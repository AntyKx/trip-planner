// One-off script to generate PWA icons. Run with: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

const TEAL = "#0d9488";
const PIN_PATH =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z";

function iconSvg({ size, cornerRadius, padding }) {
  const inner = size - padding * 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${TEAL}"/>
      <svg x="${padding}" y="${padding}" width="${inner}" height="${inner}" viewBox="0 0 24 24">
        <path d="${PIN_PATH}" fill="white"/>
      </svg>
    </svg>
  `;
}

mkdirSync("public/icons", { recursive: true });

const jobs = [
  // Regular manifest icons — rounded corners, modest padding.
  { file: "public/icons/icon-192.png", size: 192, cornerRadius: 36, padding: 36 },
  { file: "public/icons/icon-512.png", size: 512, cornerRadius: 96, padding: 96 },
  // Maskable icon — full-bleed background, icon kept in the safe zone
  // since Android may crop to a circle/squircle.
  { file: "public/icons/icon-maskable-512.png", size: 512, cornerRadius: 0, padding: 128 },
  // Apple touch icon — iOS applies its own rounding, so no corner radius.
  { file: "public/icons/apple-touch-icon.png", size: 180, cornerRadius: 0, padding: 34 },
];

for (const job of jobs) {
  const svg = iconSvg(job);
  await sharp(Buffer.from(svg)).png().toFile(job.file);
  console.log("wrote", job.file);
}
