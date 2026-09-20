// Client-side downscale + re-encode before uploading to Blob. Phone photos
// are routinely 3-10MB; the journal only ever shows them in small grids and
// a lightbox, so shipping originals made both upload and viewing slow.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

// Never throws: any failure (unsupported format, no canvas, OOM on a huge
// image) falls back to the original file so the upload still goes through.
export async function compressImage(file: File): Promise<File> {
  // GIFs would lose their animation; tiny files aren't worth re-encoding.
  if (file.type === "image/gif" || file.size < 200 * 1024) return file;
  try {
    // "from-image" applies EXIF rotation, which canvas re-encoding would
    // otherwise drop (photos coming out sideways).
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // JPEG has no alpha — transparent PNG areas would turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
