import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Tag, FileText } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function SermonTagsNotesDialog({ open, onClose, sermon, onSave }) {
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (sermon) {
      setTags(sermon.user_tags || []);
      setNotes(sermon.user_notes || "");
    }
  }, [sermon]);

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    try {
      await api.entities.Sermon.update(sermon.id, {
        user_tags: tags,
        user_notes: notes
      });
      
      toast.success("Tags and notes saved!");
      onSave?.();
      onClose();
    } catch (error) {
      console.error("Error saving tags/notes:", error);
      toast.error("Failed to save");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Edit Tags & Notes
          </DialogTitle>
          <DialogDescription>
            Add personal tags and notes to {sermon?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tags Section */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Your Tags
            </label>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button onClick={addTag} disabled={!newTag.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {tag}
                  <X
                    className="w-3 h-3 ml-2 cursor-pointer"
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            {tags.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                No tags yet. Add tags to organize your sermons.
              </p>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Your Notes
            </label>
            <Textarea
              placeholder="Add personal notes about this sermon..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-gray-500 mt-1">
              These notes are private and only visible to you
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}