import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // A fresh value baked into the client bundle every time `next build`
    // runs — used by UpdateChecker to detect a new deployment without
    // needing a service worker.
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
