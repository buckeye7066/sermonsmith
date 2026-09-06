/**
 * Client-side sermon PDF export.
 *
 * The backend `exportToPDF`/`exportToPPTX` endpoints are stubs that return a
 * JSON message, not a document; the previous export path wrapped that JSON in a
 * Blob, so a paying user downloaded an unopenable file while the UI reported
 * success. Generating the document here (the same approach QuizViewer already
 * uses) keeps the export honest and works offline.
 *
 * Layout targets the pulpit, not the screen: generous leading, points that stay
 * with their first block of text, and scripture references kept on one line so
 * they are findable at a glance while preaching.
 */

import { saveExportFile } from './downloadBlob.js';
import {
  installUnicodePdfFont,
  PDF_UNICODE_TEXT_OPTIONS,
  selectPdfFont,
} from './pdfUnicodeFont.js';

const MARGIN = 20;
const LINE = 5;
const FOOT = 18;

function sanitizeFilename(text, fallback) {
  const cleaned = String(text || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return cleaned || fallback;
}

/** Normalize a supporting-scripture entry, which may be a string or an object. */
function scriptureLabel(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'object') {
    return String(entry.reference || entry.ref || entry.citation || '').trim();
  }
  return '';
}

export function buildSermonFilename(sermon) {
  return `${sanitizeFilename(sermon?.title, 'sermon')}.pdf`;
}

/**
 * Render a sermon to a jsPDF document and return it (caller decides whether to
 * save it or inspect it — keeping the return value makes this unit-testable).
 */
