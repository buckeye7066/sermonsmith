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

export default function SearchDialog({ open, onClose, onSelectVerse, currentTranslation }) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Parse search query for verse reference (e.g., "John 3:16")
      const verseMatch = searchQuery.match(/(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)/);
      
      if (verseMatch) {
        const book = verseMatch[1].trim();
        const chapter = parseInt(verseMatch[2]);
        const verse = parseInt(verseMatch[3]);
        
        onSelectVerse(book, chapter, verse);
        onClose();
        setSearchQuery("");
      }
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    const verseMatch = searchQuery.match(/(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)/);
    
    if (verseMatch) {
      const book = verseMatch[1].trim();
      const chapter = parseInt(verseMatch[2]);
      const verse = parseInt(verseMatch[3]);
      
      onSelectVerse(book, chapter, verse);
      onClose();
      setSearchQuery("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Jump to Verse
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
              onChange={(e) => setSearchQuery(e.target.value)}
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