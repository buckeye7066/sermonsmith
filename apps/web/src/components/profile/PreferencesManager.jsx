import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Save, 
  BookOpen, 
  FileText, 
  Sparkles,
  CheckCircle2,
  Loader2,
  Users,
  Baby,
  GraduationCap,
  User as UserIcon,
  Heart
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const POPULAR_TOPICS = [
  "Prayer", "Faith", "Grace", "Love", "Forgiveness", "Hope",
  "Anxiety", "Relationships", "Purpose", "Identity", "Worship",
  "Scripture", "Holy Spirit", "Church", "Service", "Evangelism",
  "Marriage", "Parenting", "Leadership", "Discipleship", "Missions"
];

const SERMON_TONES = [
  { value: "teaching", label: "Teaching", icon: "📖", description: "Deep, expository" },
  { value: "inspirational", label: "Inspirational", icon: "✨", description: "Uplifting, encouraging" },
  { value: "evangelistic", label: "Evangelistic", icon: "🌍", description: "Gospel-centered" },
  { value: "pastoral", label: "Pastoral", icon: "❤️", description: "Caring, compassionate" }
];

const AUDIENCES = [
  { value: "general", label: "General Congregation", icon: Users },
  { value: "youth", label: "Youth (13-18)", icon: GraduationCap },
  { value: "children", label: "Children (6-12)", icon: Baby },
  { value: "young_adults", label: "Young Adults (18-30)", icon: UserIcon },
  { value: "seniors", label: "Seniors (60+)", icon: Heart }
];

const THEMES = [
  { id: 'light', name: 'Light', bg: 'bg-white', text: 'text-gray-900' },
  { id: 'dark', name: 'Dark', bg: 'bg-gray-900', text: 'text-gray-100' },
  { id: 'sepia', name: 'Sepia', bg: 'bg-amber-50', text: 'text-amber-900' },
  { id: 'cream', name: 'Cream', bg: 'bg-yellow-50', text: 'text-gray-900' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-50', text: 'text-blue-900' }
];

export default function PreferencesManager({ user, onUpdate }) {
  const [preferences, setPreferences] = useState({
    reading: user?.reading_preferences || {
      fontSize: 18,
      lineHeight: 1.8,
      theme: 'light',
      defaultTranslation: 'KJV'
    },
    study: user?.study_preferences || {
      preferredStudyType: 'personal',
      preferredSermonTone: 'teaching',
      preferredAudience: 'general',
      studyDuration: 'medium'
    },
    content: user?.content_preferences || {
      favoriteTopics: [],
      avoidTopics: [],
      preferredTestaments: ['both']
    }
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleTopicToggle = (topic) => {
    setPreferences(prev => ({
      ...prev,
      content: {
        ...prev.content,
        favoriteTopics: prev.content.favoriteTopics.includes(topic)
          ? prev.content.favoriteTopics.filter(t => t !== topic)
          : [...prev.content.favoriteTopics, topic]
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await base44.auth.updateMe({
        reading_preferences: preferences.reading,
        study_preferences: preferences.study,
        content_preferences: preferences.content
      });

      toast.success("Preferences saved! 🎉");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Reading Preferences
          </CardTitle>
          <CardDescription>Customize your Bible reading experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block">Default Translation</Label>
            <Input
              value={preferences.reading.defaultTranslation}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                reading: { ...prev.reading, defaultTranslation: e.target.value }
              }))}
              placeholder="e.g., KJV, ESV, NIV"
            />
          </div>

          <div>
            <Label className="mb-3 block">Font Size: {preferences.reading.fontSize}px</Label>
            <Slider
              value={[preferences.reading.fontSize]}
              onValueChange={(values) => setPreferences(prev => ({
                ...prev,
                reading: { ...prev.reading, fontSize: values[0] }
              }))}
              min={14}
              max={28}
              step={1}
            />
          </div>

          <div>
            <Label className="mb-3 block">Line Height: {preferences.reading.lineHeight}</Label>
            <Slider
              value={[preferences.reading.lineHeight]}
              onValueChange={(values) => setPreferences(prev => ({
                ...prev,
                reading: { ...prev.reading, lineHeight: values[0] }
              }))}
              min={1.2}
              max={2.5}
              step={0.1}
            />
          </div>

          <div>
            <Label className="mb-3 block">Reading Theme</Label>
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((theme) => (
                <Button
                  key={theme.id}
                  variant={preferences.reading.theme === theme.id ? 'default' : 'outline'}
                  className={`h-16 ${theme.bg} ${theme.text} border-2`}
                  onClick={() => setPreferences(prev => ({
                    ...prev,
                    reading: { ...prev.reading, theme: theme.id }
                  }))}
                >
                  {theme.name}
                </Button>
              ))}
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 ${THEMES.find(t => t.id === preferences.reading.theme)?.bg} ${THEMES.find(t => t.id === preferences.reading.theme)?.text}`}>
            <p style={{ fontSize: `${preferences.reading.fontSize}px`, lineHeight: preferences.reading.lineHeight }}>
              "For God so loved the world that He gave His only begotten Son..." - John 3:16
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Study & Sermon Preferences
          </CardTitle>
          <CardDescription>Set your defaults for AI-generated content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">Preferred Sermon Tone</Label>
            <div className="grid grid-cols-2 gap-3">
              {SERMON_TONES.map((tone) => (
                <Button
                  key={tone.value}
                  variant={preferences.study.preferredSermonTone === tone.value ? 'default' : 'outline'}
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => setPreferences(prev => ({
                    ...prev,
                    study: { ...prev.study, preferredSermonTone: tone.value }
                  }))}
                >
                  <span className="text-2xl">{tone.icon}</span>
                  <div>
                    <div className="font-semibold">{tone.label}</div>
                    <div className="text-xs opacity-80">{tone.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Primary Ministry Audience</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AUDIENCES.map((audience) => {
                const Icon = audience.icon;
                return (
                  <Button
                    key={audience.value}
                    variant={preferences.study.preferredAudience === audience.value ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setPreferences(prev => ({
                      ...prev,
                      study: { ...prev.study, preferredAudience: audience.value }
                    }))}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {audience.label.split(' ')[0]}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-600" />
            Content Preferences
          </CardTitle>
          <CardDescription>Personalize your content recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">Favorite Topics ({preferences.content.favoriteTopics.length} selected)</Label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TOPICS.map((topic) => (
                <Badge
                  key={topic}
                  variant={preferences.content.favoriteTopics.includes(topic) ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1.5"
                  onClick={() => handleTopicToggle(topic)}
                >
                  {preferences.content.favoriteTopics.includes(topic) && (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  {topic}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              We'll prioritize these topics in recommendations
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full">
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            Save All Preferences
          </>
        )}
      </Button>
    </div>
  );
}