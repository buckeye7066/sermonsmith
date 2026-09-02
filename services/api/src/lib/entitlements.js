export const ACCOUNT_TIERS = Object.freeze({
  FREE: 'free',
  PREMIUM: 'premium',
});

export const ENTITLEMENTS = Object.freeze({
  BIBLE_READER: 'bible_reader',
  CORE_AI: 'core_ai',
  PERSONAL_LIBRARY: 'personal_library',
  COMMUNITY: 'community',
  PREMIUM_TRANSLATIONS: 'premium_translations',
  MULTI_PERSPECTIVE_STUDY: 'multi_perspective_study',
  SERMON_ADAPTATION: 'sermon_adaptation',
  WORLDVIEW: 'worldview',
  ETHICS: 'ethics',
  EXPORTS: 'exports',
  BIBLE_MAPS: 'bible_maps',
  ADVANCED_STUDY: 'advanced_study',
  COLLABORATION: 'collaboration',
  IMAGE_GENERATION: 'image_generation',
});

const FREE_ENTITLEMENTS = Object.freeze([
  ENTITLEMENTS.BIBLE_READER,
  ENTITLEMENTS.CORE_AI,
  ENTITLEMENTS.PERSONAL_LIBRARY,
]);

const PREMIUM_ENTITLEMENTS = Object.freeze([
  ...FREE_ENTITLEMENTS,
  ENTITLEMENTS.COMMUNITY,
  ENTITLEMENTS.PREMIUM_TRANSLATIONS,
  ENTITLEMENTS.MULTI_PERSPECTIVE_STUDY,
  ENTITLEMENTS.SERMON_ADAPTATION,
  ENTITLEMENTS.WORLDVIEW,
  ENTITLEMENTS.ETHICS,
  ENTITLEMENTS.EXPORTS,
  ENTITLEMENTS.BIBLE_MAPS,
  ENTITLEMENTS.ADVANCED_STUDY,
  ENTITLEMENTS.COLLABORATION,
  ENTITLEMENTS.IMAGE_GENERATION,
]);

// Keep the owner's explicitly authorized promotional accounts working. These
// identifiers existed in the client before server-side entitlement enforcement;
// recognizing them here prevents the UI from promising Premium while the API
// denies the same request. New time-limited promotions should use premium_until
// (the existing seven-day/month grant flow), which expires automatically.
const PROMOTIONAL_EMAILS = new Set([
  'buckeye7066@gmail.com',
  'anyawhite@rocketmail.com',
  'whiterobert1201@icloud.com',
  'tishka1201@icloud.com',
]);

const PROMOTIONAL_PHONES = new Set([
  '9319981779',
  '19319981779',
]);

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function hasPromotionalAccess(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  // IMPORTANT: profile.phone is self-service data and therefore can never be
  // an authorization input. promotionalPhone is a dedicated User column that
  // only an admin can assign. This preserves the owner's phone allowlist
  // without letting a caller copy an allowlisted number into PATCH /auth/me.
  const phone = normalizePhone(user?.promotionalPhone);
  return (email && PROMOTIONAL_EMAILS.has(email))
    || (phone && PROMOTIONAL_PHONES.has(phone));
}

export function accountTierFor(user, now = new Date()) {
  if (!user) return ACCOUNT_TIERS.FREE;
  if (user.role === 'admin' || user.role === 'dev') return ACCOUNT_TIERS.PREMIUM;
  if (user.premium === true || hasPromotionalAccess(user)) return ACCOUNT_TIERS.PREMIUM;

  if (user.premium_until) {
    const until = new Date(user.premium_until);
    if (!Number.isNaN(until.getTime()) && until > now) return ACCOUNT_TIERS.PREMIUM;
  }

  return ACCOUNT_TIERS.FREE;
}

export function entitlementsFor(userOrTier) {
  const tier = typeof userOrTier === 'string' ? userOrTier : accountTierFor(userOrTier);
  return [...(tier === ACCOUNT_TIERS.PREMIUM ? PREMIUM_ENTITLEMENTS : FREE_ENTITLEMENTS)];
}

