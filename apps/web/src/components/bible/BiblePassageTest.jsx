import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { usePassage } from "./usePassage";

/**
 * Test component for the new Bible API system
 * This demonstrates how to use the usePassage hook
 */
export default function BiblePassageTest() {
  const [testCase, setTestCase] = useState("john3:16");

  const testCases = {
    "john3:16": { translationId: "en-kjv", bookCode: "JHN", chapter: 3, verses: "16" },
    "psalm23": { translationId: "en-kjv", bookCode: "PSA", chapter: 23, verses: null },
    "genesis1:1-3": { translationId: "en-kjv", bookCode: "GEN", chapter: 1, verses: "1-3" },
    "webRomans8": { translationId: "en-web", bookCode: "ROM", chapter: 8, verses: null },
  };

  const currentTest = testCases[testCase];
  const { loading, error, reference, translationLabel, verses } = usePassage(currentTest);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Bible API Test Suite</CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Testing on-demand Bible passage fetching
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Case Selector */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={testCase === "john3:16" ? "default" : "outline"}
            size="sm"
            onClick={() => setTestCase("john3:16")}
          >
            John 3:16 (KJV)
          </Button>
          <Button
            variant={testCase === "psalm23" ? "default" : "outline"}
            size="sm"
            onClick={() => setTestCase("psalm23")}
          >
            Psalm 23 (KJV)
          </Button>
          <Button
            variant={testCase === "genesis1:1-3" ? "default" : "outline"}
            size="sm"
            onClick={() => setTestCase("genesis1:1-3")}
          >
            Genesis 1:1-3 (KJV)
          </Button>
          <Button
            variant={testCase === "webRomans8" ? "default" : "outline"}
            size="sm"
            onClick={() => setTestCase("webRomans8")}
          >
            Romans 8 (WEB)
          </Button>
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="mt-3 text-sm text-gray-600">Loading passage...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Error loading passage</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">{error}</p>
          </div>
        )}

        {!loading && !error && verses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{reference}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{translationLabel}</p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {verses.length} verse{verses.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              {verses.map((v) => (
                <div key={v.verse} className="flex gap-3">
                  <span className="font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {v.verse}
                  </span>
                  <p className="text-gray-900 dark:text-gray-100">{v.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            ✅ New API System Active
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Fetching from: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">cdn.jsdelivr.net/gh/wldeh/bible-api</code></li>
            <li>• No GitHub storage needed</li>
            <li>• On-demand loading</li>
            <li>• Ready for SQLite offline support</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}