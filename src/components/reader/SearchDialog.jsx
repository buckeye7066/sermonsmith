
import React, { useState, useEffect } from "react";
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
import { Search, Loader2, BookOpen } from "lucide-react";
import { getOfflineStorage } from "@/utils";

export default function SearchDialog({ open, onClose, onSelectVerse, currentTranslation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloads, setDownloads] = useState([]);

  useEffect(() => {
    if (open) {
      loadDownloads();
    }
  }, [open]);

  const loadDownloads = async () => {
    try {
      const storage = await getOfflineStorage();
      const allDownloads = await storage.getDownloads();
      setDownloads(allDownloads);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const storage = await getOfflineStorage();
      const results = [];

      for (const download of downloads) {
        if (download.translation_id !== currentTranslation) continue;

        for (let chapter = 1; chapter <= download.total_chapters; chapter++) {
          const verses = await storage.getVerses(
            download.translation_id,
            download.book_name,
            chapter
          );

          const matchingVerses = verses.filter(v =>
            v.text.toLowerCase().includes(searchQuery.toLowerCase())
          );

          for (const verse of matchingVerses) {
            results.push({
              ...verse,
              book_name: download.book_name,
              chapter: chapter
            });
          }
        }
      }

      setSearchResults(results.slice(0, 50));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectResult = (result) => {
    onSelectVerse(result.book_name, result.chapter, result.verse);
    onClose();
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Search Downloaded Content
          </DialogTitle>
          <DialogDescription>
            Search within your offline Bible books ({currentTranslation})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="flex gap-2">
            <Input
              placeholder="Enter keywords (min 3 characters)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch}
              disabled={isSearching || searchQuery.length < 3}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {downloads.filter(d => d.translation_id === currentTranslation).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No downloaded books for {currentTranslation}</p>
              <p className="text-sm">Download books to search offline</p>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500 mb-3" />
              <p className="text-sm text-gray-600">Searching your downloads...</p>
            </div>
          )}

          {!isSearching && searchResults.length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500">
              <p>No results found for "{searchQuery}"</p>
              <p className="text-sm mt-2">Try different keywords or download more books</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                {searchResults.length === 50 && ' (showing first 50)'}
              </p>
              
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => handleSelectResult(result)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline">
                      {result.book_name} {result.chapter}:{result.verse}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {highlightText(result.text, searchQuery)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
