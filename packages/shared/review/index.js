export const PASTORAL_REVIEW_CHECKLIST_VERSION = 1;

export const PASTORAL_REVIEW_ITEMS = Object.freeze([
  Object.freeze({
    id: 'scripture_in_context',
    label: 'Scripture in context',
    description: 'I checked each passage in its literary and historical context, including every warning shown above.',
  }),
  Object.freeze({
    id: 'theological_claims',
    label: 'Theological claims',
    description: 'I evaluated the sermon’s claims against Scripture and the convictions of my congregation.',
  }),
  Object.freeze({
    id: 'illustrations_and_facts',
    label: 'Illustrations and facts',
    description: 'I verified quotations, stories, statistics, and other factual claims before repeating them.',
  }),
  Object.freeze({
    id: 'pastoral_application',
    label: 'Pastoral application',
    description: 'I reviewed the applications for clarity, care, and the real needs of the people who will hear them.',
  }),
]);

export const PASTORAL_REVIEW_ITEM_IDS = Object.freeze(
  PASTORAL_REVIEW_ITEMS.map(({ id }) => id),
);

export function normalizePastoralReviewChecklist(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(PASTORAL_REVIEW_ITEM_IDS);
  return [...new Set(value.filter((item) => typeof item === 'string' && allowed.has(item)))];
}

export function missingPastoralReviewItems(value) {
  const completed = new Set(normalizePastoralReviewChecklist(value));
  return PASTORAL_REVIEW_ITEM_IDS.filter((id) => !completed.has(id));
}

export function isPastoralReviewChecklistComplete(value) {
  return missingPastoralReviewItems(value).length === 0;
}
