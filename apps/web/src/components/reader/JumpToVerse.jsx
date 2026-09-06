import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigation } from 'lucide-react';
import PassageNavigation from './PassageNavigation';

export default function JumpToVerse({ open, onClose, onJump, ...location }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-500" /> Jump to Verse
          </DialogTitle>
          <DialogDescription>Type a Bible book, chapter, and optional verse.</DialogDescription>
        </DialogHeader>
        <PassageNavigation {...location} submitLabel="Jump" onCancel={onClose}
          onJump={(book, chapter, verse) => {
            if (onJump(book, chapter, verse) === false) return false;
            onClose();
            return true;
          }} />
      </DialogContent>
    </Dialog>
  );
}
