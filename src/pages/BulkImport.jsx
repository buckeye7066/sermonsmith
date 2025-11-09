import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Loader2, Database, Download, CheckCircle2, XCircle, BookOpen, RefreshCw, Zap, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BIBLE_BOOKS = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 }
];

export default function BulkImport() {
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [verseCount, setVerseCount] = useState(0);

  useEffect(() => {
    loadTranslations();
    checkVerseCount();
  }, []);

  const loadTranslations = async () => {
    setIsLoading(true);
    try {
      const translations = await base44.entities.Translation.filter({ enabled: true }, 'id');
      setAvailableTranslations(translations);
    } catch (error) {
      console.error('Error loading translations:', error);
      toast.error('Failed to load translations');
    } finally {
      setIsLoading(false);
    }
  };

  const checkVerseCount = async () => {
    try {
      const verses = await base44.entities.Verse.filter({}, 'id', 1);
      setVerseCount(verses.length > 0 ? 'Data exists' : 0);
    } catch (error) {
      setVerseCount(0);
    }
  };

  const handleSeedFree = async () => {
    if (!window.confirm('This will populate the FREE Bible translation (KJV) with all 31,102 verses.\n\nThis is a ONE-TIME setup and will take about 30-60 minutes.\n\nContinue?')) {
      return;
    }

    setIsSeeding(true);
    try {
      const response = await base44.functions.invoke('seedBibleData', { mode: 'free' });
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('FREE Bible data seeding started!', {
        description: 'KJV Bible is being populated. Check back in 30-60 minutes.',
        duration: 10000
      });

    } catch (error) {
      toast.error('Failed to start seeding', {
        description: error.message
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeedAll = async () => {
    if (!window.confirm('This will populate ALL Bible translations (Free + Premium) with complete verse data.\n\nThis will take 2-4 hours and is intended for initial app setup only.\n\nContinue?')) {
      return;
    }

    setIsSeeding(true);
    try {
      const response = await base44.functions.invoke('seedBibleData', { mode: 'all' });
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Full Bible data seeding started!', {
        description: 'All translations being populated. Check back in 2-4 hours.',
        duration: 10000
      });

    } catch (error) {
      toast.error('Failed to start seeding', {
        description: error.message
      });
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Bible Data Setup</h1>
            <p className="text-gray-600 dark:text-gray-400">
              One-time setup to populate your app with Bible verses
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkVerseCount}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            <strong>Current Status:</strong> {verseCount === 0 ? 'No verses in database' : `${verseCount} verses available`}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              FREE Tier - KJV Bible
            </CardTitle>
            <CardDescription>
              31,102 verses • Complete Bible • Free for all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Includes:</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• King James Version (KJV)</li>
                <li>• Old Testament (39 books)</li>
                <li>• New Testament (27 books)</li>
                <li>• Optimized for fast searching</li>
                <li>• No downloads needed by users</li>
              </ul>
            </div>

            <Button
              onClick={handleSeedFree}
              disabled={isSeeding}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Seeding in Progress...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Seed FREE Bible Data (30-60 min)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-500" />
              PREMIUM Tier - All Translations
            </CardTitle>
            <CardDescription>
              150,000+ verses • Multiple translations • Premium users only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Includes:</h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                <li>• KJV (Free tier included)</li>
                <li>• ESV - English Standard Version</li>
                <li>• NIV - New International Version</li>
                <li>• NASB - New American Standard Bible</li>
                <li>• NLT - New Living Translation</li>
              </ul>
            </div>

            <Button
              onClick={handleSeedAll}
              disabled={isSeeding}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Seeding in Progress...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5 mr-2" />
                  Seed ALL Bible Data (2-4 hours)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ After Seeding</h3>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>• Users can read the Bible instantly - no downloads</li>
              <li>• Search works across all verses immediately</li>
              <li>• Sermon builder has full Bible access</li>
              <li>• Study tools work with complete verse data</li>
              <li>• Premium features unlock additional translations</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">⚠️ Important Notes</h3>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <li>• This is a ONE-TIME setup process</li>
              <li>• Keep this tab open or check back later</li>
              <li>• Data is cached - no re-downloads needed</li>
              <li>• The process runs in the background on the server</li>
              <li>• You can close this page after starting the seed</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}