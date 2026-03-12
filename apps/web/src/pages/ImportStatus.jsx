import React, { useState, useEffect } from 'react';
import { apiPromise } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    if (status) setRefreshing(true);
    try {
      const apiClient = await apiPromise;
      const response = await api.functions.invoke('getImportStatus', {});
      console.log('Import Status:', response.data);
      setStatus(response.data);
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to check import status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="w-8 h-8 text-indigo-600" />
              Bible Import Status
            </h1>
            <p className="text-gray-600 mt-1">{status?.summary}</p>
          </div>
          <Button
            onClick={checkStatus}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Translations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 flex items-center gap-2">
                {completed}
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 flex items-center gap-2">
                {status?.inProgressTranslations || 0}
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Verses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600">
                {totalVerses.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{completed} of {total} translations complete</span>
                <span>{percentComplete}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-green-500 to-indigo-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Translation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Translation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {status?.translations?.map((trans) => (
                <div
                  key={trans.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {trans.complete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : trans.verses > 0 ? (
                      <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 animate-pulse" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{trans.id}</div>
                      <div className="text-xs text-gray-600">{trans.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {trans.complete ? (
                      <div className="text-green-600 font-semibold">
                        ✓ Complete
                      </div>
                    ) : trans.verses > 0 ? (
                      <div className="text-blue-600">
                        {trans.verses.toLocaleString()} verses
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm">Pending</div>
                    )}
                    <div className="text-xs text-gray-500">
                      {trans.books > 0 && `${trans.books} books • ${trans.chapters} chapters`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {completed === total && total > 0 && (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-900 mb-2">
                  🎉 All Translations Complete!
                </h2>
                <p className="text-green-700">
                  {totalVerses.toLocaleString()} verses from {total} Bible translations are now available in your Bible Reader!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-500">
          Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'Unknown'}
        </div>
      </div>
    </div>
  );
}