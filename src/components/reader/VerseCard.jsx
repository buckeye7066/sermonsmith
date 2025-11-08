
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Highlighter, 
  MessageSquare, 
  Copy, 
  Share,
  StickyNote,
  Languages,
  Share2,
  Link2,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

const highlightColors = {
  yellow: "bg-yellow-100 border-yellow-300 dark:bg-yellow-900 dark:border-yellow-700",
  blue: "bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700",
  green: "bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700",
  pink: "bg-pink-100 border-pink-300 dark:bg-pink-900 dark:border-pink-700",
  purple: "bg-purple-100 border-purple-300 dark:bg-purple-900 dark:border-purple-700"
};

export default function VerseCard({ 
  verse, 
  highlight, 
  notes, 
  onHighlight, 
  onNote, 
  onCopy, 
  onShare,
  onTranslate,
  onShareToCommunity,
  onCrossReference,
  onDiscoverRelated,
  showTranslate = false
}) {
  const hasNotes = notes && notes.length > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
        highlight 
          ? highlightColors[highlight.color] || highlightColors.yellow
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {verse.verse}
            </Badge>
            {hasNotes && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <StickyNote className="w-3 h-3" />
                {notes.length}
              </Badge>
            )}
          </div>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
            {verse.text}
          </p>
          {hasNotes && (
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded border-l-4 border-blue-500">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {notes[0].content.length > 100 
                  ? `${notes[0].content.substring(0, 100)}...` 
                  : notes[0].content}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-yellow-100 dark:hover:bg-yellow-900"
            onClick={() => onHighlight(verse, 'yellow')}
            aria-label="Highlight verse"
          >
            <Highlighter className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-blue-100 dark:hover:bg-blue-900"
            onClick={() => onNote(verse)}
            aria-label="Add note"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          {onCrossReference && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-indigo-100 dark:hover:bg-indigo-900"
              onClick={() => onCrossReference(verse)}
              aria-label="Cross-references"
              title="AI Cross-References"
            >
              <Link2 className="w-4 h-4" />
            </Button>
          )}
          {onDiscoverRelated && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-pink-100 dark:hover:bg-pink-900"
              onClick={() => onDiscoverRelated(verse)}
              aria-label="Discover related content"
              title="Find Related Sermons & Verses"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}
          {showTranslate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-purple-100 dark:hover:bg-purple-900"
              onClick={() => onTranslate(verse)}
              aria-label="Translate verse"
            >
              <Languages className="w-4 h-4" />
            </Button>
          )}
          {onShareToCommunity && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-green-100 dark:hover:bg-green-900"
              onClick={() => onShareToCommunity(verse)}
              aria-label="Share to community"
              title="Share to community"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCopy(verse)}
            aria-label="Copy verse"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onShare(verse)}
            aria-label="Share verse"
          >
            <Share className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
