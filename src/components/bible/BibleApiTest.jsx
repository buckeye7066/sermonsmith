/**
 * Bible API Test Component
 * For development testing of the new on-demand Bible fetching system
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { usePassage } from "./usePassage";

const TEST_PASSAGES = [
  { label: "John 3:16", bookCode: "JHN", chapter: 3, verses: "16" },
  { label: "Psalm 23", bookCode: "PSA", chapter: 23, verses: null },
  { label: "Genesis 1:1-5", bookCode: "GEN", chapter: 1, verses: "1-5" },
  { label: "Romans 8:28", bookCode: "ROM", chapter: 8, verses: "28" },
  { label: "Philippians 4:13", bookCode: "PHP", chapter: 4, verses: "13" },
];

function PassageTest({ passage, translationId }) {
  const { loading, error, reference, verses, retry } = usePassage({
    translationId,
    bookCode: passage.bookCode,
    chapter: passage.chapter,
    verses: passage.verses,
  });

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{passage.label}</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          {!loading && !error && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          {error && <AlertCircle className="w-4 h-4 text-red-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {!loading && !error && verses.length > 0 && (
          <div>
            <Badge variant="secondary" className="mb-3">
              {reference} ({translationId.toUpperCase()})
            </Badge>
            <div className="space-y-2">
              {verses.map((v) => (
                <p key={v.verse} className="text-sm">
                  <span className="font-semibold text-blue-600">{v.verse}.</span>{" "}
                  {v.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && verses.length === 0 && (
          <p className="text-gray-500 text-sm">No verses found</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BibleApiTest() {
  const [translationId, setTranslationId] = useState("en-kjv");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bible API Test</h1>
      
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Testing On-Demand Bible Fetching</h3>
          <p className="text-sm text-gray-700 mb-4">
            This page tests the new Bible API system that fetches passages on-demand
            instead of loading huge JSON files. All passages below are fetched from
            external CDN sources in real-time.
          </p>
          <div className="flex gap-2">
            <Button
              variant={translationId === "en-kjv" ? "default" : "outline"}
              size="sm"
              onClick={() => setTranslationId("en-kjv")}
            >
              KJV
            </Button>
            <Button
              variant={translationId === "en-web" ? "default" : "outline"}
              size="sm"
              onClick={() => setTranslationId("en-web")}
            >
              WEB
            </Button>
          </div>
        </CardContent>
      </Card>

      {TEST_PASSAGES.map((passage) => (
        <PassageTest
          key={passage.label}
          passage={passage}
          translationId={translationId}
        />
      ))}

      <Alert className="mt-6 bg-green-50 border-green-200">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <AlertDescription>
          <strong>✅ Success!</strong> If you can see verses above, the new on-demand
          Bible fetching system is working correctly. No giant JSON files needed!
        </AlertDescription>
      </Alert>
    </div>
  );
}