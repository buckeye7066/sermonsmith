import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Plus, Tag, Sparkles, Loader2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";

const TAG_COLORS = [
  'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink'
];

const TAG_COLOR_CLASSES = {
  gray: 'bg-gray-100 text-gray-800 border-gray-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300'
};

export default function TagManager({ open, onClose, resourceType, resourceId, userId, currentTags = [], onTagsUpdate }) {
  const [tags, setTags] = useState(currentTags);
  const [newTag, setNewTag] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [existingTags, setExistingTags] = useState([]);

  useEffect(() => {
    if (open) {
      loadExistingTags();
      setTags(currentTags);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, currentTags]);

  const loadExistingTags = async () => {
    try {
      const userTags = await api.entities.ResourceTag.filter({
        user_id: userId,
        resource_type: resourceType
      });
      
      // Get unique tags
      const uniqueTags = [...new Set(userTags.map(t => t.tag))];
      setExistingTags(uniqueTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const generateAISuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      // Get resource content for AI analysis. NOTE: fetch by id with .get() —
      // `.filter({ id })` matches against the JSON `data` blob, which does NOT
      // contain `id` (it's the row's own column), so it always returned [] and
      // the whole suggestion flow silently no-op'd.
      let content = "";

      if (resourceType === 'sermon') {
        const sermon = await api.entities.Sermon.get(resourceId).catch(() => null);
        if (sermon) {
          content = [sermon.title, sermon.topic, sermon.big_idea].filter(Boolean).join(' ').trim();
        }
      } else if (resourceType === 'study') {
        const study = await api.entities.BibleStudy.get(resourceId).catch(() => null);
        if (study) {
          content = [study.title, study.topic, study.overview].filter(Boolean).join(' ').trim();
        }
      }

      if (!content) {
        toast.error("Couldn't load this item's content to suggest tags. Try saving it first.");
        return;
      }

      {
        const prompt = `Analyze this ${resourceType} content and suggest 5-8 relevant tags or categories that would help organize and find this content later. Focus on topics, themes, biblical books, and practical applications.

Content: ${content}

Return ONLY a JSON array of tag suggestions (strings), nothing else. Example: ["Faith", "Gospel of John", "Salvation", "Evangelism"]`;

        const response = await api.integrations.Core.InvokeLLM({
          system_prompt: LARRY_SYSTEM_PROMPT,
          prompt,
          feature: 'library',
          response_json_schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        if (response.tags) {
          setSuggestions(response.tags.filter(tag => !tags.some(t => t.tag === tag)));
        }
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error("Failed to generate tag suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const addTag = async (tagName, color = selectedColor, aiSuggested = false) => {
    if (!tagName.trim()) return;
    
    const normalizedTag = tagName.trim().toLowerCase();
    
    // Check if tag already exists
    if (tags.some(t => t.tag.toLowerCase() === normalizedTag)) {
      toast.error("Tag already added");
      return;
    }

    try {
      const newTagObj = await api.entities.ResourceTag.create({
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
        tag: tagName.trim(),
        color,
        ai_suggested: aiSuggested
      });

      setTags([...tags, newTagObj]);
      setNewTag("");
      
      // Remove from suggestions if it was suggested
      setSuggestions(suggestions.filter(s => s.toLowerCase() !== normalizedTag));
      
      toast.success("Tag added");
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error("Failed to add tag");
    }
  };

  const removeTag = async (tagId) => {
    try {
      await api.entities.ResourceTag.delete(tagId);
      setTags(tags.filter(t => t.id !== tagId));
      toast.success("Tag removed");
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error("Failed to remove tag");
    }
  };

  const handleClose = () => {
    if (onTagsUpdate) {
      onTagsUpdate(tags);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-500" />
            Manage Tags
          </DialogTitle>
          <DialogDescription>
            Organize your {resourceType} with tags for easy searching and filtering
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Tags */}
          <div>
            <Label className="mb-2 block font-medium">Current Tags</Label>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No tags yet. Add some below!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className={`${TAG_COLOR_CLASSES[tag.color]} flex items-center gap-1 px-3 py-1`}
                  >
                    {tag.ai_suggested && <Sparkles className="w-3 h-3" />}
                    {tag.tag}
                    <button
                      onClick={() => removeTag(tag.id)}
                      className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* AI Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="font-medium">AI Suggestions</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAISuggestions}
                disabled={isLoadingSuggestions}
              >
                {isLoadingSuggestions ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-2" />
                    Get Suggestions
                  </>
                )}
              </Button>
            </div>
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => addTag(suggestion, 'blue', true)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {suggestion}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Click "Get Suggestions" to let AI analyze your content
              </p>
            )}
          </div>

          {/* Add New Tag */}
          <div>
            <Label className="mb-2 block font-medium">Add New Tag</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter tag name..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag(newTag)}
              />
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                {TAG_COLORS.map(color => (
                  <option key={color} value={color}>
                    {color.charAt(0).toUpperCase() + color.slice(1)}
                  </option>
                ))}
              </select>
              <Button onClick={() => addTag(newTag)}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Existing Tags (Quick Add) */}
          {existingTags.length > 0 && (
            <div>
              <Label className="mb-2 block font-medium">Your Other Tags (Quick Add)</Label>
              <div className="flex flex-wrap gap-2">
                {existingTags
                  .filter(tag => !tags.some(t => t.tag.toLowerCase() === tag.toLowerCase()))
                  .slice(0, 10)
                  .map((tag, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => addTag(tag, 'gray', false)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, className = "", ...props }) {
  return (
    <label className={`text-sm font-medium ${className}`} {...props}>
      {children}
    </label>
  );
}