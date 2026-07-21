import { parseOpeningPeriods, type RawPeriod } from "./businessHours";

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
  suggestedType: "PLACE" | "RESTAURANT";
  // Derived from Google's own address data for *this* result (not from
  // whatever the search form's region selector happens to be set to) —
  // carried on the result itself so favoriting/adding a place works
  // correctly even from "我的收藏", where the selector's current value has
  // nothing to do with where that favorite actually is. A 2-letter ISO
  // code (e.g. "JP", "FR", "KR"), or "" if Google didn't return one.
  country: string;
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
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  photos?: { name: string }[];
  addressComponents?: { shortText?: string; types?: string[] }[];
};

function countryFromAddressComponents(
  components: RawPlace["addressComponents"]
): string {
  const country = components?.find((c) => c.types?.includes("country"));
  return country?.shortText ?? "";
}

// Places API (New) "Table A" food & drink types — see
// https://developers.google.com/maps/documentation/places/web-service/place-types
const FOOD_AND_DRINK_TYPES = new Set([
  "acai_shop", "afghani_restaurant", "african_restaurant", "american_restaurant",
  "argentinian_restaurant", "asian_fusion_restaurant", "asian_restaurant",
  "australian_restaurant", "austrian_restaurant", "bagel_shop", "bakery",
  "bangladeshi_restaurant", "bar", "bar_and_grill", "barbecue_restaurant",
  "basque_restaurant", "bavarian_restaurant", "beer_garden", "belgian_restaurant",
  "bistro", "brazilian_restaurant", "breakfast_restaurant", "brewery", "brewpub",
  "british_restaurant", "brunch_restaurant", "buffet_restaurant", "burmese_restaurant",
  "burrito_restaurant", "cafe", "cafeteria", "cajun_restaurant", "cake_shop",
  "californian_restaurant", "cambodian_restaurant", "candy_store", "cantonese_restaurant",
  "caribbean_restaurant", "cat_cafe", "chicken_restaurant", "chicken_wings_restaurant",
  "chilean_restaurant", "chinese_noodle_restaurant", "chinese_restaurant",
  "chocolate_factory", "chocolate_shop", "cocktail_bar", "coffee_roastery",
  "coffee_shop", "coffee_stand", "colombian_restaurant", "confectionery",
  "croatian_restaurant", "cuban_restaurant", "czech_restaurant", "danish_restaurant",
  "deli", "dessert_restaurant", "dessert_shop", "dim_sum_restaurant", "diner",
  "dog_cafe", "donut_shop", "dumpling_restaurant", "dutch_restaurant",
  "eastern_european_restaurant", "ethiopian_restaurant", "european_restaurant",
  "falafel_restaurant", "family_restaurant", "fast_food_restaurant",
  "filipino_restaurant", "fine_dining_restaurant", "fish_and_chips_restaurant",
  "fondue_restaurant", "food_court", "french_restaurant", "fusion_restaurant",
  "gastropub", "german_restaurant", "greek_restaurant", "gyro_restaurant",
  "halal_restaurant", "hamburger_restaurant", "hawaiian_restaurant", "hookah_bar",
  "hot_dog_restaurant", "hot_dog_stand", "hot_pot_restaurant", "hungarian_restaurant",
  "ice_cream_shop", "indian_restaurant", "indonesian_restaurant", "irish_pub",
  "irish_restaurant", "israeli_restaurant", "italian_restaurant",
  "japanese_curry_restaurant", "japanese_izakaya_restaurant", "japanese_restaurant",
  "juice_shop", "kebab_shop", "korean_barbecue_restaurant", "korean_restaurant",
  "latin_american_restaurant", "lebanese_restaurant", "lounge_bar",
  "malaysian_restaurant", "meal_delivery", "meal_takeaway", "mediterranean_restaurant",
  "mexican_restaurant", "middle_eastern_restaurant", "mongolian_barbecue_restaurant",
  "moroccan_restaurant", "noodle_shop", "north_indian_restaurant",
  "oyster_bar_restaurant", "pakistani_restaurant", "pastry_shop", "persian_restaurant",
  "peruvian_restaurant", "pizza_delivery", "pizza_restaurant", "polish_restaurant",
  "portuguese_restaurant", "pub", "ramen_restaurant", "restaurant",
  "romanian_restaurant", "russian_restaurant", "salad_shop", "sandwich_shop",
  "scandinavian_restaurant", "seafood_restaurant", "shawarma_restaurant",
  "snack_bar", "soul_food_restaurant", "soup_restaurant", "south_american_restaurant",
  "south_indian_restaurant", "southwestern_us_restaurant", "spanish_restaurant",
  "sports_bar", "sri_lankan_restaurant", "steak_house", "sushi_restaurant",
  "swiss_restaurant", "taco_restaurant", "taiwanese_restaurant", "tapas_restaurant",
  "tea_house", "tex_mex_restaurant", "thai_restaurant", "tibetan_restaurant",
  "tonkatsu_restaurant", "turkish_restaurant", "ukrainian_restaurant",
  "vegan_restaurant", "vegetarian_restaurant", "vietnamese_restaurant",
  "western_restaurant", "wine_bar", "winery", "yakiniku_restaurant",
  "yakitori_restaurant",
]);

