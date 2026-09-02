// Reporters and moderation staff must not be identifiable to content authors
// or anonymous share-link visitors. The moderation queue reads the raw Entity
// rows intentionally; every owner/public serialization uses this helper.
const PRIVATE_COMMUNITY_METADATA_KEYS = Object.freeze([
  'reported_by',
  'reportedBy',
  'reporter_ids',
  'reporterIds',
  'last_report',
  'lastReport',
  'moderatorNotes',
  'moderator_notes',
  'removedAt',
  'removed_at',
  'removedBy',
  'removed_by',
]);
const PRIVATE_COMMUNITY_METADATA_KEY_SET = new Set(PRIVATE_COMMUNITY_METADATA_KEYS);

export function isPrivateCommunityMetadataKey(key) {
  return PRIVATE_COMMUNITY_METADATA_KEY_SET.has(key);
}

export function withoutPrivateCommunityMetadata(data) {
  const safe = { ...(data || {}) };
  for (const key of PRIVATE_COMMUNITY_METADATA_KEYS) delete safe[key];
  return safe;
}
