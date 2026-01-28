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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2, Users, Globe, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ShareMenu({ open, onClose, content, contentType, user }) {
  const [visibility, setVisibility] = useState("public");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [studyGroups, setStudyGroups] = useState([]);
  const [title, setTitle] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadStudyGroups();
      generateTitle();
    }
  }, [open, user]);

  const loadStudyGroups = async () => {
    try {
      const memberships = await base44.entities.GroupMembership.filter({ user_id: user.id });
      const groupIds = memberships.map(m => m.group_id);
      
      if (groupIds.length > 0) {
        const groups = await base44.entities.StudyGroup.filter({ id: { $in: groupIds } });
        setStudyGroups(groups);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const generateTitle = () => {
    if (contentType === 'note' && content.verse) {
      setTitle(`Note on ${content.book_name} ${content.chapter}:${content.verse}`);
    } else if (contentType === 'highlight' && content.verse) {
      setTitle(`Highlight from ${content.book_name} ${content.chapter}:${content.verse}`);
    } else {
      setTitle(`Shared ${contentType}`);
    }
  };

  const handleShare = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (visibility === 'group' && !selectedGroup) {
      toast.error("Please select a study group");
      return;
    }

    setIsSharing(true);

    try {
      const sharedContent = {
        user_id: user.id,
        user_name: user.full_name || user.email,
        content_type: contentType,
        title: title.trim(),
        content: content.content || content.text || "",
        scripture_reference: content.verse 
          ? `${content.book_name} ${content.chapter}:${content.verse}`
          : "",
        visibility: visibility,
        group_id: visibility === 'group' ? selectedGroup : null
      };

      await base44.entities.SharedContent.create(sharedContent);
      
      toast.success("Content shared successfully!");
      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error("Failed to share content");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            Share {contentType}
          </DialogTitle>
          <DialogDescription>
            Share your insights with the community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Textarea
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your shared content a title..."
              rows={2}
            />
          </div>

          <div>
            <Label>Who can see this?</Label>
            <RadioGroup value={visibility} onValueChange={setVisibility}>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:border-blue-500 transition-colors cursor-pointer">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public" className="cursor-pointer flex items-center gap-2 flex-1">
                    <Globe className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Public</div>
                      <div className="text-xs text-gray-500">Everyone in the community</div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:border-blue-500 transition-colors cursor-pointer">
                  <RadioGroupItem value="group" id="group" />
                  <Label htmlFor="group" className="cursor-pointer flex items-center gap-2 flex-1">
                    <Users className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Study Group</div>
                      <div className="text-xs text-gray-500">Share with a specific group</div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:border-blue-500 transition-colors cursor-pointer">
                  <RadioGroupItem value="private" id="private" />
                  <Label htmlFor="private" className="cursor-pointer flex items-center gap-2 flex-1">
                    <Lock className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Private</div>
                      <div className="text-xs text-gray-500">Only you can see this</div>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {visibility === 'group' && (
            <div>
              <Label htmlFor="group-select">Select Study Group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger id="group-select">
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent>
                  {studyGroups.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      No study groups joined yet
                    </div>
                  ) : (
                    studyGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 Sharing helps others learn from your insights and sparks meaningful discussions!
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSharing}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={isSharing}>
            {isSharing ? "Sharing..." : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}