import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Database, CheckCircle2, XCircle, BookOpen, RefreshCw, Zap, Crown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BulkImport() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [verseCount, setVerseCount] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  useEffect(() => {
    checkVerseCount();
  }, []);

  const checkVerseCount = async () => {
    setIsLoading(true);
    try {
      const verses = await base44.entities.Verse.filter({}, 'id', 100);
      setVerseCount(verses.length);
    } catch (error) {
      console.error('Error checking verses:', error);
      setVerseCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunTests = async () => {
    setIsTesting(true);
    setTestResults(null);
    
    try {
      toast.info('Running system tests...');
      
      const response = await base44.functions.invoke('testSeed', {});
      
      console.log('Test results:', response.data);
      setTestResults(response.data);
      
      if (response.data?.ready_to_seed) {
        toast.success('✅ System ready for seeding!');
      } else {
        toast.error('❌ System not ready - check test results');
      }
      
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test failed: ' + error.message);
      setTestResults({ error: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSeedFree = async () => {
    if (!window.confirm('This will populate the FREE Bible translation (KJV) with all 31,102 verses.\n\nThis is a ONE-TIME setup and will take about 30-60 minutes.\n\nContinue?')) {
      return;
    }

    setIsSeeding(true);
    try {
      toast.info('Starting Bible data seeding...', { duration: 5000 });
      
      const response = await base44.functions.invoke('seedBibleData', { mode: 'free' });
      
      console.log('Seed response:', response.data);
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('FREE Bible data seeding started!', {
        description: 'KJV Bible is being populated. Check back in 30-60 minutes.',
        duration: 10000
      });

    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Failed to start seeding: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeedAll = async () => {
    if (!window.confirm('This will populate ALL Bible translations (Free + Premium) with complete verse data.\n\nThis will take 2-4 hours and is intended for initial app setup only.\n\nContinue?')) {
      return;
    }

    setIsSeeding(true);
    try {
      toast.info('Starting full Bible data seeding...', { duration: 5000 });
      
      const response = await base44.functions.invoke('seedBibleData', { mode: 'all' });
      
      console.log('Seed response:', response.data);
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Full Bible data seeding started!', {
        description: 'All translations being populated. Check back in 2-4 hours.',
        duration: 10000
      });

    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Failed to start seeding: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Bible Data Setup</h1>
            <p className="text-gray-600 dark:text-gray-400">
              One-time setup to populate your app with Bible verses
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkVerseCount}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            <strong>Current Status:</strong> {verseCount === 0 ? 'No verses in database yet' : `${verseCount} verses loaded`}
          </AlertDescription>
        </Alert>

        {verseCount === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Action Required:</strong> Run the system test below, then seed the Bible data.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Step 1: Run System Test
            </CardTitle>
            <CardDescription>
              Test that all systems are working before seeding data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleRunTests}
              disabled={isTesting}
              className="w-full"
              variant="outline"
              size="lg"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Run System Tests
                </>
              )}
            </Button>

            {testResults && (
              <div className="space-y-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <h4 className="font-semibold mb-2">Test Results:</h4>
                {testResults.error ? (
                  <div className="text-red-600">❌ Error: {testResults.error}</div>
                ) : (
                  <>
                    {Object.entries(testResults.tests || {}).map(([name, result]) => (
                      <div key={name} className="flex items-center gap-2 text-sm">
                        {result.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-mono">{name}</span>
                        {result.error && <span className="text-red-600 text-xs">({result.error})</span>}
                        {result.count !== undefined && <span className="text-gray-600">({result.count})</span>}
                      </div>
                    ))}
                    <div className="mt-3 pt-3 border-t">
                      {testResults.ready_to_seed ? (
                        <div className="text-green-600 font-semibold">✅ Ready to seed!</div>
                      ) : (
                        <div className="text-red-600 font-semibold">❌ Fix issues before seeding</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Step 2: Seed FREE Tier - KJV Bible
            </CardTitle>
            <CardDescription>
              31,102 verses • Complete Bible • Free for all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Includes:</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• King James Version (KJV)</li>
                <li>• Old Testament (39 books)</li>
                <li>• New Testament (27 books)</li>
                <li>• Optimized for fast searching</li>
                <li>• No downloads needed by users</li>
              </ul>
            </div>

            <Button
              onClick={handleSeedFree}
              disabled={isSeeding || !testResults?.ready_to_seed}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Seeding in Progress...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Seed FREE Bible Data (30-60 min)
                </>
              )}
            </Button>
            
            {!testResults?.ready_to_seed && (
              <p className="text-sm text-gray-500 text-center">
                Run system tests first ↑
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-500" />
              Step 3: Seed PREMIUM Tier (Optional)
            </CardTitle>
            <CardDescription>
              150,000+ verses • Multiple translations • Premium users only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Includes:</h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                <li>• KJV (Free tier included)</li>
                <li>• ESV - English Standard Version</li>
                <li>• NIV - New International Version</li>
                <li>• NASB - New American Standard Bible</li>
                <li>• NLT - New Living Translation</li>
              </ul>
            </div>

            <Button
              onClick={handleSeedAll}
              disabled={isSeeding || !testResults?.ready_to_seed}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Seeding in Progress...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5 mr-2" />
                  Seed ALL Bible Data (2-4 hours)
                </>
              )}
            </Button>
            
            {!testResults?.ready_to_seed && (
              <p className="text-sm text-gray-500 text-center">
                Run system tests first ↑
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ After Seeding</h3>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• Users can read the Bible instantly - no downloads</li>
              <li>• Search works across all verses immediately</li>
              <li>• Sermon builder has full Bible access</li>
              <li>• Study tools work with complete verse data</li>
              <li>• Premium features unlock additional translations</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}