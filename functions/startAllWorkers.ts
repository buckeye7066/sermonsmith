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

    console.log('[START ALL WORKERS] Launching 5 parallel workers...');

    // Launch all 5 workers in parallel
    const workers = [
      base44.functions.invoke('importWorker1', {}),
      base44.functions.invoke('importWorker2', {}),
      base44.functions.invoke('importWorker3', {}),
      base44.functions.invoke('importWorker4', {}),
      base44.functions.invoke('importWorker5', {})
    ];

    // Don't wait for completion
    Promise.all(workers).then(() => {
      console.log('[START ALL WORKERS] ✅ All workers completed!');
    }).catch(error => {
      console.error('[START ALL WORKERS] ❌ Worker error:', error.message);
    });

    return Response.json({
      success: true,
      message: '5 parallel workers launched',
      workers: [
        { id: 1, translations: 10, names: ['KJV', 'ASV', 'BBE', 'DARBY', 'WEB', 'YLT', 'ESV', 'NIV', 'NRSV', 'NASB'] },
        { id: 2, translations: 10, names: ['NLT', 'MSG', 'AMP', 'CEV', 'GNT', 'HCSB', 'ISV', 'NET', 'RSV', 'NKJV'] },
        { id: 3, translations: 10, names: ['GW', 'TLB', 'ERV', 'EXB', 'ICB', 'NIRV', 'NCV', 'PHILLIPS', 'VOICE', 'CEB'] },
        { id: 4, translations: 10, names: ['TPT', 'TLV', 'JUB', 'NOG', 'MEV', 'CSB', 'EASY', 'NIVUK', 'RV1885', 'WE'] },
        { id: 5, translations: 11, names: ['DRA', 'AKJV', 'LEB', 'MOUNCE', 'WEBBE', 'WMBBE', 'WMBME', 'RV', 'CPDV', 'JUBILEE2000', 'WEBSTER'] }
      ],
      estimatedTime: '20-30 minutes',
      note: 'All workers running in background. Check import status in a few minutes.'
    });

  } catch (error) {
    console.error('[START ALL WORKERS] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});