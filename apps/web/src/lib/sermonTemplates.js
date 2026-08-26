const SERMON_FIELDS = [
  'title',
  'topic',
  'anchor_passage',
  'big_idea',
  'points',
  'conclusion',
  'theological_notes',
  'tone',
  'audience',
  'denomination',
];

const SERIES_FIELDS = ['title', 'description', 'denomination', 'length'];

function copyAllowed(source, fields) {
  return Object.fromEntries(fields
    .filter((field) => source?.[field] !== undefined)
    .map((field) => [field, structuredClone(source[field])]));
}

export function sermonTemplateFromSermon(sermon, name = sermon?.title) {
  return {
    name: String(name || 'Sermon template').trim(),
    description: sermon?.topic || '',
    content: copyAllowed(sermon, SERMON_FIELDS),
  };
}

export function seriesTemplateFromSeries(series, sermons = [], name = series?.title) {
  const ordered = [...sermons].sort((left, right) => (left.series_order || 0) - (right.series_order || 0));
  return {
    name: String(name || 'Series template').trim(),
    description: series?.description || '',
    content: {
      ...copyAllowed(series, SERIES_FIELDS),
      length: series?.length || ordered.length || 1,
      sermon_blueprints: ordered.map((sermon) => copyAllowed(sermon, SERMON_FIELDS)),
    },
  };
}

export function sermonDraftFromTemplate(template, overrides = {}) {
  return {
    ...structuredClone(template?.content || {}),
    ...overrides,
    title: overrides.title || template?.content?.title || template?.name || 'Untitled sermon',
    status: 'draft',
    scheduled_date: null,
  };
}

export function seriesDraftFromTemplate(template) {
  const content = structuredClone(template?.content || {});
  const sermonBlueprints = Array.isArray(content.sermon_blueprints) ? content.sermon_blueprints : [];
  delete content.sermon_blueprints;
  return {
    series: {
      ...content,
      title: content.title || template?.name || 'Untitled series',
      length: content.length || sermonBlueprints.length || 1,
      status: 'in_progress',
    },
    sermons: sermonBlueprints.map((sermon, index) => sermonDraftFromTemplate(
      { content: sermon },
      { series_order: index + 1 },
    )),
  };
}
