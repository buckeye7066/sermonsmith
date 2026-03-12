import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Download, CheckCircle2, Info, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Downloads() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Sign in to access Bible data</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Log in to start reading the Bible instantly
            </p>
            <Button onClick={() => api.auth.redirectToLogin()}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Download className="w-8 h-8 text-indigo-600" />
            Bible Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Instant access to Bible translations
          </p>
        </div>

        <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>New System Active!</strong> Bible data is now instantly available - no downloads or imports needed.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Instant Loading</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Bible data is built into the app. When you open a chapter, it loads instantly from embedded files.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Smart Caching</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Once you've read a chapter, it's cached in your browser for even faster loading next time.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Cloud Sync</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your highlights, notes, and reading progress sync across all your devices automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Available Translations
              </CardTitle>
              <CardDescription>
                All translations are ready to read instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <div className="font-semibold">King James Version (KJV)</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Free • All 66 books</div>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Ready
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <div className="font-semibold">Premium Translations</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">ESV, NIV, NLT, NASB, MSG, AMP, NKJV</div>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                No Action Needed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The old system required downloading Bible data. The new system has everything built-in, so you can start reading immediately!
              </p>
              <Link to={createPageUrl("Reader")}>
                <Button className="w-full">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Open Bible Reader
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}