// One-time backfill: downscale/re-encode existing journal photos (ItemPhoto)
// the same way new uploads are now compressed client-side (see
// src/lib/compressImage.ts) — long edge 1600px, JPEG q82.
//
// Per photo, in this order, so a failure at any step never leaves a broken
// image: download -> compress -> upload NEW blob -> update the DB row (only
// if its url is still the old one) -> only then delete the OLD blob. Photos
// already small enough (or that wouldn't get smaller) are skipped, so
// re-running is safe and only picks up what's left.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/compress-item-photos.ts --dry-run
//   npx tsx --env-file=.env.local scripts/compress-item-photos.ts
import { PrismaClient } from "@prisma/client";
import { put, del } from "@vercel/blob";
import sharp from "sharp";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;
// Below this a re-encode isn't worth the churn.
const SKIP_UNDER_BYTES = 300 * 1024;
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

const fmt = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

async function main() {
  const photos = await prisma.itemPhoto.findMany({
    select: { id: true, url: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${dryRun ? "[dry-run] " : ""}journal photos: ${photos.length}`);

  let before = 0;
  let after = 0;
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    try {
      if (!new URL(photo.url).hostname.endsWith(BLOB_HOST_SUFFIX)) {
        skipped++;
        continue;
      }
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const original = Buffer.from(await res.arrayBuffer());
      if (original.length < SKIP_UNDER_BYTES) {
        skipped++;
        continue;
      }

      // rotate() with no args applies EXIF orientation, which re-encoding
      // would otherwise drop.
      const compressed = await sharp(original)
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      // Already-compressed photos re-encode to ~the same size; not worth a swap.
      if (compressed.length > original.length * 0.9) {
        skipped++;
        continue;
      }

      before += original.length;
      after += compressed.length;
      console.log(`${photo.id}: ${fmt(original.length)} -> ${fmt(compressed.length)}`);
      if (dryRun) {
        converted++;
        continue;
      }

      const blob = await put(`journal-${photo.id}.jpg`, compressed, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: true,
      });
      // Scoped to the old url: if the row changed since we read it (user
      // deleted/replaced it meanwhile), leave it alone and drop our copy.
      const updated = await prisma.itemPhoto.updateMany({
        where: { id: photo.id, url: photo.url },
        data: { url: blob.url },
      });
      if (updated.count === 0) {
        await del(blob.url);
        console.log(`  row changed meanwhile, skipped ${photo.id}`);
        continue;
      }
      try {
        await del(photo.url);
      } catch {
        console.log(`  old blob not deleted (leaked): ${photo.url}`);
      }
      converted++;
    } catch (err) {
      failed++;
      console.log(`${photo.id}: FAILED ${(err as Error).message}`);
    }
  }

  console.log(
    `\n${dryRun ? "[dry-run] would convert" : "converted"}: ${converted}, skipped: ${skipped}, failed: ${failed}`,
  );
  console.log(`size: ${fmt(before)} -> ${fmt(after)}`);
}

main().finally(() => prisma.$disconnect());
