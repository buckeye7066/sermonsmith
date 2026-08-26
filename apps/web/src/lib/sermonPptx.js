import { strToU8, zipSync } from 'fflate';
import { saveExportFile } from './downloadBlob.js';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const SLIDE_WIDTH = 12192000;
const SLIDE_HEIGHT = 6858000;
export const PPTX_BODY_LINE_BUDGET = 12;
const BODY_CHARACTERS_PER_LINE = 68;

function isXml10CodePoint(codePoint) {
  return codePoint === 0x09
    || codePoint === 0x0a
    || codePoint === 0x0d
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function xmlEscape(value) {
  // XML 1.0 permits tab, line feed, carriage return, and the documented
  // scalar ranges only. Strip other controls and lone surrogate code units
  // before escaping markup delimiters so Office can always parse the deck.
  return [...String(value ?? '')]
    .filter((character) => isXml10CodePoint(character.codePointAt(0)))
    .join('')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function sanitizeFilename(text, fallback) {
  const cleaned = String(text || '')
    .replace(/[^\w\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .slice(0, 60);
  return cleaned || fallback;
}

function scriptureLabel(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  return String(entry.reference || entry.ref || entry.citation || '').trim();
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

export function splitSlideText(value, maximum = 310) {
  const text = normalizeText(value);
  if (!text) return [];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maximum) {
    let split = remaining.lastIndexOf(' ', maximum);
    if (split < Math.floor(maximum * 0.55)) split = maximum;
    chunks.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function estimatedParagraphLines(paragraph) {
  const value = typeof paragraph === 'string' ? { text: paragraph } : (paragraph || {});
  const charactersPerLine = value.bullet ? BODY_CHARACTERS_PER_LINE - 5 : BODY_CHARACTERS_PER_LINE;
  const logicalLines = normalizeText(value.text).split(/\n/gu);
  const wrapped = logicalLines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
    0,
  );
  // Reserve one line of inter-paragraph leading. This deliberately errs on
  // the side of an extra slide instead of clipping pulpit text.
  return wrapped + 1;
}

export function slideBodyLineCount(slide) {
  return (slide?.paragraphs || []).reduce((total, paragraph) => total + estimatedParagraphLines(paragraph), 0);
}

export function paginateSlideParagraphs(title, paragraphs, lineBudget = PPTX_BODY_LINE_BUDGET) {
  const pages = [];
  let current = [];
  let used = 0;
  const pushPage = () => {
    if (!current.length) return;
    pages.push({
      title: pages.length ? `${title} (continued)` : title,
      paragraphs: current,
    });
    current = [];
    used = 0;
  };

  for (const paragraph of paragraphs) {
    const value = typeof paragraph === 'string' ? { text: paragraph } : paragraph;
    const pieces = estimatedParagraphLines(value) > lineBudget
      ? splitSlideText(value?.text, BODY_CHARACTERS_PER_LINE * (lineBudget - 2))
        .map((text) => ({ ...value, text }))
      : [value];
    for (const piece of pieces) {
      const cost = estimatedParagraphLines(piece);
      if (current.length && used + cost > lineBudget) pushPage();
      current.push(piece);
      used += cost;
    }
  }
  pushPage();
  return pages.length ? pages : [{ title, paragraphs: [] }];
}

/** Convert the current sermon model into a compact, pulpit-readable deck. */
export function sermonToSlides(sermon) {
  if (!sermon || typeof sermon !== 'object') throw new Error('No sermon to export');

  const title = normalizeText(sermon.title) || 'Untitled Sermon';
  const subtitle = [
    normalizeText(sermon.anchor_passage),
    normalizeText(sermon.scheduled_date || sermon.preached_date),
  ].filter(Boolean).join('  •  ');
  const slides = [{ title, subtitle, kind: 'title', paragraphs: [] }];

  const opening = [];
  for (const part of splitSlideText(sermon.big_idea)) opening.push({ text: `Big idea — ${part}`, emphasis: true });
  for (const part of splitSlideText(sermon.introduction)) opening.push({ text: part });
  if (opening.length) slides.push(...paginateSlideParagraphs('Opening', opening));

  const points = Array.isArray(sermon.points) ? sermon.points : [];
  points.forEach((point, index) => {
    const paragraphs = [];
    const fields = [
      ['Exegesis', point?.exegesis || point?.content || point?.text],
      ['Illustration', point?.illustration],
      ['Application', point?.application],
    ];
    for (const [label, value] of fields) {
      for (const part of splitSlideText(value)) paragraphs.push({ text: `${label} — ${part}` });
    }
    const references = (Array.isArray(point?.supporting_scriptures) ? point.supporting_scriptures : [])
      .map(scriptureLabel)
      .filter(Boolean);
    if (references.length) {
      for (const part of splitSlideText(references.join(' • '))) {
        paragraphs.push({ text: `Scripture — ${part}`, emphasis: true });
      }
    }
    slides.push(...paginateSlideParagraphs(`${index + 1}. ${normalizeText(point?.title) || 'Untitled point'}`, paragraphs));
  });

  const closing = splitSlideText(sermon.conclusion).map((text) => ({ text }));
  if (closing.length) slides.push(...paginateSlideParagraphs('Conclusion', closing));

  const questions = Array.isArray(sermon.discussion_questions)
    ? sermon.discussion_questions.flatMap((question) => splitSlideText(question).map((text) => ({ text, bullet: true })))
    : [];
  if (questions.length) slides.push(...paginateSlideParagraphs('Discussion Questions', questions));

  return slides;
}

function runXml(text, { size = 2300, color = 'E2E8F0', bold = false } = {}) {
  return `<a:r><a:rPr lang="en-US" sz="${size}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xmlEscape(text)}</a:t></a:r>`;
}

function paragraphXml(paragraph, options = {}) {
  const value = typeof paragraph === 'string' ? { text: paragraph } : paragraph;
  const bullet = value?.bullet ? '<a:buChar char="&#x2022;"/>' : '<a:buNone/>';
  const margin = value?.bullet ? '457200' : '0';
  const indent = value?.bullet ? '-228600' : '0';
  return `<a:p><a:pPr marL="${margin}" indent="${indent}" algn="l">${bullet}</a:pPr>${runXml(value?.text, {
    ...options,
    bold: value?.emphasis || options.bold,
  })}<a:endParaRPr lang="en-US" sz="${options.size || 2300}"/></a:p>`;
}

function shapeXml({ id, name, x, y, cx, cy, paragraphs, fontSize, color, bold, align = 'l', anchor = 't' }) {
  const safeParagraphs = Array.isArray(paragraphs) && paragraphs.length ? paragraphs : [{ text: '' }];
  const content = safeParagraphs.map((paragraph) => paragraphXml(paragraph, {
    size: fontSize,
    color,
    bold,
  }).replace('algn="l"', `algn="${align}"`)).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${anchor}"/><a:lstStyle/>${content}</p:txBody></p:sp>`;
}

function slideXml(slide) {
  const isTitle = slide.kind === 'title';
  const titleShape = shapeXml({
    id: 2,
    name: 'Title',
    x: 914400,
    y: isTitle ? 1900000 : 550000,
    cx: 10363200,
    cy: isTitle ? 1600000 : 950000,
    paragraphs: [{ text: slide.title }],
    fontSize: isTitle ? 4000 : 3000,
    color: 'F8FAFC',
    bold: true,
    align: isTitle ? 'ctr' : 'l',
    anchor: 'ctr',
  });
  const body = isTitle
    ? (slide.subtitle ? shapeXml({
      id: 3,
      name: 'Subtitle',
      x: 1371600,
      y: 3650000,
      cx: 9448800,
      cy: 900000,
      paragraphs: [{ text: slide.subtitle }],
      fontSize: 2000,
      color: '93C5FD',
      align: 'ctr',
      anchor: 'ctr',
    }) : '')
    : shapeXml({
      id: 3,
      name: 'Content',
      x: 1066800,
      y: 1750000,
      cx: 10058400,
      cy: 4300000,
      paragraphs: slide.paragraphs,
      fontSize: 2150,
      color: 'E2E8F0',
    });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${titleShape}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function contentTypesXml(slideCount) {
  const slides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function presentationXml(slideCount) {
  const ids = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`;
}

function presentationRelsXml(slideCount) {
  const slides = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides}</Relationships>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const SLIDE_MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="SermonSmith"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
const SLIDE_MASTER_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
const SLIDE_LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const SLIDE_LAYOUT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
const SLIDE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="SermonSmith"><a:themeElements><a:clrScheme name="SermonSmith"><a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="F8FAFC"/></a:lt1><a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="E2E8F0"/></a:lt2><a:accent1><a:srgbClr val="3B82F6"/></a:accent1><a:accent2><a:srgbClr val="8B5CF6"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="EC4899"/></a:accent5><a:accent6><a:srgbClr val="06B6D4"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="SermonSmith"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="SermonSmith"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/><a:satMod val="200000"/></a:schemeClr></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="80000"/></a:schemeClr></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

export function buildSermonPptxFilename(sermon) {
  return `${sanitizeFilename(sermon?.title, 'sermon')}.pptx`;
}

/** Package already-normalized slides into an Open XML presentation. */
export function buildPresentationPptx({ title, slides }, { createdAt = new Date() } = {}) {
  if (!Array.isArray(slides) || slides.length === 0) throw new Error('No slides to export');
  const iso = new Date(createdAt).toISOString();
  const files = {
    '[Content_Types].xml': strToU8(contentTypesXml(slides.length)),
    '_rels/.rels': strToU8(ROOT_RELS),
    'docProps/app.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SermonSmith</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slides.length}</Slides></Properties>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title || 'Untitled Presentation')}</dc:title><dc:creator>SermonSmith</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`),
    'ppt/presentation.xml': strToU8(presentationXml(slides.length)),
    'ppt/_rels/presentation.xml.rels': strToU8(presentationRelsXml(slides.length)),
    'ppt/slideMasters/slideMaster1.xml': strToU8(SLIDE_MASTER),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': strToU8(SLIDE_MASTER_RELS),
    'ppt/slideLayouts/slideLayout1.xml': strToU8(SLIDE_LAYOUT),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': strToU8(SLIDE_LAYOUT_RELS),
    'ppt/theme/theme1.xml': strToU8(THEME),
  };
  slides.forEach((slide, index) => {
    files[`ppt/slides/slide${index + 1}.xml`] = strToU8(slideXml(slide));
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = strToU8(SLIDE_RELS);
  });
  const bytes = zipSync(files, { level: 6 });
  return new Blob([bytes], { type: PPTX_MIME });
}

export function buildSermonPptx(sermon, options) {
  const slides = sermonToSlides(sermon);
  return buildPresentationPptx({ title: sermon.title || 'Untitled Sermon', slides }, options);
}

export async function downloadPptx(blob, filename) {
  return saveExportFile(blob, filename);
}

/** Build and download a real Open XML presentation. Returns its filename. */
export async function exportSermonToPptx(sermon) {
  const blob = buildSermonPptx(sermon);
  const filename = buildSermonPptxFilename(sermon);
  await downloadPptx(blob, filename);
  return filename;
}
