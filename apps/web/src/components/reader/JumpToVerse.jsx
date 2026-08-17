import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigation, AlertCircle } from "lucide-react";
import { chaptersInBook, versesInChapter } from "@/lib/bibleVerseCounts";

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

export default function JumpToVerse({ open, onClose, onJump, currentBook, currentChapter, currentTranslation, translationBookInfo }) {
  const [book, setBook] = useState(currentBook);
  const [chapter, setChapter] = useState(currentChapter.toString());
  const [verse, setVerse] = useState("");
  const [error, setError] = useState("");

  // Re-sync the form to the reader's current location each time the dialog
  // opens (useState initialisers only run once, so without this a reopen kept
  // stale values), and clear any prior validation message.
  useEffect(() => {
    if (open) {
      setBook(currentBook);
      setChapter(String(currentChapter));
      setVerse("");
      setError("");
    }
  }, [open, currentBook, currentChapter]);

  const maxChapter = chaptersInBook(book);

  const handleJump = () => {
    const chapterNum = parseInt(chapter, 10);
    const verseNum = verse ? parseInt(verse, 10) : null;

    // Validate the reference *before* navigating so an impossible chapter or
    // verse can never reach the Reader (and the API). Previously an invalid
    // entry silently did nothing — or, for an out-of-range chapter, sent the
    // reader off to fetch a passage that doesn't exist.
    if (!book) {
      setError("Please choose a book.");
      return;
    }
    if (!Number.isInteger(chapterNum) || chapterNum < 1) {
      setError("Enter a chapter number (1 or higher).");
      return;
    }
    if (maxChapter && chapterNum > maxChapter) {
      setError(`${book} only has ${maxChapter} chapter${maxChapter === 1 ? "" : "s"}.`);
      return;
    }
    if (verseNum !== null) {
      if (!Number.isInteger(verseNum) || verseNum < 1) {
        setError("Verse must be 1 or higher.");
        return;
      }
      const maxVerse = versesInChapter(book, chapterNum, currentTranslation);
      if (maxVerse && verseNum > maxVerse) {
        setError(`${book} ${chapterNum} only has ${maxVerse} verse${maxVerse === 1 ? "" : "s"}.`);
        return;
      }
    }

    setError("");
    onJump(book, chapterNum, verseNum);
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-500" />
            Jump to Verse
          </DialogTitle>
          <DialogDescription>
            Navigate to any verse in the Bible
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="book">Book</Label>
            <Select value={book} onValueChange={(v) => { setBook(v); setError(""); }}>
              <SelectTrigger id="book">
                <SelectValue placeholder="Select book" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {!translationBookInfo?.isNTOnly && (
                  <>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Old Testament
                    </div>
                    {BIBLE_BOOKS.slice(0, 39).map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </>
                )}
                {translationBookInfo?.isNTOnly && (
                  <div className="px-2 py-1 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Old Testament not available in this translation
                  </div>
                )}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">
                  New Testament
                </div>
                {BIBLE_BOOKS.slice(39).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chapter">Chapter</Label>
              <Input
                id="chapter"
                type="number"
                min="1"
                max={maxChapter || undefined}
                value={chapter}
                onChange={(e) => { setChapter(e.target.value); setError(""); }}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 3"
              />
            </div>
            <div>
              <Label htmlFor="verse">Verse (Optional)</Label>
              <Input
                id="verse"
                type="number"
                min="1"
                value={verse}
                onChange={(e) => { setVerse(e.target.value); setError(""); }}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 16"
              />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Tip:</strong> Leave verse empty to jump to the beginning of the chapter
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleJump}>
            <Navigation className="w-4 h-4 mr-2" />
            Jump
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
