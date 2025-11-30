import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import PptxGenJS from 'npm:pptxgenjs@3.12.0';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 * 
 * Note: PPTX export returns binary data on success, envelope on error
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
    return { ok: true, selfTest: true, message: 'exportToPPTX is operational', data: null };
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

  // Create presentation
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  
  const primaryColor = '4F46E5';
  const accentColor = '3B82F6';
  const textColor = '1F2937';

  // Title Slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: primaryColor };
  
  titleSlide.addText(title, {
    x: 0.5, y: 2.0, w: 9, h: 1.5,
    fontSize: 44, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
  });
  
  if (tags.length > 0) {
    titleSlide.addText(tags.join(' • '), {
      x: 0.5, y: 3.8, w: 9, h: 0.5,
      fontSize: 16, color: 'E0E7FF', align: 'center'
    });
  }
  
  titleSlide.addText(`${user.full_name || user.email} | ${new Date().toLocaleDateString()}`, {
    x: 0.5, y: 5.0, w: 9, h: 0.3,
    fontSize: 12, color: 'C7D2FE', align: 'center'
  });

  if (resourceType === 'sermon') {
    if (content.topic || content.anchor_passage) {
      const infoSlide = pptx.addSlide();
      infoSlide.addText('Overview', {
        x: 0.5, y: 0.5, w: 9, h: 0.6,
        fontSize: 32, bold: true, color: primaryColor
      });
      
      let yPos = 1.5;
      if (content.topic) {
        infoSlide.addText('Topic:', { x: 0.5, y: yPos, w: 9, h: 0.4, fontSize: 18, bold: true, color: accentColor });
        infoSlide.addText(content.topic, { x: 0.5, y: yPos + 0.5, w: 9, h: 0.5, fontSize: 20, color: textColor });
        yPos += 1.2;
      }
      if (content.anchor_passage) {
        infoSlide.addText('Scripture:', { x: 0.5, y: yPos, w: 9, h: 0.4, fontSize: 18, bold: true, color: accentColor });
        infoSlide.addText(content.anchor_passage, { x: 0.5, y: yPos + 0.5, w: 9, h: 0.5, fontSize: 20, color: textColor, italic: true });
      }
    }

    if (content.big_idea) {
      const bigIdeaSlide = pptx.addSlide();
      bigIdeaSlide.background = { color: 'F3F4F6' };
      bigIdeaSlide.addText('Big Idea', { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 32, bold: true, color: primaryColor });
      bigIdeaSlide.addText(content.big_idea, { x: 1, y: 2, w: 8, h: 3, fontSize: 24, color: textColor, align: 'center', valign: 'middle' });
    }

    if (content.points?.length > 0) {
      content.points.forEach((point, index) => {
        const pointSlide = pptx.addSlide();
        pointSlide.addText(`Point ${index + 1}`, { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 18, bold: true, color: accentColor });
        pointSlide.addText(point.title || `Main Point ${index + 1}`, { x: 0.5, y: 0.8, w: 9, h: 1, fontSize: 32, bold: true, color: primaryColor });
        
        let yPos = 2.2;
        if (point.exegesis) {
          const text = point.exegesis.substring(0, 300);
          pointSlide.addText(text + (point.exegesis.length > 300 ? '...' : ''), {
            x: 0.8, y: yPos, w: 8.4, h: 1.5, fontSize: 16, color: textColor, bullet: true
          });
          yPos += 1.8;
        }
        
        if (point.supporting_scriptures?.length > 0) {
          pointSlide.addText(point.supporting_scriptures.slice(0, 3).join(' • '), {
            x: 0.8, y: yPos, w: 8.4, h: 0.5, fontSize: 14, color: accentColor, italic: true
          });
        }
      });
    }
  } else if (resourceType === 'study') {
    if (content.overview) {
      const overviewSlide = pptx.addSlide();
      overviewSlide.addText('Study Overview', { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 32, bold: true, color: primaryColor });
      overviewSlide.addText(content.overview, { x: 0.8, y: 1.5, w: 8.4, h: 3.5, fontSize: 18, color: textColor });
    }

    if (content.key_verses?.length > 0) {
      const versesSlide = pptx.addSlide();
      versesSlide.addText('Key Verses', { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 32, bold: true, color: primaryColor });
      content.key_verses.slice(0, 5).forEach((verse, index) => {
        versesSlide.addText(verse, { x: 1, y: 1.5 + (index * 0.7), w: 8, h: 0.6, fontSize: 18, color: textColor, bullet: true });
      });
    }

    if (content.study_sections?.length > 0) {
      content.study_sections.forEach((section, index) => {
        const sectionSlide = pptx.addSlide();
        sectionSlide.addText(`Section ${index + 1}`, { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 18, bold: true, color: accentColor });
        sectionSlide.addText(section.title || 'Study Section', { x: 0.5, y: 0.8, w: 9, h: 0.8, fontSize: 28, bold: true, color: primaryColor });
        
        let yPos = 2;
        if (section.scripture) {
          sectionSlide.addText(section.scripture, { x: 0.8, y: yPos, w: 8.4, h: 0.5, fontSize: 16, color: accentColor, italic: true });
          yPos += 0.7;
        }
        if (section.insights) {
          const text = section.insights.substring(0, 250);
          sectionSlide.addText(text + (section.insights.length > 250 ? '...' : ''), { x: 0.8, y: yPos, w: 8.4, h: 2, fontSize: 16, color: textColor });
        }
      });
    }
  }

  // Closing Slide
  const closingSlide = pptx.addSlide();
  closingSlide.background = { color: primaryColor };
  closingSlide.addText('Thank You', { x: 0.5, y: 2.5, w: 9, h: 1, fontSize: 48, bold: true, color: 'FFFFFF', align: 'center' });

  const pptxData = await pptx.write({ outputType: 'arraybuffer' });
  return { ok: true, pptx: pptxData, title };
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

    return new Response(result.pptx, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${result.title.replace(/[^a-z0-9]/gi, '_')}.pptx"`
      }
    });

  } catch (err) {
    console.error("[exportToPPTX] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});