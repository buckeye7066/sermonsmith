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
                  <h3 className="font-semibold text-lg mb-1">Full System Diagnostic</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tests all {results?.registry?.total || 16} backend functions, entities, RLS, and environment
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
                        Run Diagnostic
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
            <Card className={`mb-6 border-2 ${results.ok ? 'border-green-300' : 'border-red-300'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {results.ok 
                      ? <CheckCircle2 className="w-6 h-6 text-green-600" /> 
                      : <XCircle className="w-6 h-6 text-red-600" />}
                    Overall Status
                  </CardTitle>
                  <Badge className={results.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {results.ok ? 'ALL SYSTEMS OK' : 'ISSUES DETECTED'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {results.summary?.functions?.total || results.summary?.totalChecks || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Functions</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600">
                        {results.summary?.entities?.total || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Entities</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">
                        {results.summary?.functions?.passed || results.summary?.passed || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Passed</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-3xl font-bold text-red-600">
                        {results.summary?.functions?.failed || results.summary?.failed || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
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

            {/* Tabs */}
            <Tabs defaultValue="report" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="report">
                  <FileText className="w-4 h-4 mr-2" />
                  Error Report
                </TabsTrigger>
                <TabsTrigger value="functions">
                  Functions ({results.functionChecks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="entities">
                  Entities
                </TabsTrigger>
                <TabsTrigger value="env">
                  Environment
                </TabsTrigger>
                <TabsTrigger value="registry">
                  Registry
                </TabsTrigger>
              </TabsList>

              {/* Error Report Tab */}
              <TabsContent value="report" className="mt-4">
                <Card className="border-2 border-amber-200 dark:border-amber-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" />
                        Combined Error Report
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={copyErrorReport}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Full Report
                      </Button>
                    </div>
                    <CardDescription>
                      All errors with file paths, stack traces, and code snippets
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto">
                      {results.combinedErrorReport || 'No errors detected'}
                    </pre>
                  </CardContent>
                </Card>

                {/* Auto-Fix Suggestions */}
                {results.autoFixSuggestions?.length > 0 && (
                  <Card className="mt-4 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-blue-600" />
                        Auto-Fix Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {results.autoFixSuggestions.map((suggestion, i) => (
                          <Alert key={i} className={suggestion.severity === 'high' ? 'border-red-200' : 'border-yellow-200'}>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                              <p className="font-semibold">{suggestion.issue}</p>
                              <p className="text-sm text-gray-600 mt-1">{suggestion.fix}</p>
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Functions Tab */}
              <TabsContent value="functions" className="mt-4 space-y-2">
                {results.functionChecks?.map((fn, i) => (
                  <Collapsible key={i}>
                    <CollapsibleTrigger 
                      className="flex items-center justify-between w-full p-3 bg-white dark:bg-gray-800 rounded-lg border hover:bg-gray-50"
                      onClick={() => toggleExpanded(`fn-${i}`)}
                    >
                      <div className="flex items-center gap-3">
                        {fn.skipped ? (
                          <Badge variant="secondary">⏭️</Badge>
                        ) : fn.ok ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="font-medium">{fn.name}</span>
                        <Badge variant="outline">{fn.category}</Badge>
                        {fn.responseTime > 0 && <Badge variant="outline">{fn.responseTime}ms</Badge>}
                      </div>
                      {expandedItems[`fn-${i}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 bg-gray-50 dark:bg-gray-900 rounded-b-lg mt-1">
                      <div className="text-sm space-y-2">
                        <p><strong>File:</strong> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{fn.filePath}</code></p>
                        {fn.status && <p><strong>Status:</strong> {fn.status}</p>}
                        {fn.skipReason && <p><strong>Skip Reason:</strong> {fn.skipReason}</p>}
                        {fn.errorMessage && <p className="text-red-600"><strong>Error:</strong> {fn.errorMessage}</p>}
                        {fn.codeSnippet && (
                          <div>
                            <strong>Code Snippet:</strong>
                            <pre className="mt-1 p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">{fn.codeSnippet}</pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </TabsContent>

              {/* Entities Tab */}
              <TabsContent value="entities" className="mt-4 space-y-2">
                {results.otherChecks?.filter(c => c.category === 'entity' || c.category === 'rls').map((check, i) => (
                  <div 
                    key={i}
                    className={`p-3 rounded-lg border ${check.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.ok)}
                        <span className="font-medium">{check.name || check.entity}</span>
                        <Badge variant="outline">{check.category}</Badge>
                      </div>
                      {check.error && <span className="text-sm text-red-600">{check.error}</span>}
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Environment Tab */}
              <TabsContent value="env" className="mt-4 space-y-2">
                {results.envChecks?.map((env, i) => (
                  <div 
                    key={i}
                    className={`p-3 rounded-lg border ${
                      env.ok 
                        ? 'bg-green-50 border-green-200' 
                        : env.required 
                          ? 'bg-red-50 border-red-200'
                          : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {env.ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                        <span className="font-mono text-sm">{env.name}</span>
                        {env.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={env.present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {env.present ? 'Set' : 'Missing'}
                        </Badge>
                        {env.error && <span className="text-sm text-red-600">{env.error}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Registry Tab */}
              <TabsContent value="registry" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Function Registry ({results.registry?.total || 0} functions)</CardTitle>
                    <CardDescription>All registered backend functions in the system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {results.registry?.functions?.map((fn, i) => (
                        <div key={i} className="p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-center justify-between">
                          <span className="font-mono text-sm">{fn.name}</span>
                          <Badge variant="outline" className="text-xs">{fn.category}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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