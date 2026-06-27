// Bible source registry.
//
// Keep every Bible translation surfaced by the API in one auditable place so
// routes, exports, and UI metadata all carry license/attribution context.

export const BIBLE_TRANSLATIONS = Object.freeze([
  {
    id: 'kjv',
    name: 'King James Version',
    language: 'en',
    sourceUrl: 'https://bible-api.com/',
    license: 'Public domain in the United States',
    attribution: 'King James Version (KJV), public domain.',
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'web',
    name: 'World English Bible',
    language: 'en',
    sourceUrl: 'https://worldenglish.bible/',
    license: 'Public domain; "World English Bible" is a trademark of eBible.org',
    attribution: 'World English Bible (WEB), public domain.',
    copyrightNotice: '"World English Bible" is a trademark of eBible.org.',
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'bbe',
    name: 'Bible in Basic English',
    language: 'en',
    sourceUrl: 'https://ebible.org/engBBE/copyright.htm',
    license: 'Public domain in the United States',
    attribution: 'Bible in Basic English (BBE), public domain.',
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'asv',
    name: 'American Standard Version (1901)',
    language: 'en',
    sourceUrl: 'https://ebible.org/eng-asv/oldindex.htm',
    license: 'Public domain in the United States',
    attribution: 'American Standard Version (ASV), public domain.',
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'ylt',
    name: "Young's Literal Translation",
    language: 'en',
    sourceUrl: 'https://bible-api.com/',
    license: 'Public domain',
    attribution: "Young's Literal Translation (YLT), public domain.",
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'darby',
    name: 'Darby Bible',
    language: 'en',
    sourceUrl: 'https://bible-api.com/',
    license: 'Public domain',
    attribution: 'Darby Bible, public domain.',
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'clementine',
    name: 'Clementine Vulgate',
    language: 'la',
    sourceUrl: 'https://bible-api.com/',
    license: 'Public domain',
    attribution: 'Clementine Vulgate, public domain.',
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
  {
    id: 'almeida',
    name: 'Joao Ferreira de Almeida',
    language: 'pt',
    sourceUrl: 'https://bible-api.com/',
    license: 'Public domain',
    attribution: 'Joao Ferreira de Almeida, public domain.',
    copyrightNotice: null,
    publicDomain: true,
    displayAllowed: true,
    exportAllowed: true,
  },
]);

export const BIBLE_TRANSLATION_IDS = new Set(BIBLE_TRANSLATIONS.map((t) => t.id));

export function normalizeBibleTranslation(raw) {
  return String(raw || 'kjv').replace(/^en-/, '').toLowerCase();
}

export function getBibleTranslation(id) {
  const normalized = normalizeBibleTranslation(id);
  return BIBLE_TRANSLATIONS.find((t) => t.id === normalized) || null;
}

export function requireBibleTranslation(id) {
  const translation = getBibleTranslation(id);
  if (!translation) {
    throw Object.assign(new Error(`Unsupported translation: ${normalizeBibleTranslation(id)}`), { status: 400 });
  }
  if (!translation.displayAllowed) {
    throw Object.assign(new Error(`Translation is not licensed for display: ${translation.id}`), { status: 403 });
  }
  return translation;
}

export function translationMetadata(id) {
  const translation = requireBibleTranslation(id);
  return {
    id: translation.id,
    name: translation.name,
    language: translation.language,
    sourceUrl: translation.sourceUrl,
    license: translation.license,
    attribution: translation.attribution,
    copyrightNotice: translation.copyrightNotice,
    publicDomain: translation.publicDomain,
    displayAllowed: translation.displayAllowed,
    exportAllowed: translation.exportAllowed,
  };
}
