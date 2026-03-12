
import React, { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar, Users, Sparkles, Save, Baby, User, GraduationCap, Heart, Share2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import SharePlanDialog from "../plans/SharePlanDialog";

const AGE_GROUPS = [
  { 
    value: 'children', 
    label: 'Children (6-12)', 
    icon: Baby,
    description: 'Interactive games, crafts, simple stories'
  },
  { 
    value: 'youth', 
    label: 'Youth (13-18)', 
    icon: GraduationCap,
    description: 'Discussions, challenges, real-life applications'
  },
  { 
    value: 'adults', 
    label: 'Adults (18+)', 
    icon: User,
    description: 'Deep study, reflection, practical application'
  },
  { 
    value: 'seniors', 
    label: 'Seniors (60+)', 
    icon: Heart,
    description: 'Legacy, wisdom, encouragement'
  }
];

const PLAN_DURATIONS = [
  { value: 7, label: '1 Week' },
  { value: 14, label: '2 Weeks' },
  { value: 21, label: '3 Weeks' },
  { value: 30, label: '1 Month' },
  { value: 60, label: '2 Months' },
  { value: 90, label: '3 Months' }
];

export default function StudyPlanGenerator({ open, onClose, user }) {
  const [topic, setTopic] = useState("");
  const [ageGroup, setAgeGroup] = useState("adults");
  const [duration, setDuration] = useState(7);
  const [customNotes, setCustomNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const generatePlan = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a study topic");
      return;
    }

    setIsGenerating(true);

    try {
      const ageGroupInfo = AGE_GROUPS.find(g => g.value === ageGroup);
      
      const prompt = `Larry, create an interactive ${duration}-day Bible study plan on "${topic}" for ${ageGroupInfo.label}.

Age Group: ${ageGroupInfo.label}
Focus: ${ageGroupInfo.description}
Duration: ${duration} days
Custom Notes: ${customNotes || 'Standard approach'}
Denomination: ${user?.denomination || 'Non-Denominational'}

For EACH DAY create:

1. DAY TITLE: Engaging, progressive title showing journey
2. SCRIPTURE READING: 1-3 passages (appropriate length for age)
3. KEY VERSE: One memorable verse to focus on
4. DEVOTIONAL CONTEXT: 
   - What's happening in this passage? (age-appropriate explanation)
   - Why does it matter?
   - Connection to "${topic}" theme

5. AGE-SPECIFIC ACTIVITIES:
${ageGroup === 'children' ? `
   - Craft/Art Project: Hands-on activity reinforcing the lesson
   - Game/Movement: Active learning exercise
   - Memory Challenge: Fun way to remember key verse
   - Story Time: Simple retelling or modern parallel
` : ageGroup === 'youth' ? `
   - Discussion Starter: Provocative question for group
   - Challenge: Practical action for the day
   - Social Media Prompt: Shareable reflection
   - Real Talk: Address doubts/hard questions
` : ageGroup === 'seniors' ? `
   - Reflection Exercise: Deep personal contemplation
   - Legacy Application: How to pass this truth on
   - Prayer Focus: Specific intercession
   - Testimony Prompt: Share your experience with this truth
` : `
   - Reflection Questions: 3-4 deep questions
   - Practical Application: Specific action steps
   - Prayer Focus: How to pray about this
   - Journal Prompt: Writing exercise
`}

6. FAMILY/GROUP DISCUSSION QUESTIONS: 2-3 questions for sharing

7. PRAYER POINTS: How to pray about today's lesson

Make it engaging, age-appropriate, and progressively building toward deeper understanding of "${topic}".`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            plan_title: { type: "string" },
            plan_overview: { type: "string" },
            daily_lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "number" },
                  title: { type: "string" },
                  scripture_reading: {
                    type: "array",
                    items: { type: "string" }
                  },
                  key_verse: { type: "string" },
                  devotional_context: { type: "string" },
                  activities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  },
                  discussion_questions: {
                    type: "array",
                    items: { type: "string" }
                  },
                  prayer_points: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        }
      });

      setGeneratedPlan({
        ...response,
        topic,
        age_group: ageGroup,
        duration
      });

      toast.success(`Created ${duration}-day study plan! 📚`);
    } catch (error) {
      console.error('Error generating plan:', error);
      toast.error("Failed to generate study plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!user || !generatedPlan) return;

    try {
      await api.entities.ReadingPlan.create({
        creator_id: user.id,
        creator_name: user.full_name || user.email,
        name: generatedPlan.plan_title,
        description: generatedPlan.plan_overview,
        duration_days: duration,
        daily_readings: generatedPlan.daily_lessons.map(lesson => ({
          day: lesson.day,
          passages: lesson.scripture_reading,
          reflection: lesson.devotional_context
        })),
        category: 'topical',
        is_public: false
      });

      toast.success("Study plan saved! 🎉");
      onClose();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error("Failed to save plan");
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const selectedAgeGroup = AGE_GROUPS.find(g => g.value === ageGroup);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Interactive Study Plan Generator
          </DialogTitle>
          <DialogDescription>
            Create age-specific Bible study plans with activities and discussion questions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!generatedPlan ? (
            <div className="space-y-6">
              {/* Age Group Selector */}
              <div>
                <label className="text-sm font-medium mb-3 block">Select Age Group</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {AGE_GROUPS.map((group) => {
                    const Icon = group.icon;
                    return (
                      <Button
                        key={group.value}
                        variant={ageGroup === group.value ? 'default' : 'outline'}
                        className="h-auto py-4 flex flex-col gap-2"
                        onClick={() => setAgeGroup(group.value)}
                      >
                        <Icon className="w-6 h-6" />
                        <div className="text-center">
                          <div className="font-semibold text-sm">{group.label}</div>
                          <div className="text-xs opacity-80">{group.description}</div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <selectedAgeGroup.icon className="w-8 h-8 text-indigo-600" />
                    <div>
                      <h3 className="font-semibold mb-2">{selectedAgeGroup.label} Features</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedAgeGroup.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Study Topic</label>
                  <Input
                    placeholder="e.g., Love, Prayer, Identity in Christ..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Duration</label>
                  <Select value={duration.toString()} onValueChange={(val) => setDuration(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value.toString()}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Custom Notes (Optional)</label>
                <Textarea
                  placeholder="Any specific focus or special considerations?"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={generatePlan}
                disabled={isGenerating || !topic.trim()}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    AI is creating your {duration}-day plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Study Plan
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Plan Header */}
              <Card className="border-l-4 border-indigo-600">
                <CardHeader>
                  <CardTitle className="text-2xl">{generatedPlan.plan_title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge>{duration} Days</Badge>
                    <Badge variant="outline">{selectedAgeGroup.label}</Badge>
                    <Badge variant="outline">{topic}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300">{generatedPlan.plan_overview}</p>
                </CardContent>
              </Card>

              {/* Daily Lessons */}
              <div className="space-y-4">
                {generatedPlan.daily_lessons.map((lesson, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-indigo-600">Day {lesson.day}</Badge>
                        <CardTitle className="text-lg">{lesson.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Scripture Reading */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">📖 Scripture Reading</h4>
                        <div className="flex flex-wrap gap-2">
                          {lesson.scripture_reading.map((passage, pIndex) => (
                            <Badge key={pIndex} variant="outline">{passage}</Badge>
                          ))}
                        </div>
                      </div>

                      {/* Key Verse */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                        <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1">
                          ⭐ Key Verse
                        </h4>
                        <p className="text-blue-800 dark:text-blue-200">{lesson.key_verse}</p>
                      </div>

                      {/* Devotional Context */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">💡 Devotional Context</h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                          {lesson.devotional_context}
                        </p>
                      </div>

                      {/* Activities */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">🎯 Activities</h4>
                        <div className="space-y-2">
                          {lesson.activities.map((activity, aIndex) => (
                            <div key={aIndex} className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border-l-2 border-yellow-500">
                              <div className="font-semibold text-xs text-yellow-900 dark:text-yellow-100 mb-1">
                                {activity.type}
                              </div>
                              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                {activity.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Discussion Questions */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">💬 Discussion Questions</h4>
                        <ul className="space-y-1">
                          {lesson.discussion_questions.map((q, qIndex) => (
                            <li key={qIndex} className="text-sm text-gray-700 dark:text-gray-300">
                              {qIndex + 1}. {q}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prayer Points */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">🙏 Prayer Focus</h4>
                        <ul className="space-y-1">
                          {lesson.prayer_points.map((prayer, prIndex) => (
                            <li key={prIndex} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                              <span className="text-green-600">•</span>
                              {prayer}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={handleSavePlan} className="flex-1" size="lg">
                  <Save className="w-5 h-5 mr-2" />
                  Save to My Plans
                </Button>
                <Button 
                  onClick={handleShare} 
                  variant="outline" 
                  className="flex-1" 
                  size="lg"
                  disabled={!generatedPlan}
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share to Community
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setGeneratedPlan(null)}
                  size="lg"
                >
                  Create New Plan
                </Button>
              </div>
            </div>
          )}
        </div>

        <SharePlanDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          plan={generatedPlan}
          user={user}
        />
      </DialogContent>
    </Dialog>
  );
}
