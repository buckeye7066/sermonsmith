// Typed data service layer for the gradual Base44 migration.
//
// The generic Entity API remains supported for old UI paths. New backend code
// should prefer these helpers for durable product records so data has indexes,
// clear ownership, and moderation/privacy fields.

const TYPE_TO_MODEL = {
  Sermon: 'sermon',
  SermonSeries: 'sermonSeries',
  SermonOutline: 'sermonOutline',
  BibleStudy: 'bibleStudy',
  StudyNote: 'studyNote',
  Highlight: 'highlight',
  Bookmark: 'bookmark',
  PrayerRequest: 'prayerRequest',
  SharedContent: 'sharedContent',
  ForumPost: 'forumPost',
  StudyGroup: 'studyGroup',
};

function modelFor(db, type) {
  const model = TYPE_TO_MODEL[type];
  if (!model || !db[model]) {
    throw Object.assign(new Error(`Unsupported typed content model: ${type}`), { status: 400 });
  }
  return db[model];
}

function searchableText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .map((part) => String(part))
    .join(' ')
    .slice(0, 20000);
}

export function entityToTypedData(type, entity) {
  const data = entity?.data || {};
  const base = {
    id: entity.id,
    userId: entity.userId,
    content: data,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };

  switch (type) {
    case 'Sermon':
      return {
        ...base,
        title: data.title || 'Untitled Sermon',
        status: data.status || 'draft',
        topic: data.topic || null,
        anchorPassage: data.anchor_passage || data.anchorPassage || null,
        searchText: searchableText(data.topic, data.big_idea, data.conclusion, data.theological_notes),
      };
    case 'SermonSeries':
    case 'Series':
      return {
        ...base,
        title: data.title || data.series_title || 'Untitled Series',
        status: data.status || 'draft',
        searchText: searchableText(data.description, data.series_description, data.series_goal),
      };
    case 'SermonOutline':
      return { ...base, title: data.title || 'Untitled Outline', status: data.status || 'draft' };
    case 'BibleStudy':
      return {
        ...base,
        title: data.title || 'Untitled Study',
        passage: data.passage || data.scripture_reference || null,
        status: data.status || 'draft',
        searchText: searchableText(data.title, data.passage, data.summary, data.content),
      };
    case 'StudyNote':
      return {
        ...base,
        title: data.title || null,
        passage: data.passage || data.scripture_reference || null,
        visibility: data.visibility || (data.private === false ? 'public' : 'private'),
        searchText: searchableText(data.title, data.content, data.note),
      };
    case 'Highlight':
      return {
        ...base,
        passage: data.passage || data.verse_id || null,
        color: data.color || null,
      };
    case 'Bookmark':
      return {
        ...base,
        passage: data.passage || data.verse_id || null,
        label: data.label || data.title || null,
      };
    case 'PrayerRequest':
      return {
        ...base,
        title: data.title || null,
        status: data.status || 'active',
        visibility: data.visibility || 'private',
      };
    case 'SharedContent':
      return {
        ...base,
        title: data.title || 'Untitled Shared Content',
        contentType: data.content_type || data.contentType || 'note',
        visibility: data.visibility || 'private',
        status: data.status || 'active',
        reportedCount: Number(data.reportedCount || data.reported_count || 0),
        moderatorNotes: data.moderatorNotes || data.moderator_notes || null,
        removedAt: data.removedAt ? new Date(data.removedAt) : null,
        removedBy: data.removedBy || data.removed_by || null,
      };
    case 'ForumPost':
      return {
        ...base,
        title: data.title || 'Untitled Post',
        status: data.status || 'active',
        visibility: data.visibility || 'public',
        reportedCount: Number(data.reportedCount || data.reported_count || 0),
        moderatorNotes: data.moderatorNotes || data.moderator_notes || null,
        removedAt: data.removedAt ? new Date(data.removedAt) : null,
        removedBy: data.removedBy || data.removed_by || null,
      };
    case 'StudyGroup':
      return {
        ...base,
        name: data.name || data.title || 'Untitled Group',
        visibility: data.visibility || 'group',
        status: data.status || 'active',
      };
    default:
      throw Object.assign(new Error(`Unsupported typed conversion: ${type}`), { status: 400 });
  }
}

export async function createTypedContent(db, type, data) {
  const model = modelFor(db, type);
  return model.create({ data });
}

export async function listTypedContent(db, type, userId, options = {}) {
  const model = modelFor(db, type);
  const take = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
  const skip = Math.max(Number(options.offset) || 0, 0);
  return model.findMany({
    where: { userId, ...(options.where || {}) },
    orderBy: options.orderBy || { updatedAt: 'desc' },
    take,
    skip,
  });
}

export async function migrateEntityRowsToTyped(db, type, options = {}) {
  const sourceType = type === 'SermonSeries' ? 'Series' : type;
  const rows = await db.entity.findMany({
    where: { type: sourceType },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(Number(options.limit) || 500, 1), 5000),
    skip: Math.max(Number(options.offset) || 0, 0),
  });

  const model = modelFor(db, type);
  let created = 0;
  for (const row of rows) {
    const data = entityToTypedData(type, row);
    await model.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    created++;
  }
  return { type, sourceType, created };
}
