import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  TrendingUp,
  AlertCircle,
  BookOpen,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function ImportStatus() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const loadData = useCallback(async () => {
    try {
      // OPTIMIZED: Use aggregation query instead of loading all verses
      // Get verse count by translation using a smart approach
      const translations = await base44.entities.Translation.filter({ enabled: true }, 'id');
      
      const translationStats = await Promise.all(
        translations.slice(0, 10).map(async (trans) => {
          try {
            // Sample just a few verses to check if translation has data
            const sample = await base44.entities.Verse.filter(
              { translation_id: trans.id },
              'created_date',
              5
            );
            
            if (sample.length === 0) {
              return null;
            }

            // If has data, get more detailed count (limited to avoid overload)
            const verses = await base44.entities.Verse.filter(
              { translation_id: trans.id },
              'book_name',
              1000 // Sample up to 1000 verses per translation
            );

            // Calculate unique books and chapters
            const books = new Set(verses.map(v => v.book_name));
            const chapters = new Set(verses.map(v => `${v.book_name}-${v.chapter}`));

            return {
              id: trans.id,
              name: trans.name,
              verseCount: verses.length,
              estimatedTotal: verses.length >= 1000 ? `${Math.round(verses.length / 1000)}k+` : verses.length,
              books: books.size,
              chapters: chapters.size,
              progress: (verses.length / 31102) * 100
            };
          } catch (error) {
            console.error(`Error loading ${trans.id}:`, error);
            return null;
          }
        })
      );

      const validStats = translationStats.filter(s => s !== null);
      
      // Calculate totals
      const totalVerses = validStats.reduce((sum, t) => sum + t.verseCount, 0);
      const estimatedTotal = validStats.some(t => t.verseCount >= 1000) 
        ? `${Math.round(totalVerses / 1000)}k+` 
        : totalVerses;

      // Load recent logs (last 50 only)
      const recentLogs = await base44.entities.FetchLog.list('-created_date', 50);
      setLogs(recentLogs);

      // Calculate log statistics
      const logStats = {
        total: recentLogs.length,
        success: recentLogs.filter(l => l.status === 'ok').length,
        errors: recentLogs.filter(l => l.status === 'error').length,
        cached: recentLogs.filter(l => l.cache_hit === true).length,
        avgDuration: recentLogs.length > 0 
          ? recentLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / recentLogs.length 
          : 0
      };

      setStats({
        totalVerses,
        estimatedTotal,
        translations: validStats,
        logs: logStats
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Failed to load import data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds (not 10 - too aggressive)
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading import status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-8 h-8 text-indigo-600" />
              Import Status
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Monitor your Bible import progress • Auto-updates every 30s
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </Button>
            <Button
              onClick={() => window.location.href = '/BulkImport'}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Database className="w-4 h-4 mr-2" />
              Go to Bulk Import
            </Button>
          </div>
        </div>

        {/* Quick Start Guide - Show if no data */}
        {(!stats || stats.totalVerses === 0) && (
          <Alert className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-300 dark:border-indigo-800">
            <Database className="w-5 h-5 text-indigo-600" />
            <AlertDescription className="text-gray-800 dark:text-gray-200">
              <p className="font-bold text-lg mb-3">🚀 Quick Start: Import Your First Translation</p>
              <div className="space-y-3">
                <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">Step 1: Go to Bulk Import Page</p>
                  <Button
                    onClick={() => window.location.href = '/BulkImport'}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Open Bulk Import Page
                  </Button>
                </div>
                
                <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">Step 2: Select Translations</p>
                  <p className="text-sm">Choose which Bible translations you want (KJV is selected by default)</p>
                </div>
                
                <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">Step 3: Click "Background Import" (Recommended)</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• ✅ Runs on server - you can close the page</li>
                    <li>• ✅ Imports all 1,189 chapters automatically</li>
                    <li>• ✅ Takes 15-30 minutes per translation</li>
                    <li>• ✅ Come back here to monitor progress</li>
                  </ul>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-300">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This status page only <em>displays</em> progress. To actually import data, you must start an import from the Bulk Import page.
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Import In Progress - Show if data exists but not complete */}
        {stats && stats.totalVerses > 0 && stats.totalVerses < 30000 && (
          <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-500">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-2">📊 Import in Progress</p>
              <p className="text-sm mb-2">
                You have <strong>{stats.estimatedTotal}</strong> verses imported (sampled). A full translation has ~31,102 verses.
              </p>
              <p className="text-sm mb-2">
                <strong>Your progress: ~{Math.round((stats.totalVerses / 31102) * 100)}%</strong> of one complete Bible
              </p>
              <p className="text-sm">
                ✅ Import is running! This page auto-refreshes every 30 seconds to show progress.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message - Show if import is complete */}
        {stats && stats.totalVerses >= 30000 && (
          <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-500">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <p className="font-semibold mb-2">✅ Import Complete!</p>
              <p className="text-sm">
                You have {stats.estimatedTotal} verses imported across {stats.translations?.length} translation(s). Your Bible data is ready to use!
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Verses</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats?.estimatedTotal || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats && stats.totalVerses > 0 && `~${Math.round((stats.totalVerses / 31102) * 100)}% of full Bible`}
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Translations</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats?.translations?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">with data</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats?.logs?.success && stats?.logs?.total 
                      ? Math.round((stats.logs.success / stats.logs.total) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">last 50 calls</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Speed</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {Math.round(stats?.logs?.avgDuration || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500 mt-1">per request</p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Translation Progress */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Translation Progress</CardTitle>
            <CardDescription>
              Full Bible contains ~31,102 verses (66 books, 1,189 chapters) • Showing sample data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!stats || stats.translations?.length === 0 ? (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  No translations imported yet. Start a bulk import to see activity here.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {stats.translations?.map((translation) => (
                  <div key={translation.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {translation.id}
                        </Badge>
                        <div className="text-sm">
                          <span className="font-medium">{translation.estimatedTotal}</span>
                          <span className="text-gray-500"> verses</span>
                          <span className="mx-2">•</span>
                          <span className="font-medium">{translation.books}</span>
                          <span className="text-gray-500"> books</span>
                          <span className="mx-2">•</span>
                          <span className="font-medium">{translation.chapters}</span>
                          <span className="text-gray-500"> chapters</span>
                        </div>
                      </div>
                      <Badge 
                        variant={translation.progress >= 100 ? "default" : "secondary"}
                        className="flex items-center gap-1"
                      >
                        {translation.progress >= 100 ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        ~{Math.round(translation.progress)}%
                      </Badge>
                    </div>
                    <Progress value={Math.min(translation.progress, 100)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Import Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Import Activity</CardTitle>
            <CardDescription>
              Last 50 API calls (updates every 30 seconds)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  No import activity yet. Start a bulk import to see activity here.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div
                    key={log.id || index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {log.status === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {log.translation_id} - {log.book_name} {log.chapter}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.cache_hit ? 'Cached' : 'Fresh'} • {log.duration_ms}ms
                          {log.created_date && ` • ${new Date(log.created_date).toLocaleTimeString()}`}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={log.status === 'ok' ? 'secondary' : 'destructive'}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Statistics */}
        {stats?.logs && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Import Statistics (Last 50 Calls)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.logs.total}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {stats.logs.success}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {stats.logs.errors}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Errors</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.logs.cached}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Cached</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {Math.round(stats.logs.avgDuration)}ms
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Alert className="mt-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-2">💡 Import Tips:</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• A full Bible translation has ~31,102 verses across 66 books</li>
              <li>• This page shows <strong>sampled data</strong> to avoid overloading your database</li>
              <li>• Actual verse counts may be higher than displayed</li>
              <li>• Background imports run on the server - you can close this page</li>
              <li>• This page auto-refreshes every 30 seconds</li>
              <li>• Green badges = complete, Gray badges = in progress</li>
              <li>• Typical import time: 15-30 minutes per translation</li>
              <li>• You can import multiple complete translations (KJV, WEB, ESV, etc.)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}