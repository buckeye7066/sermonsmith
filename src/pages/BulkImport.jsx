import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Database, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
        description: 'Sequential processing with auto-retry. Check server logs.',
        duration: 8000
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

        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            {verseCount > 0 ? `${verseCount} verses loaded` : 'No verses yet'} • {translationCount} translations enabled
          </AlertDescription>
        </Alert>

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
              Check Deno Deploy logs for progress.
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
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">After Completion:</h3>
            <ul className="text-sm space-y-1">
              <li>✓ All translations available instantly</li>
              <li>✓ Validation results in server logs</li>
              <li>✓ Verse counts per translation confirmed</li>
              <li>✓ Ready for production use</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}