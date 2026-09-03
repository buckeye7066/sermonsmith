// Entity.data is a JSON document, so two otherwise unrelated mutations can
// overwrite each other if they both read, spread, and replace it concurrently.
// Every route that mutates a community-visible Entity must use this exact lock
// key before re-reading and writing the row.
export async function lockCommunityEntity(tx, targetId) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`community-entity:${targetId}`}))`;
}

// MeetingAttendance still lives in the legacy Entity table, where PostgreSQL
// cannot enforce a compound unique key over JSON fields. This lock serializes
// the only supported RSVP mutation path for one meeting/account pair.
export async function lockMeetingRsvp(tx, meetingId, userId) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`community-rsvp:${meetingId}:${userId}`}))`;
}
