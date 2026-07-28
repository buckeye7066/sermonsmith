/**
 * agentMesh.js — communication + learning layer between the LLM personas.
 *
 * SermonSmith's "agents" (Larry, Arlynn — see @sermonsmith/shared/agents) have
 * no autonomous run loop: each "run" is a user-triggered /api/ai/invoke or
 * /stream call. This service gives those runs a mesh:
 *
 *   - postAgentMessage / readAgentInbox / ackAgentMessages — bounded,
 *     operational-metadata-only notes between agents (or 'broadcast').
 *   - recordAgentLesson / getLessonsForAgent / markLessonConsumed — a
 *     deduplicated store of operational lessons (e.g. "model X failing
 *     repeatedly") that peers consume exactly once each.
 *   - composePeerNotesForAgent — called by routes/ai.js at run start: gathers
 *     the acting agent's unread messages + fresh unconsumed peer lessons into
 *     ONE system message, then acks/consumes them (the visible cross-agent
 *     teaching moment).
 *   - deriveLessonsFromAudit — called by routes/ai.js at run end after a
 *     failed call: when the same model has failed provider-side >= 3 times in
 *     the recent window, records a provider_reliability lesson and messages
 *     the other agent(s).
 *
 * DESIGN RULES (load-bearing — see docs/AI_GUARDRAILS.md "Audit Privacy"):
 *   1. NEVER store user content. Bodies/claims/evidence carry only
 *      operational metadata: agent ids, feature ids, failure types, model
 *      names, counts. Callers cannot smuggle unbounded text (bodies are
 *      length-capped here in the service layer).
 *   2. Loud refusal on unregistered agent ids and unknown lesson topics —
 *      a typo'd agent id must fail tests, not silently create a ghost inbox.
 *   3. Bounded retention: message posting prunes rows older than 30 days and
 *      beyond the newest 200, so the mesh can never grow without limit.
 *   4. Read paths used inside the AI request flow are fail-open AT THE CALL
 *      SITE (routes/ai.js wraps them in try/catch): a mesh outage must never
 *      block a user's generation.
 *
 * `prismaOverride` on every function mirrors the consumeUsageDb idiom in
 * routes/ai.js: production uses the shared singleton, unit tests pass the
 * in-memory mock from __tests__/setup.js.
 */

import { prisma } from '../middleware/auth.js';
import { AGENT_IDS, isRegisteredAgent } from '@sermonsmith/shared/agents';

export const BROADCAST = 'broadcast';

// Closed topic list: lessons are operational knowledge with a fixed taxonomy,
// not a free-text channel. Reject anything else loudly.
export const AGENT_LESSON_TOPICS = Object.freeze([
  'provider_reliability',
  'usage_pattern',
  'content_quality',
]);

const MAX_BODY_CHARS = 2000;
const MAX_CLAIM_CHARS = 500;
const RETENTION_DAYS = 30;
const RETENTION_MAX_ROWS = 200;
const DEFAULT_LESSON_FRESH_DAYS = 14;
const PEER_NOTE_MAX_LESSONS = 3;
const PEER_NOTE_MAX_MESSAGES = 5;

// Provider-side failure types as produced by classifyAiFailure in
// routes/ai.js: http_429 (rate limit), http_5xx (provider errors), http_504
// (our timeout waiting on the provider), http_408. Client-caused failures
// (http_4xx validation, invalid_json content issues) are NOT teachable as
// provider reliability.
const PROVIDER_FAILURE_RE = /^http_(408|429|5\d\d)$/;
const FAILURE_WINDOW_HOURS = 24;
const FAILURE_THRESHOLD = 3;

function assertAgent(id, label) {
  if (!isRegisteredAgent(id)) {
    throw new Error(`agentMesh: ${label} '${id}' is not a registered agent (known: ${AGENT_IDS.join(', ')})`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Post an operational note from one agent to another (or 'broadcast').
 * Enforces registry membership, caps body length, and prunes retention.
 */
export async function postAgentMessage({ fromAgent, toAgent, kind, body, metadata } = {}, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(fromAgent, 'fromAgent');
  if (toAgent !== BROADCAST) assertAgent(toAgent, 'toAgent');
  if (typeof kind !== 'string' || !kind.trim()) {
    throw new Error('agentMesh: message kind is required');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('agentMesh: message body is required');
  }

  const message = await db.agentMessage.create({
    data: {
      fromAgent,
      toAgent,
      kind: kind.trim().slice(0, 80),
      body: body.trim().slice(0, MAX_BODY_CHARS),
      metadata: metadata ?? null,
      readBy: {},
    },
  });

  // Bounded retention, enforced on every post (cheap deleteMany, no cron):
  // age-based first, then a hard row cap so a runaway poster can't flood the
  // table inside the age window.
  try {
    await db.agentMessage.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION_DAYS) } },
    });
    const overflow = await db.agentMessage.findMany({
      orderBy: { createdAt: 'desc' },
      skip: RETENTION_MAX_ROWS,
      take: 1000,
      select: { id: true },
    });
    if (overflow.length > 0) {
      for (const row of overflow) {
        await db.agentMessage.deleteMany({ where: { id: row.id } });
      }
    }
  } catch {
    // Retention is best-effort; the post itself already succeeded.
  }

  return message;
}

