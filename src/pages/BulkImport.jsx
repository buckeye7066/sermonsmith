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
  const [verses, setVerses] = useState([]);
  const [translationCount, setTranslationCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const [allVerses, translations] = await Promise.all([
        base44.entities.Verse.filter({}, '-created_date', 100),
        base44.entities.Translation.filter({ enabled: true })
      ]);
      
      setVerses(allVerses);
      setTranslationCount(translations.length);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectImport = async () => {
    setIsImporting(true);

    try {
      console.log('[BulkImport] Starting direct import...');
      const response = await base44.functions.invoke('directImport', {});
      console.log('[BulkImport] Response:', response);
      
      toast.success('🚀 Direct import started!', {
        description: 'Importing all Bible translations in the background. This will take 3-4 hours.',
        duration: 10000
      });

      setTimeout(checkStatus, 5000);
    } catch (error) {
      console.error('[BulkImport] Error:', error);
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

  // Count unique translations that have data
  const translationsWithData = new Set(verses.map(v => v.translation_id)).size;
  const totalVerses = verses.length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🚀 Direct Bible Import</h1>

        <Alert className="bg-indigo-50 border-indigo-200">
          <Activity className="h-4 w-4 text-indigo-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-indigo-900">Simple Direct Import</p>
                <p className="text-sm text-indigo-700 mt-1">
                  {translationsWithData}/{translationCount} translations • {totalVerses.toLocaleString()} verses imported
                </p>
              </div>
              <Link to={createPageUrl('ImportStatus')}>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
                  View Status
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
                <h3 className="font-bold text-green-900 text-lg mb-2">✨ New Simple Import</h3>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>✅ One click to import all Bible translations</li>
                  <li>✅ Runs completely in the background</li>
                  <li>✅ Takes ~3-4 hours total</li>
                  <li>✅ You can close the browser - it keeps running</li>
                  <li>✅ Check progress by refreshing this page</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {translationsWithData === 0 && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Click below to start importing all {translationCount} Bible translations. This happens completely in the background.
                </p>
                <Button
                  onClick={handleDirectImport}
                  disabled={isImporting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Starting Import...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5 mr-2" />
                      Start Direct Import
                    </>
                  )}
                </Button>
              </>
            )}

            {translationsWithData > 0 && translationsWithData < translationCount && (
              <>
                <Alert className="bg-blue-50 border-blue-200">
                  <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
                  <AlertDescription className="text-blue-800">
                    <p className="font-semibold">Import in progress...</p>
                    <p className="text-sm mt-1">
                      {translationsWithData} of {translationCount} translations • {totalVerses.toLocaleString()} verses imported
                    </p>
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={checkStatus}
                  variant="outline"
                  className="w-full"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Refresh Status
                </Button>
              </>
            )}

            {translationsWithData === translationCount && translationCount > 0 && (
              <Alert className="bg-indigo-50 border-indigo-200">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-indigo-800">
                  <p className="font-semibold">🎉 Import Complete!</p>
                  <p className="text-sm mt-1">
                    {translationCount} translations • {totalVerses.toLocaleString()} verses ready to use
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Current Status:</h3>
            <ul className="text-sm space-y-1">
              <li>✓ {translationCount} translations enabled</li>
              <li>✓ {translationsWithData} translations have data</li>
              <li>✓ {totalVerses.toLocaleString()} total verses imported</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-dashed">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2 text-xs text-gray-600">💡 How it works:</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Click "Start Direct Import" once</li>
              <li>• Backend fetches all Bible data from bible-api.com</li>
              <li>• Process runs completely in the background</li>
              <li>• Refresh this page to see progress updates</li>
              <li>• Takes ~3-4 hours for all 51 translations</li>
              <li>• You can close the browser - it keeps running on the server</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}