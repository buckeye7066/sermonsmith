
import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BookOpen, 
  ChevronLeft,
  ChevronRight,
  Languages,
  Crown,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Wifi,
  WifiOff,
  Settings,
  Navigation,
  Search,
  Volume2
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl, getOfflineStorage, syncService } from "../utils";

import VerseCard from "../components/reader/VerseCard";
import HighlightDrawer from "../components/reader/HighlightDrawer";
import NoteDrawer from "../components/reader/NoteDrawer";
import TranslationSelector from "../components/reader/TranslationSelector";
import TranslationPanel from "../components/reader/TranslationPanel";
import VersionComparison from "../components/reader/VersionComparison";
import ReaderSettings from "../components/reader/ReaderSettings";
import JumpToVerse from "../components/reader/JumpToVerse";
import AudioPlayer from "../components/reader/AudioPlayer";
import SearchDialog from "../components/reader/SearchDialog";
import ShareMenu from "../components/reader/ShareMenu";
import VerseOfTheDay from "../components/reader/VerseOfTheDay";
import CrossReferencePanel from "../components/reader/CrossReferencePanel";
import ThematicLinker from "../components/discovery/ThematicLinker";
import { getVerses } from "@/functions/getVerses"; // Keeping this import as it's not explicitly removed, though its usage changes

