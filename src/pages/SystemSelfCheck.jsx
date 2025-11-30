import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  Database,
  Zap,
  Lock,
  Download,
  Copy,
  RefreshCw,
  FileText
} from "lucide-react";
import { toast } from "sonner";

export default function SystemSelfCheck() {
  const [user, setUser] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  
  // Options
  const [autoRetry, setAutoRetry] = useState(false);
  const [retryDelay, setRetryDelay] = useState("2000");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const runSelfCheck = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      toast.info("Running deep system self-check...");
      
      const params = new URLSearchParams();
      if (autoRetry) params.append('autoRetry', '1');
      params.append('retryDelayMs', retryDelay);
      
      const response = await base44.functions.invoke(`systemSelfCheck?${params.toString()}`);

      if (response.data) {
        const result = response.data;
        setResults(result.data || result);

        if (result.ok) {
          toast.success("All systems operational!");
        } else {
          const failCount = result.data?.failed || result.failed || 0;
          toast.error(`${failCount} issue(s) detected`);
        }
      }
    } catch (error) {
      console.error('Self-check error:', error);
      toast.error("Failed to run self-check");
      setResults({
        ok: false,
        checked: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        failures: [{
          functionId: 'systemSelfCheck',
          path: '/functions/systemSelfCheck',
          filePath: 'functions/systemSelfCheck.js',
          errorMessage: error.message,
          stack: null,
          codeSnippet: '// Self-check crashed'
        }],
        combinedErrorReport: `CRASH: ${error.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const downloadReport = () => {
    if (!results) return;
    
    const report = JSON.stringify(results, null, 2);
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-check-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const copyErrorReport = () => {
    if (!results?.combinedErrorReport) return;
    navigator.clipboard.writeText(results.combinedErrorReport);
    toast.success("Error report copied to clipboard");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in</p>
            <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium mb-4">Admin Access Required</p>
            <p className="text-gray-600">Only administrators can run system self-checks.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            System Self-Check v2.0
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive diagnostic with auto-fix, auto-retry, and consolidated error reporting
          </p>
        </div>

        {/* Control Panel */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6">
              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id="auto-retry" checked={autoRetry} onCheckedChange={setAutoRetry} />
                  <Label htmlFor="auto-retry" className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Auto-Retry Failed
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="retry-delay">Retry Delay:</Label>
                  <Select value={retryDelay} onValueChange={setRetryDelay}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1 sec</SelectItem>
                      <SelectItem value="2000">2 sec</SelectItem>
                      <SelectItem value="3000">3 sec</SelectItem>
                      <SelectItem value="5000">5 sec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Deep System Diagnostic</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Discovers and tests all backend functions with selfCheck mode
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={runSelfCheck}
                    disabled={isRunning}
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-5 h-5 mr-2" />
                        Run Self-Check
                      </>
                    )}
                  </Button>
                  {results && (
                    <>
                      <Button variant="outline" onClick={downloadReport}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button variant="outline" onClick={() => setResults(null)}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {isRunning && (
                <div className="mt-4">
                  <Progress value={50} className="mb-2" />
                  <p className="text-sm text-gray-600">Testing all systems...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <>
            {/* Summary Card */}
            <Card className={`mb-6 border-2 ${results.failed === 0 ? 'border-green-300' : 'border-red-300'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {results.failed === 0 
                      ? <CheckCircle2 className="w-6 h-6 text-green-600" /> 
                      : <XCircle className="w-6 h-6 text-red-600" />}
                    Overall Status
                  </CardTitle>
                  <Badge className={results.failed === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {results.failed === 0 ? 'ALL SYSTEMS OK' : `${results.failed} ISSUE(S) DETECTED`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {results.checked || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Checked</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {results.passed || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Passed</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">
                      {results.failed || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-amber-600">
                      {results.skipped || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Skipped</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">
                      {results.elapsedTime || 0}ms
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Combined Error Report - Single Panel */}
            <Card className={`border-2 ${results.failures?.length > 0 ? 'border-red-200' : 'border-green-200'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Self-Check Report
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={copyErrorReport}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Report
                  </Button>
                </div>
                <CardDescription>
                  {results.failures?.length > 0 
                    ? `${results.failures.length} failure(s) with function IDs, paths, errors, and code snippets`
                    : 'All functions passed self-check'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results.failures?.length > 0 ? (
                  <div className="space-y-6">
                    {results.failures.map((failure, i) => (
                      <div key={i} className="border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-red-800 dark:text-red-400 text-lg">
                              #{i + 1} {failure.functionId}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Path: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{failure.path}</code>
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              File: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{failure.filePath}</code>
                            </p>
                          </div>
                          <Badge variant="destructive">FAILED</Badge>
                        </div>
                        
                        <div className="mb-3">
                          <p className="font-semibold text-red-700 dark:text-red-400">Error:</p>
                          <p className="text-red-600 dark:text-red-300">{failure.errorMessage}</p>
                        </div>
                        
                        {failure.stack && (
                          <div className="mb-3">
                            <p className="font-semibold text-gray-700 dark:text-gray-300">Stack Trace:</p>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto max-h-32">
                              {failure.stack}
                            </pre>
                          </div>
                        )}
                        
                        {failure.codeSnippet && (
                          <div>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">Code Context:</p>
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                              {failure.codeSnippet}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <p className="text-xl font-semibold text-green-700 dark:text-green-400">
                      All Systems Operational
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                      All {results.passed} functions passed self-check
                    </p>
                  </div>
                )}

                {/* Raw Combined Report */}
                {results.combinedErrorReport && results.failures?.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Raw Combined Report:</p>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                      {results.combinedErrorReport}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Environment & Entity Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Environment */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Environment Variables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {results.envResults?.map((env, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{env.name}</span>
                        <Badge className={env.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {env.present ? '✓' : '✗'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Entities */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Entity Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {results.entityResults?.map((entity, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{entity.name}</span>
                        <Badge className={entity.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {entity.ok ? '✓' : '✗'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Info Cards when no results */}
        {!results && !isRunning && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Function Tests
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Tests all backend functions with self-test payloads and captures errors with code snippets.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="w-5 h-5 text-blue-600" />
                  Entity & RLS
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Verifies entity existence, readability, and row-level security policies.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="w-5 h-5 text-gray-600" />
                  Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                Validates required and optional environment variables including Stripe key format.
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}