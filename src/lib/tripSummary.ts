// Figures derived from a trip's own stops, shared by the home page's
// memory blocks and the /memories page so both count things the same way.

type SummaryItem = {
  place: { id: string; photoUrl: string | null; country: string } | null;
  _count: { photos: number };
  journalText?: string | null;
};
type SummaryTrip = {
  coverImage: string | null;
  days: { items: SummaryItem[] }[];
};

function itemsOf(trip: SummaryTrip): SummaryItem[] {
  return trip.days.flatMap((d) => d.items);
}

// The trip's own cover, else the first stop that has a photo.
export function tripCover(trip: SummaryTrip): string | undefined {
  return (
    trip.coverImage ?? itemsOf(trip).find((i) => i.place?.photoUrl)?.place?.photoUrl ?? undefined
  );
}

// Distinct places — the same hotel across three nights counts once.
export function tripPlaceIds(trip: SummaryTrip): Set<string> {
  return new Set(itemsOf(trip).flatMap((i) => (i.place ? [i.place.id] : [])));
}

export function tripPhotoCount(trip: SummaryTrip): number {
  return itemsOf(trip).reduce((sum, i) => sum + i._count.photos, 0);
}

export function footprintOf(trips: SummaryTrip[]) {
  const items = trips.flatMap(itemsOf);
  return {
    countries: new Set(items.flatMap((i) => (i.place ? [i.place.country.toUpperCase()] : []))).size,
    trips: trips.length,
    places: new Set(items.flatMap((i) => (i.place ? [i.place.id] : []))).size,
    photos: items.reduce((sum, i) => sum + i._count.photos, 0),
  };
}

// Whether the 旅遊書 would have anything in it — a trip nobody wrote or
// photographed opens an empty book, so memory tiles send those to the
// trip page instead.
export function tripHasJournal(trip: SummaryTrip): boolean {
  return itemsOf(trip).some((i) => i._count.photos > 0 || Boolean(i.journalText?.trim()));
}
