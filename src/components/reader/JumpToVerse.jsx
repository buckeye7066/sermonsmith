import React, { useState } from "react";
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
import { Navigation } from "lucide-react";

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

export default function JumpToVerse({ open, onClose, onJump, currentBook, currentChapter }) {
  const [book, setBook] = useState(currentBook);
  const [chapter, setChapter] = useState(currentChapter.toString());
  const [verse, setVerse] = useState("");

  const handleJump = () => {
    const chapterNum = parseInt(chapter);
    const verseNum = verse ? parseInt(verse) : null;
    
    if (book && !isNaN(chapterNum) && chapterNum > 0) {
      onJump(book, chapterNum, verseNum);
      onClose();
    }
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
            <Select value={book} onValueChange={setBook}>
              <SelectTrigger id="book">
                <SelectValue placeholder="Select book" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                  Old Testament
                </div>
                {BIBLE_BOOKS.slice(0, 39).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
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
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
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
                onChange={(e) => setVerse(e.target.value)}
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