/**
 * Centralized Scripture / trust-state gate.
 *
 * This is the ONE place that decides, for a persisted AI-generated record:
 *   - which entity types are Scripture-gated,
 *   - how their `scripture_validation` is (re)computed (canon-aware),
 *   - which "trust" fields only a human-review flow may ever set,
 *   - and whether a record may cross a PUBLIC / PUBLISHED / SHARED surface.
 *
 * Every exposure surface — the generic entity save gate (routes/entities.js),
 * share-link creation + serving (routes/functions.js, routes/community.js), and
 * any future route that publishes AI content — imports from here so they can
 * never drift apart. A bypass fixed in one place is fixed everywhere.
 *
 * The gate core (`gateEntityWrite`) is PURE (no req / no prisma): callers
 * resolve the denomination string (which may need a DB lookup) and pass it in.
 */

import { validateAiSermon, validateAiContent } from '@sermonsmith/shared/scripture';
import { canonForDenomination } from '@sermonsmith/shared/denominations';

// Every persisted AI-generated type that can carry Scripture references.
// `SharedContent` is included: it is the community-publish wrapper (free-text
// `content` + `content_type`) exposed publicly by /api/community/shared-content,
// so its references must be revalidated and its trust fields stripped exactly
// like any other gated type before it can go `visibility:'public'`.
export const SCRIPTURE_GATED_TYPES = new Set([
  'Sermon',
  'BibleStudy',
  'Quiz',
  'ReadingPlan',
  'EthicsAnalysis',
  'StudyNote',
  'SharedContent',
  // Community "share" COPIES of AI content. SharedSermon copies a sermon's
  // anchor_passage + points; SharedSeries copies series metadata. They exist to
  // be shown to other users, so they are inherently public (see below) — an
  // invalid reference must block them even without an explicit visibility flag.
  'SharedSermon',
  'SharedSeries',
]);

// Gated types that are public by their very existence — a shared COPY is made
// to be shown to the community, so there is no "private draft" state. For these
// an unverified reference blocks the write outright, without waiting for a
// status:'published' / visibility:'public' flag.
export const INHERENTLY_PUBLIC_TYPES = new Set(['SharedSermon', 'SharedSeries']);

// Gated types whose UI models a draft → published status lifecycle. Only these
// get the `draft → needs_review` honest relabel; others just carry the honest
// validation without inventing a status their UI can't render.
export const STATUS_WORKFLOW_TYPES = new Set(['Sermon']);

// Types that expose the human-only pastoral review acknowledgment endpoint.
export const REVIEWABLE_TYPES = new Set(['Sermon']);

// Trust-state fields that only a human review flow may ever set.
export const REVIEW_ONLY_FIELDS = [
  'pastor_reviewed',
  'ready_to_present',
  'reviewed_by',
  'reviewed_at',
  'verified',
];

// Content fields whose change invalidates a prior pastoral review (Sermon).
const CONTENT_FIELDS = ['title', 'topic', 'anchor_passage', 'big_idea', 'points', 'conclusion', 'theological_notes'];

// A record crosses a PUBLIC / SHARED surface when any of these signals is set.
// Each is a "publish" transition for gate purposes: a gated record whose
// references do not all verify must never become publicly visible or shared.
export function isPublicOrPublished(rec) {
  if (!rec || typeof rec !== 'object') return false;
  return (
    rec.status === 'published' ||
    rec.is_public === true ||
    rec.public === true ||
    rec.is_shared === true ||
    rec.shared === true ||
    rec.visibility === 'public'
  );
}

// Canon-aware validation of a record, using the sermon-shaped validator for
// sermons and the shape-agnostic deep validator for every other gated type.
export function recomputeScriptureValidation(type, record, canon) {
  return type === 'Sermon'
    ? validateAiSermon(record, { canon })
    : validateAiContent(record, { canon });
}

/**
 * Pure gate core for a create/update of a gated type. Returns a copy of
 * `incoming` with trust fields stripped, stale trust markers neutralized on the
 * merged record, `scripture_validation` recomputed, and `status` honestly
 * downgraded. Throws 422 when the record would be published OR publicly shared
 * with references that do not all verify.
 *
 * `denomination` is the already-resolved denomination string (payload → stored
 * record → user profile); the caller owns that resolution.
 */
