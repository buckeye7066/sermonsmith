/**
 * Canonical agent registry — the "awareness" layer of the agent mesh.
 *
 * SermonSmith has two user-facing LLM personas ("agents"): Larry and Arlynn.
 * They have no autonomous run loop — every "run" is a user-triggered
 * InvokeLLM/StreamLLM call that lands on /api/ai/invoke or /api/ai/stream.
 * Until now the personas existed only as prompt text; nothing machine-readable
 * said WHO the agents are, what they do, where their code lives, or how they
 * can exchange operational knowledge.
 *
 * This registry is that single source of truth. It mirrors the AI_FEATURES
 * idiom (same shared package, frozen object keyed by stable id) and is bound
 * to it by a totality test (apps/web/src/lib/agentRegistryTotality.test.js):
 * every distinct `persona` in AI_FEATURES must be a registered agent id here,
 * and every agent id here must front at least one feature — so a new persona
 * cannot ship unregistered, and a registered agent cannot silently lose all
 * of its entry points.
 *
 * Consumed by:
 *   - services/api/src/services/agentMesh.js — validates message/lesson
 *     participants against this registry (loud refusal on unknown ids).
 *   - services/api/src/routes/ai.js — resolves the acting agent for a request
 *     from the request's `feature` id via AI_FEATURES[feature].persona.
 *
 * PRIVACY: the mesh built on top of this registry stores ONLY operational
 *   metadata (agent ids, feature ids, failure types, model names, counts) —
 *   never user prompts or generated content (see docs/AI_GUARDRAILS.md).
 */

export const AGENTS = Object.freeze({
  larry: Object.freeze({
    id: 'larry',
    name: 'Larry',
    role: 'Sermon & Bible Study assistant',
    charter:
      'Helps pastors, teachers, and students build sermons, study Scripture, and explore '
      + 'theology with a warm, pastoral voice grounded in real, cited passages.',
    capabilities: Object.freeze([
      'sermon drafting and point enhancement',
      'exegesis and Bible study generation',
      'study plans, prayers, quizzes, worldview and ethics exploration',
      'reader insight panels, maps, thematic linking, presentation helpers',
    ]),
    entryPoints: Object.freeze([
      'apps/web/src/ai/personas.js (LARRY_SYSTEM_PROMPT)',
      'packages/shared/prompts/index.js',
      'services/api/src/routes/ai.js (/invoke, /stream)',
    ]),
    telemetry: 'AiAuditLog rows via feature ids',
    lessonsHome: 'agent_lessons rows with author_agent = larry',
  }),
  arlynn: Object.freeze({
    id: 'arlynn',
    name: 'Arlynn',
    role: 'Series Specialist',
    charter:
      'Plans multi-week sermon series and teaching outlines, thinking strategically about '
      + 'theological trajectory so each week builds on the last.',
    capabilities: Object.freeze([
      'multi-week series planning',
      'teaching outline construction',
      'discussion questions and small-group prompts',
    ]),
    entryPoints: Object.freeze([
      'apps/web/src/ai/personas.js (ARLYNN_SYSTEM_PROMPT)',
      'services/api/src/routes/ai.js (/invoke, /stream)',
    ]),
    telemetry: 'AiAuditLog rows via feature ids',
    lessonsHome: 'agent_lessons rows with author_agent = arlynn',
  }),
});

export const AGENT_IDS = Object.freeze(Object.keys(AGENTS));

export function getAgentById(id) {
  return (typeof id === 'string' && AGENT_IDS.includes(id))
    ? AGENTS[id]
    : null;
}

export function isRegisteredAgent(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(AGENTS, id);
}
