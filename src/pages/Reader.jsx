import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { logActivity } from "../components/admin/UserActivityLogger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  Volume2,
  Download,
  CloudOff
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { BOOK_NAME_TO_OSIS } from "../components/bible/bibleSources";

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
import AIExplanation from "../components/reader/AIExplanation";
import ReligiousViewpointsDialog from "../components/reader/ReligiousViewpointsDialog";
import StudyToolsPanel from "../components/reader/StudyToolsPanel";
import OfflineDownloadManager from "../components/reader/OfflineDownloadManager";
import { getChapterOffline, isOnline as checkOnline } from "../components/reader/OfflineBibleService";

// Translation ID normalization map - maps user-friendly IDs to actual HelloAO API IDs
const TRANSLATION_NORMALIZE_MAP = {
  "en-kjv": "eng-kjv2006", "kjv": "eng-kjv2006", "k-j-v": "eng-kjv2006",
  "en-web": "ENGWEBP", "web": "ENGWEBP",
  "en-bsb": "BSB", "bsb": "BSB",
  "en-asv": "eng-asv", "asv": "eng-asv",
  "en-darby": "eng-darby", "darby": "eng-darby",
  "en-ylt": "eng-ylt", "ylt": "eng-ylt",
  "ru-rst": "rus-synodal", "rst": "rus-synodal", "ru-synodal": "rus-synodal",
  "russian": "rus-synodal"
};

function normalizeTranslationId(translationId) {
  if (!translationId) return "eng-kjv2006";
  const lower = translationId.toLowerCase().trim();
  if (TRANSLATION_NORMALIZE_MAP[lower]) {
    return TRANSLATION_NORMALIZE_MAP[lower];
  }
  // If already looks like an API ID, use as-is
  if (translationId.includes('-') || /^[A-Z]{2,}$/.test(translationId)) {
    return translationId;
  }
  return "eng-kjv2006";
}

