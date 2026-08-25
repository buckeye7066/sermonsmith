import { buildPresentationPptx, downloadPptx } from './sermonPptx.js';

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function sanitizeFilename(text, fallback) {
  const cleaned = String(text || '')
    .replace(/[^\w\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .slice(0, 60);
  return cleaned || fallback;
}

function chunks(value, maximum = 310) {
  let remaining = normalizeText(value);
  const result = [];
  while (remaining.length > maximum) {
    let split = remaining.lastIndexOf(' ', maximum);
    if (split < Math.floor(maximum * 0.55)) split = maximum;
    result.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}

function page(title, paragraphs, limit = 5) {
  const slides = [];
  for (let index = 0; index < paragraphs.length; index += limit) {
    slides.push({
      title: index ? `${title} (continued)` : title,
      paragraphs: paragraphs.slice(index, index + limit),
    });
  }
  return slides.length ? slides : [{ title, paragraphs: [] }];
}

export function studyToSlides(study) {
  if (!study || typeof study !== 'object') throw new Error('No study to export');
  const title = normalizeText(study.title) || 'Untitled Study';
  const slides = [{
    title,
    subtitle: normalizeText(study.topic),
    kind: 'title',
    paragraphs: [],
  }];

  const overview = chunks(study.overview).map((text) => ({ text }));
  if (overview.length) slides.push(...page('Overview', overview));

  const keyVerses = (Array.isArray(study.key_verses) ? study.key_verses : [])
    .map(normalizeText)
    .filter(Boolean)
    .map((text) => ({ text, bullet: true }));
  if (keyVerses.length) slides.push(...page('Key Verses', keyVerses, 6));

  const sections = Array.isArray(study.study_sections) ? study.study_sections : [];
  sections.forEach((section, index) => {
    const paragraphs = [];
    for (const part of chunks(section?.scripture)) paragraphs.push({ text: `Scripture — ${part}`, emphasis: true });
    for (const part of chunks(section?.insights)) paragraphs.push({ text: `Insights — ${part}` });
    for (const question of (Array.isArray(section?.questions) ? section.questions : [])) {
      for (const part of chunks(question)) paragraphs.push({ text: `Question — ${part}`, bullet: true });
    }
    for (const part of chunks(section?.application)) paragraphs.push({ text: `Application — ${part}`, emphasis: true });
    slides.push(...page(`${index + 1}. ${normalizeText(section?.title) || 'Study section'}`, paragraphs));
  });

  const conclusion = chunks(study.conclusion).map((text) => ({ text }));
  if (conclusion.length) slides.push(...page('Conclusion', conclusion));
  return slides;
}

export function buildStudyPptxFilename(study) {
  return `${sanitizeFilename(study?.title, 'bible-study')}.pptx`;
}

export function buildStudyPptx(study, options) {
  return buildPresentationPptx({
    title: study?.title || 'Untitled Study',
    slides: studyToSlides(study),
  }, options);
}

export async function renderStudyPdf(study) {
  if (!study || typeof study !== 'object') throw new Error('No study to export');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const margin = 20;
  const footer = 18;
  const lineHeight = 5;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (needed = 20) => {
    if (y + needed <= pageHeight - footer) return;
    doc.addPage();
    y = margin;
  };
  const write = (text, { size = 11, style = 'normal', indent = 0, gap = 3 } = {}) => {
    const value = normalizeText(text);
    if (!value) return;
    doc.setFontSize(size);
    doc.setFont(undefined, style);
    const lines = doc.splitTextToSize(value, maxWidth - indent);
    checkPage(Math.min(lines.length, 2) * lineHeight + gap);
    for (const line of lines) {
      checkPage(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
    y += gap;
  };
  const heading = (text) => write(text, { size: 9, style: 'bold', gap: 1 });

  write(study.title || 'Untitled Study', { size: 20, style: 'bold', gap: 2 });
  write(study.topic, { size: 10, style: 'italic', gap: 5 });
  if (study.overview) {
    heading('OVERVIEW');
    write(study.overview, { gap: 5 });
  }
  const keyVerses = Array.isArray(study.key_verses) ? study.key_verses : [];
  if (keyVerses.length) {
    heading('KEY VERSES');
    keyVerses.forEach((verse) => write(`• ${verse}`, { indent: 3, gap: 1 }));
    y += 3;
  }
  const sections = Array.isArray(study.study_sections) ? study.study_sections : [];
  sections.forEach((section, index) => {
    checkPage(25);
    write(`${index + 1}. ${section?.title || 'Study section'}`, { size: 13, style: 'bold', gap: 2 });
    if (section?.scripture) {
      heading('SCRIPTURE');
      write(section.scripture, { style: 'italic', indent: 3 });
    }
    if (section?.insights) {
      heading('INSIGHTS');
      write(section.insights, { indent: 3 });
    }
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    if (questions.length) {
      heading('DISCUSSION QUESTIONS');
      questions.forEach((question, questionIndex) => write(`${questionIndex + 1}. ${question}`, { indent: 3, gap: 1 }));
      y += 2;
    }
    if (section?.application) {
      heading('APPLICATION');
      write(section.application, { indent: 3, gap: 5 });
    }
  });
  if (study.conclusion) {
    checkPage(20);
    heading('CONCLUSION');
    write(study.conclusion);
  }
  const pageCount = doc.internal.getNumberOfPages();
  for (let current = 1; current <= pageCount; current += 1) {
    doc.setPage(current);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text('SermonSmith Bible Study', margin, pageHeight - 10);
    doc.text(`Page ${current} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    doc.setTextColor(0);
  }
  return doc;
}

export function buildStudyPdfFilename(study) {
  return `${sanitizeFilename(study?.title, 'bible-study')}.pdf`;
}

export async function exportStudyToPdf(study) {
  const doc = await renderStudyPdf(study);
  const filename = buildStudyPdfFilename(study);
  doc.save(filename);
  return filename;
}

export async function exportStudyToPptx(study) {
  const blob = buildStudyPptx(study);
  const filename = buildStudyPptxFilename(study);
  downloadPptx(blob, filename);
  return filename;
}
