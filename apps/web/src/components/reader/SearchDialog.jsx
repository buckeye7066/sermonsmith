import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
  "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
  "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
  "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const normalizeBookName = (input) => {
  const normalized = input.trim();
  
  // Direct match
  const directMatch = BIBLE_BOOKS.find(b => b.toLowerCase() === normalized.toLowerCase());
  if (directMatch) return directMatch;
  
  // Partial match (starts with)
  const partialMatch = BIBLE_BOOKS.find(b => b.toLowerCase().startsWith(normalized.toLowerCase()));
  if (partialMatch) return partialMatch;
  
  // Handle common abbreviations
  const abbrevMap = {
    'gen': 'Genesis', 'exo': 'Exodus', 'lev': 'Leviticus', 'num': 'Numbers', 'deut': 'Deuteronomy',
    'josh': 'Joshua', 'judg': 'Judges', 'sam': '1 Samuel', '1sam': '1 Samuel', '2sam': '2 Samuel',
    'kings': '1 Kings', '1kings': '1 Kings', '2kings': '2 Kings', 'chron': '1 Chronicles',
    '1chron': '1 Chronicles', '2chron': '2 Chronicles', 'neh': 'Nehemiah', 'esth': 'Esther',
    'ps': 'Psalms', 'psalm': 'Psalms', 'prov': 'Proverbs', 'eccl': 'Ecclesiastes', 'song': 'Song of Solomon',
    'isa': 'Isaiah', 'jer': 'Jeremiah', 'lam': 'Lamentations', 'ezek': 'Ezekiel', 'dan': 'Daniel',
    'hos': 'Hosea', 'obad': 'Obadiah', 'jon': 'Jonah', 'mic': 'Micah', 'nah': 'Nahum',
    'hab': 'Habakkuk', 'zeph': 'Zephaniah', 'hag': 'Haggai', 'zech': 'Zechariah', 'mal': 'Malachi',
    'matt': 'Matthew', 'mat': 'Matthew', 'mk': 'Mark', 'lk': 'Luke', 'jn': 'John',
    'rom': 'Romans', 'cor': '1 Corinthians', '1cor': '1 Corinthians', '2cor': '2 Corinthians',
    'gal': 'Galatians', 'eph': 'Ephesians', 'phil': 'Philippians', 'col': 'Colossians',
    'thess': '1 Thessalonians', '1thess': '1 Thessalonians', '2thess': '2 Thessalonians',
    'tim': '1 Timothy', '1tim': '1 Timothy', '2tim': '2 Timothy', 'tit': 'Titus',
    'philem': 'Philemon', 'heb': 'Hebrews', 'jas': 'James', 'jam': 'James',
    'pet': '1 Peter', '1pet': '1 Peter', '2pet': '2 Peter', 'joh': '1 John',
    '1joh': '1 John', '2joh': '2 John', '3joh': '3 John', 'rev': 'Revelation'
  };
  
  const abbrevMatch = abbrevMap[normalized.toLowerCase()];
  if (abbrevMatch) return abbrevMatch;
  
  return null;
};

export default function SearchDialog({ open, onClose, onSelectVerse, currentTranslation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleSearch();
    }
  };

  // NOTE: never use window.alert() here — a native alert blocks the renderer
  // (and hangs automated/embedded browsers entirely). Surface validation via a
  // toast + inline message instead.
  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    // Parse search query for verse reference (e.g., "John 3:16")
    const verseMatch = searchQuery.match(/(.+?)\s+(\d+):(\d+)/);

    if (!verseMatch) {
      const msg = 'Enter a reference like "John 3:16" (Book Chapter:Verse).';
      setError(msg);
      toast.error(msg);
      return;
    }

    const rawBook = verseMatch[1].trim();
    const book = normalizeBookName(rawBook);
    const chapter = parseInt(verseMatch[2]);
    const verse = parseInt(verseMatch[3]);

    if (!book) {
      const msg = `"${rawBook}" isn't a recognized book. Check the spelling (e.g., "John", "Genesis").`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setError("");
    onSelectVerse(book, chapter, verse);
    onClose();
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Go to Verse
          </DialogTitle>
          <DialogDescription>
            Enter a verse reference (e.g., "John 3:16", "Genesis 1:1")
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enter verse reference in format: Book Chapter:Verse
              <div className="mt-2 space-y-1 text-xs">
                <div>Examples:</div>
                <div className="font-mono">• John 3:16</div>
                <div className="font-mono">• Genesis 1:1</div>
                <div className="font-mono">• 1 Corinthians 13:4</div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Input
              placeholder="Enter verse reference (e.g., John 3:16)..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (error) setError(""); }}
              onKeyPress={handleKeyPress}
              className="flex-1"
              autoFocus
            />
            <Button 
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
            >
              <Search className="w-4 h-4 mr-2" />
              Go
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-2">Popular Verses:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                "John 3:16",
                "Psalm 23:1",
                "Romans 8:28",
                "Philippians 4:13",
                "Jeremiah 29:11",
                "Proverbs 3:5"
              ].map((verse) => (
                <Badge
                  key={verse}
                  variant="outline"
                  className="cursor-pointer hover:bg-blue-50 transition-colors justify-center py-2"
                  onClick={() => {
                    setSearchQuery(verse);
                    setTimeout(handleSearch, 100);
                  }}
                >
                  {verse}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}