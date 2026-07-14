import type { NextConfig } from "next";

// Human-readable build stamp (YYYYMMDD-HHmmss, local build machine time),
// baked into the client bundle every time `next build` runs — used by
// UpdateChecker to detect a new deployment without needing a service
// worker, and shown in the UI so the user can visually confirm a deploy
// landed without asking.
function buildStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildStamp(),
  },
  // Default is 1MB. Raised for the booking-confirmation screenshot
  // recognition action (src/app/trips/aiActions.ts), which passes a
  // base64-encoded image straight through as a Server Action argument
  // instead of uploading to Blob first.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
