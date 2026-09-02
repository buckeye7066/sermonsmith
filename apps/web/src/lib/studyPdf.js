const MARGIN = 20;
const LINE_HEIGHT = 5;
const FOOTER_HEIGHT = 18;

function safeFilename(value) {
  return String(value || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'bible-study';
}

export function buildStudyFilename(study) {
  return `${safeFilename(study?.title)}.pdf`;
}

export async function renderStudyPdf(study) {
  if (!study || typeof study !== 'object') {
    throw new Error('No study guide to export');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const ensureRoom = (needed = 25) => {
    if (y + needed > pageHeight - FOOTER_HEIGHT) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const write = (value, { size = 11, style = 'normal', indent = 0, gap = 3 } = {}) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont(undefined, style);
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    ensureRoom(Math.min(lines.length, 2) * LINE_HEIGHT + gap);
    for (const line of lines) {
      ensureRoom(LINE_HEIGHT);
      doc.text(line, MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
    y += gap;
  };

  const heading = (value) => write(value, { size: 9, style: 'bold', gap: 1 });

  write(study.title || 'Bible Study', { size: 20, style: 'bold', gap: 2 });
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
    ensureRoom(30);
    write(`${index + 1}. ${section?.title || 'Study section'}`, { size: 14, style: 'bold', gap: 3 });
    if (section?.scripture) {
      heading('SCRIPTURE');
      write(section.scripture, { style: 'italic', indent: 3, gap: 3 });
    }
    if (section?.insights) {
      heading('INSIGHTS');
      write(section.insights, { indent: 3, gap: 3 });
    }
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    if (questions.length) {
      heading('DISCUSSION QUESTIONS');
      questions.forEach((question, questionIndex) => {
        write(`${questionIndex + 1}. ${question}`, { indent: 3, gap: 2 });
      });
    }
    if (section?.application) {
      heading('APPLICATION');
      write(section.application, { indent: 3, gap: 5 });
    }
  });

  if (study.conclusion) {
    ensureRoom(25);
    heading('CONCLUSION');
    write(study.conclusion, { gap: 4 });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(130);
    doc.text('SermonSmith', MARGIN, pageHeight - 10);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 10, { align: 'right' });
    doc.setTextColor(0);
  }

  return doc;
}

export async function exportStudyToPdf(study) {
  const doc = await renderStudyPdf(study);
  const filename = buildStudyFilename(study);
  doc.save(filename);
  return filename;
}
