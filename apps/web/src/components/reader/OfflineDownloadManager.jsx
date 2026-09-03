import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Download, Trash2, Check, Loader2, WifiOff, HardDrive, Play, X, CloudOff, BookOpen
} from "lucide-react";
import { toast } from "sonner";
import {
  saveChapterOffline,
  getChapterOffline,
  saveTranslationMeta,
  getDownloadedTranslations,
  getDownloadProgress,
  updateDownloadProgress,
  deleteTranslation,
  getStorageEstimate,
  isOnline
} from "./OfflineBibleService";
import { api } from "@/api/apiClient";

// Bible book codes and chapter counts
const BIBLE_BOOKS = [
  { code: "GEN", chapters: 50 }, { code: "EXO", chapters: 40 }, { code: "LEV", chapters: 27 },
  { code: "NUM", chapters: 36 }, { code: "DEU", chapters: 34 }, { code: "JOS", chapters: 24 },
  { code: "JDG", chapters: 21 }, { code: "RUT", chapters: 4 }, { code: "1SA", chapters: 31 },
  { code: "2SA", chapters: 24 }, { code: "1KI", chapters: 22 }, { code: "2KI", chapters: 25 },
  { code: "1CH", chapters: 29 }, { code: "2CH", chapters: 36 }, { code: "EZR", chapters: 10 },
  { code: "NEH", chapters: 13 }, { code: "EST", chapters: 10 }, { code: "JOB", chapters: 42 },
  { code: "PSA", chapters: 150 }, { code: "PRO", chapters: 31 }, { code: "ECC", chapters: 12 },
  { code: "SNG", chapters: 8 }, { code: "ISA", chapters: 66 }, { code: "JER", chapters: 52 },
  { code: "LAM", chapters: 5 }, { code: "EZK", chapters: 48 }, { code: "DAN", chapters: 12 },
  { code: "HOS", chapters: 14 }, { code: "JOL", chapters: 3 }, { code: "AMO", chapters: 9 },
  { code: "OBA", chapters: 1 }, { code: "JON", chapters: 4 }, { code: "MIC", chapters: 7 },
  { code: "NAM", chapters: 3 }, { code: "HAB", chapters: 3 }, { code: "ZEP", chapters: 3 },
  { code: "HAG", chapters: 2 }, { code: "ZEC", chapters: 14 }, { code: "MAL", chapters: 4 },
  { code: "MAT", chapters: 28 }, { code: "MRK", chapters: 16 }, { code: "LUK", chapters: 24 },
  { code: "JHN", chapters: 21 }, { code: "ACT", chapters: 28 }, { code: "ROM", chapters: 16 },
  { code: "1CO", chapters: 16 }, { code: "2CO", chapters: 13 }, { code: "GAL", chapters: 6 },
  { code: "EPH", chapters: 6 }, { code: "PHP", chapters: 4 }, { code: "COL", chapters: 4 },
  { code: "1TH", chapters: 5 }, { code: "2TH", chapters: 3 }, { code: "1TI", chapters: 6 },
  { code: "2TI", chapters: 4 }, { code: "TIT", chapters: 3 }, { code: "PHM", chapters: 1 },
  { code: "HEB", chapters: 13 }, { code: "JAS", chapters: 5 }, { code: "1PE", chapters: 5 },
  { code: "2PE", chapters: 3 }, { code: "1JN", chapters: 5 }, { code: "2JN", chapters: 1 },
  { code: "3JN", chapters: 1 }, { code: "JUD", chapters: 1 }, { code: "REV", chapters: 22 }
];

const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, book) => sum + book.chapters, 0); // 1189

