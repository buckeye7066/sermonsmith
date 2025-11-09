import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Download, BookOpen, RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BulkImport() {
  const [verseCount, setVerseCount] = useState(0);
  const [translationCount, setTranslationCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setIsLoading(true);
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
    if (!window.confirm(
      `This will download all ${translationCount} enabled Bible translations.\n\n` +
      `Total: ~31,000 verses per translation\n` +
      `Time: 30-60 minutes per translation\n\n` +
      `Click OK to start.`
    )) {
      return;
    }

    setIsImporting(true);

    try {
      await base44.functions.invoke('simpleImport', {});
      
      toast.success('Bible import started!', {
        description: 'This will run in the background. Check back in 1-2 hours.',
        duration: 10000
      });
    } catch (error) {
      toast.error('Failed to start import: ' + error.message);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Bible Import</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Download all Bible translations
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={checkStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            <strong>Status:</strong> {verseCount > 0 ? `${verseCount} verses loaded` : 'No verses yet'}
            {' • '}
            {translationCount} translations enabled
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Import All Translations
            </CardTitle>
            <CardDescription>
              Downloads all {translationCount} enabled Bible translations from your Translation entity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
              <div>📥 <strong>Total chapters:</strong> ~31,000 per translation</div>
              <div>⏱️ <strong>Time:</strong> 30-60 minutes per translation</div>
              <div>🔄 <strong>Automatic:</strong> Skips existing verses</div>
              <div>✅ <strong>No monitoring needed</strong></div>
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
                  Start Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">After Import:</h3>
            <ul className="text-sm space-y-1">
              <li>✅ Users can read any Bible translation instantly</li>
              <li>✅ Search works across all verses</li>
              <li>✅ Sermon builder has full access</li>
              <li>✅ No user downloads needed</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}