// Style B ("場景組合") empty-state illustrations — simple two-tone
// (brand blue + accent orange) scene compositions, no human figures. Picked
// over the plainer icon-only style and the more elaborate character-
// illustration style after a live side-by-side review (see the
// empty-state-and-modal-motion-review artifact, 2026-07-13).

export function NoTripsIllustration() {
  return (
    <svg width="110" height="96" viewBox="0 0 110 96" fill="none" aria-hidden="true">
      <path
        d="M8 70 Q40 20 74 34 T104 26"
        stroke="var(--color-accent-500)"
        strokeWidth="2"
        strokeDasharray="3 6"
        fill="none"
      />
      <circle cx="8" cy="70" r="3" fill="var(--color-accent-500)" />
      <circle cx="104" cy="26" r="3" fill="var(--color-accent-500)" />
      <rect
        x="34"
        y="46"
        width="34"
        height="26"
        rx="4"
        fill="var(--color-brand-100)"
        stroke="var(--color-brand-400)"
        strokeWidth="2"
      />
      <path
        d="M44 46v-6a7 7 0 0 1 14 0v6"
        stroke="var(--color-brand-400)"
        strokeWidth="2"
        fill="none"
      />
      <rect x="44" y="54" width="14" height="4" rx="2" fill="var(--color-brand-400)" />
      <rect x="56" y="40" width="8" height="6" rx="1.5" fill="var(--color-accent-500)" />
    </svg>
  );
}

export function NoChecklistItemsIllustration() {
  return (
    <svg width="100" height="88" viewBox="0 0 100 88" fill="none" aria-hidden="true">
      <rect
        x="10"
        y="10"
        width="70"
        height="68"
        rx="8"
        fill="var(--color-surface)"
        stroke="var(--color-brand-300)"
        strokeWidth="2.5"
      />
      <rect x="22" y="26" width="12" height="12" rx="3" stroke="var(--color-brand-400)" strokeWidth="2" fill="none" />
      <line x1="40" y1="32" x2="66" y2="32" stroke="var(--color-ink-400)" strokeWidth="3" strokeLinecap="round" />
      <rect x="22" y="46" width="12" height="12" rx="3" stroke="var(--color-brand-400)" strokeWidth="2" fill="none" />
      <line x1="40" y1="52" x2="60" y2="52" stroke="var(--color-ink-400)" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 60l14 14M84 60 70 74" stroke="var(--color-accent-500)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function NoFavoritesIllustration() {
  return (
    <svg width="104" height="92" viewBox="0 0 104 92" fill="none" aria-hidden="true">
      <rect
        x="14"
        y="26"
        width="60"
        height="46"
        rx="6"
        fill="var(--color-brand-100)"
        stroke="var(--color-brand-400)"
        strokeWidth="2"
      />
      <circle cx="30" cy="42" r="6" fill="var(--color-brand-300)" />
      <path d="M20 62l12-10 10 8 14-14 12 12" stroke="var(--color-brand-400)" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path
        d="M78 24c-4-4-10-2-10 3 0 4 6 9 10 12 4-3 10-8 10-12 0-5-6-7-10-3z"
        stroke="var(--color-accent-500)"
        strokeWidth="2.5"
        fill="var(--color-accent-100)"
      />
      <path d="M8 20l3 3M6 30h4" stroke="var(--color-accent-500)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function NoSearchResultsIllustration() {
  return (
    <svg width="104" height="96" viewBox="0 0 104 96" fill="none" aria-hidden="true">
      <circle cx="40" cy="46" r="4" fill="var(--color-brand-200)" />
      <circle cx="58" cy="60" r="4" fill="var(--color-brand-200)" />
      <circle cx="66" cy="34" r="4" fill="var(--color-brand-200)" />
      <path
        d="M40 46q10 4 18-6M58 60q-6-8 8-26"
        stroke="var(--color-brand-200)"
        strokeWidth="2"
        strokeDasharray="2 5"
        fill="none"
      />
      <circle cx="46" cy="46" r="20" stroke="var(--color-brand-500)" strokeWidth="3.5" fill="var(--color-surface)" />
      <line x1="61" y1="61" x2="76" y2="76" stroke="var(--color-brand-500)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="46" cy="46" r="6" fill="var(--color-accent-500)" />
    </svg>
  );
}

export function NoItemsTodayIllustration() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="46" cy="40" r="26" stroke="var(--color-brand-400)" strokeWidth="3" fill="var(--color-brand-50)" />
      <path d="M46 24v16l12 8" stroke="var(--color-brand-500)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M46 14v4M46 62v4M14 40h4M74 40h4" stroke="var(--color-brand-300)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="46" cy="40" r="3" fill="var(--color-accent-500)" />
      <circle cx="20" cy="82" r="3" stroke="var(--color-brand-200)" strokeWidth="2" fill="none" strokeDasharray="1 4" />
      <circle cx="46" cy="86" r="3" stroke="var(--color-brand-200)" strokeWidth="2" fill="none" strokeDasharray="1 4" />
      <circle cx="72" cy="82" r="3" stroke="var(--color-brand-200)" strokeWidth="2" fill="none" strokeDasharray="1 4" />
      <line x1="20" y1="82" x2="46" y2="86" stroke="var(--color-brand-200)" strokeWidth="1.5" strokeDasharray="2 4" />
      <line x1="46" y1="86" x2="72" y2="82" stroke="var(--color-brand-200)" strokeWidth="1.5" strokeDasharray="2 4" />
    </svg>
  );
}
