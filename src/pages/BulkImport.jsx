import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Database } from 'lucide-react';
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
        description: 'Processing translations sequentially. Check server logs for progress.',
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
            <CardTitle>Import All Translations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 space-y-1">
              <div>• Processes {translationCount} translations sequentially</div>
              <div>• Skips existing verses automatically</div>
              <div>• 2-3 seconds delay between translations</div>
              <div>• Check server logs for progress</div>
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
                  Started...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Start Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}