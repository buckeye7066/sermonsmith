import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import PptxGenJS from 'npm:pptxgenjs@3.12.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resourceType, resourceId, _selfTest } = body;

    // Handle self-test from system check
    if (_selfTest) {
      return Response.json({ ok: true, message: 'PPTX export function is operational' });
    }

    let content, title, tags = [];
    
    // Fetch resource
    if (resourceType === 'sermon') {
      const sermons = await base44.entities.Sermon.filter({ id: resourceId, user_id: user.id });
      if (!sermons[0]) {
        return Response.json({ error: 'Sermon not found' }, { status: 404 });
      }
      content = sermons[0];
      title = content.title;
      
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
      
      const resourceTags = await base44.entities.ResourceTag.filter({
        resource_id: resourceId,
        resource_type: 'study',
        user_id: user.id
      });
      tags = resourceTags.map(t => t.tag);
    }

    // Create presentation
    const pptx = new PptxGenJS();
    
    // Set layout
    pptx.layout = 'LAYOUT_16x9';
    
    // Define color scheme
    const primaryColor = '4F46E5'; // Indigo
    const accentColor = '3B82F6'; // Blue
    const textColor = '1F2937'; // Gray-800

    // Title Slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: primaryColor };
    
    titleSlide.addText(title, {
      x: 0.5,
      y: 2.0,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle'
    });
    
    if (tags.length > 0) {
      titleSlide.addText(tags.join(' • '), {
        x: 0.5,
        y: 3.8,
        w: 9,
        h: 0.5,
        fontSize: 16,
        color: 'E0E7FF',
        align: 'center'
      });
    }
    
    titleSlide.addText(`${user.full_name || user.email} | ${new Date().toLocaleDateString()}`, {
      x: 0.5,
      y: 5.0,
      w: 9,
      h: 0.3,
      fontSize: 12,
      color: 'C7D2FE',
      align: 'center'
    });

    if (resourceType === 'sermon') {
      // Topic & Scripture Slide
      if (content.topic || content.anchor_passage) {
        const infoSlide = pptx.addSlide();
        infoSlide.addText('Overview', {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.6,
          fontSize: 32,
          bold: true,
          color: primaryColor
        });
        
        let yPos = 1.5;
        
        if (content.topic) {
          infoSlide.addText('Topic:', {
            x: 0.5,
            y: yPos,
            w: 9,
            h: 0.4,
            fontSize: 18,
            bold: true,
            color: accentColor
          });
          infoSlide.addText(content.topic, {
            x: 0.5,
            y: yPos + 0.5,
            w: 9,
            h: 0.5,
            fontSize: 20,
            color: textColor
          });
          yPos += 1.2;
        }
        
        if (content.anchor_passage) {
          infoSlide.addText('Scripture:', {
            x: 0.5,
            y: yPos,
            w: 9,
            h: 0.4,
            fontSize: 18,
            bold: true,
            color: accentColor
          });
          infoSlide.addText(content.anchor_passage, {
            x: 0.5,
            y: yPos + 0.5,
            w: 9,
            h: 0.5,
            fontSize: 20,
            color: textColor,
            italic: true
          });
        }
      }

      // Big Idea Slide
      if (content.big_idea) {
        const bigIdeaSlide = pptx.addSlide();
        bigIdeaSlide.background = { color: 'F3F4F6' };
        
        bigIdeaSlide.addText('Big Idea', {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.6,
          fontSize: 32,
          bold: true,
          color: primaryColor
        });
        
        bigIdeaSlide.addText(content.big_idea, {
          x: 1,
          y: 2,
          w: 8,
          h: 3,
          fontSize: 24,
          color: textColor,
          align: 'center',
          valign: 'middle'
        });
      }

      // Sermon Points
      if (content.points && content.points.length > 0) {
        content.points.forEach((point, index) => {
          const pointSlide = pptx.addSlide();
          
          // Point title
          pointSlide.addText(`Point ${index + 1}`, {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.4,
            fontSize: 18,
            bold: true,
            color: accentColor
          });
          
          pointSlide.addText(point.title || `Main Point ${index + 1}`, {
            x: 0.5,
            y: 0.8,
            w: 9,
            h: 1,
            fontSize: 32,
            bold: true,
            color: primaryColor
          });
          
          let yPos = 2.2;
          
          // Key content
          if (point.exegesis) {
            const text = point.exegesis.substring(0, 300);
            pointSlide.addText(text + (point.exegesis.length > 300 ? '...' : ''), {
              x: 0.8,
              y: yPos,
              w: 8.4,
              h: 1.5,
              fontSize: 16,
              color: textColor,
              bullet: true
            });
            yPos += 1.8;
          }
          
          // Supporting scriptures
          if (point.supporting_scriptures && point.supporting_scriptures.length > 0) {
            pointSlide.addText(point.supporting_scriptures.slice(0, 3).join(' • '), {
              x: 0.8,
              y: yPos,
              w: 8.4,
              h: 0.5,
              fontSize: 14,
              color: accentColor,
              italic: true
            });
          }
        });
      }

    } else if (resourceType === 'study') {
      // Overview Slide
      if (content.overview) {
        const overviewSlide = pptx.addSlide();
        overviewSlide.addText('Study Overview', {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.6,
          fontSize: 32,
          bold: true,
          color: primaryColor
        });
        
        overviewSlide.addText(content.overview, {
          x: 0.8,
          y: 1.5,
          w: 8.4,
          h: 3.5,
          fontSize: 18,
          color: textColor
        });
      }

      // Key Verses Slide
      if (content.key_verses && content.key_verses.length > 0) {
        const versesSlide = pptx.addSlide();
        versesSlide.addText('Key Verses', {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.6,
          fontSize: 32,
          bold: true,
          color: primaryColor
        });
        
        content.key_verses.slice(0, 5).forEach((verse, index) => {
          versesSlide.addText(verse, {
            x: 1,
            y: 1.5 + (index * 0.7),
            w: 8,
            h: 0.6,
            fontSize: 18,
            color: textColor,
            bullet: true
          });
        });
      }

      // Study Sections
      if (content.study_sections && content.study_sections.length > 0) {
        content.study_sections.forEach((section, index) => {
          const sectionSlide = pptx.addSlide();
          
          sectionSlide.addText(`Section ${index + 1}`, {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.4,
            fontSize: 18,
            bold: true,
            color: accentColor
          });
          
          sectionSlide.addText(section.title || 'Study Section', {
            x: 0.5,
            y: 0.8,
            w: 9,
            h: 0.8,
            fontSize: 28,
            bold: true,
            color: primaryColor
          });
          
          let yPos = 2;
          
          if (section.scripture) {
            sectionSlide.addText(section.scripture, {
              x: 0.8,
              y: yPos,
              w: 8.4,
              h: 0.5,
              fontSize: 16,
              color: accentColor,
              italic: true
            });
            yPos += 0.7;
          }
          
          if (section.insights) {
            const text = section.insights.substring(0, 250);
            sectionSlide.addText(text + (section.insights.length > 250 ? '...' : ''), {
              x: 0.8,
              y: yPos,
              w: 8.4,
              h: 2,
              fontSize: 16,
              color: textColor
            });
          }
        });
      }
    }

    // Closing Slide
    const closingSlide = pptx.addSlide();
    closingSlide.background = { color: primaryColor };
    closingSlide.addText('Thank You', {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 1,
      fontSize: 48,
      bold: true,
      color: 'FFFFFF',
      align: 'center'
    });

    // Generate PPTX
    const pptxData = await pptx.write({ outputType: 'arraybuffer' });

    return new Response(pptxData, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.pptx"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});