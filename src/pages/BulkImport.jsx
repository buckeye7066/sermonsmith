import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Rocket, CheckCircle2, Activity, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function BulkImport() {
  const [status, setStatus] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const response = await base44.functions.invoke('getImportStatus', {});
      setStatus(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWorkers = async () => {
    setIsImporting(true);

    try {
      console.log('[BulkImport] Starting all 5 parallel workers...');
      const response = await base44.functions.invoke('startAllWorkers', {});
      console.log('[BulkImport] Response:', response);
      
      toast.success('🚀 All 5 Workers Launched!', {
        description: '51 translations importing in parallel. Check back in 20-30 minutes.',
        duration: 10000
      });

      setTimeout(checkStatus, 10000);
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

  const completed = status?.completedTranslations || 0;
  const total = status?.totalTranslations || 0;
  const totalVerses = status?.totalVerses || 0;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">⚡ Multi-Worker Bible Import</h1>

        <Alert className="bg-indigo-50 border-indigo-200">
          <Activity className="h-4 w-4 text-indigo-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-indigo-900">Import Status</p>
                <p className="text-sm text-indigo-700 mt-1">
                  {completed}/{total} translations • {totalVerses.toLocaleString()} verses imported
                </p>
              </div>
              <Link to={createPageUrl('ImportStatus')}>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
                  View Details
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>

        {completed === 0 && (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Zap className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-green-900 text-lg mb-2">⚡ 5 Parallel Workers</h3>
                  <ul className="text-green-800 text-sm space-y-1">
                    <li>✅ Worker 1: 10 translations (KJV, ASV, BBE, etc.)</li>
                    <li>✅ Worker 2: 10 translations (NLT, MSG, AMP, etc.)</li>
                    <li>✅ Worker 3: 10 translations (GW, TLB, ERV, etc.)</li>
                    <li>✅ Worker 4: 10 translations (TPT, TLV, JUB, etc.)</li>
                    <li>✅ Worker 5: 11 translations (DRA, AKJV, LEB, etc.)</li>
                    <li className="pt-2 font-semibold">🚀 All 51 translations import simultaneously in 20-30 min!</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Import Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {completed === 0 && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Launch 5 parallel workers that each handle 10-11 translations simultaneously. Each worker operates independently and stays under the 15-minute limit. Total completion time: ~20-30 minutes.
                </p>
                <Button
                  onClick={handleStartWorkers}
                  disabled={isImporting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Launching Workers...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Launch 5 Parallel Workers
                    </>
                  )}
                </Button>
              </>
            )}

            {completed > 0 && completed < total && (
              <>
                <Alert className="bg-blue-50 border-blue-200">
                  <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
                  <AlertDescription className="text-blue-800">
                    <p className="font-semibold">Workers importing...</p>
                    <p className="text-sm mt-1">
                      {completed} of {total} translations complete ({percentComplete}%)
                    </p>
                    <div className="mt-2 bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentComplete}%` }}
                      />
                    </div>
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

            {completed === total && total > 0 && (
              <Alert className="bg-indigo-50 border-indigo-200">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-indigo-800">
                  <p className="font-semibold">🎉 All Workers Complete!</p>
                  <p className="text-sm mt-1">
                    All {total} translations imported • {totalVerses.toLocaleString()} verses ready
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">How It Works:</h3>
            <ul className="text-sm space-y-1">
              <li>🚀 5 independent workers run simultaneously</li>
              <li>⚡ Each worker imports 10-11 translations</li>
              <li>⏱️ Each worker completes in ~10-12 minutes</li>
              <li>🔄 All 51 translations done in 20-30 minutes total</li>
              <li>💻 You can close the browser - keeps running!</li>
            </ul>
          </CardContent>
        </Card>

        {status?.translations && status.translations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Translation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {status.translations.map((trans) => (
                  <div key={trans.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-mono text-sm font-semibold">{trans.id}</span>
                      <span className="text-xs text-gray-600 ml-2">{trans.name}</span>
                    </div>
                    <div className="text-right">
                      {trans.complete ? (
                        <span className="text-green-600 text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {trans.verses.toLocaleString()} verses
                        </span>
                      ) : trans.verses > 0 ? (
                        <span className="text-blue-600 text-xs">
                          {trans.verses.toLocaleString()} verses...
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}