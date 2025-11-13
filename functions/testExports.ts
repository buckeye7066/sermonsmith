import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden - Admin access required',
        user_email: user.email,
        user_role: user.role
      }, { status: 403 });
    }

    console.log('🧪 TESTING EXPORT FUNCTIONS...');

    const tests = [];

    // TEST 1: jsPDF availability
    console.log('\n📄 TEST 1: PDF Export Dependencies');
    const pdfTest = {
      name: 'PDF Export (jsPDF)',
      status: 'running'
    };

    try {
      const { jsPDF } = await import('npm:jspdf@2.5.1');
      
      // Create a test PDF
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Test PDF', 20, 20);
      
      const pdfBytes = doc.output('arraybuffer');
      
      if (pdfBytes && pdfBytes.byteLength > 0) {
        pdfTest.result = {
          status: '✅ PASSED',
          message: 'jsPDF is working correctly',
          details: {
            pdfSize: `${pdfBytes.byteLength} bytes`,
            version: '2.5.1'
          }
        };
        console.log(`  ✅ PDF generated: ${pdfBytes.byteLength} bytes`);
      } else {
        throw new Error('PDF generation returned empty buffer');
      }

      pdfTest.status = 'passed';
    } catch (e) {
      pdfTest.result = {
        status: '❌ FAILED',
        message: e.message,
        recommendation: 'Check jsPDF import and version'
      };
      pdfTest.status = 'failed';
      console.log('  ❌ PDF test failed:', e.message);
    }

    tests.push(pdfTest);

    // TEST 2: PptxGenJS availability
    console.log('\n📊 TEST 2: PowerPoint Export Dependencies');
    const pptxTest = {
      name: 'PPTX Export (PptxGenJS)',
      status: 'running'
    };

    try {
      const PptxGenJS = (await import('npm:pptxgenjs@3.12.0')).default;
      
      // Create a test presentation
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slide.addText('Test Slide', {
        x: 1,
        y: 1,
        fontSize: 24,
        bold: true
      });
      
      const pptxData = await pptx.write({ outputType: 'arraybuffer' });
      
      if (pptxData && pptxData.byteLength > 0) {
        pptxTest.result = {
          status: '✅ PASSED',
          message: 'PptxGenJS is working correctly',
          details: {
            pptxSize: `${pptxData.byteLength} bytes`,
            version: '3.12.0'
          }
        };
        console.log(`  ✅ PPTX generated: ${pptxData.byteLength} bytes`);
      } else {
        throw new Error('PPTX generation returned empty buffer');
      }

      pptxTest.status = 'passed';
    } catch (e) {
      pptxTest.result = {
        status: '❌ FAILED',
        message: e.message,
        recommendation: 'Check PptxGenJS import and version'
      };
      pptxTest.status = 'failed';
      console.log('  ❌ PPTX test failed:', e.message);
    }

    tests.push(pptxTest);

    // TEST 3: Sermon data availability
    console.log('\n📖 TEST 3: Sermon Data Access');
    const sermonTest = {
      name: 'Sermon Data Access',
      status: 'running'
    };

    try {
      const sermons = await base44.entities.Sermon.filter({ user_id: user.id }, 'id', 1);
      
      sermonTest.result = {
        status: sermons.length > 0 ? '✅ DATA AVAILABLE' : '⚠️ NO SERMONS',
        message: sermons.length > 0 
          ? 'User has sermons available for export'
          : 'No sermons found (expected for new users)',
        count: sermons.length
      };
      
      console.log(`  Sermons found: ${sermons.length}`);
      
      sermonTest.status = 'passed';
    } catch (e) {
      sermonTest.result = {
        status: '❌ FAILED',
        message: e.message
      };
      sermonTest.status = 'failed';
      console.log('  ❌ Sermon access failed:', e.message);
    }

    tests.push(sermonTest);

    // TEST 4: Study data availability
    console.log('\n📚 TEST 4: Study Data Access');
    const studyTest = {
      name: 'Study Data Access',
      status: 'running'
    };

    try {
      const studies = await base44.entities.BibleStudy.filter({ user_id: user.id }, 'id', 1);
      
      studyTest.result = {
        status: studies.length > 0 ? '✅ DATA AVAILABLE' : '⚠️ NO STUDIES',
        message: studies.length > 0 
          ? 'User has studies available for export'
          : 'No studies found (expected for new users)',
        count: studies.length
      };
      
      console.log(`  Studies found: ${studies.length}`);
      
      studyTest.status = 'passed';
    } catch (e) {
      studyTest.result = {
        status: '❌ FAILED',
        message: e.message
      };
      studyTest.status = 'failed';
      console.log('  ❌ Study access failed:', e.message);
    }

    tests.push(studyTest);

    // Summary
    const summary = {
      total: tests.length,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length,
      warnings: tests.filter(t => t.status === 'warning').length
    };

    console.log('\n📊 EXPORT TEST SUMMARY:');
    console.log(`  ✅ Passed: ${summary.passed}`);
    console.log(`  ❌ Failed: ${summary.failed}`);
    console.log(`  ⚠️ Warnings: ${summary.warnings}`);

    return Response.json({
      success: true,
      message: 'Export function tests completed',
      tests,
      summary,
      overallStatus: summary.failed === 0 ? 'OPERATIONAL' : 'ISSUES_DETECTED',
      readyForExport: summary.failed === 0,
      notes: [
        'PDF and PPTX libraries are loaded on-demand',
        'Actual export performance may vary based on content size',
        'No user data is required for libraries to work'
      ]
    });

  } catch (error) {
    console.error('❌ EXPORT TEST FAILED:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});