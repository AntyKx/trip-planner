// Journal input bounds, shared by the server actions (authoritative) and
// the editing UI (early feedback). Lives outside actions.ts because a
// "use server" module may only export async functions.
export const MAX_PHOTOS_PER_ITEM = 20;
export const MAX_JOURNAL_TEXT_LENGTH = 10000;
