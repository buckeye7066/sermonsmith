import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Shield,
  Database,
  CreditCard,
  Zap,
  FileText,
  Crown
} from "lucide-react";
import { toast } from "sonner";

export default function SystemDiagnostics() {
  const [user, setUser] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [currentPhase, setCurrentPhase] = useState('');

  React.useEffect(() => {
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

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults(null);
    setCurrentPhase('Initializing...');

    try {
      toast.info("Running comprehensive diagnostics...");
      
      const response = await base44.functions.invoke('validateApp');
      
      if (response.status === 200 && response.data) {
        setResults(response.data);
        
        if (response.data.success) {
          toast.success("Diagnostics complete - All systems operational!");
        } else {
          toast.error("Diagnostics complete - Issues found");
        }
      } else {
        toast.error("Diagnostic failed to run");
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error("Failed to run diagnostics");
      setResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsRunning(false);
      setCurrentPhase('');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'FAIL':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'WARN':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'INFO':
        return <Info className="w-5 h-5 text-blue-600" />;
      case 'SKIP':
        return <Info className="w-5 h-5 text-gray-400" />;
      default:
        return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'FULLY_OPERATIONAL': 'bg-green-100 text-green-800 border-green-300',
      'OPERATIONAL_WITH_WARNINGS': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'ISSUES_DETECTED': 'bg-orange-100 text-orange-800 border-orange-300',
      'CRITICAL_ISSUES': 'bg-red-100 text-red-800 border-red-300',
      'PASS': 'bg-green-100 text-green-800',
      'FAIL': 'bg-red-100 text-red-800',
      'WARN': 'bg-yellow-100 text-yellow-800'
    };

    return (
      <Badge className={`${colors[status] || 'bg-gray-100 text-gray-800'} border`}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to run diagnostics</p>
            <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
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
            System Diagnostics & Validation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive runtime testing of all app components
          </p>
        </div>

        {/* Control Panel */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">Production Validation Suite</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tests Stripe integration, database access, backend functions, and more
                </p>
              </div>
              <Button
                onClick={runDiagnostics}
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
                    Run Diagnostics
                  </>
                )}
              </Button>
            </div>
            
            {isRunning && (
              <div className="mt-4">
                <Progress value={33} className="mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentPhase || 'Running tests...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <>
            {/* Summary Card */}
            <Card className="mb-6 border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Overall Status</CardTitle>
                  {getStatusBadge(results.overallStatus)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {results.summary?.total_tests || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Tests</p>
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
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">
                      {results.summary?.warnings || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Warnings</p>
                  </div>
                </div>

                {results.productionReady && (
                  <Alert className="mt-4 bg-green-50 border-green-300">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>✅ Production Ready!</strong> All critical systems passed validation.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Detailed Results */}
            <Tabs defaultValue="tests" className="mb-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tests">Test Results</TabsTrigger>
                <TabsTrigger value="errors">
                  Errors ({results.errors?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>

              {/* Tests Tab */}
              <TabsContent value="tests" className="space-y-4 mt-4">
                {results.tests?.map((test, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{test.testName}</CardTitle>
                        {getStatusBadge(test.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {test.subtests?.map((subtest, si) => (
                          <div key={si} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            {getStatusIcon(subtest.status)}
                            <div className="flex-1">
                              <p className="font-medium text-sm">{subtest.name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {subtest.message}
                              </p>
                              {subtest.details && (
                                <p className="text-xs text-gray-500 mt-1 font-mono">
                                  {JSON.stringify(subtest.details, null, 2)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Errors Tab */}
              <TabsContent value="errors" className="space-y-4 mt-4">
                {results.errors?.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                      <h3 className="text-xl font-semibold mb-2">No Errors Found!</h3>
                      <p className="text-gray-600">All systems are working correctly</p>
                    </CardContent>
                  </Card>
                ) : (
                  results.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold">[{error.test}] {error.error}</p>
                        {error.details && (
                          <p className="text-sm mt-1">Details: {error.details}</p>
                        )}
                        {error.fix && (
                          <p className="text-sm mt-2 font-medium">Fix: {error.fix}</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))
                )}

                {results.warnings?.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-6 mb-3">Warnings (Non-Critical)</h3>
                    {results.warnings.map((warning, index) => (
                      <Alert key={index} className="bg-yellow-50 border-yellow-300">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                          <p className="font-semibold">[{warning.test}] {warning.warning}</p>
                          {warning.recommendation && (
                            <p className="text-sm mt-1">→ {warning.recommendation}</p>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </>
                )}
              </TabsContent>

              {/* Recommendations Tab */}
              <TabsContent value="recommendations" className="space-y-4 mt-4">
                {results.recommendations?.map((rec, index) => {
                  const priorityColors = {
                    'CRITICAL': 'bg-red-50 border-red-300',
                    'HIGH': 'bg-orange-50 border-orange-300',
                    'MEDIUM': 'bg-yellow-50 border-yellow-300',
                    'LOW': 'bg-blue-50 border-blue-300',
                    'INFO': 'bg-green-50 border-green-300'
                  };

                  return (
                    <Card key={index} className={priorityColors[rec.priority]}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Badge className="mt-1">{rec.priority}</Badge>
                          <div className="flex-1">
                            <p className="font-semibold mb-1">{rec.message}</p>
                            <p className="text-sm text-gray-700">{rec.action}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {results.nextSteps && results.nextSteps.length > 0 && (
                  <Card className="mt-6 bg-indigo-50 dark:bg-indigo-900/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Action Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {results.nextSteps.map((step, index) => (
                          <p key={index} className="text-sm font-mono text-gray-700 dark:text-gray-300">
                            {step}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Info Cards */}
        {!results && !isRunning && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  Stripe Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>✓ Webhook signature verification</p>
                <p>✓ Checkout session creation</p>
                <p>✓ Subscription event handling</p>
                <p>✓ Payment processing flow</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Database & Entities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>✓ Entity access permissions</p>
                <p>✓ Data availability checks</p>
                <p>✓ Service role validation</p>
                <p>✓ User scoped queries</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Backend Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>✓ Runtime execution tests</p>
                <p>✓ Response validation</p>
                <p>✓ Error handling</p>
                <p>✓ Integration connectivity</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-indigo-600" />
                  Premium Logic
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>✓ Developer backdoor</p>
                <p>✓ Subscription tier checks</p>
                <p>✓ Access control validation</p>
                <p>✓ Feature gating</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* How to Use */}
        <Card className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5" />
              How to Use This Tool
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <li>• <strong>Click "Run Diagnostics"</strong> to start comprehensive testing</li>
              <li>• Tests run against <strong>live backend functions</strong> with real API calls</li>
              <li>• <strong>Stripe</strong>: Creates and expires test sessions (no charges)</li>
              <li>• <strong>Database</strong>: Validates all entity access (read-only)</li>
              <li>• <strong>Functions</strong>: Invokes backend functions with test payloads</li>
              <li>• <strong>Results</strong> show exactly what works and what needs fixing</li>
              <li>• Run this <strong>before deploying</strong> to catch issues early</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}