const THEME_CLASSES = {
  light: { bg: 'bg-white', text: 'text-gray-900', card: 'bg-white' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100', card: 'bg-gray-800' },
  sepia: { bg: 'bg-amber-50', text: 'text-amber-900', card: 'bg-amber-100' },
  cream: { bg: 'bg-yellow-50', text: 'text-gray-900', card: 'bg-yellow-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-900', card: 'bg-blue-100' }
};

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

export default function Reader() {
  const [verses, setVerses] = useState([]);
  const [currentBook, setCurrentBook] = useState(() => {
    // Validate and load from localStorage
    const saved = localStorage.getItem('lastReadBook');
    if (saved && BIBLE_BOOKS.find(b => b.name === saved)) {
      return saved;
    }
    return "Genesis";
  });
  const [currentChapter, setCurrentChapter] = useState(() => {
    const saved = parseInt(localStorage.getItem('lastReadChapter'));
    return saved > 0 ? saved : 1;
  });
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
  const [showAIExplanation, setShowAIExplanation] = useState(false);
  const [aiExplainVerse, setAiExplainVerse] = useState(null);
  const [showReligiousViewpoints, setShowReligiousViewpoints] = useState(false);
  const [religiousViewpointsVerse, setReligiousViewpointsVerse] = useState(null);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [studyToolsVerse, setStudyToolsVerse] = useState(null);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [availableTranslations, setAvailableTranslations] = useState([]);

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
      toast.success("Back online!");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info("You're offline");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const premium = userData.subscription_tier === 'premium' ||
                      userData.premium_override === true ||
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
      // Validate currentBook before proceeding
      if (!currentBook || !BIBLE_BOOKS.find(b => b.name === currentBook)) {
        console.error(`Invalid book: ${currentBook}, resetting to Genesis`);
        setCurrentBook("Genesis");
        setCurrentChapter(1);
        localStorage.setItem('lastReadBook', 'Genesis');
        localStorage.setItem('lastReadChapter', '1');
        return;
      }

      const bookCode = BOOK_NAME_TO_OSIS[currentBook];
      if (!bookCode) {
        throw new Error(`Book code not found for ${currentBook}`);
      }

      // Normalize the translation ID before sending
      const normalizedTranslation = normalizeTranslationId(currentTranslation);

      // Validate inputs before API call
      if (!bookCode || !currentChapter) {
        throw new Error("Missing book or chapter.");
      }
      if (!normalizedTranslation) {
        throw new Error("Missing or invalid translation code.");
      }

      // Try offline first if we're offline
      if (!navigator.onLine) {
        const offlineData = await getChapterOffline(normalizedTranslation, bookCode, currentChapter);
        if (offlineData && offlineData.chapter?.content) {
          // Parse offline data
          const verseData = [];
          let currentVerse = null;
          let currentText = "";
          
          for (const item of offlineData.chapter.content) {
            if (item.type === "verse") {
              if (currentVerse !== null && currentText.trim()) {
                verseData.push({ verse: currentVerse, text: currentText.trim() });
              }
              currentVerse = item.number;
              currentText = "";
            } else if (item.type === "text" && currentVerse !== null) {
              currentText += item.text;
            }
          }
          if (currentVerse !== null && currentText.trim()) {
            verseData.push({ verse: currentVerse, text: currentText.trim() });
          }

          const formattedVerses = verseData.map((v) => ({
            id: `${currentBook}-${currentChapter}-${v.verse}`,
            verse: v.verse,
            text: v.text,
            book_name: currentBook,
            chapter: currentChapter
          }));

          setVerses(formattedVerses);
          setIsCached(true);
          setIsOfflineMode(true);
          setIsLoading(false);
          return;
        }
      }

      const response = await base44.functions.invoke('biblePassage', {
        translationId: normalizedTranslation,
        bookCode: bookCode,
        chapter: currentChapter
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const verses = response.data.verses || [];

      if (verses && verses.length > 0) {
        const formattedVerses = verses.map((v) => ({
          id: `${currentBook}-${currentChapter}-${v.verse}`,
          verse: v.verse,
          text: v.text,
          book_name: currentBook,
          chapter: currentChapter
        }));

        setVerses(formattedVerses);
        setIsCached(true);
        setIsOfflineMode(false);

        // Log Bible reading with granular details
        logActivity('bible_read', { 
          page_name: 'Reader',
          data_viewed: `${currentBook} ${currentChapter}`,
          metadata: { 
            book: currentBook, 
            chapter: currentChapter, 
            translation: normalizedTranslation,
            verse_count: formattedVerses.length,
            is_cached: true
          }
        });
      } else {
        setError({
          message: `${currentBook} ${currentChapter} is not available in ${normalizedTranslation} yet.`,
          canRetry: false
        });
        setVerses([]);
      }
    } catch (error) {
      console.error("Error loading verses:", error);
      
      // Try offline fallback
      const bookCode = BOOK_NAME_TO_OSIS[currentBook];
      const normalizedTranslation = normalizeTranslationId(currentTranslation);
      
      if (bookCode) {
        try {
          const offlineData = await getChapterOffline(normalizedTranslation, bookCode, currentChapter);
          if (offlineData && offlineData.chapter?.content) {
            const verseData = [];
            let currentVerse = null;
            let currentText = "";
            
            for (const item of offlineData.chapter.content) {
              if (item.type === "verse") {
                if (currentVerse !== null && currentText.trim()) {
                  verseData.push({ verse: currentVerse, text: currentText.trim() });
                }
                currentVerse = item.number;
                currentText = "";
              } else if (item.type === "text" && currentVerse !== null) {
                currentText += item.text;
              }
            }
            if (currentVerse !== null && currentText.trim()) {
              verseData.push({ verse: currentVerse, text: currentText.trim() });
            }

            const formattedVerses = verseData.map((v) => ({
              id: `${currentBook}-${currentChapter}-${v.verse}`,
              verse: v.verse,
              text: v.text,
              book_name: currentBook,
              chapter: currentChapter
            }));

            setVerses(formattedVerses);
            setIsCached(true);
            setIsOfflineMode(true);
            setIsLoading(false);
            return;
          }
        } catch (offlineError) {
          console.error("Offline fallback failed:", offlineError);
        }
      }
      
      // Extract user-friendly error message
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load verses. Please try again.';
      
      setError({
        message: errorMessage,
        canRetry: true
      });
      setVerses([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBook, currentChapter, currentTranslation]);

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
    
    // Log page view
    logActivity('page_view', { page_name: 'Reader' });
    
    // Handle deep link parameters
    const params = new URLSearchParams(window.location.search);
    const bookParam = params.get('book');
    const chapterParam = params.get('chapter');
    const verseParam = params.get('verse');
    
    if (bookParam && chapterParam) {
      handleJumpToVerse(bookParam, parseInt(chapterParam), verseParam ? parseInt(verseParam) : null);
    }
    
    // Handle shared content
    const sharedContent = sessionStorage.getItem('sharedContent');
    if (sharedContent) {
      try {
        const { text } = JSON.parse(sharedContent);
        if (text) {
          toast.info(`Shared: ${text.substring(0, 50)}...`);
        }
        sessionStorage.removeItem('sharedContent');
      } catch (e) {
        console.error('Failed to parse shared content');
      }
    }
  }, [loadUser]);

  useEffect(() => {
    loadCurrentChapter();
  }, [loadCurrentChapter]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const navigateChapter = (direction) => {
    const currentBookInfo = BIBLE_BOOKS.find(b => b.name === currentBook);
    if (!currentBookInfo) return;

    if (direction === 'prev' && currentChapter > 1) {
      const newChapter = currentChapter - 1;
      setCurrentChapter(newChapter);
      localStorage.setItem('lastReadChapter', newChapter.toString());
    } else if (direction === 'next' && currentChapter < currentBookInfo.chapters) {
      const newChapter = currentChapter + 1;
      setCurrentChapter(newChapter);
      localStorage.setItem('lastReadChapter', newChapter.toString());
    }
  };

  const navigateBook = (direction) => {
    const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook);

    if (direction === 'prev' && currentBookIndex > 0) {
      const prevBook = BIBLE_BOOKS[currentBookIndex - 1];
      setCurrentBook(prevBook.name);
      setCurrentChapter(1);
      localStorage.setItem('lastReadBook', prevBook.name);
      localStorage.setItem('lastReadChapter', '1');
    } else if (direction === 'next' && currentBookIndex < BIBLE_BOOKS.length - 1) {
      const nextBook = BIBLE_BOOKS[currentBookIndex + 1];
      setCurrentBook(nextBook.name);
      setCurrentChapter(1);
      localStorage.setItem('lastReadBook', nextBook.name);
      localStorage.setItem('lastReadChapter', '1');
    }
  };

  const handleJumpToVerse = (book, chapter, verse) => {
    // Validate book name
    if (book && BIBLE_BOOKS.find(b => b.name === book)) {
      setCurrentBook(book);
      localStorage.setItem('lastReadBook', book);
    }
    
    if (chapter && chapter > 0) {
      setCurrentChapter(chapter);
      localStorage.setItem('lastReadChapter', chapter.toString());
    }

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
    
    // Show drawer to choose color
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
    if (!selectedVerse || !user) {
      toast.error("Cannot save highlight - missing data");
      return;
    }

    try {
      // Ensure we have all required fields
      const verseId = selectedVerse.id || `${currentBook}-${currentChapter}-${selectedVerse.verse}`;
      
      const created = await base44.entities.Highlight.create({
        user_id: user.id,
        verse_id: verseId,
        color,
        book_name: currentBook,
        chapter: currentChapter,
        verse: selectedVerse.verse
      });
      
      // Immediately update local state for instant visual feedback
      setHighlights(prev => [...prev, created]);

      logActivity('highlight_added', {
        page_name: 'Reader',
        resource_type: 'highlight',
        resource_id: created.id,
        data_modified: `${currentBook} ${currentChapter}:${selectedVerse.verse}`,
        new_value: color,
        metadata: { 
          book: currentBook, 
          chapter: currentChapter, 
          verse: selectedVerse.verse,
          color: color,
          verse_text: selectedVerse.text?.substring(0, 100)
        }
      });

      toast.success(`Highlighted with ${color}!`);
      setShowHighlightDrawer(false);
      setSelectedVerse(null);
    } catch (error) {
      console.error("Highlight save error:", error);
      toast.error("Failed to save highlight");
    }
  };

  const saveNote = async (content) => {
    if (!selectedVerse || !user || !content.trim()) return;

    try {
      await base44.entities.Note.create({
        user_id: user.id,
        verse_id: selectedVerse.id,
        content: content.trim(),
        book_name: selectedVerse.book_name,
        chapter: selectedVerse.chapter,
        verse: selectedVerse.verse
      });
      toast.success("Note saved!");

      logActivity('note_added', {
        page_name: 'Reader',
        resource_type: 'note',
        data_modified: `${currentBook} ${currentChapter}:${selectedVerse.verse}`,
        new_value: content.substring(0, 100),
        metadata: { 
          book: currentBook, 
          chapter: currentChapter, 
          verse: selectedVerse.verse,
          note_length: content.length,
          verse_text: selectedVerse.text?.substring(0, 100)
        }
      });

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

  const handleAIExplain = (verse) => {
    if (!user) {
      toast.error("Please log in to use AI explanations");
      return;
    }
    setAiExplainVerse({
      ...verse,
      book_name: currentBook,
      chapter: currentChapter
    });
    setShowAIExplanation(true);
  };

  const handleReligiousViewpoints = (verse) => {
    if (!user) {
      toast.error("Please log in to compare religious viewpoints");
      return;
    }
    setReligiousViewpointsVerse({
      ...verse,
      book_name: currentBook,
      chapter: currentChapter
    });
    setShowReligiousViewpoints(true);
  };

  const handleStudyTools = (verse) => {
    if (!user) {
      toast.error("Please log in to use study tools");
      return;
    }
    setStudyToolsVerse({
      ...verse,
      book_name: currentBook,
      chapter: currentChapter
    });
    setShowStudyTools(true);
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

  // Load available translations for offline manager
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await base44.functions.invoke('listAvailableTranslations');
        if (response.data.translations) {
          setAvailableTranslations(response.data.translations);
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };
    loadTranslations();
  }, []);

  const themeClasses = THEME_CLASSES[readerSettings.theme];
  const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.name === currentBook);
  const currentBookInfo = BIBLE_BOOKS[currentBookIndex];

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
              onClick={() => setShowOfflineManager(true)}
              title="Offline Downloads"
            >
              <CloudOff className="w-4 h-4" />
            </Button>
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

        {/* Book Navigation */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateBook('prev')}
            disabled={currentBookIndex <= 0 || isLoading}
            className="flex items-center gap-1"
          >
            <ChevronsLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous Book</span>
          </Button>
          <Badge variant="secondary" className="px-4 py-2 flex-1 text-center">
            {currentBook}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateBook('next')}
            disabled={currentBookIndex >= BIBLE_BOOKS.length - 1 || isLoading}
            className="flex items-center gap-1"
          >
            <span className="hidden sm:inline">Next Book</span>
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Chapter Navigation */}
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
            disabled={currentChapter >= currentBookInfo?.chapters || isLoading}
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
          currentTranslation={currentTranslation}
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
                      onAIExplain={handleAIExplain}
                      onReligiousViewpoints={handleReligiousViewpoints}
                      onStudyTools={handleStudyTools}
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

        <AIExplanation
          open={showAIExplanation}
          onClose={() => {
            setShowAIExplanation(false);
            setAiExplainVerse(null);
          }}
          verse={aiExplainVerse}
          user={user}
        />

        <ReligiousViewpointsDialog
          open={showReligiousViewpoints}
          onClose={() => {
            setShowReligiousViewpoints(false);
            setReligiousViewpointsVerse(null);
          }}
          verse={religiousViewpointsVerse}
          user={user}
        />

        <StudyToolsPanel
          open={showStudyTools}
          onClose={() => {
            setShowStudyTools(false);
            setStudyToolsVerse(null);
          }}
          verse={studyToolsVerse}
          user={user}
        />

        <OfflineDownloadManager
          open={showOfflineManager}
          onClose={() => setShowOfflineManager(false)}
          translations={availableTranslations}
        />
        </div>
        </div>
        );
        }