const THEME_CLASSES = {
  light: { bg: 'bg-white', text: 'text-gray-900', card: 'bg-white' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100', card: 'bg-gray-800' },
  sepia: { bg: 'bg-amber-50', text: 'text-amber-900', card: 'bg-amber-100' },
  cream: { bg: 'bg-yellow-50', text: 'text-gray-900', card: 'bg-yellow-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-900', card: 'bg-blue-100' }
};

export default function Reader() {
  const [verses, setVerses] = useState([]);
  const [currentBook, setCurrentBook] = useState("Genesis");
  const [currentChapter, setCurrentChapter] = useState(1);
  const [currentTranslation, setCurrentTranslation] = useState("KJV");
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [showHighlightDrawer, setShowHighlightDrawer] = useState(false);
  const [showNoteDrawer, setShowNoteDrawer] = useState(false);
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJumpToVerse, setShowJumpToVerse] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  const [readerSettings, setReaderSettings] = useState({
    fontSize: 18,
    lineHeight: 1.8,
    theme: 'light'
  });
  
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [contentToShare, setContentToShare] = useState(null);
  const [showCrossRefs, setShowCrossRefs] = useState(false);
  const [crossRefVerse, setCrossRefVerse] = useState(null);
  const [showThematicLinker, setShowThematicLinker] = useState(false);
  const [thematicVerse, setThematicVerse] = useState(null);

  const verseRefs = useRef({});

  useEffect(() => {
    // Load from user preferences if available, otherwise localStorage
    const loadReaderSettings = async () => {
      try {
        const userData = await base44.auth.me();
        if (userData?.reading_preferences) {
          setReaderSettings({
            fontSize: userData.reading_preferences.fontSize || 18,
            lineHeight: userData.reading_preferences.lineHeight || 1.8,
            theme: userData.reading_preferences.theme || 'light'
          });
          
          // Set default translation if available
          if (userData.reading_preferences.defaultTranslation) {
            setCurrentTranslation(userData.reading_preferences.defaultTranslation);
          }
        } else {
          const savedSettings = localStorage.getItem('readerSettings');
          if (savedSettings) {
            setReaderSettings(JSON.parse(savedSettings));
          }
        }
      } catch (error) {
        // If base44.auth.me() fails (e.g., not logged in), fall back to localStorage
        const savedSettings = localStorage.getItem('readerSettings');
        if (savedSettings) {
          setReaderSettings(JSON.parse(savedSettings));
        }
      }
    };
    
    loadReaderSettings();
  }, [setCurrentTranslation]);

  useEffect(() => {
    // Save to both user profile and localStorage
    const saveSettings = async () => {
      localStorage.setItem('readerSettings', JSON.stringify(readerSettings));
      
      if (user) {
        try {
          await base44.auth.updateMe({
            reading_preferences: {
              ...(user.reading_preferences || {}), // Spread existing preferences or an empty object
              fontSize: readerSettings.fontSize,
              lineHeight: readerSettings.lineHeight,
              theme: readerSettings.theme
            }
          });
        } catch (error) {
          console.log('Failed to save to user profile:', error);
        }
      }
    };
    
    saveSettings();
  }, [readerSettings, user]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online - syncing data...");
      if (syncService && syncService.syncAll) {
        syncService.syncAll();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.info("You're offline - using local data");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (syncService && syncService.startAutoSync) {
      syncService.startAutoSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const devEmails = [
        'buckeye7066@gmail.com',
        'anyawhite@rocketmail.com',
        'whiterobert1201@icloud.com',
        'tishka1201@icloud.com'
      ];
      
      const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
      
      const emailMatch = userData.email && devEmails.includes(userData.email.toLowerCase());
      const phoneMatch = userData.phone && devPhones.some(p => 
        userData.phone.replace(/[\s\-\(\)]/g, '').includes(p.replace(/[\s\-\(\)\+]/g, ''))
      );
      
      const premium = userData.subscription_tier === 'premium' || 
                      userData.premium_override === true ||
                      emailMatch ||
                      phoneMatch ||
                      (userData.premium_until && new Date(userData.premium_until) > new Date());
      
      setIsPremium(premium);
    } catch (error) {
      console.log("User not logged in");
    }
  }, []);

  const loadCurrentChapter = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsOfflineMode(false);

    try {
      // Handle offline mode first
      if (!isOnline) {
        const storage = await getOfflineStorage();
        const offlineVerses = await storage.getVerses(currentTranslation, currentBook, currentChapter);
        
        if (offlineVerses.length > 0) {
          setVerses(offlineVerses);
          setIsCached(true);
          setIsOfflineMode(true);
          setIsLoading(false);
          return;
        } else {
          setError({
            message: 'This chapter is not available offline. Connect to internet to download it.',
            canRetry: false
          });
          setIsLoading(false);
          return;
        }
      }

      // ONLINE MODE: Try database first (this is the fix!)
      try {
        const dbVerses = await base44.entities.Verse.filter({
          translation_id: currentTranslation,
          book_name: currentBook,
          chapter: currentChapter
        }, 'verse');

        if (dbVerses.length > 0) {
          const formattedVerses = dbVerses.map(v => ({
            id: v.id,
            verse: v.verse,
            text: v.text
          }));
          
          setVerses(formattedVerses);
          setIsCached(true);
          setIsOfflineMode(false);
          
          // Cache in IndexedDB for offline use (fire and forget)
          if (formattedVerses.length > 0) {
            getOfflineStorage()
              .then(storage => storage.saveVerses(formattedVerses, currentTranslation, currentBook, currentChapter))
              .catch(e => console.warn('Cache skipped:', e.message));
          }
          
          setIsLoading(false);
          return;
        }
      } catch (dbError) {
        console.warn('Database fetch failed:', dbError);
      }

      // If not in database, show message
      setError({
        message: `Chapter not imported yet. Go to Bulk Import to download ${currentBook} ${currentChapter}.`,
        canRetry: false
      });
      
    } catch (error) { // This catch now handles initial offline errors, DB errors (if re-thrown), and API errors
      console.error("Error loading verses:", error);
      
      // Last resort: try offline storage (in case the online attempts failed catastrophically but we have some local data)
      try {
        const storage = await getOfflineStorage();
        const offlineVerses = await storage.getVerses(currentTranslation, currentBook, currentChapter);
        
        if (offlineVerses.length > 0) {
          setVerses(offlineVerses);
          setIsCached(true);
          setIsOfflineMode(true);
          toast.info("Loaded from offline storage");
        } else {
          setError({
            message: 'Failed to load verses. Please try again.',
            canRetry: true
          });
        }
      } catch (offlineError) {
        setError({
          message: 'Failed to load verses. Please try again.',
          canRetry: true
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentBook, currentChapter, currentTranslation, isOnline]);

  const loadUserData = useCallback(async () => {
    if (user) {
      try {
        const userHighlights = await base44.entities.Highlight.filter({ user_id: user.id });
        const userNotes = await base44.entities.Note.filter({ user_id: user.id });
        setHighlights(userHighlights);
        setNotes(userNotes);
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    }
  }, [user]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadCurrentChapter();
  }, [loadCurrentChapter]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const navigateChapter = (direction) => {
    if (direction === 'prev' && currentChapter > 1) {
      setCurrentChapter(currentChapter - 1);
    } else if (direction === 'next') {
      setCurrentChapter(currentChapter + 1);
    }
  };

  const handleJumpToVerse = (book, chapter, verse) => {
    setCurrentBook(book);
    setCurrentChapter(chapter);
    
    if (verse) {
      setTimeout(() => {
        const verseElement = verseRefs.current[verse];
        if (verseElement) {
          verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          verseElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            verseElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 2000);
        }
      }, 500);
    }
  };

  const handleHighlight = (verse) => {
    if (!user) {
      toast.error("Please log in to save highlights");
      return;
    }
    setSelectedVerse(verse);
    setShowHighlightDrawer(true);
  };

  const handleNote = (verse) => {
    if (!user) {
      toast.error("Please log in to save notes");
      return;
    }
    setSelectedVerse(verse);
    setShowNoteDrawer(true);
  };

  const saveHighlight = async (color) => {
    if (!selectedVerse || !user) return;
    
    try {
      if (isOnline) {
        await base44.entities.Highlight.create({
          user_id: user.id,
          verse_id: selectedVerse.id,
          color,
          book_name: selectedVerse.book_name,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse
        });
        toast.success("Highlight saved!");
      } else {
        const storage = await getOfflineStorage();
        await storage.saveOfflineHighlight({
          user_id: user.id,
          verse_id: selectedVerse.id,
          color,
          book_name: selectedVerse.book_name,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse
        });
        toast.success("Highlight saved offline - will sync when online");
      }
      
      setShowHighlightDrawer(false);
      loadUserData();
    } catch (error) {
      toast.error("Error saving highlight");
    }
  };

  const saveNote = async (content) => {
    if (!selectedVerse || !user || !content.trim()) return;
    
    try {
      if (isOnline) {
        await base44.entities.Note.create({
          user_id: user.id,
          verse_id: selectedVerse.id,
          content: content.trim(),
          book_name: selectedVerse.book_name,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse
        });
        toast.success("Note saved!");
      } else {
        const storage = await getOfflineStorage();
        await storage.saveOfflineNote({
          user_id: user.id,
          verse_id: selectedVerse.id,
          content: content.trim(),
          book_name: selectedVerse.book_name,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse
        });
        toast.success("Note saved offline - will sync when online");
      }
      
      setShowNoteDrawer(false);
      loadUserData();
    } catch (error) {
      toast.error("Error saving note");
    }
  };

  const handleTranslate = (verse) => {
    if (!user) {
      toast.error("Please log in to use translation");
      return;
    }
    
    if (!isPremium) {
      toast.error("Translation is a Premium feature", {
        description: "Upgrade to translate verses into any language"
      });
      return;
    }
    
    setSelectedVerse(verse);
    setShowTranslationPanel(true);
  };

  const copyVerse = (verse) => {
    const text = `"${verse.text}" - ${verse.book_name} ${verse.chapter}:${verse.verse}`;
    navigator.clipboard.writeText(text);
    toast.success("Verse copied to clipboard!");
  };

  const shareVerse = (verse) => {
    const text = `"${verse.text}" - ${verse.book_name} ${verse.chapter}:${verse.verse}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {
        copyVerse(verse);
      });
    } else {
      copyVerse(verse);
    }
  };

  const handleShareToCommunity = (verse) => {
    if (!user) {
      toast.error("Please log in to share to community");
      return;
    }
    
    setContentToShare({
      ...verse,
      content: verse.text,
      verse: verse.verse,
      book_name: currentBook,
      chapter: currentChapter
    });
    setShowShareMenu(true);
  };

  const handleCrossReference = (verse) => {
    setCrossRefVerse({
      ...verse,
      book_name: currentBook,
      chapter: currentChapter
    });
    setShowCrossRefs(true);
  };

  const handleDiscoverRelated = (verse) => {
    setThematicVerse({
      ...verse,
      book_name: currentBook,
      chapter: currentChapter
    });
    setShowThematicLinker(true);
  };

  const getVerseHighlight = (verseId) => {
    return highlights.find(h => h.verse_id === verseId);
  };

  const getVerseNotes = (verseId) => {
    return notes.filter(n => n.verse_id === verseId);
  };

  const handleTranslationChange = (newTranslation) => {
    setCurrentTranslation(newTranslation);
  };

  const themeClasses = THEME_CLASSES[readerSettings.theme];

  return (
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text}`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Verse of the Day */}
        <div className="mb-8">
          <VerseOfTheDay user={user} />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-blue-600" />
              Bible Reader
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {currentBook} Chapter {currentChapter}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={isOnline ? 'default' : 'secondary'} className="flex items-center gap-1">
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
              title="Reader Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowJumpToVerse(true)}
              title="Jump to Verse"
            >
              <Navigation className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSearch(true)}
              title="Search"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateChapter('prev')}
            disabled={currentChapter <= 1 || isLoading}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Badge variant="secondary" className="px-4 py-2">
            Chapter {currentChapter}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateChapter('next')}
            disabled={isLoading}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {!isOnline && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You're offline. Reading from local storage. 
              <Link to={createPageUrl('Downloads')} className="ml-2 underline font-medium">
                Manage Downloads
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {!isPremium && (
          <Card className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 border-purple-200 dark:border-purple-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Languages className="w-8 h-8 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                      Unlock Premium Features
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Multi-language translation & audio playback!
                    </p>
                  </div>
                </div>
                <Link to={createPageUrl("Pricing")}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <AudioPlayer 
          verses={verses}
          book={currentBook}
          chapter={currentChapter}
          isPremium={isPremium}
          isOnline={isOnline}
        />

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TranslationSelector 
            currentTranslation={currentTranslation}
            onTranslationChange={handleTranslationChange}
            user={user}
            isPremium={isPremium}
          />
          <Button 
            variant="outline" 
            onClick={() => setShowVersionComparison(true)}
            className="flex items-center gap-2"
            disabled={!isOnline}
          >
            <Languages className="w-4 h-4" />
            Compare
          </Button>
        </div>

        <Card className={`mb-6 shadow-lg border-0 ${themeClasses.card}`}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="w-5 h-5 text-blue-600" />
              {currentBook} {currentChapter} ({currentTranslation})
              {isCached && (
                <Badge variant="secondary" className="ml-2">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {isOfflineMode ? 'Offline' : 'Cached'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                ))}
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-500" />
                  <p className="mt-2 text-sm text-gray-600">Loading verses...</p>
                </div>
              </div>
            )}

            {error && !isLoading && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{error.message}</span>
                  {error.canRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadCurrentChapter}
                      className="ml-4"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!isLoading && !error && verses.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
                <p className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">
                  No verses available
                </p>
              </div>
            )}

            {!isLoading && !error && verses.length > 0 && (
              <div className="space-y-4">
                {verses.map((verse, index) => (
                  <div
                    key={verse.id || index}
                    ref={(el) => verseRefs.current[verse.verse] = el}
                    style={{
                      fontSize: `${readerSettings.fontSize}px`,
                      lineHeight: readerSettings.lineHeight
                    }}
                  >
                    <VerseCard
                      verse={{...verse, book_name: currentBook, chapter: currentChapter, id: verse.id || `${currentBook}-${currentChapter}-${verse.verse}`}}
                      highlight={getVerseHighlight(verse.id)}
                      notes={getVerseNotes(verse.id)}
                      onHighlight={handleHighlight}
                      onNote={handleNote}
                      onCopy={copyVerse}
                      onShare={shareVerse}
                      onTranslate={handleTranslate}
                      onShareToCommunity={handleShareToCommunity}
                      onCrossReference={handleCrossReference}
                      onDiscoverRelated={handleDiscoverRelated}
                      showTranslate={isPremium}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {showThematicLinker && thematicVerse && (
          <div className="mb-6">
            <ThematicLinker 
              sourceType="verse"
              sourceData={thematicVerse}
              user={user}
            />
            <Button
              variant="outline"
              onClick={() => setShowThematicLinker(false)}
              className="w-full mt-3"
            >
              Hide Related Content
            </Button>
          </div>
        )}

        <ReaderSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          settings={readerSettings}
          onSettingsChange={setReaderSettings}
        />

        <JumpToVerse
          open={showJumpToVerse}
          onClose={() => setShowJumpToVerse(false)}
          onJump={handleJumpToVerse}
          currentBook={currentBook}
          currentChapter={currentChapter}
        />

        <SearchDialog
          open={showSearch}
          onClose={() => setShowSearch(false)}
          onSelectVerse={handleJumpToVerse}
          currentTranslation={currentTranslation}
        />

        {showVersionComparison && (
          <VersionComparison 
            book={currentBook}
            chapter={currentChapter}
            onClose={() => setShowVersionComparison(false)}
          />
        )}

        {showTranslationPanel && selectedVerse && (
          <TranslationPanel 
            verse={selectedVerse}
            onClose={() => {
              setShowTranslationPanel(false);
              setSelectedVerse(null);
            }}
          />
        )}

        <HighlightDrawer
          open={showHighlightDrawer}
          onClose={() => setShowHighlightDrawer(false)}
          onSave={saveHighlight}
          verse={selectedVerse}
        />

        <NoteDrawer
          open={showNoteDrawer}
          onClose={() => setShowNoteDrawer(false)}
          onSave={saveNote}
          verse={selectedVerse}
          existingNotes={selectedVerse ? getVerseNotes(selectedVerse.id) : []}
        />

        <ShareMenu
          open={showShareMenu}
          onClose={() => setShowShareMenu(false)}
          content={contentToShare}
          contentType="highlight"
          user={user}
        />

        <CrossReferencePanel
          open={showCrossRefs}
          onClose={() => {
            setShowCrossRefs(false);
            setCrossRefVerse(null);
          }}
          verse={crossRefVerse}
          onNavigate={handleJumpToVerse}
        />
      </div>
    </div>
  );
}