export function gateEntityWrite({ type, incoming, existingData = null, denomination }) {
  if (!SCRIPTURE_GATED_TYPES.has(type)) return incoming;

  const data = { ...incoming };
  for (const field of REVIEW_ONLY_FIELDS) delete data[field];
  delete data.scripture_validation;

  const merged = { ...(existingData || {}), ...data };
  delete merged.scripture_validation;

  const canon = canonForDenomination(denomination || merged.denomination);
  const validation = recomputeScriptureValidation(type, merged, canon);
  data.scripture_validation = validation.refs;

  // Neutralize stale / forged trust markers on the MERGED stored record.
  // `verified`/`ready_to_present` are set by NO endpoint ever; the review
  // markers are legitimate only on a type with the human-review endpoint
  // (Sermon), whose /review flow + the stale-review rule below own them.
  const STALE_TRUST_FIELDS = REVIEWABLE_TYPES.has(type)
    ? ['verified', 'ready_to_present']
    : REVIEW_ONLY_FIELDS;
  for (const field of STALE_TRUST_FIELDS) {
    if (field in merged) data[field] = null;
  }

  const resultRecord = { ...(existingData || {}), ...data };
  const requestedStatus = data.status ?? existingData?.status;
  if (!validation.allValid) {
    if (isPublicOrPublished(resultRecord) || INHERENTLY_PUBLIC_TYPES.has(type)) {
      throw Object.assign(
        new Error(
          `Cannot publish or share: ${validation.summary}. Fix the flagged references (or keep the record private) and try again.`,
        ),
        { status: 422, scripture_validation: validation.refs },
      );
    }
    if (
      STATUS_WORKFLOW_TYPES.has(type) &&
      (requestedStatus === 'draft' || requestedStatus == null)
    ) {
      data.status = 'needs_review';
    }
  }

  // Stale-review rule (Sermon): editing content the pastor reviewed resets the
  // acknowledgment; a status-only change preserves it.
  if (existingData?.pastor_reviewed && CONTENT_FIELDS.some((f) => f in data)) {
    data.pastor_reviewed = false;
    data.reviewed_at = null;
    data.reviewed_by = null;
  }

  return data;
}

// Shared evaluator: does a stored record's CURRENT content fully verify?
// Returns { gated, validation }. Non-gated types are never gated (validation
// null). AI-generated community replies (is_ai_response) are treated as gated
// AI content even though CommunityReply is not a first-class gated entity type;
// user-authored replies are NOT gated.
function evaluateExposure(type, resourceData, denomination) {
  const data = resourceData || {};
  const isAiReply = type === 'CommunityReply' && data.is_ai_response === true;
  if (!SCRIPTURE_GATED_TYPES.has(type) && !isAiReply) {
    return { gated: false, validation: null };
  }
  const record = { ...data };
  delete record.scripture_validation;
  const canon = canonForDenomination(denomination || record.denomination);
  // Entity gated types keep their type-specific validator; AI replies (free
  // text) use the shape-agnostic deep validator.
  const validation = isAiReply
    ? validateAiContent(record, { canon })
    : recomputeScriptureValidation(type, record, canon);
  return { gated: true, validation };
}

/**
 * Exposure gate (throwing) for routes that make an EXISTING stored resource
 * publicly readable without going through the entity save gate — share-link
 * creation + serving, the moderation publish transition. Re-runs canon-aware
 * validation over the resource's CURRENT stored data and throws 422 if a gated
 * resource does not fully verify. Non-gated types pass through.
 */
export function assertGatedResourceExposable({ type, resourceData, denomination }) {
  const { gated, validation } = evaluateExposure(type, resourceData, denomination);
  if (gated && !validation.allValid) {
    throw Object.assign(
      new Error(
        `This ${type} has Scripture references that could not be verified (${validation.summary}). It cannot be shared until they are corrected.`,
      ),
      { status: 422, scripture_validation: validation.refs },
    );
  }
}

/**
 * Non-throwing companion for FEED / list routes that serve many public rows:
 * returns true when a row is safe to surface. A gated row (or an is_ai_response
 * reply) whose CURRENT stored content does not fully verify returns false, so
 * the caller can FAIL CLOSED and omit it — catching a record edited to an
 * invalid state after it was published/shared. Non-gated rows always return
 * true.
 */
export function isPublicContentServable({ type, data, denomination }) {
  const { gated, validation } = evaluateExposure(type, data, denomination);
  return !gated || validation.allValid;
}

/**
 * Create-time gate for AI-generated community content that is persisted + served
 * publicly but is not a first-class gated entity type (an is_ai_response
 * CommunityReply). Recomputes canon-aware validation over the content and throws
 * 422 if any reference does not verify; returns the validated refs to store.
 */
export function assertAiReplyExposable({ content, denomination }) {
  const record = { content };
  const canon = canonForDenomination(denomination);
  const validation = validateAiContent(record, { canon });
  if (!validation.allValid) {
    throw Object.assign(
      new Error(
        `This AI reply has Scripture references that could not be verified (${validation.summary}). It cannot be posted until they are corrected.`,
      ),
      { status: 422, scripture_validation: validation.refs },
    );
  }
  return validation.refs;
}
