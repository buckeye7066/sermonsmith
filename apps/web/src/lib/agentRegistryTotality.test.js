/**
 * Agent registry ↔ AI feature registry totality test.
 *
 * The agent mesh (packages/shared/agents) and the AI feature registry
 * (packages/shared/aiFeatures) must never drift apart:
 *
 *   1. Every distinct `persona` value in AI_FEATURES must be a registered
 *      agent id — a new persona cannot be introduced on a feature without
 *      registering the agent (its charter, entry points, and lessons home).
 *   2. Every registered agent id must front at least one feature — a
 *      registered agent cannot silently lose all of its entry points and
 *      linger as a ghost participant in the mesh.
 *
 * Lives next to aiFeatureTotality.test.js because this workspace already
 * resolves both @sermonsmith/shared subpath exports.
 */
import { describe, it, expect } from 'vitest';
import { AGENTS, AGENT_IDS, getAgentById, isRegisteredAgent } from '@sermonsmith/shared/agents';
import { AI_FEATURES } from '@sermonsmith/shared/aiFeatures';

describe('agent registry totality', () => {
  const personas = [...new Set(Object.values(AI_FEATURES).map((f) => f.persona))];

  it('every AI_FEATURES persona is a registered agent', () => {
    const unregistered = personas.filter((p) => !isRegisteredAgent(p));
    expect(
      unregistered.map((p) => `persona '${p}' appears in AI_FEATURES but is not in AGENTS`),
    ).toEqual([]);
  });

  it('every registered agent fronts at least one feature', () => {
    const orphans = AGENT_IDS.filter((id) => !personas.includes(id));
    expect(
      orphans.map((id) => `agent '${id}' is registered but no AI_FEATURES entry names it as persona`),
    ).toEqual([]);
  });

  it('registry entries carry the full awareness contract', () => {
    for (const id of AGENT_IDS) {
      const agent = AGENTS[id];
      expect(agent.id).toBe(id);
      expect(agent.name).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(typeof agent.charter).toBe('string');
      expect(agent.charter.length).toBeGreaterThan(20);
      expect(Array.isArray(agent.capabilities)).toBe(true);
      expect(agent.capabilities.length).toBeGreaterThan(0);
      expect(Array.isArray(agent.entryPoints)).toBe(true);
      expect(agent.entryPoints.length).toBeGreaterThan(0);
      expect(agent.telemetry).toContain('AiAuditLog');
      expect(agent.lessonsHome).toContain('agent_lessons');
    }
  });

  it('the registry is frozen (no runtime mutation of agent identity)', () => {
    expect(Object.isFrozen(AGENTS)).toBe(true);
    expect(Object.isFrozen(AGENT_IDS)).toBe(true);
    for (const id of AGENT_IDS) expect(Object.isFrozen(AGENTS[id])).toBe(true);
  });

  it('lookup helpers agree with the registry', () => {
    expect(getAgentById('larry')?.name).toBe('Larry');
    expect(getAgentById('arlynn')?.role).toBe('Series Specialist');
    expect(getAgentById('nobody')).toBeNull();
    expect(getAgentById(undefined)).toBeNull();
    expect(isRegisteredAgent('larry')).toBe(true);
    expect(isRegisteredAgent('broadcast')).toBe(false);
  });
});
