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

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function hasPromotionalAccess(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const phone = normalizePhone(user?.phone || user?.profile?.phone);
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
  return req?.userPremium === true;
}

const PREMIUM_AI_FEATURES = new Map([
  ['bible_maps', ENTITLEMENTS.BIBLE_MAPS],
  ['community', ENTITLEMENTS.COMMUNITY],
  ['ethics', ENTITLEMENTS.ETHICS],
  ['multi_perspective_study', ENTITLEMENTS.MULTI_PERSPECTIVE_STUDY],
  ['plan_adaptation', ENTITLEMENTS.ADVANCED_STUDY],
  ['sermon_adaptation', ENTITLEMENTS.SERMON_ADAPTATION],
  ['worldview', ENTITLEMENTS.WORLDVIEW],
]);

export function entitlementForAiFeature(feature) {
  return PREMIUM_AI_FEATURES.get(String(feature || '').trim().toLowerCase()) || null;
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
