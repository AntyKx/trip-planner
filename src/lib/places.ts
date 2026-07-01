export type PlaceResult = {
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  priceLevel?: number;
  category: string;
  photoUrl?: string;
};

export type SearchPlacesResult =
  | { ok: true; results: PlaceResult[] }
  | { ok: false; error: string };

type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text?: string };
  photos?: { name: string }[];
};

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Called directly from the browser so the request carries the page's
// Referer header — required because the API key is HTTP-referrer restricted.
export async function searchPlaces(
  query: string,
  country: "TW" | "JP"
): Promise<SearchPlacesResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "尚未設定 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.photos",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "zh-TW",
      regionCode: country,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Places API 錯誤 (${res.status})：${text.slice(0, 200)}` };
  }

  const data: { places?: RawPlace[] } = await res.json();

  const results: PlaceResult[] = (data.places ?? []).map((p) => ({
    externalId: p.id,
    name: p.displayName?.text ?? "未命名",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating: p.rating,
    priceLevel: p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] : undefined,
    category: p.primaryTypeDisplayName?.text ?? "",
    photoUrl: p.photos?.[0]
      ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?key=${apiKey}&maxWidthPx=480`
      : undefined,
  }));

  return { ok: true, results };
}
