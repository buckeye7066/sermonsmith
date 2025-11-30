import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 * 
 * Note: PDF export returns binary data on success, envelope on error
 */

async function safeRun(req, base44, user) {
  let body;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body', data: null };
  }

  const { resourceType, resourceId, _selfTest } = body;

  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'exportToPDF is operational', data: null };
  }

  if (!resourceType || !resourceId) {
    return { ok: false, error: 'Missing resourceType or resourceId', data: null };
  }

  let content, title, tags = [];
  
  if (resourceType === 'sermon') {
    const sermons = await base44.entities.Sermon.filter({ id: resourceId, user_id: user.id });
    if (!sermons[0]) {
      return { ok: false, error: 'Sermon not found', data: null };
    }
    content = sermons[0];
    title = content.title;
    
    try {
      const resourceTags = await base44.entities.ResourceTag.filter({
        resource_id: resourceId,
        resource_type: 'sermon',
        user_id: user.id
      });
      tags = resourceTags.map(t => t.tag);
    } catch { tags = []; }
    
  } else if (resourceType === 'study') {
    const studies = await base44.entities.BibleStudy.filter({ id: resourceId, user_id: user.id });
    if (!studies[0]) {
      return { ok: false, error: 'Study not found', data: null };
    }
    content = studies[0];
    title = content.title;
    
    try {
      const resourceTags = await base44.entities.ResourceTag.filter({
        resource_id: resourceId,
        resource_type: 'study',
        user_id: user.id
      });
      tags = resourceTags.map(t => t.tag);
    } catch { tags = []; }
  } else {
    return { ok: false, error: 'Invalid resourceType', data: null };
  }

  // Generate PDF
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const maxWidth = pageWidth - marginLeft - 20;

  const addText = (text, fontSize = 10, isBold = false) => {
    if (yPos > 270) { doc.addPage(); yPos = 20; }
    doc.setFontSize(fontSize);
    doc.setFont(undefined, isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text || '', maxWidth);
    doc.text(lines, marginLeft, yPos);
    yPos += (lines.length * fontSize * 0.5) + 5;
  };

  // Title header
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  const titleLines = doc.splitTextToSize(title, maxWidth);
  doc.text(titleLines, marginLeft, 25);
  yPos = 50;
  doc.setTextColor(0, 0, 0);

  if (tags.length > 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Tags: ${tags.join(', ')}`, marginLeft, yPos);
    yPos += 10;
  }

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Created: ${new Date(content.created_date).toLocaleDateString()}`, marginLeft, yPos);
  yPos += 5;
  doc.text(`Author: ${user.full_name || user.email}`, marginLeft, yPos);
  yPos += 15;
  doc.setTextColor(0, 0, 0);

  if (resourceType === 'sermon') {
    if (content.topic) { addText('Topic', 14, true); addText(content.topic, 11); yPos += 5; }
    if (content.anchor_passage) { addText('Scripture', 14, true); addText(content.anchor_passage, 11); yPos += 5; }
    if (content.big_idea) { addText('Big Idea', 14, true); addText(content.big_idea, 11); yPos += 5; }

    if (content.points?.length > 0) {
      addText('Sermon Points', 16, true);
      yPos += 5;
      content.points.forEach((point, index) => {
        doc.setFillColor(240, 240, 250);
        doc.rect(marginLeft, yPos - 5, maxWidth, 10, 'F');
        addText(`${index + 1}. ${point.title || `Point ${index + 1}`}`, 13, true);
        if (point.exegesis) { addText('Exegesis:', 11, true); addText(point.exegesis, 10); }
        if (point.illustration) { addText('Illustration:', 11, true); addText(point.illustration, 10); }
        if (point.application) { addText('Application:', 11, true); addText(point.application, 10); }
        yPos += 5;
      });
    }
  } else if (resourceType === 'study') {
    if (content.overview) { addText('Overview', 14, true); addText(content.overview, 11); yPos += 5; }
    if (content.key_verses?.length > 0) {
      addText('Key Verses', 14, true);
      content.key_verses.forEach(verse => addText(`• ${verse}`, 10));
      yPos += 5;
    }
    if (content.study_sections?.length > 0) {
      addText('Study Sections', 16, true);
      content.study_sections.forEach((section, index) => {
        addText(`Section ${index + 1}: ${section.title || 'Untitled'}`, 13, true);
        if (section.scripture) { addText('Scripture:', 11, true); addText(section.scripture, 10); }
        if (section.insights) { addText('Insights:', 11, true); addText(section.insights, 10); }
        yPos += 5;
      });
    }
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | Generated by SermonSmith`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return { ok: true, pdf: doc.output('arraybuffer'), title };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized', data: null }, { status: 401 });
    }

    const result = await safeRun(req, base44, user);
    
    if (result.selfTest) {
      return Response.json(result);
    }
    
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error, data: null });
    }

    return new Response(result.pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`
      }
    });

  } catch (err) {
    console.error("[exportToPDF] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});