/**
 * Defensive normalizers for AI-generated structured payloads.
 *
 * Larry / Arlynn occasionally return malformed sermons / outlines / series
 * — missing arrays, stringified numbers, omitted fields. The pages used to
 * crash on `.points.map(...)` when one of those shapes drifted. These
 * helpers coerce the AI output into the exact shape the UI expects so a
 * partial response degrades gracefully instead of bringing the page down.
 *
 * The normalizers also de-duplicate scripture lists so re-suggesting more
 * verses can't push the same reference twice.
 */

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function mergeUniqueStrings(...lists) {
  const seen = new Set();
  const out = [];

  for (const list of lists) {
    for (const item of asArray(list)) {
      const value = asString(item).trim();
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      out.push(value);
    }
  }

  return out;
}

export function normalizeSermon(raw = {}, fallback = {}) {
  const points = asArray(raw.points).map((point, index) => ({
    title: asString(point?.title, `Point ${index + 1}`),
    exegesis: asString(point?.exegesis),
    illustration: asString(point?.illustration),
    application: asString(point?.application),
    supporting_scriptures: mergeUniqueStrings(point?.supporting_scriptures),
  }));

  return {
    ...fallback,
    ...raw,
    title: asString(raw.title, fallback.title || 'Untitled Sermon'),
    big_idea: asString(raw.big_idea, fallback.big_idea || ''),
    theological_notes: asString(raw.theological_notes, fallback.theological_notes || ''),
    points,
    conclusion: asString(raw.conclusion, fallback.conclusion || ''),
  };
}

export function normalizeOutline(raw = {}) {
  const mainPoints = asArray(raw.main_points).map((point, index) => ({
    number: Number(point?.number) || index + 1,
    title: asString(point?.title, `Point ${index + 1}`),
    explanation: asString(point?.explanation),
    significance: asString(point?.significance),
    supporting_scriptures: mergeUniqueStrings(point?.supporting_scriptures),
    applications: asArray(point?.applications).map((app) => ({
      area: asString(app?.area, 'Application'),
      action: asString(app?.action),
      reflection_question: asString(app?.reflection_question),
    })),
    illustration_suggestions: asArray(point?.illustration_suggestions).map((ill) => ({
      type: asString(ill?.type, 'Illustration'),
      idea: asString(ill?.idea),
    })),
  }));

  return {
    ...raw,
    title: asString(raw.title, 'Untitled Outline'),
    big_idea: asString(raw.big_idea),
    main_points: mainPoints,
    conclusion: {
      recap: asString(raw.conclusion?.recap),
      call_to_action: asString(raw.conclusion?.call_to_action),
      final_illustration_idea: asString(raw.conclusion?.final_illustration_idea),
      invitation: asString(raw.conclusion?.invitation),
      next_steps: mergeUniqueStrings(raw.conclusion?.next_steps),
    },
  };
}

export function normalizeSeriesOutline(raw = {}, requestedLength = 0) {
  const sermons = asArray(raw.sermons)
    .slice(0, requestedLength || undefined)
    .map((sermon, index) => ({
      week: Number(sermon?.week) || index + 1,
      title: asString(sermon?.title, `Week ${index + 1}`),
      scripture: asString(sermon?.scripture),
      big_idea: asString(sermon?.big_idea),
      theological_focus: asString(sermon?.theological_focus),
      builds_on_previous: asString(sermon?.builds_on_previous),
      preview_next: asString(sermon?.preview_next),
      discussion_questions: mergeUniqueStrings(sermon?.discussion_questions),
    }));

  return {
    ...raw,
    series_title: asString(raw.series_title, 'Untitled Series'),
    series_description: asString(raw.series_description),
    series_goal: asString(raw.series_goal),
    target_audience: asString(raw.target_audience),
    theological_trajectory: {
      progression: asString(raw.theological_trajectory?.progression),
      key_doctrines: mergeUniqueStrings(raw.theological_trajectory?.key_doctrines),
      build_pattern: asString(raw.theological_trajectory?.build_pattern),
      culmination: asString(raw.theological_trajectory?.culmination),
      biblical_connection: asString(raw.theological_trajectory?.biblical_connection),
    },
    sermons,
    promotion: {
      social_tagline: asString(raw.promotion?.social_tagline),
      bulletin_text: asString(raw.promotion?.bulletin_text),
      email_text: asString(raw.promotion?.email_text),
    },
  };
}
