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

export type PlaceReview = {
  authorName: string;
  authorPhotoUri?: string;
  rating?: number;
  text?: string;
  relativeTime: string;
};

export type PlaceDetails = {
  name: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  phoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  openNow?: boolean;
  weekdayDescriptions?: string[];
  reviews: PlaceReview[];
  photoUrl?: string;
};

export type PlaceDetailsResult =
  | { ok: true; details: PlaceDetails }
  | { ok: false; error: string };

type RawReview = {
  rating?: number;
  text?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; photoUri?: string };
};

type RawPlaceDetails = {
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  reviews?: RawReview[];
  photos?: { name: string }[];
};

// Called directly from the browser — see searchPlaces above for why.
export async function getPlaceDetails(
  placeId: string
): Promise<PlaceDetailsResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "尚未設定 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" };
  }

  const fieldMask = [
    "displayName",
    "formattedAddress",
    "rating",
    "userRatingCount",
    "nationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "regularOpeningHours",
    "reviews",
    "photos",
  ].join(",");

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
      "Accept-Language": "zh-TW",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Places API 錯誤 (${res.status})：${text.slice(0, 200)}` };
  }

  const data: RawPlaceDetails = await res.json();

  const reviews: PlaceReview[] = (data.reviews ?? []).slice(0, 5).map((r) => ({
    authorName: r.authorAttribution?.displayName ?? "匿名",
    authorPhotoUri: r.authorAttribution?.photoUri,
    rating: r.rating,
    text: r.text?.text,
    relativeTime: r.relativePublishTimeDescription ?? "",
  }));

  return {
    ok: true,
    details: {
      name: data.displayName?.text ?? "",
      address: data.formattedAddress,
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      phoneNumber: data.nationalPhoneNumber,
      websiteUri: data.websiteUri,
      googleMapsUri: data.googleMapsUri,
      openNow: data.regularOpeningHours?.openNow,
      weekdayDescriptions: data.regularOpeningHours?.weekdayDescriptions,
      reviews,
      photoUrl: data.photos?.[0]
        ? `https://places.googleapis.com/v1/${data.photos[0].name}/media?key=${apiKey}&maxWidthPx=480`
        : undefined,
    },
  };
}
