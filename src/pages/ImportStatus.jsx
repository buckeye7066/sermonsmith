import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  CheckCircle2, 
  RefreshCw,
  BookOpen,
  Loader2,
  Activity,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";

const REFRESH_MS = 10000; // 10 seconds

export default function ImportStatus() {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const loadData = async () => {
    try {
      const response = await base44.functions.invoke('getImportStatus', {});
      setStatus(response.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[ImportStatus] Error loading data:', error);
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
          <p className="text-gray-600">Loading import status...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Alert className="max-w-2xl mx-auto">
          <AlertDescription>
            Unable to load import status. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const completed = status.completedTranslations || 0;
  const total = status.totalTranslations || 0;
  const totalVerses = status.totalVerses || 0;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('BulkImport')}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Import
              </Button>
            </Link>
          </div>
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

        <Card className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Database className="w-8 h-8" />
                  Import Status
                </h1>
                <p className="mt-2 opacity-90">
                  Tracking {total} Bible translations
                </p>
                <p className="text-xs opacity-75 mt-1">
                  Auto-refreshes every 10 seconds • Last: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Summary */}
        {completed === 0 && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-yellow-800">
              <p className="font-semibold">⏳ No translations imported yet</p>
              <p className="text-sm mt-1">
                Go to <Link to={createPageUrl('BulkImport')} className="underline font-medium">Bulk Import</Link> to start the parallel workers.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {completed > 0 && completed < total && (
          <Alert className="mb-6 bg-blue-50 border-blue-500">
            <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
            <AlertDescription className="text-blue-800">
              <p className="font-semibold">🚀 Import in progress...</p>
              <p className="text-sm mt-1">
                {completed} of {total} translations complete ({percentComplete}%)
              </p>
            </AlertDescription>
          </Alert>
        )}

        {completed === total && total > 0 && (
          <Alert className="mb-6 bg-green-50 border-green-500">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <p className="font-semibold">🎉 All translations imported!</p>
              <p className="text-sm mt-1">
                {totalVerses.toLocaleString()} verses ready to use
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {completed}
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
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-3xl font-bold text-gray-600 mt-1">
                    {total - completed}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Verses</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-1">
                    {totalVerses.toLocaleString()}
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress */}
        {total > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Overall Progress</CardTitle>
              <CardDescription>
                {status.summary}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {totalVerses.toLocaleString()} verses imported
                  </span>
                  <span className="text-gray-500">
                    {percentComplete}% complete
                  </span>
                </div>
                <Progress value={percentComplete} className="h-3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Translation Details */}
        {status.translations && status.translations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Translation Details</CardTitle>
              <CardDescription>
                Status of each Bible translation (Full Bible = ~31,000 verses)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {status.translations.map((trans) => {
                  const progressPercent = trans.complete ? 100 : Math.min((trans.verses / 31000) * 100, 100);

                  return (
                    <div key={trans.id} className="space-y-2 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono font-semibold">
                            {trans.id}
                          </Badge>
                          <span className="text-sm text-gray-600">{trans.name}</span>
                          {trans.complete && (
                            <Badge className="bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Complete
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-600">
                          {Math.round(progressPercent)}%
                        </span>
                      </div>

                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{trans.verses.toLocaleString()}</span> verses • 
                        <span className="font-medium ml-1">{trans.chapters}</span> chapters •
                        <span className="font-medium ml-1">{trans.books}</span> books
                      </div>

                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}