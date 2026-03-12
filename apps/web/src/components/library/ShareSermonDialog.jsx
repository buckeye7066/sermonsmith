import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";

export default function ShareSermonDialog({ open, onClose, user, mySermons }) {
  const [selectedSermonId, setSelectedSermonId] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  const handleShare = async () => {
    if (!selectedSermonId) {
      toast.error("Please select a sermon to share");
      return;
    }

    setIsSharing(true);

    try {
      const sermon = mySermons.find(s => s.id === selectedSermonId);

      // Generate AI tags and categorization
      setIsGeneratingTags(true);
      
      const prompt = `Analyze this sermon and generate comprehensive tags and categorization:

Title: ${sermon.title}
Topic: ${sermon.topic}
Passage: ${sermon.anchor_passage}
Big Idea: ${sermon.big_idea}
Points: ${sermon.points?.map(p => p.title).join(', ')}

Generate:
1. Content tags (8-12 tags): Topics, themes, biblical books, doctrines covered
2. Style tags (2-4 tags): Preaching style (expository, topical, narrative, pastoral, evangelistic, prophetic, teaching)
3. Category: Primary sermon category (Gospel, Discipleship, Theology, Practical Living, Apologetics, Worship, Mission)

Return comprehensive tags for discoverability.`;

      const tagsResponse = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            content_tags: {
              type: "array",
              items: { type: "string" }
            },
            style_tags: {
              type: "array",
              items: { type: "string" }
            },
            category: { type: "string" }
          }
        }
      });

      setIsGeneratingTags(false);

      // Create shared sermon
      await api.entities.SharedSermon.create({
        user_id: user.id,
        user_name: user.full_name || user.email,
        title: sermon.title,
        topic: sermon.topic,
        anchor_passage: sermon.anchor_passage,
        big_idea: sermon.big_idea,
        points: sermon.points,
        denomination: user.denomination,
        ai_tags: tagsResponse.content_tags,
        style_tags: tagsResponse.style_tags,
        average_rating: 0,
        ratings_count: 0,
        forks_count: 0,
        views_count: 0
      });

      toast.success("Sermon shared with the community! 🎉");
      onClose();
    } catch (error) {
      console.error('Error sharing sermon:', error);
      toast.error("Failed to share sermon");
    } finally {
      setIsSharing(false);
      setIsGeneratingTags(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            Share Sermon
          </DialogTitle>
          <DialogDescription>
            Share your sermon with the community. AI will automatically tag and categorize it for discoverability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Sermon</label>
            <Select value={selectedSermonId} onValueChange={setSelectedSermonId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a sermon to share..." />
              </SelectTrigger>
              <SelectContent>
                {mySermons.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No sermons yet. Create one first!
                  </div>
                ) : (
                  mySermons.map((sermon) => (
                    <SelectItem key={sermon.id} value={sermon.id}>
                      {sermon.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {isGeneratingTags && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                <div>
                  <p className="font-medium text-purple-900 dark:text-purple-100">
                    AI is analyzing your sermon...
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Generating tags and categorization for discoverability
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 Your sermon will be tagged with AI to help others discover it. 
              You'll earn reputation when others fork or rate your content!
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSharing}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={isSharing || !selectedSermonId}>
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Share to Community
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}