export async function renderSermonPdf(sermon) {
  if (!sermon || typeof sermon !== 'object') {
    throw new Error('No sermon to export');
  }
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  installUnicodePdfFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const checkPage = (needed = 30) => {
    if (y + needed > pageHeight - FOOT) {
      doc.addPage();
      y = MARGIN;
      return true;
    }
    return false;
  };

  const write = (text, { size = 11, style = 'normal', indent = 0, gap = 3 } = {}) => {
    const value = String(text ?? '').trim();
    if (!value) return;
    doc.setFontSize(size);
    selectPdfFont(doc, value, style);
    const lines = doc.splitTextToSize(value, maxWidth - indent);
    // Keep at least the first two lines of a block with its heading.
    checkPage(Math.min(lines.length, 2) * LINE + gap);
    for (const line of lines) {
      checkPage(LINE);
      doc.text(line, MARGIN + indent, y, PDF_UNICODE_TEXT_OPTIONS);
      y += LINE;
    }
    y += gap;
  };

  const rule = () => {
    checkPage(8);
    doc.setDrawColor(200);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 6;
  };

  // Header
  write(sermon.title || 'Untitled Sermon', { size: 20, style: 'bold', gap: 2 });

  const meta = [];
  if (sermon.anchor_passage) meta.push(sermon.anchor_passage);
  if (sermon.audience) meta.push(`Audience: ${sermon.audience}`);
  if (sermon.scheduled_date || sermon.preached_date) {
    meta.push(`Date: ${sermon.scheduled_date || sermon.preached_date}`);
  }
  write(meta.join('   |   '), { size: 10, gap: 2 });
  rule();

  if (sermon.big_idea) {
    write('BIG IDEA', { size: 9, style: 'bold', gap: 1 });
    write(sermon.big_idea, { size: 12, style: 'italic', gap: 5 });
  }

  if (sermon.introduction) {
    write('INTRODUCTION', { size: 9, style: 'bold', gap: 1 });
    write(sermon.introduction, { gap: 5 });
  }

  const points = Array.isArray(sermon.points) ? sermon.points : [];
  points.forEach((point, index) => {
    checkPage(28);
    write(`${index + 1}. ${point?.title || 'Untitled point'}`, {
      size: 13,
      style: 'bold',
      gap: 2,
    });

    if (point?.exegesis) {
      write('Exegesis', { size: 9, style: 'bold', indent: 4, gap: 1 });
      write(point.exegesis, { indent: 4, gap: 3 });
    }
    if (point?.illustration) {
      write('Illustration', { size: 9, style: 'bold', indent: 4, gap: 1 });
      write(point.illustration, { indent: 4, gap: 3 });
    }
    if (point?.application) {
      write('Application', { size: 9, style: 'bold', indent: 4, gap: 1 });
      write(point.application, { indent: 4, gap: 3 });
    }

    const refs = (Array.isArray(point?.supporting_scriptures) ? point.supporting_scriptures : [])
      .map(scriptureLabel)
      .filter(Boolean);
    if (refs.length) {
      write(`Scriptures: ${refs.join('  ·  ')}`, { size: 10, style: 'italic', indent: 4, gap: 5 });
    } else {
      y += 2;
    }
  });

  if (sermon.conclusion) {
    checkPage(24);
    rule();
    write('CONCLUSION', { size: 9, style: 'bold', gap: 1 });
    write(sermon.conclusion, { gap: 4 });
  }

  if (sermon.theological_notes) {
    checkPage(24);
    write('THEOLOGICAL NOTES', { size: 9, style: 'bold', gap: 1 });
    write(sermon.theological_notes, { size: 10, gap: 4 });
  }

  // Prefer wording_verification; fall back to legacy quotation_verification alias.
  const qv = sermon.wording_verification || sermon.quotation_verification;
  if (qv && typeof qv === 'object') {
    checkPage(28);
    rule();
    write('SCRIPTURE QUOTATION PROVENANCE', { size: 9, style: 'bold', gap: 1 });
    // Honest product language: never claim "verified" when mismatched / unavailable.
    const verifiedLabel = qv.verified === true
      ? 'yes'
      : (qv.overall === 'mismatch'
        ? 'no (mismatch)'
        : (qv.overall === 'provider_unavailable' || qv.overall === 'unsupported_translation'
          ? 'no (unverified — provider unavailable)'
          : 'no'));
    write(
      `Overall: ${qv.overall || 'unknown'}  |  Verified wording: ${verifiedLabel}  |  Checked: ${qv.verifiedAt || 'n/a'}`,
      { size: 9, gap: 2 },
    );
    const quotations = Array.isArray(qv.quotations) ? qv.quotations : [];
    for (const q of quotations) {
      const ref = q?.reference || '(no reference)';
      const status = q?.status || 'unknown';
      const translation = q?.translationId || qv.translationId || '';
      const provider = q?.provider || '';
      write(
        `${ref} — ${status}${translation ? ` [${translation}]` : ''}${provider ? ` via ${provider}` : ''}`,
        { size: 9, indent: 2, gap: 1 },
      );
      if (q?.quotedText && status !== 'exact_full_verse' && status !== 'verified_excerpt') {
        // Surface the claimed quote when it was NOT verified, so the PDF cannot
        // be mistaken for provider-blessed wording.
        write(`Claimed quote (unverified): ${q.quotedText}`, { size: 8, style: 'italic', indent: 4, gap: 2 });
      } else if (q?.quotedText) {
        write(`Quote: ${q.quotedText}`, { size: 8, style: 'italic', indent: 4, gap: 2 });
      }
    }
  }

  // Footer: page numbers on every page, added last so the count is final.
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    selectPdfFont(doc, `Page ${page} of ${pageCount}`, 'normal');
    doc.setTextColor(130);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 10, {
      ...PDF_UNICODE_TEXT_OPTIONS,
      align: 'right',
    });
    doc.text('SermonSmith', MARGIN, pageHeight - 10, PDF_UNICODE_TEXT_OPTIONS);
    doc.setTextColor(0);
  }

  return doc;
}

/** Render and download. Returns the filename actually used. */
export async function exportSermonToPdf(sermon) {
  const doc = await renderSermonPdf(sermon);
  const filename = buildSermonFilename(sermon);
  await saveExportFile(doc.output('blob'), filename);
  return filename;
}
