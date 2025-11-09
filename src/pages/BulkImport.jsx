import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Database, CheckCircle2, Activity, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function BulkImport() {
  const [verseCount, setVerseCount] = useState(0);
  const [translationCount, setTranslationCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const [verses, translations] = await Promise.all([
        base44.entities.Verse.filter({}, 'id', 100),
        base44.entities.Translation.filter({ enabled: true })
      ]);
      setVerseCount(verses.length);
      setTranslationCount(translations.length);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);

    try {
      await base44.functions.invoke('simpleImport', {});
      
      toast.success('Import started', {
        description: 'Check Import Status page for live progress.',
        duration: 8000,
        action: {
          label: 'View Status',
          onClick: () => {
            window.location.href = createPageUrl('ImportStatus');
          }
        }
      });
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Bible Import</h1>

        <Alert className="bg-indigo-50 border-indigo-200">
          <Activity className="h-4 w-4 text-indigo-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="text-indigo-900">
                {verseCount > 0 ? `${verseCount} verses loaded` : 'No verses yet'} • {translationCount} translations enabled
              </span>
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
              <Activity className="w-6 h-6 text-green-600 flex-shrink-0 mt-1 animate-pulse" />
              <div className="flex-1">
                <h3 className="font-bold text-green-900 text-lg mb-2">📊 Real-Time Import Monitoring Available!</h3>
                <p className="text-green-800 text-sm mb-3">
                  Track your import progress live with auto-refreshing stats, completion percentages, and event logs.
                </p>
                <Link to={createPageUrl('ImportStatus')}>
                  <Button className="bg-green-600 hover:bg-green-700 w-full">
                    <Activity className="w-4 h-4 mr-2" />
                    Open Import Status Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sequential Import System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Single-threaded sequential mode</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>2-3 second pause between translations</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Auto-retry on failure (2 attempts, 5s delay)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Auto-resume after interruption (30s cooldown)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Post-import validation included</span>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <strong>Process:</strong> Downloads {translationCount} translations one at a time.
              Streams verses directly to database. Skips existing verses automatically.
            </div>

            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Import Started...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Start Sequential Import
                </>
              )}
            </Button>

            {isImporting && (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Import running in background...</p>
                <Link to={createPageUrl('ImportStatus')}>
                  <Button variant="outline" className="w-full">
                    <Activity className="w-4 h-4 mr-2 animate-pulse" />
                    Monitor Progress Live
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">After Completion:</h3>
            <ul className="text-sm space-y-1">
              <li>✓ All translations available instantly</li>
              <li>✓ Validation results in Import Status page</li>
              <li>✓ Verse counts per translation confirmed</li>
              <li>✓ Ready for production use</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}