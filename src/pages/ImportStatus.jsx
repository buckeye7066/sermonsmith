import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Activity,
  XCircle
} from "lucide-react";

const REFRESH_MS = 10000; // 10 seconds for import jobs

export default function ImportStatus() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const importJobs = await base44.entities.ImportJob.filter({}, '-updated_date');
      console.log('[ImportStatus] Loaded', importJobs.length, 'jobs');
      setJobs(importJobs);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[ImportStatus] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    intervalRef.current = setInterval(() => {
      console.log('[ImportStatus] Auto-refresh...');
      loadData();
    }, REFRESH_MS);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadData]);

  const handleRefresh = () => {
    console.log('[ImportStatus] Manual refresh');
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

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const activeJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'retrying');
  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const failedJobs = jobs.filter(j => j.status === 'failed');

  const totalVerses = completedJobs.reduce((sum, j) => sum + (j.progress?.total_verses_imported || 0), 0);
  const totalChapters = completedJobs.reduce((sum, j) => sum + (j.progress?.total_chapters_imported || 0), 0);

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
                  🚀 Resilient Import Monitor
                </h1>
                <p className="mt-2 opacity-90">
                  Worker-based persistent import queue • Auto-refreshes every 10s
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
                {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Alerts */}
        {activeJobs.length > 0 ? (
          <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-500">
            <Activity className="w-4 h-4 text-green-600 animate-pulse" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <p className="font-semibold">✅ Worker processing translations!</p>
              <p className="text-sm mt-1">
                {activeJobs.length} translation(s) currently importing. Worker runs independently.
              </p>
            </AlertDescription>
          </Alert>
        ) : jobs.length === 0 ? (
          <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-500">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <p className="font-semibold">No import jobs found</p>
              <p className="text-sm mt-1">
                Start an import from the <a href="/BulkImport" className="underline font-medium">Bulk Import</a> page.
              </p>
            </AlertDescription>
          </Alert>
        ) : completedJobs.length === jobs.length ? (
          <Alert className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <AlertDescription className="text-indigo-800 dark:text-indigo-200">
              <p className="font-semibold">🎉 All imports complete!</p>
              <p className="text-sm mt-1">
                {completedJobs.length} translation(s) ready • {totalVerses.toLocaleString()} verses • {totalChapters} chapters
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {failedJobs.length > 0 && (
          <Alert className="mb-6 bg-red-50 border-red-500">
            <XCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <p className="font-semibold">⚠️ {failedJobs.length} translation(s) failed after 5 retries</p>
              <p className="text-sm mt-1">Check detailed error logs below.</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        {jobs.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">✅ Completed</p>
                      <p className="text-3xl font-bold text-green-600 mt-1">
                        {completedJobs.length}
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
                      <p className="text-sm text-gray-600 dark:text-gray-400">⏳ Active</p>
                      <p className="text-3xl font-bold text-blue-600 mt-1">
                        {activeJobs.length}
                      </p>
                    </div>
                    <TrendingUp className={`w-8 h-8 text-blue-600 ${activeJobs.length > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">📋 Pending</p>
                      <p className="text-3xl font-bold text-gray-600 mt-1">
                        {pendingJobs.length}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-gray-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">❌ Failed</p>
                      <p className="text-3xl font-bold text-red-600 mt-1">
                        {failedJobs.length}
                      </p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overall Progress */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Overall Progress</CardTitle>
                <CardDescription>
                  {completedJobs.length} of {jobs.length} translations complete
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {totalVerses.toLocaleString()} verses • {totalChapters} chapters
                    </span>
                    <span className="text-gray-500">
                      {Math.round((completedJobs.length / jobs.length) * 100)}% complete
                    </span>
                  </div>
                  <Progress value={(completedJobs.length / jobs.length) * 100} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card>
              <CardHeader>
                <CardTitle>Translation Import Jobs</CardTitle>
                <CardDescription>
                  Detailed status of each translation (1,189 chapters = complete Bible)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobs.map((job) => {
                    const chaptersProgress = job.progress?.total_chapters_imported || 0;
                    const progressPercent = Math.min((chaptersProgress / 1189) * 100, 100);

                    return (
                      <div key={job.id} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}
                              className="font-mono"
                            >
                              {job.translation_id}
                            </Badge>
                            {job.status === 'completed' && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Complete
                              </Badge>
                            )}
                            {job.status === 'in_progress' && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                <Activity className="w-3 h-3 mr-1 animate-pulse" />
                                Importing
                              </Badge>
                            )}
                            {job.status === 'retrying' && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry {job.retries}/5
                              </Badge>
                            )}
                            {job.status === 'pending' && (
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                Queued
                              </Badge>
                            )}
                            {job.status === 'failed' && (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-600">
                            {Math.round(progressPercent)}%
                          </span>
                        </div>

                        <div className="text-sm text-gray-600">
                          <span className="font-medium">{job.progress?.total_verses_imported || 0}</span> verses • 
                          <span className="font-medium ml-1">{chaptersProgress}/1,189</span> chapters
                          {job.progress?.current_book && (
                            <span className="ml-2">• Currently: {job.progress.current_book} {job.progress.current_chapter}</span>
                          )}
                        </div>

                        <Progress value={progressPercent} className="h-2" />

                        {job.validation && (
                          <div className="text-xs text-gray-500 mt-2">
                            Validated: {job.validation.actual_verses} verses, {job.validation.actual_chapters} chapters
                          </div>
                        )}

                        {job.error_log && job.error_log.length > 0 && (
                          <details className="text-xs text-red-600 mt-2">
                            <summary className="cursor-pointer font-medium">
                              View error log ({job.error_log.length} errors)
                            </summary>
                            <div className="mt-2 space-y-1 pl-4">
                              {job.error_log.slice(-5).map((err, idx) => (
                                <div key={idx} className="font-mono">
                                  {err.timestamp}: {err.error}
                                  {err.book && ` (${err.book} ${err.chapter})`}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}