export function accessSummaryFor(user) {
  const subscription_tier = accountTierFor(user);
  return {
    subscription_tier,
    entitlements: entitlementsFor(subscription_tier),
  };
}

export function requestHasEntitlement(req, entitlement) {
  if (req?.userRole === 'admin' || req?.userRole === 'dev') return true;
  if (Array.isArray(req?.entitlements)) return req.entitlements.includes(entitlement);
  // Compatibility for route tests and rolling deploys where the authentication
  // middleware has not yet attached the explicit entitlement array.
  if (FREE_ENTITLEMENTS.includes(entitlement)) return Boolean(req?.userId);
  return req?.userPremium === true;
}

// Every public text-generation workflow has an explicit server-side scope.
// There is no implicit "unlabelled means free" fallback: unknown/omitted ids
// are rejected by the AI route, and the experimental general scope is
// Premium-only. Core workflows remain available to the free tier as advertised.
const AI_FEATURE_ENTITLEMENTS = new Map([
  ['sermon', ENTITLEMENTS.CORE_AI],
  ['sermon_helper', ENTITLEMENTS.CORE_AI],
  ['sermon_series', ENTITLEMENTS.CORE_AI],
  ['sermon_outline', ENTITLEMENTS.CORE_AI],
  ['bible_maps', ENTITLEMENTS.BIBLE_MAPS],
  ['bible_study', ENTITLEMENTS.CORE_AI],
  ['community', ENTITLEMENTS.COMMUNITY],
  ['ethics', ENTITLEMENTS.ETHICS],
  ['exegesis', ENTITLEMENTS.CORE_AI],
  ['general', ENTITLEMENTS.ADVANCED_STUDY],
  ['library', ENTITLEMENTS.CORE_AI],
  ['multi_perspective_study', ENTITLEMENTS.MULTI_PERSPECTIVE_STUDY],
  ['plan_adaptation', ENTITLEMENTS.ADVANCED_STUDY],
  ['prayer', ENTITLEMENTS.CORE_AI],
  ['presentation', ENTITLEMENTS.CORE_AI],
  ['quiz', ENTITLEMENTS.CORE_AI],
  ['reader_insight', ENTITLEMENTS.CORE_AI],
  ['sermon_adaptation', ENTITLEMENTS.SERMON_ADAPTATION],
  ['study_plan', ENTITLEMENTS.CORE_AI],
  ['support', ENTITLEMENTS.CORE_AI],
  ['thematic_linker', ENTITLEMENTS.CORE_AI],
  ['worldview', ENTITLEMENTS.WORLDVIEW],
]);

export function entitlementForAiFeature(feature) {
  return AI_FEATURE_ENTITLEMENTS.get(String(feature || '').trim().toLowerCase()) || null;
}

const PREMIUM_ENTITY_TYPES = new Map([
  ['CommunityPost', ENTITLEMENTS.COMMUNITY],
  ['CommunityReply', ENTITLEMENTS.COMMUNITY],
  ['StudyGroup', ENTITLEMENTS.COMMUNITY],
  ['GroupMembership', ENTITLEMENTS.COMMUNITY],
  ['GroupMessage', ENTITLEMENTS.COMMUNITY],
  ['GroupProgress', ENTITLEMENTS.COMMUNITY],
  ['GroupMeeting', ENTITLEMENTS.COMMUNITY],
  ['MeetingAttendance', ENTITLEMENTS.COMMUNITY],
  ['SharedSermon', ENTITLEMENTS.COMMUNITY],
  ['SharedSeries', ENTITLEMENTS.COMMUNITY],
  ['SermonRating', ENTITLEMENTS.COMMUNITY],
  ['SharedPlanRating', ENTITLEMENTS.COMMUNITY],
  ['SermonCollaborator', ENTITLEMENTS.COLLABORATION],
  ['SeriesCollaborator', ENTITLEMENTS.COLLABORATION],
  ['SermonComment', ENTITLEMENTS.COLLABORATION],
  ['SermonEdit', ENTITLEMENTS.COLLABORATION],
  ['EthicsAnalysis', ENTITLEMENTS.ETHICS],
]);

export function entitlementForEntityType(type) {
  return PREMIUM_ENTITY_TYPES.get(type) || null;
}
