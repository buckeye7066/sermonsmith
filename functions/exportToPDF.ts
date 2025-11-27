import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resourceType, resourceId } = await req.json();

    let content, title, tags = [];
    
    // Fetch resource based on type
    if (resourceType === 'sermon') {
      const sermons = await base44.entities.Sermon.filter({ id: resourceId, user_id: user.id });
      if (!sermons[0]) {
        return Response.json({ error: 'Sermon not found' }, { status: 404 });
      }
      content = sermons[0];
      title = content.title;
      
      // Get tags
      const resourceTags = await base44.entities.ResourceTag.filter({
        resource_id: resourceId,
        resource_type: 'sermon',
        user_id: user.id
      });
      tags = resourceTags.map(t => t.tag);
      
    } else if (resourceType === 'study') {
      const studies = await base44.entities.BibleStudy.filter({ id: resourceId, user_id: user.id });
      if (!studies[0]) {
        return Response.json({ error: 'Study not found' }, { status: 404 });
      }
      content = studies[0];
      title = content.title;
      
      // Get tags
      const resourceTags = await base44.entities.ResourceTag.filter({
        resource_id: resourceId,
        resource_type: 'study',
        user_id: user.id
      });
      tags = resourceTags.map(t => t.tag);
    }

    // Create PDF
    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 20;
    const marginRight = 20;
    const maxWidth = pageWidth - marginLeft - marginRight;

    // Helper function to add text with auto page break
    const addText = (text, fontSize = 10, isBold = false) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(fontSize);
      if (isBold) {
        doc.setFont(undefined, 'bold');
      } else {
        doc.setFont(undefined, 'normal');
      }
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, marginLeft, yPos);
      yPos += (lines.length * fontSize * 0.5) + 5;
    };

    // Title
    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    const titleLines = doc.splitTextToSize(title, maxWidth);
    doc.text(titleLines, marginLeft, 25);
    yPos = 50;
    doc.setTextColor(0, 0, 0);

    // Tags
    if (tags.length > 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Tags: ${tags.join(', ')}`, marginLeft, yPos);
      yPos += 10;
    }

    // Metadata
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Created: ${new Date(content.created_date).toLocaleDateString()}`, marginLeft, yPos);
    yPos += 5;
    doc.text(`Author: ${user.full_name || user.email}`, marginLeft, yPos);
    yPos += 15;
    doc.setTextColor(0, 0, 0);

    // Content based on type
    if (resourceType === 'sermon') {
      // Topic
      if (content.topic) {
        addText('Topic', 14, true);
        addText(content.topic, 11);
        yPos += 5;
      }

      // Anchor Passage
      if (content.anchor_passage) {
        addText('Scripture', 14, true);
        addText(content.anchor_passage, 11);
        yPos += 5;
      }

      // Big Idea
      if (content.big_idea) {
        addText('Big Idea', 14, true);
        addText(content.big_idea, 11);
        yPos += 5;
      }

      // Denominational Perspective
      if (content.denominational_perspective) {
        addText('Theological Perspective', 14, true);
        addText(content.denominational_perspective, 10);
        yPos += 5;
      }

      // Points
      if (content.points && content.points.length > 0) {
        addText('Sermon Points', 16, true);
        yPos += 5;

        content.points.forEach((point, index) => {
          // Point title
          doc.setFillColor(240, 240, 250);
          doc.rect(marginLeft, yPos - 5, maxWidth, 10, 'F');
          addText(`${index + 1}. ${point.title || `Point ${index + 1}`}`, 13, true);
          yPos += 2;

          // Exegesis
          if (point.exegesis) {
            addText('Exegesis:', 11, true);
            addText(point.exegesis, 10);
            yPos += 3;
          }

          // Illustration
          if (point.illustration) {
            addText('Illustration:', 11, true);
            addText(point.illustration, 10);
            yPos += 3;
          }

          // Application
          if (point.application) {
            addText('Application:', 11, true);
            addText(point.application, 10);
            yPos += 3;
          }

          // Supporting Scriptures
          if (point.supporting_scriptures && point.supporting_scriptures.length > 0) {
            addText('Supporting Scriptures:', 11, true);
            addText(point.supporting_scriptures.join(', '), 10);
            yPos += 3;
          }

          yPos += 5;
        });
      }

      // Citations
      if (content.citations && content.citations.length > 0) {
        addText('References', 14, true);
        content.citations.forEach((citation) => {
          addText(`• ${citation}`, 9);
        });
      }

    } else if (resourceType === 'study') {
      // Overview
      if (content.overview) {
        addText('Overview', 14, true);
        addText(content.overview, 11);
        yPos += 5;
      }

      // Key Verses
      if (content.key_verses && content.key_verses.length > 0) {
        addText('Key Verses', 14, true);
        content.key_verses.forEach((verse) => {
          addText(`• ${verse}`, 10);
        });
        yPos += 5;
      }

      // Study Sections
      if (content.study_sections && content.study_sections.length > 0) {
        addText('Study Sections', 16, true);
        yPos += 5;

        content.study_sections.forEach((section, index) => {
          doc.setFillColor(240, 240, 250);
          doc.rect(marginLeft, yPos - 5, maxWidth, 10, 'F');
          addText(`Section ${index + 1}: ${section.title || 'Untitled'}`, 13, true);
          yPos += 2;

          if (section.scripture) {
            addText('Scripture:', 11, true);
            addText(section.scripture, 10);
            yPos += 3;
          }

          if (section.insights) {
            addText('Insights:', 11, true);
            addText(section.insights, 10);
            yPos += 3;
          }

          if (section.questions && section.questions.length > 0) {
            addText('Discussion Questions:', 11, true);
            section.questions.forEach((q) => {
              addText(`• ${q}`, 10);
            });
            yPos += 3;
          }

          if (section.application) {
            addText('Application:', 11, true);
            addText(section.application, 10);
            yPos += 3;
          }

          yPos += 5;
        });
      }

      // Conclusion
      if (content.conclusion) {
        addText('Conclusion', 14, true);
        addText(content.conclusion, 11);
      }
    }

    // Footer on last page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by SermonSmith | ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Generate PDF as ArrayBuffer
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.pdf"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});