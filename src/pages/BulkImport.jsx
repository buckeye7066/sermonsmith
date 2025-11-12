import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Database, CheckCircle2, Activity, ArrowRight, Rocket, Clock, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function BulkImport() {
  const [importJobs, setImportJobs] = useState([]);
  const [translationCount, setTranslationCount] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [tickStatus, setTickStatus] = useState('');
  const autoRunRef = useRef(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => {
      clearInterval(interval);
      if (autoRunRef.current) {
        clearTimeout(autoRunRef.current);
      }
    };
  }, []);

  const checkStatus = async () => {
    try {
      const [jobs, translations] = await Promise.all([
        base44.entities.ImportJob.filter({}),
        base44.entities.Translation.filter({ enabled: true })
      ]);
      
      setImportJobs(jobs);
      setTranslationCount(translations.length);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartImport = async () => {
    setIsStarting(true);

    try {
      const response = await base44.functions.invoke('startImportWorker', {});
      
      toast.success('Import system initialized!', {
        description: 'Jobs created. Now start the auto-runner.',
        duration: 5000
      });

      setTimeout(checkStatus, 2000);
    } catch (error) {
      toast.error('Failed to start import: ' + error.message);
    } finally {
      setIsStarting(false);
    }
  };

  const runTick = async () => {
    if (!isAutoRunning) return;

    try {
      console.log('[AUTO] Running tick...');
      const response = await base44.functions.invoke('tickImportWorker', {});
      const result = response.data;
      
      console.log('[AUTO] Tick result:', result);
      setTickStatus(result.status);

      if (result.status === 'completed') {
        toast.success(`✅ ${result.translation} completed!`, {
          description: `${result.verses} verses imported`
        });
        await checkStatus();
        // Continue to next translation
        if (isAutoRunning) {
          autoRunRef.current = setTimeout(runTick, 2000);
        }
      } else if (result.status === 'complete') {
        toast.success('🎉 All translations imported!', {
          description: `${result.completed}/${result.total} completed`,
          duration: 10000
        });
        setIsAutoRunning(false);
        await checkStatus();
      } else if (result.status === 'retry') {
        toast.warning(`Retrying ${result.translation}`, {
          description: `Attempt ${result.retries}/5`
        });
        await checkStatus();
        if (isAutoRunning) {
          autoRunRef.current = setTimeout(runTick, result.backoff_seconds * 1000);
        }
      } else if (result.status === 'failed') {
        toast.error(`Failed: ${result.translation}`, {
          description: 'Moving to next translation'
        });
        await checkStatus();
        if (isAutoRunning) {
          autoRunRef.current = setTimeout(runTick, 2000);
        }
      } else {
        // waiting, stalled_reset, etc.
        await checkStatus();
        if (isAutoRunning) {
          autoRunRef.current = setTimeout(runTick, 5000);
        }
      }

    } catch (error) {
      console.error('[AUTO] Tick error:', error);
      toast.error('Tick failed: ' + error.message);
      if (isAutoRunning) {
        autoRunRef.current = setTimeout(runTick, 10000);
      }
    }
  };

  const handleStartAutoRun = () => {
    setIsAutoRunning(true);
    toast.info('🚀 Auto-runner started', {
      description: 'Imports will continue automatically'
    });
    setTimeout(runTick, 1000);
  };

  const handleStopAutoRun = () => {
    setIsAutoRunning(false);
    if (autoRunRef.current) {
      clearTimeout(autoRunRef.current);
      autoRunRef.current = null;
    }
    toast.info('Auto-runner stopped');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  const completedJobs = importJobs.filter(j => j.status === 'completed').length;
  const activeJobs = importJobs.filter(j => j.status === 'in_progress' || j.status === 'retrying').length;
  const pendingJobs = importJobs.filter(j => j.status === 'pending').length;
  const failedJobs = importJobs.filter(j => j.status === 'failed').length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🚀 Tick-Based Bible Import System</h1>

        <Alert className="bg-indigo-50 border-indigo-200">
          <Activity className="h-4 w-4 text-indigo-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-indigo-900">Cron-Style Import Worker</p>
                <p className="text-sm text-indigo-700 mt-1">
                  {completedJobs}/{translationCount} complete • {activeJobs} active • {pendingJobs} pending
                </p>
              </div>
              <Link to={createPageUrl('ImportStatus')}>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
                  View Live Status
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-green-900 text-lg mb-2">⏰ How This Works</h3>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>✅ Each "tick" processes one complete translation (~3-5 min)</li>
                  <li>✅ Auto-runner calls tick repeatedly until all translations complete</li>
                  <li>✅ Can pause/resume anytime without losing progress</li>
                  <li>✅ Each translation completes fully before moving to next</li>
                  <li>✅ Automatic retry with exponential backoff</li>
                  <li>✅ Browser can close - just restart auto-runner when you return</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Control Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {importJobs.length === 0 && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Step 1: Initialize the import system (creates jobs for all translations)
                </p>
                <Button
                  onClick={handleStartImport}
                  disabled={isStarting}
                  className="w-full"
                  size="lg"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Database className="w-5 h-5 mr-2" />
                      Step 1: Initialize Import Jobs
                    </>
                  )}
                </Button>
              </>
            )}

            {importJobs.length > 0 && completedJobs < translationCount && (
              <>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Import Status:</p>
                  <p className="text-xs text-blue-700">
                    ✓ {completedJobs} completed • ⏳ {pendingJobs + activeJobs} remaining • ✗ {failedJobs} failed
                  </p>
                  {tickStatus && (
                    <p className="text-xs text-blue-600 mt-2">
                      Last tick: {tickStatus}
                    </p>
                  )}
                </div>

                {!isAutoRunning ? (
                  <Button
                    onClick={handleStartAutoRun}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Auto-Runner
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopAutoRun}
                    className="w-full bg-red-600 hover:bg-red-700"
                    size="lg"
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    Stop Auto-Runner
                  </Button>
                )}

                {isAutoRunning && (
                  <Alert className="bg-green-50 border-green-200">
                    <Activity className="h-4 w-4 text-green-600 animate-pulse" />
                    <AlertDescription className="text-green-800">
                      <p className="font-semibold">Auto-runner active</p>
                      <p className="text-xs mt-1">Processing translations automatically. You can close this page - just come back and restart the runner later.</p>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-center">
                  <Link to={createPageUrl('ImportStatus')}>
                    <Button variant="outline" className="w-full">
                      <Activity className="w-4 h-4 mr-2" />
                      Monitor Detailed Progress
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {completedJobs === translationCount && translationCount > 0 && (
              <Alert className="bg-indigo-50 border-indigo-200">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-indigo-800">
                  <p className="font-semibold">🎉 All translations imported!</p>
                  <p className="text-sm mt-1">{translationCount} translations ready to use</p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {failedJobs > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2 text-red-900">⚠️ Failed Imports</h3>
              <p className="text-sm text-red-800">
                {failedJobs} translation(s) failed after 5 retry attempts. 
                Check the Import Status page for detailed error logs.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">System Status:</h3>
            <ul className="text-sm space-y-1">
              <li>✓ {translationCount} translations enabled</li>
              <li>✓ {completedJobs} imports completed</li>
              <li>✓ {pendingJobs + activeJobs} remaining</li>
              {failedJobs > 0 && <li className="text-red-600">✗ {failedJobs} failed (see logs)</li>}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-dashed">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2 text-xs text-gray-600">💡 Pro Tips:</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Each translation takes 3-5 minutes to import completely</li>
              <li>• Total time for 51 translations: ~3-4 hours</li>
              <li>• You can pause and resume anytime without losing progress</li>
              <li>• Browser can close - progress is saved in database</li>
              <li>• Check Import Status page for real-time chapter/verse counts</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}