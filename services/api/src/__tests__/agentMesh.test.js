import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPrismaMock } from './setup.js';

// Unit tests for the agent-mesh service layer: messaging (post/read/ack with
// bounded retention), lessons (dedupe/refresh, closed topic list, consumption
// rules), and the audit-driven teaching hook. All calls pass the in-memory
// prisma mock explicitly (the same prismaOverride idiom consumeUsageDb uses).

const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
}));

const {
  postAgentMessage,
  readAgentInbox,
  ackAgentMessages,
  recordAgentLesson,
  getLessonsForAgent,
  markLessonConsumed,
  composePeerNotesForAgent,
  deriveLessonsFromAudit,
  AGENT_LESSON_TOPICS,
  __test: meshInternals,
} = await import('../services/agentMesh.js');

describe('agentMesh — messages', () => {
  beforeEach(() => prisma._reset());

  it('posts a message between registered agents', async () => {
    const msg = await postAgentMessage(
      { fromAgent: 'larry', toAgent: 'arlynn', kind: 'lesson', body: 'model gpt-4o-mini failing repeatedly (http_500)' },
      prisma,
    );
    expect(msg.fromAgent).toBe('larry');
    expect(msg.toAgent).toBe('arlynn');
    expect(msg.readBy).toEqual({});
    expect(prisma._store.agentMessage).toHaveLength(1);
  });

  it('allows broadcast as a recipient', async () => {
    const msg = await postAgentMessage(
      { fromAgent: 'arlynn', toAgent: 'broadcast', kind: 'notice', body: 'operational notice' },
      prisma,
    );
    expect(msg.toAgent).toBe('broadcast');
  });

  it('refuses unregistered agents loudly (both directions)', async () => {
    await expect(postAgentMessage(
      { fromAgent: 'sasquatch', toAgent: 'larry', kind: 'x', body: 'y' }, prisma,
    )).rejects.toThrow(/not a registered agent/);
    await expect(postAgentMessage(
      { fromAgent: 'larry', toAgent: 'nobody', kind: 'x', body: 'y' }, prisma,
    )).rejects.toThrow(/not a registered agent/);
    await expect(readAgentInbox('ghost', {}, prisma)).rejects.toThrow(/not a registered agent/);
    await expect(ackAgentMessages('ghost', [], prisma)).rejects.toThrow(/not a registered agent/);
  });

  it('caps the body length in the service layer', async () => {
    const msg = await postAgentMessage(
      { fromAgent: 'larry', toAgent: 'arlynn', kind: 'note', body: 'x'.repeat(9000) },
      prisma,
    );
    expect(msg.body.length).toBe(meshInternals.MAX_BODY_CHARS);
  });

  it('prunes messages older than the retention window on post', async () => {
    const old = new Date(Date.now() - (meshInternals.RETENTION_DAYS + 5) * 24 * 60 * 60 * 1000);
    prisma._store.agentMessage.push(
      { id: 'old-1', fromAgent: 'larry', toAgent: 'arlynn', kind: 'note', body: 'stale', readBy: {}, createdAt: old },
      { id: 'old-2', fromAgent: 'larry', toAgent: 'broadcast', kind: 'note', body: 'stale', readBy: {}, createdAt: old },
    );
    await postAgentMessage({ fromAgent: 'arlynn', toAgent: 'larry', kind: 'note', body: 'fresh' }, prisma);
    const ids = prisma._store.agentMessage.map((m) => m.id);
    expect(ids).not.toContain('old-1');
    expect(ids).not.toContain('old-2');
    expect(prisma._store.agentMessage).toHaveLength(1);
  });

  it('caps total retained rows at the newest RETENTION_MAX_ROWS', async () => {
    const base = Date.now() - 60 * 60 * 1000;
    for (let i = 0; i < meshInternals.RETENTION_MAX_ROWS + 10; i++) {
      prisma._store.agentMessage.push({
        id: `m-${i}`, fromAgent: 'larry', toAgent: 'arlynn', kind: 'note', body: `n${i}`,
        readBy: {}, createdAt: new Date(base + i * 1000),
      });
    }
    await postAgentMessage({ fromAgent: 'arlynn', toAgent: 'larry', kind: 'note', body: 'newest' }, prisma);
    expect(prisma._store.agentMessage.length).toBe(meshInternals.RETENTION_MAX_ROWS);
    // The newest post survives; the oldest rows are the ones pruned.
    expect(prisma._store.agentMessage.some((m) => m.body === 'newest')).toBe(true);
    expect(prisma._store.agentMessage.some((m) => m.id === 'm-0')).toBe(false);
  });

  it('readAgentInbox returns direct + broadcast, and unreadOnly hides acked', async () => {
    const a = await postAgentMessage({ fromAgent: 'larry', toAgent: 'arlynn', kind: 'note', body: 'direct' }, prisma);
    await postAgentMessage({ fromAgent: 'larry', toAgent: 'broadcast', kind: 'note', body: 'blast' }, prisma);
    await postAgentMessage({ fromAgent: 'arlynn', toAgent: 'larry', kind: 'note', body: 'not-for-arlynn' }, prisma);

    const inbox = await readAgentInbox('arlynn', {}, prisma);
    expect(inbox.map((m) => m.body).sort()).toEqual(['blast', 'direct']);

    const acked = await ackAgentMessages('arlynn', [a.id], prisma);
    expect(acked).toBe(1);
    const unread = await readAgentInbox('arlynn', { unreadOnly: true }, prisma);
    expect(unread.map((m) => m.body)).toEqual(['blast']);
    // Ack stamps an ISO timestamp per agent, not a boolean.
    const row = prisma._store.agentMessage.find((m) => m.id === a.id);
    expect(new Date(row.readBy.arlynn).toString()).not.toBe('Invalid Date');
  });
});

