import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function Downloads() {
  const [user, setUser] = useState(null);

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Download className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to view downloads</p>
            <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Download className="w-8 h-8 text-blue-500" />
              Bible Downloads
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              All Bible data is now stored in the cloud database
            </p>
          </div>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Offline downloads have been simplified!</strong>
            <p className="mt-2">
              Bible verses are now cached automatically in your database as you read them. 
              No manual downloads needed!
            </p>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              The new streamlined Bible reading experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-300">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Read the Bible</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Navigate to the Bible Reader and select any book and chapter
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-300">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Auto-Import via Bulk Import</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Use the Bulk Import page to download entire books or testaments at once
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-300">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Always Available</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Once imported, verses are stored in your cloud database and accessible instantly
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Link to={createPageUrl('Reader')}>
                <Button className="w-full">
                  Go to Bible Reader
                </Button>
              </Link>
              <Link to={createPageUrl('BulkImport')}>
                <Button variant="outline" className="w-full">
                  Go to Bulk Import
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ Benefits</h3>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• No manual downloads needed</li>
              <li>• Automatic caching as you read</li>
              <li>• Cloud-based storage (no device space used)</li>
              <li>• Accessible from any device</li>
              <li>• Faster performance with database queries</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}