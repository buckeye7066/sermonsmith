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
  Clock, 
  RefreshCw, 
  TrendingUp,
  AlertCircle,
  BookOpen,
  Loader2,
  Activity
} from "lucide-react";
import { toast } from "sonner";

export default function ImportStatus() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [recentActivity, setRecentActivity] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const translations = await base44.entities.Translation.filter({ enabled: true }, 'id');
      
      const translationStats = await Promise.all(
        translations.map(async (trans) => {
          try {
            // Fetch a sample of verses to calculate stats
            const sampleVerses = await base44.entities.Verse.filter(
              { translation_id: trans.id },
              '-created_date',
              1000
            );

            if (sampleVerses.length === 0) {
              return null;
            }

            const books = new Set(sampleVerses.map(v => v.book_name));
            const chapters = new Set(sampleVerses.map(v => `${v.book_name}-${v.chapter}`));
            
            // Estimate total verses: if we have 1000 verses with X chapters, 
            // and full Bible is 1189 chapters, extrapolate
            const estimatedTotalVerses = chapters.size >= 1189 
              ? 31102 
              : Math.round((sampleVerses.length / chapters.size) * chapters.size);
            
            // Get most recent verse timestamp
            const lastVerse = sampleVerses[0];
            const lastUpdateTime = lastVerse?.created_date ? new Date(lastVerse.created_date) : null;
            const timeSinceUpdate = lastUpdateTime ? Date.now() - lastUpdateTime.getTime() : null;
            const isActive = timeSinceUpdate && timeSinceUpdate < 300000; // Active if updated in last 5 min

            // Use chapter count to determine completeness (1189 chapters = complete Bible)
            const progress = Math.min((chapters.size / 1189) * 100, 100);
            const isComplete = chapters.size >= 1189;

            return {
              id: trans.id,
              name: trans.name,
              verseCount: estimatedTotalVerses,
              books: books.size,
              chapters: chapters.size,
              progress: progress,
              lastUpdate: lastUpdateTime,
              isActive: isActive,
              status: isComplete ? 'complete' : isActive ? 'importing' : 'partial'
            };
          } catch (error) {
            console.error(`Error loading ${trans.id}:`, error);
            return null;
          }
        })
      );

      const validStats = translationStats.filter(s => s !== null);
      
      const totalVerses = validStats.reduce((sum, t) => sum + t.verseCount, 0);
      const completeCount = validStats.filter(t => t.status === 'complete').length;
      const activeCount = validStats.filter(t => t.status === 'importing').length;
      
      // Generate recent activity log
      const activity = [];
      validStats.forEach(trans => {
        if (trans.lastUpdate) {
          const timeDiff = Date.now() - trans.lastUpdate.getTime();
          const timeStr = timeDiff < 60000 
            ? `${Math.floor(timeDiff / 1000)}s ago`
            : timeDiff < 3600000
            ? `${Math.floor(timeDiff / 60000)}m ago`
            : `${Math.floor(timeDiff / 3600000)}h ago`;
          
          activity.push({
            translation: trans.name || trans.id,
            action: trans.status === 'importing' ? 'Importing' : 'Updated',
            time: timeStr,
            verses: trans.verseCount,
            chapters: trans.chapters,
            status: trans.status
          });
        }
      });
      
      activity.sort((a, b) => {
        const timeA = a.time.includes('s') ? parseInt(a.time) : 
                     a.time.includes('m') ? parseInt(a.time) * 60 :
                     parseInt(a.time) * 3600;
        const timeB = b.time.includes('s') ? parseInt(b.time) : 
                     b.time.includes('m') ? parseInt(b.time) * 60 :
                     parseInt(b.time) * 3600;
        return timeA - timeB;
      });

      setRecentActivity(activity.slice(0, 10));
      
      setStats({
        totalVerses,
        translations: validStats,
        completeCount,
        activeCount,
        totalTranslations: validStats.length
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
    const interval = setInterval(loadData, 30000);
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

  const hasActiveImports = stats?.activeCount > 0;
  const hasData = stats?.totalVerses > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Live Import Monitor Card */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Database className="w-8 h-8" />
                  📘 Live Import Status
                </h1>
                <p className="mt-2 opacity-90">
                  Real-time Bible import progress • Auto-refreshes every 30s
                </p>
                <p className="text-xs opacity-75 mt-1">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="secondary"
                size="lg"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                🔄 Refresh Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Status Alerts */}
        {!hasData ? (
          <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-500">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <p className="font-semibold">No active imports — all translations are up to date.</p>
              <p className="text-sm mt-1">
                Start a new import from the <a href="/BulkImport" className="underline font-medium">Bulk Import</a> page.
              </p>
            </AlertDescription>
          </Alert>
        ) : hasActiveImports ? (
          <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-500">
            <Activity className="w-4 h-4 text-green-600 animate-pulse" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <p className="font-semibold">✅ Import in progress!</p>
              <p className="text-sm mt-1">
                {stats.activeCount} translation(s) currently importing. This page will update automatically.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <AlertDescription className="text-indigo-800 dark:text-indigo-200">
              <p className="font-semibold">All imports complete!</p>
              <p className="text-sm mt-1">
                {stats.completeCount} translation(s) ready • {stats.totalVerses.toLocaleString()} verses loaded
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Real-Time Dashboard - Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Verses</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats?.totalVerses?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">~estimated</p>
                </div>
                <BookOpen className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">✅ Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {stats?.completeCount || 0}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">⏳ Importing</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">
                    {stats?.activeCount || 0}
                  </p>
                </div>
                <TrendingUp className={`w-8 h-8 text-blue-600 ${hasActiveImports ? 'animate-pulse' : ''}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Translations</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats?.totalTranslations || 0}
                  </p>
                </div>
                <Database className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress Bar */}
        {hasData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Overall Progress</CardTitle>
              <CardDescription>
                Expected: 1,189 chapters per translation • {stats.completeCount} of {stats.totalTranslations} complete
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {stats.totalVerses.toLocaleString()} verses loaded (estimated)
                  </span>
                  <span className="text-gray-500">
                    {Math.round((stats.completeCount / stats.totalTranslations) * 100)}% complete
                  </span>
                </div>
                <Progress value={(stats.completeCount / stats.totalTranslations) * 100} className="h-3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Translation Details */}
        {hasData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Translation Details</CardTitle>
              <CardDescription>
                Live status of each Bible translation (1,189 chapters = complete)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.translations?.map((translation) => (
                  <div key={translation.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={translation.status === 'complete' ? 'default' : 'secondary'}
                          className="font-mono"
                        >
                          {translation.id}
                        </Badge>
                        <div className="text-sm">
                          <span className="font-medium">{translation.verseCount.toLocaleString()}</span>
                          <span className="text-gray-500"> verses (est.)</span>
                          <span className="mx-2">•</span>
                          <span className="font-medium">{translation.books}</span>
                          <span className="text-gray-500"> books</span>
                          <span className="mx-2">•</span>
                          <span className="font-medium">{translation.chapters}</span>
                          <span className="text-gray-500">/1,189 chapters</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {translation.status === 'complete' && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                        {translation.status === 'importing' && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            <Clock className="w-3 h-3 mr-1 animate-pulse" />
                            Importing
                          </Badge>
                        )}
                        {translation.status === 'partial' && (
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            Partial
                          </Badge>
                        )}
                        <span className="text-sm font-medium text-gray-600">
                          {Math.round(translation.progress)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={translation.progress} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Events */}
        {recentActivity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Last 10 status updates from import logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {event.status === 'importing' ? (
                        <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                      ) : event.status === 'complete' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {event.translation} — {event.action}
                        </p>
                        <p className="text-xs text-gray-500">
                          {event.chapters}/1,189 chapters • ~{event.verses.toLocaleString()} verses • {event.time}
                        </p>
                      </div>
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