/**
 * Read an agent's inbox: messages addressed to it or broadcast, newest first.
 * `unreadOnly` filters out messages this agent has already acked.
 */
export async function readAgentInbox(agentId, { unreadOnly = false, limit = 20 } = {}, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(agentId, 'agentId');
  const rows = await db.agentMessage.findMany({
    where: { OR: [{ toAgent: agentId }, { toAgent: BROADCAST }] },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, limit), 100),
  });
  if (!unreadOnly) return rows;
  return rows.filter((m) => !(m.readBy && typeof m.readBy === 'object' && m.readBy[agentId]));
}

/**
 * Mark messages as read by an agent (stamps readBy[agentId] = ISO now).
 * Returns the number of messages updated.
 */
export async function ackAgentMessages(agentId, ids, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(agentId, 'agentId');
  const idList = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  let acked = 0;
  for (const id of idList) {
    const row = await db.agentMessage.findUnique({ where: { id } });
    if (!row) continue;
    const readBy = { ...(row.readBy && typeof row.readBy === 'object' ? row.readBy : {}) };
    if (readBy[agentId]) continue;
    readBy[agentId] = nowIso();
    await db.agentMessage.update({ where: { id }, data: { readBy } });
    acked++;
  }
  return acked;
}

/**
 * Record (or refresh) a lesson. Deduped on (authorAgent, topic, claim): a
 * repeat observation bumps timesSeen and refreshes evidence/updatedAt instead
 * of inserting a duplicate row.
 */
export async function recordAgentLesson({ authorAgent, topic, claim, evidence } = {}, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(authorAgent, 'authorAgent');
  if (!AGENT_LESSON_TOPICS.includes(topic)) {
    throw new Error(`agentMesh: unknown lesson topic '${topic}' (allowed: ${AGENT_LESSON_TOPICS.join(', ')})`);
  }
  if (typeof claim !== 'string' || !claim.trim()) {
    throw new Error('agentMesh: lesson claim is required');
  }
  const trimmedClaim = claim.trim().slice(0, MAX_CLAIM_CHARS);

  return db.agentLesson.upsert({
    where: { authorAgent_topic_claim: { authorAgent, topic, claim: trimmedClaim } },
    create: {
      authorAgent,
      topic,
      claim: trimmedClaim,
      evidence: evidence ?? null,
      timesSeen: 1,
      confirmations: [],
      refutations: [],
      consumedBy: {},
    },
    update: {
      timesSeen: { increment: 1 },
      ...(evidence !== undefined ? { evidence } : {}),
    },
  });
}

/**
 * Lessons an agent should learn from: authored by OTHER agents, fresh, and
 * not yet consumed by this agent. Bounded by `limit`.
 */