describe('agentMesh — lessons', () => {
  beforeEach(() => prisma._reset());

  it('records a lesson and dedupes on (author, topic, claim) with timesSeen/evidence refresh', async () => {
    const first = await recordAgentLesson(
      { authorAgent: 'larry', topic: 'provider_reliability', claim: 'model x failing repeatedly (http_500)', evidence: { count: 3 } },
      prisma,
    );
    expect(first.timesSeen).toBe(1);
    const again = await recordAgentLesson(
      { authorAgent: 'larry', topic: 'provider_reliability', claim: 'model x failing repeatedly (http_500)', evidence: { count: 4 } },
      prisma,
    );
    expect(prisma._store.agentLesson).toHaveLength(1);
    expect(again.timesSeen).toBe(2);
    expect(again.evidence).toEqual({ count: 4 });
  });

  it('rejects unknown topics and unregistered authors', async () => {
    await expect(recordAgentLesson(
      { authorAgent: 'larry', topic: 'gossip', claim: 'c' }, prisma,
    )).rejects.toThrow(/unknown lesson topic/);
    await expect(recordAgentLesson(
      { authorAgent: 'ghost', topic: 'usage_pattern', claim: 'c' }, prisma,
    )).rejects.toThrow(/not a registered agent/);
    expect(AGENT_LESSON_TOPICS).toContain('provider_reliability');
  });

  it('getLessonsForAgent excludes own, consumed, and stale lessons', async () => {
    const now = new Date();
    prisma._store.agentLesson.push(
      { id: 'l-own', authorAgent: 'larry', topic: 'usage_pattern', claim: 'own', timesSeen: 1, consumedBy: {}, createdAt: now, updatedAt: now },
      { id: 'l-fresh', authorAgent: 'arlynn', topic: 'usage_pattern', claim: 'fresh', timesSeen: 1, consumedBy: {}, createdAt: now, updatedAt: now },
      { id: 'l-consumed', authorAgent: 'arlynn', topic: 'usage_pattern', claim: 'consumed', timesSeen: 1, consumedBy: { larry: now.toISOString() }, createdAt: now, updatedAt: now },
      { id: 'l-stale', authorAgent: 'arlynn', topic: 'usage_pattern', claim: 'stale', timesSeen: 1, consumedBy: {}, createdAt: now, updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    );
    const lessons = await getLessonsForAgent('larry', {}, prisma);
    expect(lessons.map((l) => l.claim)).toEqual(['fresh']);
  });

  it('filters by topic when topics are given', async () => {
    const now = new Date();
    prisma._store.agentLesson.push(
      { id: 'l-a', authorAgent: 'arlynn', topic: 'usage_pattern', claim: 'a', timesSeen: 1, consumedBy: {}, createdAt: now, updatedAt: now },
      { id: 'l-b', authorAgent: 'arlynn', topic: 'content_quality', claim: 'b', timesSeen: 1, consumedBy: {}, createdAt: now, updatedAt: now },
    );
    const lessons = await getLessonsForAgent('larry', { topics: ['content_quality'] }, prisma);
    expect(lessons.map((l) => l.claim)).toEqual(['b']);
  });

  it('markLessonConsumed stamps peers but refuses the author', async () => {
    const lesson = await recordAgentLesson(
      { authorAgent: 'arlynn', topic: 'content_quality', claim: 'series intros run long' }, prisma,
    );
    await expect(markLessonConsumed(lesson.id, 'arlynn', prisma)).rejects.toThrow(/own lesson/);
    const updated = await markLessonConsumed(lesson.id, 'larry', prisma);
    expect(Object.keys(updated.consumedBy)).toEqual(['larry']);
  });
});

describe('agentMesh — composePeerNotesForAgent', () => {
  beforeEach(() => prisma._reset());

  it('returns null when there is nothing to learn', async () => {
    expect(await composePeerNotesForAgent('larry', prisma)).toBeNull();
  });

  it('composes one note from messages + lessons and marks them consumed', async () => {
    const now = new Date();
    prisma._store.agentLesson.push({
      id: 'l-1', authorAgent: 'arlynn', topic: 'provider_reliability',
      claim: 'model gpt-4o failing repeatedly (http_500)', timesSeen: 3, consumedBy: {},
      createdAt: now, updatedAt: now,
    });
    await postAgentMessage({ fromAgent: 'arlynn', toAgent: 'larry', kind: 'notice', body: 'series usage spiking' }, prisma);

    const note = await composePeerNotesForAgent('larry', prisma);
    expect(note).toContain('Peer notes from your fellow assistant');
    expect(note).toContain('model gpt-4o failing repeatedly (http_500)');
    expect(note).toContain('series usage spiking');
    expect(note).toContain('do not mention to the user');

    // Consumption is stamped so the same note never repeats next run.
    expect(prisma._store.agentLesson[0].consumedBy.larry).toBeTruthy();
    expect(prisma._store.agentMessage[0].readBy.larry).toBeTruthy();
    expect(await composePeerNotesForAgent('larry', prisma)).toBeNull();
  });
});

describe('agentMesh — deriveLessonsFromAudit (teaching hook)', () => {
  beforeEach(() => prisma._reset());

  const seedFailures = (n, { model = 'gpt-4o-mini', failureType = 'http_500' } = {}) => {
    for (let i = 0; i < n; i++) {
      prisma._store.aiAuditLog.push({
        id: `a-${failureType}-${i}`, feature: 'sermon', model, status: 'failure',
        failureType, createdAt: new Date(),
      });
    }
  };

  it('does NOT teach below the failure threshold', async () => {
    seedFailures(meshInternals.FAILURE_THRESHOLD - 1);
    const result = await deriveLessonsFromAudit(
      { actingAgent: 'larry', model: 'gpt-4o-mini', failureType: 'http_500' }, prisma,
    );
    expect(result.taught).toBe(false);
    expect(prisma._store.agentLesson).toHaveLength(0);
    expect(prisma._store.agentMessage).toHaveLength(0);
  });

  it('records a lesson and messages the peer at the threshold', async () => {
    seedFailures(meshInternals.FAILURE_THRESHOLD);
    const result = await deriveLessonsFromAudit(
      { actingAgent: 'larry', model: 'gpt-4o-mini', failureType: 'http_500' }, prisma,
    );
    expect(result.taught).toBe(true);
    const [lesson] = prisma._store.agentLesson;
    expect(lesson.authorAgent).toBe('larry');
    expect(lesson.topic).toBe('provider_reliability');
    expect(lesson.claim).toBe('model gpt-4o-mini failing repeatedly (http_500)');
    expect(lesson.evidence).toMatchObject({ model: 'gpt-4o-mini', failureType: 'http_500', count: 3 });
    const [msg] = prisma._store.agentMessage;
    expect(msg.fromAgent).toBe('larry');
    expect(msg.toAgent).toBe('arlynn');
    expect(msg.kind).toBe('lesson');
  });

  it('ignores non-provider failure types (client/content errors are not reliability lessons)', async () => {
    seedFailures(5, { failureType: 'invalid_json' });
    const result = await deriveLessonsFromAudit(
      { actingAgent: 'larry', model: 'gpt-4o-mini', failureType: 'invalid_json' }, prisma,
    );
    expect(result.taught).toBe(false);
    expect(prisma._store.agentLesson).toHaveLength(0);
  });
});
