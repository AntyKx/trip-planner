// Journal input bounds, shared by the server actions (authoritative) and
// the editing UI (early feedback). Lives outside actions.ts because a
// "use server" module may only export async functions.
export const MAX_PHOTOS_PER_ITEM = 30;
export const MAX_JOURNAL_TEXT_LENGTH = 10000;

// Longest trip createTrip/updateTripInfo accept — also greys out dates
// past this span in the DateRangePicker so it can't be picked at all.
export const MAX_TRIP_DAYS = 180;