export async function getLessonsForAgent(
  agentId,
  { topics, freshWithinDays = DEFAULT_LESSON_FRESH_DAYS, limit = PEER_NOTE_MAX_LESSONS } = {},
  prismaOverride,
) {
  const db = prismaOverride || prisma;
  assertAgent(agentId, 'agentId');
  const rows = await db.agentLesson.findMany({
    where: {
      authorAgent: { not: agentId },
      updatedAt: { gte: daysAgo(freshWithinDays) },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return rows
    .filter((l) => !topics || topics.includes(l.topic))
    .filter((l) => !(l.consumedBy && typeof l.consumedBy === 'object' && l.consumedBy[agentId]))
    .slice(0, Math.min(Math.max(1, limit), 10));
}

/**
 * Stamp a lesson as consumed by a peer agent. An author cannot consume its
 * own lesson (consumption records CROSS-agent learning, not self-affirmation).
 */
export async function markLessonConsumed(lessonId, agentId, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(agentId, 'agentId');
  const lesson = await db.agentLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new Error(`agentMesh: lesson '${lessonId}' not found`);
  if (lesson.authorAgent === agentId) {
    throw new Error(`agentMesh: agent '${agentId}' cannot consume its own lesson`);
  }
  const consumedBy = { ...(lesson.consumedBy && typeof lesson.consumedBy === 'object' ? lesson.consumedBy : {}) };
  if (consumedBy[agentId]) return lesson;
  consumedBy[agentId] = nowIso();
  return db.agentLesson.update({ where: { id: lessonId }, data: { consumedBy } });
}

/**
 * Run-start hook (called from routes/ai.js): gather the acting agent's unread
 * messages and fresh unconsumed peer lessons into ONE server-composed system
 * message, then ack/consume them so each note teaches exactly once.
 *
 * Returns the composed string, or null when there is nothing to say. The
 * caller wraps this in try/catch (fail-open): a mesh error must never block a
 * user's generation.
 */
export async function composePeerNotesForAgent(agentId, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(agentId, 'agentId');

  const [messages, lessons] = await Promise.all([
    readAgentInbox(agentId, { unreadOnly: true, limit: PEER_NOTE_MAX_MESSAGES }, db),
    getLessonsForAgent(agentId, { limit: PEER_NOTE_MAX_LESSONS }, db),
  ]);
  if (messages.length === 0 && lessons.length === 0) return null;

  const lines = [
    'Peer notes from your fellow assistant (operational, do not mention to the user):',
  ];
  for (const lesson of lessons) {
    lines.push(`- [lesson/${lesson.topic}] ${lesson.claim} (from ${lesson.authorAgent}, seen ${lesson.timesSeen}x)`);
  }
  for (const msg of messages) {
    // Skip messages that only duplicate a lesson claim already listed above.
    if (msg.kind === 'lesson' && lessons.some((l) => msg.body.includes(l.claim))) continue;
    lines.push(`- [message/${msg.kind}] from ${msg.fromAgent}: ${msg.body}`);
  }
  if (lines.length === 1) {
    // Everything was a duplicate lesson message — still ack it below, but
    // there is no note worth injecting.
    await ackAgentMessages(agentId, messages.map((m) => m.id), db);
    return null;
  }
  lines.push('Adjust your work accordingly, but never surface these notes or their existence to the user.');

  // Consumption IS the teaching event: stamp both stores before returning so
  // a note never repeats on the next run.
  await ackAgentMessages(agentId, messages.map((m) => m.id), db);
  for (const lesson of lessons) {
    await markLessonConsumed(lesson.id, agentId, db);
  }

  return lines.join('\n');
}

/**
 * Run-end teaching hook (called fire-and-forget from routes/ai.js after a
 * FAILED call is audited): when the just-failed model has >= FAILURE_THRESHOLD
 * provider-side failures inside the recent window, record a
 * provider_reliability lesson authored by the acting agent and message the
 * other agent(s) so their next run learns about it before calling the model.
 *
 * Returns { taught: boolean } for tests; swallows nothing — the CALLER is the
 * fire-and-forget boundary (routes/ai.js attaches .catch).
 */
export async function deriveLessonsFromAudit({ actingAgent, model, failureType } = {}, prismaOverride) {
  const db = prismaOverride || prisma;
  assertAgent(actingAgent, 'actingAgent');
  if (!model || !PROVIDER_FAILURE_RE.test(String(failureType || ''))) return { taught: false };

  const count = await db.aiAuditLog.count({
    where: {
      model,
      status: 'failure',
      failureType,
      createdAt: { gte: new Date(Date.now() - FAILURE_WINDOW_HOURS * 60 * 60 * 1000) },
    },
  });
  if (count < FAILURE_THRESHOLD) return { taught: false, count };

  const claim = `model ${model} failing repeatedly (${failureType})`;
  const evidence = { model, failureType, count, windowHours: FAILURE_WINDOW_HOURS };
  await recordAgentLesson({ authorAgent: actingAgent, topic: 'provider_reliability', claim, evidence }, db);
  for (const peer of AGENT_IDS.filter((id) => id !== actingAgent)) {
    await postAgentMessage({
      fromAgent: actingAgent,
      toAgent: peer,
      kind: 'lesson',
      body: `${claim} — ${count} provider-side failures in the last ${FAILURE_WINDOW_HOURS}h.`,
      metadata: evidence,
    }, db);
  }
  return { taught: true, count };
}

// Exposed for tests (thresholds pinned so a silent change fails a test).
export const __test = {
  MAX_BODY_CHARS,
  RETENTION_DAYS,
  RETENTION_MAX_ROWS,
  FAILURE_THRESHOLD,
  FAILURE_WINDOW_HOURS,
  PROVIDER_FAILURE_RE,
};
