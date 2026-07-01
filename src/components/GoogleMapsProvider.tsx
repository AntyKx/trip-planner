"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import type { ReactNode } from "react";

export default function GoogleMapsProvider({
  apiKey,
  children,
}: {
  apiKey?: string;
  children: ReactNode;
}) {
  if (!apiKey) return <>{children}</>;
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>;
}
