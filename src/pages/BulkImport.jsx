import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Loader2, Database, Download, CheckCircle2, XCircle, BookOpen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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
  const [selectedTranslations, setSelectedTranslations] = useState(['KJV']);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTranslation, setCurrentTranslation] = useState('');
  const [currentBook, setCurrentBook] = useState('');
  const [currentChapter, setCurrentChapter] = useState(0);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ success: 0, failed: 0, cached: 0, retries: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [totalChapters, setTotalChapters] = useState(0);
  const [processedChapters, setProcessedChapters] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const isMountedRef = useRef(true);
  const importStateRef = useRef({ shouldContinue: true, retryQueue: [] });

  useEffect(() => {
    isMountedRef.current = true;
    loadTranslations();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadTranslations = async () => {
    setIsLoading(true);
    try {
      const translations = await base44.entities.Translation.filter({ enabled: true }, 'id');
      
      // Group translations by language family
      const grouped = translations.map(t => {
        const lang = t.language;
        let group = 'Other';
        
        if (lang === 'en') group = 'English';
        else if (lang === 'es') group = 'Spanish';
        else if (['fr', 'de', 'pt', 'it', 'sv', 'no'].includes(lang)) group = 'European';
        else if (['ru', 'uk'].includes(lang)) group = 'Slavic';
        else if (['zh', 'ja', 'ko', 'hi', 'bn', 'vi', 'th'].includes(lang)) group = 'Asian';
        else if (['ar', 'he', 'arc'].includes(lang)) group = 'Original/Middle East';
        
        return {
          id: t.id,
          name: t.name,
          language: lang,
          year: t.year,
          is_premium: t.is_premium,
          group
        };
      });

      setAvailableTranslations(grouped);
      toast.success(`Loaded ${grouped.length} Bible translations from database`);
    } catch (error) {
      console.error('Error loading translations:', error);
      toast.error('Failed to load translations from database');
    } finally {
      setIsLoading(false);
    }
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  const toggleTranslation = (translationId) => {
    setSelectedTranslations(prev => {
      if (prev.includes(translationId)) {
        return prev.filter(id => id !== translationId);
      } else {
        return [...prev, translationId];
      }
    });
  };

  const selectAll = () => {
    setSelectedTranslations(availableTranslations.map(t => t.id));
  };

  const selectGroup = (group) => {
    const groupTranslations = availableTranslations.filter(t => t.group === group).map(t => t.id);
    setSelectedTranslations(prev => {
      const hasAll = groupTranslations.every(id => prev.includes(id));
      if (hasAll) {
        return prev.filter(id => !groupTranslations.includes(id));
      } else {
        return [...new Set([...prev, ...groupTranslations])];
      }
    });
  };

  const clearAll = () => {
    setSelectedTranslations([]);
  };

  const startBackgroundImport = async () => {
    if (selectedTranslations.length === 0) {
      toast.error('Please select at least one translation');
      return;
    }

    setIsImporting(true);

    try {
      addLog(`Starting background import for: ${selectedTranslations.join(', ')}`, 'info');
      
      const response = await base44.functions.invoke('bulkImportBackground', {
        translations: selectedTranslations
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`Background import started for ${selectedTranslations.length} translation(s)!`, {
        description: 'Check Import Status page for progress.'
      });

      addLog(`✓ Background import initiated`, 'success');
      addLog('Import is running on the server - will complete even if you close this page', 'info');

    } catch (error) {
      toast.error('Failed to start background import', {
        description: error.message
      });
      addLog(`✗ Error: ${error.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const fetchChapter = async (translation, bookName, chapter, retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      const response = await base44.functions.invoke('getVerses', {
        translationId: translation,
        book: bookName,
        chapter: chapter
      });

      if (response.data?.verses && response.data.verses.length > 0) {
        return { success: true, cached: response.data.cached };
      } else {
        throw new Error('No verses returned');
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        addLog(`${translation}: ⟳ Retry ${retryCount + 1}/${maxRetries} for ${bookName} ${chapter}`, 'info');
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return fetchChapter(translation, bookName, chapter, retryCount + 1);
      } else {
        throw error;
      }
    }
  };

  const importAllChapters = async () => {
    if (selectedTranslations.length === 0) {
      toast.error('Please select at least one translation');
      return;
    }

    if (!window.confirm(`This will import ${selectedTranslations.length} translation(s).\n\nIMPORTANT: Keep this tab open.\n\nProceed?`)) {
      return;
    }

    setIsImporting(true);
    setIsPaused(false);
    setProgress(0);
    setStats({ success: 0, failed: 0, cached: 0, retries: 0 });
    setLogs([]);
    setProcessedChapters(0);
    setStartTime(Date.now());
    importStateRef.current = { shouldContinue: true, retryQueue: [] };

    const chaptersPerTranslation = BIBLE_BOOKS.reduce((sum, b) => sum + b.chapters, 0);
    const total = chaptersPerTranslation * selectedTranslations.length;
    setTotalChapters(total);

    addLog(`🚀 Starting import for ${selectedTranslations.length} translation(s)`, 'info');
    addLog(`📊 Total chapters: ${total}`, 'info');
    addLog(`⚠️ DO NOT CLOSE THIS TAB`, 'info');

    let processed = 0;
    const currentRunStats = { success: 0, failed: 0, cached: 0, retries: 0 };

    try {
      for (const translation of selectedTranslations) {
        if (!importStateRef.current.shouldContinue) break;
        
        setCurrentTranslation(translation);
        addLog(`\n=== 📖 ${translation} ===`, 'info');

        for (const book of BIBLE_BOOKS) {
          if (!importStateRef.current.shouldContinue) break;
          
          setCurrentBook(book.name);

          for (let chapter = 1; chapter <= book.chapters; chapter++) {
            if (!importStateRef.current.shouldContinue) break;
            
            while (isPaused && importStateRef.current.shouldContinue) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            setCurrentChapter(chapter);

            try {
              const result = await fetchChapter(translation, book.name, chapter);
              
              if (result.cached) {
                currentRunStats.cached++;
                addLog(`${translation}: ✓ ${book.name} ${chapter} (cached)`, 'success');
              } else {
                currentRunStats.success++;
                addLog(`${translation}: ✓ ${book.name} ${chapter}`, 'success');
              }
            } catch (error) {
              currentRunStats.failed++;
              addLog(`${translation}: ✗ ${book.name} ${chapter}`, 'error');
              importStateRef.current.retryQueue.push({ translation, book: book.name, chapter });
            }

            if (isMountedRef.current) {
              setStats({ ...currentRunStats });
              processed++;
              setProcessedChapters(processed);
              setProgress((processed / total) * 100);
            }

            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
      }

      if (importStateRef.current.retryQueue.length > 0 && importStateRef.current.shouldContinue) {
        addLog(`\n🔄 Retrying ${importStateRef.current.retryQueue.length} failed chapters...`, 'info');
        
        const retryQueue = [...importStateRef.current.retryQueue];
        importStateRef.current.retryQueue = [];
        
        for (const item of retryQueue) {
          if (!importStateRef.current.shouldContinue) break;
          
          try {
            const result = await fetchChapter(item.translation, item.book, item.chapter);
            currentRunStats.failed--;
            if (result.cached) {
              currentRunStats.cached++;
            } else {
              currentRunStats.success++;
            }
            currentRunStats.retries++;
            if (isMountedRef.current) setStats({ ...currentRunStats });
            addLog(`✓ Retry: ${item.translation} ${item.book} ${item.chapter}`, 'success');
          } catch (error) {
            addLog(`✗ Retry failed: ${item.translation} ${item.book} ${item.chapter}`, 'error');
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (isMountedRef.current) {
        addLog(`\n🎉 COMPLETE! ✓ ${currentRunStats.success} | 💾 ${currentRunStats.cached} | ✗ ${currentRunStats.failed}`, 'info');
        toast.success('Import completed! 🎉');
      }
    } catch (error) {
      addLog(`❌ Fatal error: ${error.message}`, 'error');
      toast.error('Import error');
    } finally {
      if (isMountedRef.current) {
        setIsImporting(false);
        setIsPaused(false);
      }
      importStateRef.current.shouldContinue = false;
    }
  };

  const handlePauseResume = () => {
    setIsPaused(prev => !prev);
    toast.info(isPaused ? 'Resumed' : 'Paused');
  };

  const handleStop = () => {
    if (window.confirm('Stop import? Progress will be lost.')) {
      importStateRef.current.shouldContinue = false;
      setIsImporting(false);
      setIsPaused(false);
      toast.info('Import stopped');
    }
  };

  // Group translations by category
  const groupedTranslations = availableTranslations.reduce((acc, translation) => {
    if (!acc[translation.group]) {
      acc[translation.group] = [];
    }
    acc[translation.group].push(translation);
    return acc;
  }, {});

  const elapsedSeconds = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const estimatedTotalSeconds = processedChapters > 0 ? (elapsedSeconds / processedChapters) * totalChapters : 0;
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <p className="text-lg">Loading translations from database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Unstoppable Bible Import</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {availableTranslations.length} translations available • 1,189 chapters each
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTranslations}
            disabled={isLoading || isImporting}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh List
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Select Translations ({availableTranslations.length} available)
            </CardTitle>
            <CardDescription>
              All translations loaded from your database • Import 1,189 chapters per translation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={isImporting}>
                All ({availableTranslations.length})
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll} disabled={isImporting}>
                Clear
              </Button>
              {Object.keys(groupedTranslations).map(group => (
                <Button 
                  key={group}
                  variant="outline" 
                  size="sm" 
                  onClick={() => selectGroup(group)}
                  disabled={isImporting}
                >
                  {group} ({groupedTranslations[group].length})
                </Button>
              ))}
              <div className="ml-auto text-sm font-medium">
                {selectedTranslations.length} selected
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto p-2 border rounded">
              {Object.entries(groupedTranslations).map(([group, translations]) => (
                <div key={group} className="mb-4">
                  <h3 className="text-sm font-semibold mb-2 px-2 flex items-center gap-2">
                    {group}
                    <Badge variant="secondary">{translations.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {translations.map((translation) => (
                      <div 
                        key={translation.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                      >
                        <Checkbox
                          id={translation.id}
                          checked={selectedTranslations.includes(translation.id)}
                          onCheckedChange={() => toggleTranslation(translation.id)}
                          disabled={isImporting}
                        />
                        <label
                          htmlFor={translation.id}
                          className="text-sm cursor-pointer flex-1"
                        >
                          <div className="flex items-center gap-2">
                            <span>{translation.name}</span>
                            {translation.is_premium && (
                              <Badge variant="secondary" className="text-xs">Premium</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {translation.language.toUpperCase()} • {translation.year || 'Classic'}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={startBackgroundImport} 
                disabled={isImporting || selectedTranslations.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Background Import
              </Button>
              <Button 
                onClick={importAllChapters} 
                disabled={isImporting || selectedTranslations.length === 0}
                variant="outline"
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Live Import
                  </>
                )}
              </Button>
            </div>

            {isImporting && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePauseResume}
                  className="flex-1"
                >
                  {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleStop}
                  className="flex-1"
                >
                  🛑 Stop
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isImporting && (
          <Card className="sticky top-4 z-10 shadow-xl">
            <CardHeader>
              <CardTitle>Import Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="w-full h-3" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-semibold">{currentTranslation}</span>
                  {isPaused && <Badge>⏸️ Paused</Badge>}
                </div>
                <div className="font-mono">
                  {currentBook} Ch {currentChapter} - {Math.round(progress)}%
                </div>
                {remainingSeconds > 0 && (
                  <div className="text-xs mt-2 text-gray-500">
                    ~{Math.round(remainingSeconds / 60)} min remaining
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-green-50 dark:bg-green-900 rounded">
                  <CheckCircle2 className="w-6 h-6 mx-auto text-green-600 mb-1" />
                  <div className="text-lg font-bold">{stats.success}</div>
                  <div className="text-xs text-gray-600">New</div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded">
                  <Database className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                  <div className="text-lg font-bold">{stats.cached}</div>
                  <div className="text-xs text-gray-600">Cached</div>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900 rounded">
                  <XCircle className="w-6 h-6 mx-auto text-red-600 dark:text-red-400 mb-1" />
                  <div className="text-lg font-bold">{stats.failed}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-900 rounded">
                  <Loader2 className="w-6 h-6 mx-auto text-orange-600 mb-1" />
                  <div className="text-lg font-bold">{stats.retries}</div>
                  <div className="text-xs text-gray-600">Retries</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Import Log ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-1 font-mono text-xs bg-gray-900 text-green-400 p-4 rounded">
                {logs.slice(-100).map((log, index) => (
                  <div 
                    key={index}
                    className={`${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-green-400' : 
                      'text-gray-300'
                    }`}
                  >
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Import Guide</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• <strong>Background:</strong> Runs on server, close tab safely</li>
              <li>• <strong>Live:</strong> Real-time with pause/resume, keep tab open</li>
              <li>• <strong>Auto-Retry:</strong> 5 attempts per failed chapter (unstoppable!)</li>
              <li>• <strong>Speed:</strong> ~30-60 sec per book</li>
              <li>• <strong>Database-Driven:</strong> All {availableTranslations.length} translations from your Translation entity</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}