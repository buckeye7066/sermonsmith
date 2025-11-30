import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Database,
  Zap,
  Lock,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Server,
  Settings,
  Copy,
  FileText
} from "lucide-react";
import { toast } from "sonner";

export default function SystemSelfCheck() {
  const [user, setUser] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

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
      toast.info("Running comprehensive system self-check...");
      
      const response = await base44.functions.invoke('systemSelfCheck');
      
      if (response.data) {
        setResults(response.data);
        
        if (response.data.ok) {
          toast.success("All systems operational!");
        } else {
          toast.error("Issues detected - review results");
        }
      } else {
        toast.error("Self-check returned no data");
      }
    } catch (error) {
      console.error('Self-check error:', error);
      toast.error("Failed to run self-check");
      setResults({
        ok: false,
        error: error.message,
        summary: { total: 0, passed: 0, failed: 1 },
        checks: [],
        contamination: { ok: false, results: [] }
      });
    } finally {
      setIsRunning(false);
    }
  };

  const toggleExpanded = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
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

  const getStatusIcon = (ok) => {
    return ok 
      ? <CheckCircle2 className="w-5 h-5 text-green-600" />
      : <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'environment': return <Settings className="w-4 h-4" />;
      case 'function': return <Zap className="w-4 h-4" />;
      case 'entity': return <Database className="w-4 h-4" />;
      case 'rls': return <Lock className="w-4 h-4" />;
      case 'integration': return <Server className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const groupChecksByCategory = (checks) => {
    return checks.reduce((acc, check) => {
      const cat = check.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(check);
      return acc;
    }, {});
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

  const groupedChecks = results?.checks ? groupChecksByCategory(results.checks) : {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            System Self-Check
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive diagnostic of all app layers
          </p>
        </div>

        {/* Control Panel */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">Full System Diagnostic</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tests backend functions, database, RLS policies, environment, and cross-contamination
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
                      Run Full System Diagnostic
                    </>
                  )}
                </Button>
                {results && (
                  <Button variant="outline" onClick={downloadReport}>
                    <Download className="w-4 h-4 mr-2" />
                    Download JSON Report
                  </Button>
                )}
              </div>
            </div>
            
            {isRunning && (
              <div className="mt-4">
                <Progress value={50} className="mb-2" />
                <p className="text-sm text-gray-600">Testing all systems...</p>
              </div>
            )}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {results.summary?.total || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Checks</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">
                      {results.summary?.passed || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Passed</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">
                      {results.summary?.failed || 0}
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

                {results.ok && (
                  <Alert className="mt-4 bg-green-50 border-green-300">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>✅ All Systems Operational!</strong> No issues detected.
                    </AlertDescription>
                  </Alert>
                )}

                {results.error && (
                  <Alert variant="destructive" className="mt-4">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> {results.error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Detailed Results */}
            <Tabs defaultValue="checks" className="mb-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="checks">All Checks ({results.checks?.length || 0})</TabsTrigger>
                <TabsTrigger value="failures">
                  Failures ({results.checks?.filter(c => !c.ok).length || 0})
                </TabsTrigger>
                <TabsTrigger value="contamination">
                  Contamination {results.contamination?.ok ? '✅' : '🚨'}
                </TabsTrigger>
              </TabsList>

              {/* All Checks Tab */}
              <TabsContent value="checks" className="space-y-4 mt-4">
                {Object.entries(groupedChecks).map(([category, checks]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg capitalize">
                        {getCategoryIcon(category)}
                        {category} ({checks.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {checks.map((check, index) => (
                          <Collapsible key={index}>
                            <CollapsibleTrigger 
                              className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => toggleExpanded(`${category}-${index}`)}
                            >
                              <div className="flex items-center gap-3">
                                {getStatusIcon(check.ok)}
                                <span className="font-medium">{check.name || check.entity}</span>
                                {check.responseTime && (
                                  <Badge variant="outline" className="text-xs">
                                    {check.responseTime}ms
                                  </Badge>
                                )}
                              </div>
                              {expandedItems[`${category}-${index}`] 
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="p-3 bg-gray-50 dark:bg-gray-800 rounded-b-lg mt-1">
                              <div className="text-sm space-y-1">
                                {check.status && <p><strong>Status:</strong> {check.status}</p>}
                                {check.error && <p className="text-red-600"><strong>Error:</strong> {check.error}</p>}
                                {check.warning && <p className="text-yellow-600"><strong>Warning:</strong> {check.warning}</p>}
                                {check.description && <p><strong>Description:</strong> {check.description}</p>}
                                {check.exists !== undefined && <p><strong>Exists:</strong> {check.exists ? 'Yes' : 'No'}</p>}
                                {check.readable !== undefined && <p><strong>Readable:</strong> {check.readable ? 'Yes' : 'No'}</p>}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Failures Tab */}
              <TabsContent value="failures" className="space-y-4 mt-4">
                {results.checks?.filter(c => !c.ok).length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                      <h3 className="text-xl font-semibold mb-2">No Failures!</h3>
                      <p className="text-gray-600">All checks passed successfully</p>
                    </CardContent>
                  </Card>
                ) : (
                  results.checks?.filter(c => !c.ok).map((check, index) => (
                    <Alert key={index} variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold">[{check.category}] {check.name || check.entity}</p>
                        {check.error && <p className="text-sm mt-1">Error: {check.error}</p>}
                        {check.status && <p className="text-sm">Status: {check.status}</p>}
                      </AlertDescription>
                    </Alert>
                  ))
                )}
              </TabsContent>

              {/* Contamination Tab */}
              <TabsContent value="contamination" className="space-y-4 mt-4">
                <Card className={results.contamination?.ok ? 'border-green-300' : 'border-red-300'}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Cross-Contamination Detection
                      <Badge className={results.contamination?.ok ? 'bg-green-100 text-green-800 ml-2' : 'bg-red-100 text-red-800 ml-2'}>
                        {results.contamination?.ok ? 'Clean' : 'Leak Detected'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Checks if users can access data belonging to other users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.contamination?.results?.length === 0 ? (
                      <p className="text-gray-600">No contamination tests run</p>
                    ) : (
                      <div className="space-y-3">
                        {results.contamination?.results?.map((result, index) => (
                          <div 
                            key={index} 
                            className={`p-4 rounded-lg ${result.leak ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}
                          >
                            <div className="flex items-start gap-3">
                              {result.leak 
                                ? <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                : <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />}
                              <div className="flex-1">
                                <p className={`font-medium ${result.leak ? 'text-red-800' : 'text-green-800'}`}>
                                  {result.description}
                                </p>
                                {result.functionName && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <strong>Function:</strong> {result.functionName}
                                  </p>
                                )}
                                {result.filePath && (
                                  <p className="text-sm text-gray-600">
                                    <strong>File:</strong> {result.filePath}
                                  </p>
                                )}
                                {result.offendingCode && (
                                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                    {result.offendingCode}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Info when no results */}
        {!results && !isRunning && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Backend Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>• Tests all function endpoints</p>
                <p>• Validates response codes</p>
                <p>• Measures response times</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="w-5 h-5 text-blue-600" />
                  Database & Entities
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>• Verifies entity existence</p>
                <p>• Tests read/write access</p>
                <p>• Validates schema integrity</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="w-5 h-5 text-purple-600" />
                  RLS Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>• Row-level security checks</p>
                <p>• User isolation validation</p>
                <p>• Admin override testing</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-5 h-5 text-red-600" />
                  Contamination Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>• Cross-user data leak detection</p>
                <p>• Identifies vulnerable code</p>
                <p>• Points to exact file/function</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="w-5 h-5 text-gray-600" />
                  Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>• Required env vars check</p>
                <p>• API key validation</p>
                <p>• Secret configuration</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="w-5 h-5 text-green-600" />
                  Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-1">
                <p>• Stripe connectivity</p>
                <p>• External API status</p>
                <p>• Webhook configuration</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}