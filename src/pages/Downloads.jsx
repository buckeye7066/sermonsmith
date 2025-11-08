
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash2, HardDrive, Wifi, WifiOff, CheckCircle2, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { getOfflineStorage } from "../utils";

const BIBLE_BOOKS = [
  { name: "Genesis", chapters: 50 }, { name: "Exodus", chapters: 40 }, { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 }, { name: "Deuteronomy", chapters: 34 }, { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 }, { name: "Ruth", chapters: 4 }, { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 }, { name: "1 Kings", chapters: 22 }, { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 }, { name: "2 Chronicles", chapters: 36 }, { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 }, { name: "Esther", chapters: 10 }, { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 }, { name: "Proverbs", chapters: 31 }, { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 }, { name: "Isaiah", chapters: 66 }, { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 }, { name: "Ezekiel", chapters: 48 }, { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 }, { name: "Joel", chapters: 3 }, { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 }, { name: "Jonah", chapters: 4 }, { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 }, { name: "Habakkuk", chapters: 3 }, { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 }, { name: "Zechariah", chapters: 14 }, { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 }, { name: "Mark", chapters: 16 }, { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 }, { name: "Acts", chapters: 28 }, { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 }, { name: "2 Corinthians", chapters: 13 }, { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 }, { name: "Philippians", chapters: 4 }, { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 }, { name: "2 Thessalonians", chapters: 3 }, { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 }, { name: "Titus", chapters: 3 }, { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 }, { name: "James", chapters: 5 }, { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 }, { name: "1 John", chapters: 5 }, { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 }, { name: "Jude", chapters: 1 }, { name: "Revelation", chapters: 22 }
];

export default function Downloads() {
  const [user, setUser] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [translations, setTranslations] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageInfo, setStorageInfo] = useState(null);
  const [selectedTranslation, setSelectedTranslation] = useState('KJV');
  const [selectedBook, setSelectedBook] = useState('Genesis');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    loadUser();
    loadDownloads();
    loadTranslations();
    loadStorageInfo();

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const loadDownloads = async () => {
    try {
      const storage = await getOfflineStorage();
      const allDownloads = await storage.getDownloads();
      setDownloads(allDownloads);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    }
  };

  const loadTranslations = async () => {
    try {
      const response = await base44.functions.invoke('listAvailableTranslations');
      if (response.data?.translations) {
        setTranslations(response.data.translations.filter(t => t.available));
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const storage = await getOfflineStorage();
      const info = await storage.getStorageSize();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const handleDownloadBook = async () => {
    if (!selectedTranslation || !selectedBook) {
      toast.error('Please select a translation and book');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const storage = await getOfflineStorage();
      const book = BIBLE_BOOKS.find(b => b.name === selectedBook);
      
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        const response = await base44.functions.invoke('getVerses', {
          translationId: selectedTranslation,
          book: selectedBook,
          chapter: chapter
        });

        if (response.data?.verses && response.data.verses.length > 0) {
          await storage.saveVerses(response.data.verses, selectedTranslation, selectedBook, chapter);
        }

        setDownloadProgress((chapter / book.chapters) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await storage.markDownloaded(selectedTranslation, selectedBook, book.chapters);
      toast.success(`${selectedBook} downloaded successfully!`);
      loadDownloads();
      loadStorageInfo();
    } catch (error) {
      toast.error('Failed to download book');
      console.error(error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDeleteDownload = async (translationId, bookName) => {
    try {
      const storage = await getOfflineStorage();
      await storage.deleteDownload(translationId, bookName);
      toast.success('Download deleted');
      loadDownloads();
      loadStorageInfo();
    } catch (error) {
      toast.error('Failed to delete download');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Download className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to manage downloads</p>
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
              Offline Downloads
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Download Bible books for offline reading and note-taking.
            </p>
          </div>
          <Badge variant={isOnline ? 'default' : 'destructive'} className="text-sm">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 mr-1" />
                Offline
              </>
            )}
          </Badge>
        </div>

        {storageInfo && (
          <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">Storage Usage</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {storageInfo.usedMB} MB of {storageInfo.quotaMB} used
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round((storageInfo.used / storageInfo.quota) * 100)}%</p>
                </div>
              </div>
              <Progress value={(storageInfo.used / storageInfo.quota) * 100} className="mt-4" />
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Download New Book</CardTitle>
            <CardDescription>
              Download a book for offline reading. All chapters will be saved locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Translation</label>
                <Select value={selectedTranslation} onValueChange={setSelectedTranslation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {translations.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Book</label>
                <Select value={selectedBook} onValueChange={setSelectedBook}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {BIBLE_BOOKS.map((book) => (
                      <SelectItem key={book.name} value={book.name}>
                        {book.name} ({book.chapters} chapters)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isDownloading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Downloading...</span>
                  <span>{Math.round(downloadProgress)}%</span>
                </div>
                <Progress value={downloadProgress} />
              </div>
            )}

            <Button 
              onClick={handleDownloadBook} 
              disabled={isDownloading || !isOnline}
              className="w-full"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Book
                </>
              )}
            </Button>

            {!isOnline && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ You're offline. Downloads require an internet connection.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Downloaded Books ({downloads.length})</CardTitle>
            <CardDescription>
              Books available for offline reading
            </CardDescription>
          </CardHeader>
          <CardContent>
            {downloads.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No downloads yet</p>
                <p className="text-sm text-gray-600">Download books to read offline</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloads.map((download) => (
                  <Card key={download.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <div>
                            <h4 className="font-semibold">{download.book_name}</h4>
                            <p className="text-sm text-gray-600">
                              {download.translation_id} • {download.total_chapters} chapters
                            </p>
                            <p className="text-xs text-gray-500">
                              Downloaded {new Date(download.downloaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDownload(download.translation_id, download.book_name)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">💡 About Offline Mode</h3>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <li>• Downloaded books are stored on your device</li>
              <li>• Notes and highlights work offline and sync when online</li>
              <li>• Each book requires ~1-5 MB of storage</li>
              <li>• Delete downloads to free up space</li>
              <li>• Auto-sync happens when you return online</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
