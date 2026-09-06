import {
  buildPresentationPptx,
  downloadPptx,
  paginateSlideParagraphs,
  splitSlideText,
} from './sermonPptx.js';
import { persistStudyPdf } from './studyPdf.js';
import {
  installUnicodePdfFont,
  PDF_UNICODE_TEXT_OPTIONS,
  selectPdfFont,
} from './pdfUnicodeFont.js';

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function sanitizeFilename(text, fallback) {
  const cleaned = String(text || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
    .slice(0, 60);
  return cleaned || fallback;
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

  const overview = splitSlideText(study.overview).map((text) => ({ text }));
  if (overview.length) slides.push(...paginateSlideParagraphs('Overview', overview));

  const keyVerses = (Array.isArray(study.key_verses) ? study.key_verses : [])
    .flatMap((verse) => splitSlideText(verse).map((text) => ({ text, bullet: true })));
  if (keyVerses.length) slides.push(...paginateSlideParagraphs('Key Verses', keyVerses));

  const sections = Array.isArray(study.study_sections) ? study.study_sections : [];
  sections.forEach((section, index) => {
    const paragraphs = [];
    for (const part of splitSlideText(section?.scripture)) paragraphs.push({ text: `Scripture — ${part}`, emphasis: true });
    for (const part of splitSlideText(section?.insights)) paragraphs.push({ text: `Insights — ${part}` });
    for (const question of (Array.isArray(section?.questions) ? section.questions : [])) {
      for (const part of splitSlideText(question)) paragraphs.push({ text: `Question — ${part}`, bullet: true });
    }
    for (const part of splitSlideText(section?.application)) paragraphs.push({ text: `Application — ${part}`, emphasis: true });
    slides.push(...paginateSlideParagraphs(`${index + 1}. ${normalizeText(section?.title) || 'Study section'}`, paragraphs));
  });

  const conclusion = splitSlideText(study.conclusion).map((text) => ({ text }));
  if (conclusion.length) slides.push(...paginateSlideParagraphs('Conclusion', conclusion));
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
  installUnicodePdfFont(doc);
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
    selectPdfFont(doc, value, style);
    const lines = doc.splitTextToSize(value, maxWidth - indent);
    checkPage(Math.min(lines.length, 2) * lineHeight + gap);
    for (const line of lines) {
      checkPage(lineHeight);
      doc.text(line, margin + indent, y, PDF_UNICODE_TEXT_OPTIONS);
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
    selectPdfFont(doc, 'SermonSmith Bible Study', 'normal');
    doc.text('SermonSmith Bible Study', margin, pageHeight - 10, PDF_UNICODE_TEXT_OPTIONS);
    doc.text(`Page ${current} of ${pageCount}`, pageWidth - margin, pageHeight - 10, {
      ...PDF_UNICODE_TEXT_OPTIONS,
      align: 'right',
    });
    doc.setTextColor(0);
  }
  return doc;
}

export function buildStudyPdfFilename(study) {
  return `${sanitizeFilename(study?.title, 'bible-study')}.pdf`;
}

/**
 * Render with the Unicode-capable renderer above, then persist through the
 * platform-aware writer in studyPdf.js. That writer already handles the
 * Electron save dialog (and its cancel result), the Android/iOS durable
 * Documents copy plus share sheet, and the plain browser download - so the
 * Unicode upgrade must not bypass it. A null return means the user cancelled.
 */
export async function exportStudyToPdf(study) {
  const doc = await renderStudyPdf(study);
  const filename = buildStudyPdfFilename(study);
  return persistStudyPdf(doc, filename);
}

export async function exportStudyToPptx(study) {
  const blob = buildStudyPptx(study);
  const filename = buildStudyPptxFilename(study);
  await downloadPptx(blob, filename);
  return filename;
}
