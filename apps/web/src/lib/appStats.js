// Single source of truth for the user-facing "catalogue size" numbers in
// marketing copy. Recurring QA finding: the homepage said "100+ translations /
// 50+ worldviews" while the Reader showed "121 translations • 69 languages" and
// Worldview Explorer showed "59 Systems" — three places drifting apart. Import
// these everywhere static copy cites a count so they can never disagree again.
//
// Labels are intentionally conservative ("at least this many"); the live
// translation catalogue is fetched at runtime and may show the exact number.

// Must equal BELIEF_SYSTEMS.length in WorldviewExplorer (asserted there in dev).
export const WORLDVIEW_COUNT = 59;

export const WORLDVIEWS_LABEL = `${WORLDVIEW_COUNT}`;
export const TRANSLATIONS_LABEL = '120+'; // live catalogue: 121 (8 free + getBible)
export const LANGUAGES_LABEL = '60+';     // live catalogue: ~69 languages
