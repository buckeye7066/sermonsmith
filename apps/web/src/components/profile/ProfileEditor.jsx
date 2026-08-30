import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {  Plus, X, Save, Shield, BookOpen, Heart } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

const PREACHING_STYLES = [
  { value: "expository", label: "Expository (verse-by-verse)" },
  { value: "topical", label: "Topical (theme-based)" },
  { value: "narrative", label: "Narrative (story-driven)" },
  { value: "textual", label: "Textual (single passage)" },
  { value: "verse_by_verse", label: "Verse-by-Verse" }
];

const MINISTRY_FOCUS_OPTIONS = [
  "Missions", "Discipleship", "Worship", "Youth Ministry", "Children's Ministry",
  "Evangelism", "Counseling", "Teaching", "Community Outreach", "Small Groups",
  "Prayer", "Leadership Development", "Seniors Ministry", "Marriage & Family"
];

export default function ProfileEditor({ user, onUpdate }) {
  const [preachingStyle, setPreachingStyle] = useState(user && user.preferred_preaching_style || "");
  const [ministryFocus, setMinistryFocus] = useState(user && user.ministry_focus || []);
  const [denominationalBackground, setDenominationalBackground] = useState(user && user.denominational_background || "");
  const [favoritePassages, setFavoritePassages] = useState(user && user.favorite_scripture_passages || []);
  const [newPassage, setNewPassage] = useState("");
  const [privacy, setPrivacy] = useState(user && user.profile_privacy || {
    show_denomination: true,
    show_ministry_focus: true,
    show_preaching_style: true,
    show_favorite_passages: false,
    show_email: false,
    allow_direct_messages: true
  });
  const [isSaving, setIsSaving] = useState(false);

  const addMinistryFocus = (focus) => {
    if (!ministryFocus.includes(focus)) {
      setMinistryFocus([...ministryFocus, focus]);
    }
  };

  const removeMinistryFocus = (focus) => {
    setMinistryFocus(ministryFocus.filter(f => f !== focus));
  };

  const addPassage = () => {
    if (newPassage.trim() && !favoritePassages.includes(newPassage.trim())) {
      setFavoritePassages([...favoritePassages, newPassage.trim()]);
      setNewPassage("");
    }
  };

  const removePassage = (passage) => {
    setFavoritePassages(favoritePassages.filter(p => p !== passage));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.auth.updateMe({
        preferred_preaching_style: preachingStyle,
        ministry_focus: ministryFocus,
        denominational_background: denominationalBackground,
        favorite_scripture_passages: favoritePassages,
        profile_privacy: privacy
      });
      toast.success("Profile updated successfully!");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(`Failed to update profile: ${error.message || error}`);
    } finally {
      if (isSaving) setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preaching Style */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Preaching & Ministry Profile
          </CardTitle>
          <CardDescription>
            Help us understand your ministry approach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Preferred Preaching Style</label>
            <Select value={preachingStyle} onValueChange={setPreachingStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Select your preaching style..." />
              </SelectTrigger>
              <SelectContent>
                {PREACHING_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Ministry Focus Areas</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {MINISTRY_FOCUS_OPTIONS.filter(f => !ministryFocus.includes(f)).map((focus) => (
                <Badge
                  key={focus}
                  variant="outline"
                  className="cursor-pointer hover:bg-indigo-50"
                  onClick={() => addMinistryFocus(focus)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {focus}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ministryFocus.map((focus) => (
                <Badge key={focus} className="bg-indigo-600">
                  {focus}
                  <X
                    className="w-3 h-3 ml-2 cursor-pointer"
                    onClick={() => removeMinistryFocus(focus)}
                  />
                </Badge>
              ))}
            </div>
            {ministryFocus.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Select the areas of ministry you're passionate about
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Denominational Background</label>
            <Textarea
              placeholder="Describe your denominational history, theological training, and traditions..."
              value={denominationalBackground}
              onChange={(e) => setDenominationalBackground(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-gray-500 mt-1">
              This helps us provide relevant theological context in AI-generated content
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Favorite Passages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-600" />
            Favorite Scripture Passages
          </CardTitle>
          <CardDescription>
            Passages that inspire and guide your ministry
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., John 3:16, Romans 8:28-39..."
              value={newPassage}
              onChange={(e) => setNewPassage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPassage();
                }
              }}
            />
            <Button onClick={addPassage} disabled={!newPassage.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {favoritePassages.map((passage, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-red-600" />
                  {passage}
                </span>
                <X
                  className="w-4 h-4 cursor-pointer text-red-600 hover:text-red-800"
                  onClick={() => removePassage(passage)}
                />
              </div>
            ))}
          </div>
          {favoritePassages.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No favorite passages yet. Add scriptures that are meaningful to you!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card className="border-2 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Privacy Settings
          </CardTitle>
          <CardDescription>
            Control what information is visible to the community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm">
              Your name and basic profile are always visible. These settings control additional information.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">Show Denomination</p>
                <p className="text-sm text-gray-500">Display your denominational affiliation</p>
              </div>
              <Switch
                checked={privacy.show_denomination}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, show_denomination: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">Show Ministry Focus</p>
                <p className="text-sm text-gray-500">Display your ministry focus areas</p>
              </div>
              <Switch
                checked={privacy.show_ministry_focus}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, show_ministry_focus: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">Show Preaching Style</p>
                <p className="text-sm text-gray-500">Display your preferred preaching approach</p>
              </div>
              <Switch
                checked={privacy.show_preaching_style}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, show_preaching_style: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">Show Favorite Passages</p>
                <p className="text-sm text-gray-500">Share your favorite scriptures with the community</p>
              </div>
              <Switch
                checked={privacy.show_favorite_passages}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, show_favorite_passages: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">Show Email Address</p>
                <p className="text-sm text-gray-500">Make your email visible to other users</p>
              </div>
              <Switch
                checked={privacy.show_email}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, show_email: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">Allow Direct Messages</p>
                <p className="text-sm text-gray-500">Let others contact you through the platform</p>
              </div>
              <Switch
                checked={privacy.allow_direct_messages}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, allow_direct_messages: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Save className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}