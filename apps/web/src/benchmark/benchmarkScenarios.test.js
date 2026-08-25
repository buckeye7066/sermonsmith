/**
 * Deterministic benchmark suite — model-independent pipeline invariants for
 * every scenario in the canonical ministry corpus AND its held-out
 * variation. This is the CI-facing half of the benchmark (spec: quality
 * ratchet); the live-model runner consumes the same corpus separately.
 *
 * Nothing here grades prose. It proves the deterministic machinery every
 * scenario depends on: denomination resolution (incl. honesty about
 * unprofiled traditions), canon-aware Scripture validation, prompt-block
 * caution delivery, server-invariant coverage of the high-risk classes, and
 * feature-id registration.
 */
import { describe, it, expect } from 'vitest';
import { BENCHMARK_SCENARIOS, HIGH_RISK_SCENARIO_IDS } from '@sermonsmith/shared/benchmark';
import { validateScriptureRefs } from '@sermonsmith/shared/scripture';
import { resolveDenominationProfile, denominationPromptBlock, canonForDenomination } from '@sermonsmith/shared/denominations';
import { isRegisteredAiFeature, SERVER_AI_INVARIANTS } from '@sermonsmith/shared/aiFeatures';

describe('benchmark corpus — shape and ratchet', () => {
  it('holds at least the 18 spec scenarios with unique ids (corpus may grow, never shrink)', () => {
    expect(BENCHMARK_SCENARIOS.length).toBeGreaterThanOrEqual(18);
    const ids = BENCHMARK_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the five spec-mandated highest-risk scenarios', () => {
    for (const id of [
      'catholic-funeral-deuterocanon',
      'youth-anxiety-social-media',
      'domestic-abuse-teaching',
      'sudden-death-funeral',
      'ethics-end-of-life',
    ]) {
      expect(HIGH_RISK_SCENARIO_IDS, id).toContain(id);
    }
  });

  it('every scenario has a held-out variation (anti-hardcoding rule)', () => {
    for (const s of BENCHMARK_SCENARIOS) {
      expect(s.heldOut, s.id).toBeTruthy();
    }
  });
});

describe('benchmark corpus — denomination resolution', () => {
  for (const s of BENCHMARK_SCENARIOS) {
    it(`${s.id}: '${s.tradition}' resolves to the ${s.expectProfile} profile`, () => {
      const profile = resolveDenominationProfile(s.tradition);
      expect(profile.id).toBe(s.expectProfile);
      // The user's own label is preserved in the prompt block, whatever the
      // resolved family.
      expect(denominationPromptBlock(s.tradition)).toContain(s.tradition);
    });

    const ho = s.heldOut;
    if (ho?.tradition) {
      it(`${s.id} (held-out): '${ho.tradition}' resolves to the ${ho.expectProfile ?? s.expectProfile} profile`, () => {
        expect(resolveDenominationProfile(ho.tradition).id).toBe(ho.expectProfile ?? s.expectProfile);
      });
    }
  }

  it('prompt blocks deliver each tradition\'s cautions (not just its name)', () => {
    for (const s of BENCHMARK_SCENARIOS) {
      const profile = resolveDenominationProfile(s.tradition);
      const block = denominationPromptBlock(s.tradition);
      expect(block, s.id).toContain(profile.cautions);
    }
  });

  it('unprofiled traditions are honestly generic, never silently claimed as profiled', () => {
    const s = BENCHMARK_SCENARIOS.find((x) => x.id === 'unprofiled-tradition-honesty');
    const profile = resolveDenominationProfile(s.tradition);
    expect(profile.id).toBe('generic');
    // The label is preserved so the prompt still names the real tradition…
    expect(profile.name).toBe(s.tradition);
    // …and the summary marks it as a general historic tradition rather than
    // inventing specific doctrinal claims for it.
    expect(profile.summary).toContain(s.tradition);
  });
});

describe('benchmark corpus — canon-aware Scripture validation', () => {
  for (const s of BENCHMARK_SCENARIOS) {
    const cases = [
      { label: s.id, canon: s.canon, expectRefs: s.expectRefs },
      s.heldOut && {
        label: `${s.id} (held-out)`,
        canon: s.heldOut.canon ?? (s.heldOut.tradition ? canonForDenomination(s.heldOut.tradition) : s.canon),
        expectRefs: s.heldOut.expectRefs,
      },
    ].filter(Boolean);
    for (const c of cases) {
      if (!c.expectRefs || Object.keys(c.expectRefs).length === 0) continue;
      it(`${c.label}: passages validate as expected under the ${c.canon} canon`, () => {
        for (const [ref, expected] of Object.entries(c.expectRefs)) {
          const [checked] = validateScriptureRefs([ref], { canon: c.canon });
          expect(checked.status, `${c.label} → ${ref}`).toBe(expected);
        }
      });
    }
  }

  it('scenario canons match their traditions', () => {
    for (const s of BENCHMARK_SCENARIOS) {
      expect(canonForDenomination(s.tradition), s.id).toBe(s.canon);
    }
  });
});

describe('benchmark corpus — feature ids and server-invariant coverage', () => {
  it('every scenario targets a registered AI feature', () => {
    for (const s of BENCHMARK_SCENARIOS) {
      expect(isRegisteredAiFeature(s.feature), `${s.id} → ${s.feature}`).toBe(true);
    }
  });

  it('the server invariants cover the high-risk failure classes the corpus tests', () => {
    // Fabrication classes (Scenarios 1, 4, 15, 17…)
    expect(SERVER_AI_INVARIANTS).toMatch(/Never fabricate or approximate Bible verse text/);
    expect(SERVER_AI_INVARIANTS).toMatch(/quotations, testimonies, personal stories, statistics/);
    // Crisis classes (Scenarios 9-12, 16)
    expect(SERVER_AI_INVARIANTS).toMatch(/never guarantee/);
    expect(SERVER_AI_INVARIANTS).toMatch(/insufficient faith/);
    expect(SERVER_AI_INVARIANTS).toMatch(/remain in danger|counsel anyone to remain/);
    expect(SERVER_AI_INVARIANTS).toMatch(/without inventing hotline numbers/);
    // Generated content must not claim human endorsement.
    expect(SERVER_AI_INVARIANTS).toMatch(/Never state or imply.*created, endorsed/s);
  });

  it('red-line screens are lower-case substrings (live-runner contract)', () => {
    for (const s of BENCHMARK_SCENARIOS) {
      for (const f of s.redLines?.forbid ?? []) {
        expect(f, s.id).toBe(f.toLowerCase());
      }
    }
  });
});
