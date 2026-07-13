import { describe, it, expect } from "vitest";
import { isOwnBlobUrl } from "./blob";

describe("isOwnBlobUrl", () => {
  it("accepts a Vercel Blob store URL", () => {
    expect(
      isOwnBlobUrl(
        "https://a9xyigfuupqgvmso.public.blob.vercel-storage.com/photo-abc123.png"
      )
    ).toBe(true);
  });

  it("rejects arbitrary external hosts", () => {
    expect(isOwnBlobUrl("https://evil.example.com/photo.png")).toBe(false);
    expect(isOwnBlobUrl("https://places.googleapis.com/v1/places/x/photos/y/media")).toBe(false);
  });

  it("rejects hosts that merely embed the blob suffix", () => {
    // The suffix must terminate the hostname, not appear mid-string.
    expect(
      isOwnBlobUrl("https://x.public.blob.vercel-storage.com.evil.com/photo.png")
    ).toBe(false);
  });

  it("rejects non-https schemes", () => {
    expect(
      isOwnBlobUrl("http://a.public.blob.vercel-storage.com/photo.png")
    ).toBe(false);
    expect(isOwnBlobUrl("javascript:alert(1)")).toBe(false);
    expect(isOwnBlobUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("rejects unparseable strings", () => {
    expect(isOwnBlobUrl("not a url")).toBe(false);
    expect(isOwnBlobUrl("")).toBe(false);
  });
});
