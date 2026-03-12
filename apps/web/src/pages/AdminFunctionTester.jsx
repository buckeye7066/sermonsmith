import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlayCircle, Loader2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminFunctionTester() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not logged in");
    } finally {
      setLoading(false);
    }
  };

  const runFullTestSuite = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      toast.info("Running full test suite...");
      
      const result = await api.functions.invoke('testAllFunctions', {});
      
      if (result) {
        setResults(result);
        const rd = result.data || result;
        if (result.ok) {
          toast.success(`All ${rd.passed || 0} functions passed!`);
        } else {
          toast.error(`${rd.failed || 0} function(s) failed`);
        }
      }
    } catch (error) {
      console.error('Test suite error:', error);
      toast.error("Test suite crashed");
      setResults({
        ok: false,
        error: error.message,
        data: {
          checked: 0,
          failed: 1,
          failures: [{
            functionId: 'testAllFunctions',
            filePath: 'functions/testAllFunctions.js',
            payload: null,
            errorMessage: error.message,
            rawOutput: null,
            stack: null,
            codeSnippet: '// Test suite crashed'
          }]
        }
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in</p>
            <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
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
            <p className="text-gray-600">Only administrators can run function tests.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            Admin Function Tester
          </h1>
          <p className="text-gray-600 mt-2">
            Heavyweight backend function testing with full error capture
          </p>
        </div>

        {/* Run Button */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Full Test Suite</h3>
                <p className="text-sm text-gray-600">
                  Tests all functions with their required payloads
                </p>
              </div>
              <Button
                onClick={runFullTestSuite}
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
                    Run Full Test Suite
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info when no results */}
        {!results && !isRunning && (
          <Alert>
            <AlertDescription>
              Click "Run Full Test Suite" to discover all functions, load test payloads, 
              and run each function. All failures will be displayed below with full error details.
            </AlertDescription>
          </Alert>
        )}

        {/* Results - Full JSON Display */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle className={results.ok ? 'text-green-700' : 'text-red-700'}>
                {results.ok ? '✅ ALL TESTS PASSED' : `❌ ${results.data?.failed || 0} FAILURE(S)`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg text-sm overflow-auto max-h-[70vh] whitespace-pre-wrap font-mono">
                {JSON.stringify(results, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}