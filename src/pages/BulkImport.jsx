import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Database, CheckCircle2, Activity, ArrowRight, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function BulkImport() {
  const [importJobs, setImportJobs] = useState([]);
  const [translationCount, setTranslationCount] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
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
      
      toast.success('Resilient import worker started!', {
        description: 'Check Import Status page for live progress.',
        duration: 8000,
        action: {
          label: 'View Status',
          onClick: () => {
            window.location.href = createPageUrl('ImportStatus');
          }
        }
      });

      setTimeout(checkStatus, 2000);
    } catch (error) {
      toast.error('Failed to start import: ' + error.message);
    } finally {
      setIsStarting(false);
    }
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
        <h1 className="text-3xl font-bold">🚀 Resilient Bible Import System</h1>

        <Alert className="bg-indigo-50 border-indigo-200">
          <Activity className="h-4 w-4 text-indigo-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-indigo-900">Production-Grade Import Worker</p>
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
              <Rocket className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-green-900 text-lg mb-2">💪 Enterprise-Grade Features</h3>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>✅ Persistent queue survives disconnects</li>
                  <li>✅ Auto-retry with exponential backoff (up to 5 attempts)</li>
                  <li>✅ Watchdog timer detects stalled imports</li>
                  <li>✅ Heartbeat monitoring every 10 chapters</li>
                  <li>✅ Post-import validation & verification</li>
                  <li>✅ Delta-based resume from any failure</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import System Architecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Background worker processes queue independently</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Database-backed status tracking (ImportJob entity)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Smart retry: 2s → 5s → 15s → 30s → 60s backoff</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Watchdog restarts stalled jobs after 10 minutes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Automatic validation pass after completion</span>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <strong>How it works:</strong> The worker runs continuously in the background, processing one translation at a time. 
              If the browser closes, the worker continues. If the server restarts, the worker resumes from the last saved state.
            </div>

            <Button
              onClick={handleStartImport}
              disabled={isStarting || activeJobs > 0}
              className="w-full"
              size="lg"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting Worker...
                </>
              ) : activeJobs > 0 ? (
                <>
                  <Activity className="w-5 h-5 mr-2 animate-pulse" />
                  Worker Running ({activeJobs} active)
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Resilient Import Worker
                </>
              )}
            </Button>

            {(isStarting || activeJobs > 0) && (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Worker running in background...</p>
                <Link to={createPageUrl('ImportStatus')}>
                  <Button variant="outline" className="w-full">
                    <Activity className="w-4 h-4 mr-2 animate-pulse" />
                    Monitor Live Progress
                  </Button>
                </Link>
              </div>
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
              <li>✓ {activeJobs} currently processing</li>
              <li>✓ {pendingJobs} queued for import</li>
              {failedJobs > 0 && <li className="text-red-600">✗ {failedJobs} failed (see logs)</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}