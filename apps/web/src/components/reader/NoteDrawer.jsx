import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function NoteDrawer({ open, onClose, onSave, verse, existingNotes }) {
  const [noteContent, setNoteContent] = useState("");

  const handleSave = () => {
    if (!noteContent.trim()) {
      toast.error("Please write a note first");
      return;
    }
    onSave(noteContent);
    setNoteContent("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            {verse && (
              <Badge variant="outline">
                {verse.book_name} {verse.chapter}:{verse.verse}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {verse && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                "{verse.text}"
              </p>
            </div>
          )}
          
          {existingNotes && existingNotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Existing notes:
              </p>
              {existingNotes.map((note, index) => (
                <div key={index} className="p-2 bg-blue-50 dark:bg-blue-900 rounded border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Add new note:
            </p>
            <Textarea
              placeholder="Your thoughts on this verse..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}