function suggestTypeFromPrimaryType(primaryType?: string): "PLACE" | "RESTAURANT" {
  if (primaryType && FOOD_AND_DRINK_TYPES.has(primaryType)) return "RESTAURANT";
  return "PLACE";
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// `regionCode` in a Text Search request only *biases* ranking/formatting —
// per Google's docs it's "a signal, not a restriction," which is why
// switching JP/TW visibly changed nothing. A rectangle passed as
// `locationRestriction` is an actual hard filter, so this is what makes
// the country picker do anything at all. Generous boxes (a little wider
// than each country's real bounds) so border/island places aren't
// accidentally excluded.
const COUNTRY_BOUNDS: Record<
  "TW" | "JP",
  { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }
> = {
  TW: { low: { latitude: 21.5, longitude: 119.3 }, high: { latitude: 25.5, longitude: 122.3 } },
  JP: { low: { latitude: 24.0, longitude: 122.0 }, high: { latitude: 46.0, longitude: 146.5 } },
};

// JP/TW keep the precise rectangle restriction (a real hard filter, see
// COUNTRY_BOUNDS above). Any other region is free text (e.g. "法國",
// "Paris") — there's no bounding box for it, so it's appended straight into
// the text query and left to Google's own text understanding, same as
// typing "拉麵 東京" into normal Google Maps search would work today.
function isPresetRegion(region: string): region is "TW" | "JP" {
  return region === "TW" || region === "JP";
}

// Called directly from the browser so the request carries the page's
// Referer header — required because the API key is HTTP-referrer restricted.
export async function searchPlaces(
  query: string,
  region: string
): Promise<SearchPlacesResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "尚未設定 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" };
  }

  const trimmedRegion = region.trim();
  const upperRegion = trimmedRegion.toUpperCase();
  const preset = isPresetRegion(upperRegion) ? upperRegion : null;

  const body: Record<string, unknown> = {
    textQuery: preset || !trimmedRegion ? query : `${query} ${trimmedRegion}`,
    languageCode: "zh-TW",
    // Explicit rather than relying on whatever Google's default happens
    // to be — 20 is the documented max per request for Text Search (New).
    pageSize: 20,
  };
  if (preset) {
    body.regionCode = preset;
    body.locationRestriction = { rectangle: COUNTRY_BOUNDS[preset] };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.primaryType,places.primaryTypeDisplayName,places.photos,places.addressComponents",
    },
    body: JSON.stringify(body),
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
    suggestedType: suggestTypeFromPrimaryType(p.primaryType),
    country: countryFromAddressComponents(p.addressComponents) || preset || "",
    // 300px, not 480 — this URL is what gets stored as Place.photoUrl, and
    // its most common uses are small (search-result thumb ~72px,
    // DayTimeline card thumb ~80-112px); it's occasionally also the
    // fallback trip-cover image when no cover was set, where 300px is a
    // reasonable middle ground rather than optimizing purely for the
    // common small case.
    photoUrl: p.photos?.[0]
      ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?key=${apiKey}&maxWidthPx=300`
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
  // Structured periods (see src/lib/businessHours.ts), pre-serialized to
  // JSON so callers can drop it straight into Place.openHours without
  // caring about the parsing — this is what makes the add-time "closed
  // this day" check and the item card's time-range check possible.
  openHoursJson?: string;
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
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
    periods?: RawPeriod[];
  };
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
      openHoursJson: data.regularOpeningHours?.periods
        ? JSON.stringify(parseOpeningPeriods(data.regularOpeningHours.periods))
        : undefined,
      reviews,
      photoUrl: data.photos?.[0]
        ? `https://places.googleapis.com/v1/${data.photos[0].name}/media?key=${apiKey}&maxWidthPx=480`
        : undefined,
    },
  };
}