export default function OfflineDownloadManager({ open, onClose, translations = [] }) {
  const [downloadedTranslations, setDownloadedTranslations] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [activeDownloads, setActiveDownloads] = useState({});
  const [storageInfo, setStorageInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllers = useRef({});

  useEffect(() => {
    if (open) {
      loadDownloadedTranslations();
      loadStorageInfo();
    }
  }, [open]);

  const loadDownloadedTranslations = async () => {
    setIsLoading(true);
    try {
      const downloaded = await getDownloadedTranslations();
      setDownloadedTranslations(downloaded);
      
      // Load progress for each
      const progressMap = {};
      for (const t of downloaded) {
        const progress = await getDownloadProgress(t.id);
        if (progress) {
          progressMap[t.id] = progress;
        }
      }
      setDownloadProgress(progressMap);
    } catch (error) {
      console.error('Failed to load downloaded translations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    const info = await getStorageEstimate();
    setStorageInfo(info);
  };

  const startDownload = async (translation) => {
    if (!isOnline()) {
      toast.error("No internet connection", {
        description: "Please connect to the internet to download translations."
      });
      return;
    }

    // Create abort controller for this download
    abortControllers.current[translation.id] = new AbortController();
    
    setActiveDownloads(prev => ({ ...prev, [translation.id]: 'downloading' }));
    
    let downloaded = 0;
    let processed = 0;
    let failed = 0;
    const books = translation.scope === 'nt'
      ? BIBLE_BOOKS.slice(39)
      : translation.scope === 'ot'
        ? BIBLE_BOOKS.slice(0, 39)
        : BIBLE_BOOKS;
    const total = books.reduce((sum, book) => sum + book.chapters, 0) || TOTAL_CHAPTERS;
    
    try {
      // Save translation metadata first
      await saveTranslationMeta(translation);
      await updateDownloadProgress(translation.id, 0, total, 'downloading');
      
      toast.info(`Starting download: ${translation.name}`, {
        description: "This may take a few minutes..."
      });

      // Download each book and chapter
      for (const book of books) {
        for (let chapter = 1; chapter <= book.chapters; chapter++) {
          // Check if aborted
          if (abortControllers.current[translation.id]?.signal.aborted) {
            throw new Error('Download cancelled');
          }
          
          try {
            const existing = await getChapterOffline(translation.id, book.code, chapter);
            if (existing?.verses?.length || existing?.chapter?.content?.length) {
              downloaded++;
              processed++;
              continue;
            }
            // Download through OUR backend (biblePassage), which resolves OSIS
            // book codes for every translation — free (bible-api.com) AND premium
            // (gb:/ab: via getBible/API.Bible). The previous hardcoded
            // bible.helloao.org URL didn't know the gb:/ab: ids and returned an
            // HTML page, so premium offline downloads silently saved nothing.
            const data = await api.functions.invoke('biblePassage', {
              translationId: translation.id,
              bookCode: book.code,
              chapter,
            });
            if (data && Array.isArray(data.verses) && data.verses.length > 0) {
              await saveChapterOffline(translation.id, book.code, chapter, data);
              downloaded++;
            } else {
              failed++;
            }
          } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
              throw new Error('Download cancelled');
            }
            // Skip failed chapters, continue with others
            console.warn(`Failed to download ${book.code} ${chapter}:`, fetchError);
            failed++;
          }
          
          processed++;
          
          // Update progress every 10 chapters
          if (processed % 10 === 0) {
            await updateDownloadProgress(translation.id, downloaded, total, 'downloading');
            setDownloadProgress(prev => ({
              ...prev,
              [translation.id]: { 
                downloaded, 
                total, 
                percentage: Math.round((downloaded / total) * 100),
                status: 'downloading'
              }
            }));
          }
        }
      }
      
      // Never label a translation complete when one or more chapters failed.
      const finalStatus = downloaded === total ? 'complete' : 'error';
      await updateDownloadProgress(translation.id, downloaded, total, finalStatus);
      setDownloadProgress(prev => ({
        ...prev,
        [translation.id]: {
          downloaded,
          total,
          percentage: Math.round((downloaded / total) * 100),
          status: finalStatus,
        }
      }));
      
      setActiveDownloads(prev => {
        const newState = { ...prev };
        delete newState[translation.id];
        return newState;
      });
      
      await loadDownloadedTranslations();
      await loadStorageInfo();
      
      if (finalStatus === 'complete') {
        toast.success(`Downloaded: ${translation.name}`, {
          description: "Now available for offline reading!"
        });
      } else {
        toast.warning(`${translation.name} download is incomplete`, {
          description: `${downloaded} of ${total} chapters saved; ${failed} failed. Choose Resume to retry only missing chapters.`,
        });
      }
      
    } catch (error) {
      console.error('Download failed:', error);
      
      if (error.message === 'Download cancelled') {
        toast.info("Download cancelled");
        await updateDownloadProgress(translation.id, downloaded, total, 'paused');
      } else {
        toast.error("Download failed", { description: error.message });
        await updateDownloadProgress(translation.id, downloaded, total, 'error');
      }
      
      setActiveDownloads(prev => {
        const newState = { ...prev };
        delete newState[translation.id];
        return newState;
      });
      
      setDownloadProgress(prev => ({
        ...prev,
        [translation.id]: { 
          downloaded, 
          total, 
          percentage: Math.round((downloaded / total) * 100),
          status: error.message === 'Download cancelled' ? 'paused' : 'error'
        }
      }));
    }
  };

  const cancelDownload = (translationId) => {
    if (abortControllers.current[translationId]) {
      abortControllers.current[translationId].abort();
      delete abortControllers.current[translationId];
    }
  };

  const handleDeleteTranslation = async (translationId, name) => {
    try {
      await deleteTranslation(translationId);
      await loadDownloadedTranslations();
      await loadStorageInfo();
      toast.success(`Deleted: ${name}`);
    } catch (error) {
      toast.error("Failed to delete translation");
    }
  };

  const getTranslationStatus = (translationId) => {
    const isDownloaded = downloadedTranslations.some(t => t.id === translationId);
    const progress = downloadProgress[translationId];
    const isActive = activeDownloads[translationId];
    
    if (isActive) return 'downloading';
    if (progress?.status === 'complete' || (isDownloaded && !progress)) return 'complete';
    if (progress?.status === 'paused') return 'paused';
    if (progress?.status === 'error') return 'error';
    return 'not_downloaded';
  };

  // Filter available translations (ones that can be downloaded)
  const availableTranslations = translations.filter(t => t.available);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CloudOff className="w-6 h-6 text-indigo-600" />
            Offline Bible Downloads
          </DialogTitle>
          <DialogDescription>
            Download Bible translations for reading without internet
          </DialogDescription>
        </DialogHeader>

        {/* Storage Info */}
        {storageInfo && (
          <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <HardDrive className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Storage Used</span>
                <span>{storageInfo.usedMB} MB</span>
              </div>
              <Progress 
                value={(storageInfo.used / storageInfo.quota) * 100} 
                className="h-2"
              />
            </div>
          </div>
        )}

        {/* Offline Status */}
        {!isOnline() && (
          <Alert variant="destructive">
            <WifiOff className="w-4 h-4" />
            <AlertDescription>
              You're currently offline. Connect to the internet to download new translations.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Downloaded Translations */}
              {downloadedTranslations.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    Downloaded ({downloadedTranslations.length})
                  </h3>
                  <div className="space-y-2">
                    {downloadedTranslations.map(translation => {
                      const progress = downloadProgress[translation.id];
                      const status = getTranslationStatus(translation.id);
                      
                      return (
                        <Card key={translation.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{translation.shortName || translation.id}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {translation.language}
                                  </Badge>
                                  {status === 'complete' && (
                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                      <Check className="w-3 h-3 mr-1" />
                                      Ready
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{translation.name}</p>
                                {progress && progress.status !== 'complete' && (
                                  <div className="mt-2">
                                    <Progress value={progress.percentage} className="h-2" />
                                    <p className="text-xs text-gray-500 mt-1">
                                      {progress.downloaded} / {progress.total} chapters ({progress.percentage}%)
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {status === 'downloading' ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => cancelDownload(translation.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                ) : status === 'paused' || status === 'error' ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => startDownload(translation)}
                                  >
                                    <Play className="w-4 h-4 mr-1" />
                                    Resume
                                  </Button>
                                ) : null}
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteTranslation(translation.id, translation.name)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Available for Download */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-600" />
                  Available for Download
                </h3>
                <div className="space-y-2">
                  {availableTranslations
                    .filter(t => !downloadedTranslations.some(d => d.id === t.id))
                    .slice(0, 20) // Show first 20 to avoid overwhelming
                    .map(translation => {
                      const status = getTranslationStatus(translation.id);
                      const progress = downloadProgress[translation.id];
                      
                      return (
                        <Card key={translation.id} className="hover:shadow-sm transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{translation.shortName || translation.id}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {translation.language}
                                  </Badge>
                                  {translation.isComplete && (
                                    <Badge variant="secondary" className="text-xs">
                                      <BookOpen className="w-3 h-3 mr-1" />
                                      Complete
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{translation.name}</p>
                                {status === 'downloading' && progress && (
                                  <div className="mt-2">
                                    <Progress value={progress.percentage} className="h-2" />
                                    <p className="text-xs text-gray-500 mt-1">
                                      Downloading... {progress.percentage}%
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div>
                                {status === 'downloading' ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => cancelDownload(translation.id)}
                                  >
                                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                    Cancel
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => startDownload(translation)}
                                    disabled={!isOnline()}
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
                {availableTranslations.length > 20 && (
                  <p className="text-sm text-gray-500 text-center mt-4">
                    And {availableTranslations.length - 20} more translations available...
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-gray-500">
            ~3-5 MB per translation • Downloads work in background
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
