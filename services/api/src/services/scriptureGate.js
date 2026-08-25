/**
 * Centralized Scripture integrity gate.
 *
 * This is the ONE place that decides, for a persisted AI-generated record:
 *   - which entity types are Scripture-gated,
 *   - how their `scripture_validation` is (re)computed (canon-aware),
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

// Fields written by the retired attestation workflow. Clients cannot restore
// them, and touching an older record removes them from the persisted JSON.
// Publishing remains an explicit owner action; only Scripture-reference
// integrity is enforced automatically.
export const LEGACY_ATTESTATION_FIELDS = [
  'pastor_reviewed',
  'ready_to_present',
  'reviewed_by',
  'reviewed_at',
  'review_checklist',
  'review_checklist_version',
  'verified',
];

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
 * the merged record with retired attestation fields removed and
 * `scripture_validation` recomputed. Throws 422 when the record would be
 * published OR publicly shared with references that do not all verify.
 *
 * `denomination` is the already-resolved denomination string (payload → stored
 * record → user profile); the caller owns that resolution.
 */
export function gateEntityWrite({ type, incoming, existingData = null, denomination }) {
  if (!SCRIPTURE_GATED_TYPES.has(type)) return incoming;

  const data = { ...(existingData || {}), ...incoming };
  for (const field of LEGACY_ATTESTATION_FIELDS) delete data[field];
  delete data.scripture_validation;
  // Provider wording verification is recomputed on the entities save path —
  // never trust a client-supplied blob (same rule as scripture_validation).
  delete data.wording_verification;
  delete data.quotation_verification;

  // Older rows may still contain the retired workflow status. Normalize it as
  // they are edited so no approval-style state can survive a normal save.
  if (data.status === 'needs_review') data.status = 'draft';

  const canon = canonForDenomination(denomination || data.denomination);
  const validation = recomputeScriptureValidation(type, data, canon);
  data.scripture_validation = validation.refs;
  if (!validation.allValid) {
    if (isPublicOrPublished(data) || INHERENTLY_PUBLIC_TYPES.has(type)) {
      throw Object.assign(
        new Error(
          `Cannot publish or share: ${validation.summary}. Fix the flagged references (or keep the record private) and try again.`,
        ),
        { status: 422, scripture_validation: validation.refs },
      );
    }
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
