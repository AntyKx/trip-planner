import { del } from "@vercel/blob";

// Every Vercel Blob store serves from <store-id>.public.blob.vercel-storage.com.
// Matching on the suffix (rather than pinning this project's exact store id)
// keeps this from breaking if the store is ever recreated; del() below can
// only ever touch blobs owned by this project's token anyway, so a URL from
// some other store just no-ops there.
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isOwnBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

// Best-effort cleanup of blob files whose DB references were just removed —
// called AFTER the DB write succeeds, never before: a leaked blob (storage
// cost) is strictly better than a dangling DB reference (broken image), so
// deletion failures are swallowed rather than failing the user-visible
// action. Non-blob URLs (Google place photos, pasted external links) are
// filtered out rather than sent to del().
export async function deleteBlobsQuietly(urls: (string | null | undefined)[]) {
  const targets = urls.filter((url): url is string => !!url && isOwnBlobUrl(url));
  if (targets.length === 0) return;
  try {
    await del(targets);
  } catch {
    // Leaked blob — acceptable; see above.
  }
}
