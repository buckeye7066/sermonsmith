import React from "react";
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, CheckCircle2, Database, Info, WifiOff } from "lucide-react";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";

export default function Downloads() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-600" />
            Scripture Sources & Offline Use
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            A plain-language guide to what the Reader can display, cache, and synchronize.
          </p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <Info className="w-5 h-5 text-blue-600" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            The Reader catalogue is the source of truth for this deployment. Translation
            availability, display, export, and offline use vary by configured source and license.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                What is available
              </CardTitle>
              <CardDescription>
                No copyrighted translation is promised unless its licensed source is configured and working.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">King James Version (KJV)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    SermonSmith includes a KJV source for its core reading experience.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold">Additional sources</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Other translations appear only when a compatible source is configured. Open
                    the Reader to see the catalogue currently available to your account.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-amber-600" />
                Offline expectations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-600 dark:text-gray-400">
              <p>
                Browser and installed-app caches can make previously loaded material available
                without a connection, but cache behavior differs by platform and can be cleared by
                the operating system or browser.
              </p>
              <p>
                Before relying on SermonSmith offline, open the needed passage on that device,
                disconnect briefly, and confirm it still opens. Do not assume every translation or
                every chapter is stored locally.
              </p>
              <p>
                Highlights and notes are associated with a signed-in account when sync succeeds.
                Confirm important material on another signed-in client and keep your own backup
                before clearing local app data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verify Scripture before teaching</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                AI-generated references, quotations, cross-references, and translations can be
                incomplete or wrong. Open the passage in your preferred authorized translation,
                read its surrounding context, and verify wording before publication or delivery.
              </p>
              <Link to={user ? createPageUrl("Reader") : "/Login?return=%2FReader"}>
                <Button className="w-full">
                  <BookOpen className="w-4 h-4 mr-2" />
                  {user ? "Open Bible Reader" : "Sign in to open the Reader"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
