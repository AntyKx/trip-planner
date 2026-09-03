import { put } from "@vercel/blob";
import { isOwnBlobUrl } from "./blob";

// Google's Places API (New) enforces the API key's HTTP-referrer allowlist
// even on server-side requests — a fetch with no Referer header (or one
// that isn't on the allowlist) gets a 403 API_KEY_HTTP_REFERRER_BLOCKED
// before it even gets to check whether the photo itself is valid. This is
// the production domain, already allowlisted for the client-side
// searchPlaces/getPlaceDetails calls in src/lib/places.ts.
const PLACES_PHOTO_REFERER = "https://trip-planner-flax-ten.vercel.app/";

// Places photo reference tokens embedded in `photos[].name` are NOT
// permanent — despite looking like an opaque long-lived id, they've been
// observed expiring within days, at which point the media endpoint starts
// 400ing "The photo resource in the request is invalid" and the image
// silently disappears everywhere it's used (trip cards, timeline, map).
// Downloading the bytes once and re-hosting on Blob (same approach as the
// hardcoded login/welcome hero photos, see git history) is what makes the
// stored URL permanent instead of a ticking time bomb. Called wherever a
// Place row is first written from client-supplied search-result data
// (addPlaceToDay/setDayAnchor in trips/actions.ts, addFavorite in
// explore/actions.ts) — never called for URLs already on our own Blob
// store, so re-adding an already-migrated place is a no-op.
export async function persistPlacePhoto(
  photoUrl: string | null | undefined
): Promise<string | undefined> {
  if (!photoUrl) return undefined;
  if (isOwnBlobUrl(photoUrl)) return photoUrl;
  if (!photoUrl.startsWith("https://places.googleapis.com/")) return photoUrl;

  try {
    const res = await fetch(photoUrl, {
      headers: { Referer: PLACES_PHOTO_REFERER },
    });
    // A dead reference (already expired between the client fetching the
    // search result and the server processing the add) — drop it rather
    // than store a URL we already know is broken. ImgWithFallback handles
    // a missing photoUrl gracefully.
    if (!res.ok) return undefined;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const bytes = await res.arrayBuffer();

    const uploaded = await put(`place-photos/${crypto.randomUUID()}.${ext}`, Buffer.from(bytes), {
      access: "public",
      contentType,
    });
    return uploaded.url;
  } catch {
    return undefined;
  }
}
