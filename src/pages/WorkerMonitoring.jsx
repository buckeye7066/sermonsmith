import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  CheckCircle2, 
  RefreshCw,
  Activity,
  XCircle,
  Pause,
  PlayCircle,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";

const REFRESH_MS = 5000; // 5 seconds for worker monitoring

const statusIcons = {
  idle: <Pause className="w-5 h-5 text-gray-400" />,
  running: <Activity className="w-5 h-5 text-blue-600 animate-pulse" />,
  completed: <CheckCircle2 className="w-5 h-5 text-green-600" />,
  error: <XCircle className="w-5 h-5 text-red-600" />
};

const statusColors = {
  idle: "bg-gray-100 text-gray-700 border-gray-300",
  running: "bg-blue-100 text-blue-700 border-blue-300",
  completed: "bg-green-100 text-green-700 border-green-300",
  error: "bg-red-100 text-red-700 border-red-300"
};

export default function WorkerMonitoring() {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      const response = await base44.functions.invoke('getWorkerStatus', {});
      setStatus(response.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[WorkerMonitoring] Error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    
    const interval = setInterval(() => {
      loadData();
    }, REFRESH_MS);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading worker status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert className="max-w-2xl mx-auto border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <p className="font-semibold">Unable to load worker status</p>
            <p className="text-sm mt-1">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!status || !status.workers || !status.summary) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert className="max-w-2xl mx-auto border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <p className="font-semibold">No worker data available</p>
            <p className="text-sm mt-1">Workers haven't been started yet or data is loading.</p>
            <div className="flex gap-2 mt-3">
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Link to={createPageUrl('BulkImport')}>
                <Button size="sm">
                  Go to Bulk Import
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { workers, summary } = status;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('BulkImport')}>
              <Button variant="ghost" size="sm">
                ← Back to Import
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Auto-refresh every 5s • Last: {lastUpdate.toLocaleTimeString()}
            </span>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Title Card */}
        <Card className="mb-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <PlayCircle className="w-8 h-8" />
                  Worker Monitoring
                </h1>
                <p className="mt-2 opacity-90">
                  Real-time status of all 5 parallel import workers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Active Workers</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {summary.activeWorkers}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {summary.completedWorkers}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Verses</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">
                  {summary.totalVerses.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Translations</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {summary.completedTranslations}/{summary.totalTranslations}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Overall Progress</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {summary.overallProgress}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress Bar */}
        {summary.totalTranslations > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Overall Import Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {summary.completedTranslations} of {summary.totalTranslations} translations complete
                  </span>
                  <span className="text-gray-500">
                    {summary.overallProgress}%
                  </span>
                </div>
                <Progress value={summary.overallProgress} className="h-3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Worker Cards */}
        <div className="space-y-4">
          {workers.map((worker) => (
            <Card key={worker.workerId} className="overflow-hidden">
              <CardHeader className={`${statusColors[worker.status]} border-b-2`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcons[worker.status]}
                    <div>
                      <CardTitle className="text-lg">
                        Worker {worker.workerId}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {worker.status === 'running' && worker.startedAt && (
                          <>Started: {new Date(worker.startedAt).toLocaleTimeString()}</>
                        )}
                        {worker.status === 'completed' && "All tasks completed"}
                        {worker.status === 'idle' && "Not started"}
                        {worker.status === 'error' && "Error occurred"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {worker.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column - Current Status */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Current Activity</h4>
                      {worker.status === 'running' && worker.currentTranslation ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm">
                            <span className="font-medium">Translation:</span>{' '}
                            <Badge variant="outline" className="ml-1 font-mono">
                              {worker.currentTranslation}
                            </Badge>
                          </p>
                          {worker.currentBook && (
                            <p className="text-sm mt-1">
                              <span className="font-medium">Book:</span> {worker.currentBook}
                            </p>
                          )}
                          {worker.currentChapter && (
                            <p className="text-sm mt-1">
                              <span className="font-medium">Chapter:</span> {worker.currentChapter}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          {worker.status === 'idle' ? 'Waiting to start' : 'No active task'}
                        </p>
                      )}
                    </div>

                    {worker.errorMessage && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 text-sm">
                          {worker.errorMessage}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">Verses Imported</p>
                        <p className="text-xl font-bold text-gray-900">
                          {worker.totalVerses.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">Chapters Imported</p>
                        <p className="text-xl font-bold text-gray-900">
                          {worker.totalChapters}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Translations */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">
                        Assigned Translations ({worker.translationsAssigned.length})
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        {worker.translationsAssigned.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {worker.translationsAssigned.map((trans) => (
                              <Badge
                                key={trans}
                                variant={worker.translationsCompleted.includes(trans) ? "default" : "outline"}
                                className="font-mono text-xs"
                              >
                                {worker.translationsCompleted.includes(trans) && (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                )}
                                {trans}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No translations assigned yet</p>
                        )}
                      </div>
                    </div>

                    {worker.translationsCompleted.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">
                          Completed ({worker.translationsCompleted.length})
                        </h4>
                        <Progress 
                          value={(worker.translationsCompleted.length / worker.translationsAssigned.length) * 100} 
                          className="h-2"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          {worker.translationsCompleted.length} of {worker.translationsAssigned.length} translations
                        </p>
                      </div>
                    )}

                    {worker.lastUpdate && (
                      <p className="text-xs text-gray-500">
                        Last update: {new Date(worker.lastUpdate).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-center">
          <Link to={createPageUrl('BulkImport')}>
            <Button variant="outline">
              Back to Import Control
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}