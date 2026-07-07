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
  // Without this, station/line names in transit results (and anything
  // else Google returns through the JS SDK — DirectionsService, the map
  // itself) follow whatever language the browser happens to be set to,
  // which is why transit names weren't reliably showing in Chinese. Place
  // search (searchPlaces/getPlaceDetails) is unaffected — those hit the
  // Places API (New) REST endpoint directly with their own languageCode,
  // not through this script.
  return (
    <APIProvider apiKey={apiKey} language="zh-TW">
      {children}
    </APIProvider>
  );
}
