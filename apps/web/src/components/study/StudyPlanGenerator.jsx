
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar, Sparkles, Save, Baby, User, GraduationCap, Heart, Share2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { formatUserInputBlock } from '@/lib/aiPrompt';
import SharePlanDialog from "../plans/SharePlanDialog";
import PrintButton from "@/components/common/PrintButton";

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

// Generate the plan in batches of days rather than all at once. A full 60/90-day
// plan is far more than one completion can hold (it truncated mid-JSON and the
// whole plan failed). Batching both fixes that AND streams days into the UI as
// they're produced, so even short plans feel faster. 10 days/batch fits well
// within the token budget.
const BATCH_DAYS = 10;

const DAY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    day: { type: 'number' },
    title: { type: 'string' },
    scripture_reading: { type: 'array', items: { type: 'string' } },
    key_verse: { type: 'string' },
    devotional_context: { type: 'string' },
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: { type: { type: 'string' }, description: { type: 'string' } },
      },
    },
    discussion_questions: { type: 'array', items: { type: 'string' } },
    prayer_points: { type: 'array', items: { type: 'string' } },
  },
};
const FIRST_BATCH_SCHEMA = {
  type: 'object',
  properties: {
    plan_title: { type: 'string' },
    plan_overview: { type: 'string' },
    daily_lessons: { type: 'array', items: DAY_ITEM_SCHEMA },
  },
};
const CONTINUE_BATCH_SCHEMA = {
  type: 'object',
  properties: { daily_lessons: { type: 'array', items: DAY_ITEM_SCHEMA } },
};

export default function StudyPlanGenerator({ open, onClose, user }) {
  const [topic, setTopic] = useState("");
  const [ageGroup, setAgeGroup] = useState("adults");
  const [duration, setDuration] = useState(7);
  const [customNotes, setCustomNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  // Progressive-generation progress: how many days have been produced so far.
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });

  const activitiesGuide = (group) => (
    group === 'children'
      ? 'Craft/Art Project, Game/Movement, Memory Challenge, Story Time'
      : group === 'youth'
        ? 'Discussion Starter, Challenge, Social Media Prompt, Real Talk (doubts/hard questions)'
        : group === 'seniors'
          ? 'Reflection Exercise, Legacy Application, Prayer Focus, Testimony Prompt'
          : 'Reflection Questions, Practical Application, Prayer Focus, Journal Prompt'
  );

  const generatePlan = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a study topic");
      return;
    }

    setIsGenerating(true);
    setGeneratedPlan(null);
    setGenProgress({ done: 0, total: duration });

    const ageGroupInfo = AGE_GROUPS.find(g => g.value === ageGroup);
    const baseContext = `Age Group: ${ageGroupInfo.label}
Focus: ${ageGroupInfo.description}
${formatUserInputBlock('Topic', topic)}
${formatUserInputBlock('Custom Notes', customNotes, 'Standard approach')}
Denomination: ${user?.denomination ?? 'Non-Denominational'}

For EACH DAY include: a progressive day TITLE; 1-3 SCRIPTURE READINGS (age-appropriate length); one KEY VERSE; a DEVOTIONAL CONTEXT (what's happening, why it matters, connection to the study topic); ACTIVITIES (${activitiesGuide(ageGroup)}); 2-3 DISCUSSION QUESTIONS; and PRAYER POINTS. Keep it engaging and age-appropriate.`;

    // Build day-range batches so a 60/90-day plan never has to fit in one
    // completion (it used to truncate and fail entirely).
    const batches = [];
    for (let start = 1; start <= duration; start += BATCH_DAYS) {
      batches.push([start, Math.min(start + BATCH_DAYS - 1, duration)]);
    }

    let planMeta = { plan_title: `${topic} — ${duration}-Day Study`, plan_overview: '' };
    const allLessons = [];
    let failures = 0;

    try {
      for (let i = 0; i < batches.length; i++) {
        const [from, to] = batches[i];
        const isFirst = i === 0;
        const prompt = isFirst
          ? `Larry, create days ${from}-${to} of an interactive ${duration}-day Bible study plan, plus a plan_title and a 2-3 sentence plan_overview.\n\n${baseContext}\n\nNumber the days ${from} through ${to}.`
          : `Larry, continue the ${duration}-day study plan titled "${planMeta.plan_title}" on the fenced study topic below. Produce ONLY days ${from} to ${to}, building progressively on the earlier days.\n\n${baseContext}\n\nNumber the days ${from} through ${to}.`;

        try {
          const resp = await api.integrations.Core.InvokeLLM({
            system_prompt: LARRY_SYSTEM_PROMPT,
            prompt,
            feature: 'study_plan',
            response_json_schema: isFirst ? FIRST_BATCH_SCHEMA : CONTINUE_BATCH_SCHEMA,
            max_tokens: 6000,
          });
          if (isFirst && resp.plan_title) {
            planMeta = { plan_title: resp.plan_title, plan_overview: resp.plan_overview || '' };
          }
          allLessons.push(...(resp.daily_lessons || []));
        } catch (batchErr) {
          console.error(`Plan batch ${from}-${to} failed:`, batchErr);
          failures++;
        }

        // Stream what we have into the UI as each batch lands.
        setGeneratedPlan({
          ...planMeta,
          daily_lessons: [...allLessons],
          topic,
          age_group: ageGroup,
          duration,
        });
        setGenProgress({ done: Math.min(to, duration), total: duration });
      }

      if (allLessons.length === 0) {
        setGeneratedPlan(null);
        toast.error('Failed to generate study plan. Please try again.');
      } else if (failures > 0) {
        toast.warning(`Created ${allLessons.length} of ${duration} days — some sections didn't generate. You can retry or save what's here.`);
      } else {
        toast.success(`Created ${duration}-day study plan! 📚`);
      }
    } catch (error) {
      console.error('Error generating plan:', error.message || error);
      toast.error(allLessons.length === 0 ? 'Failed to generate study plan' : 'Partial generation failure. Please refer to console for details.');
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-print-full-width>
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
            <div className="space-y-6" data-print-section>
              {/* Plan Header */}
              <Card className="border-l-4 border-indigo-600" data-print-break-inside-avoid>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-2xl">{generatedPlan.plan_title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge>{duration} Days</Badge>
                        <Badge variant="outline">{selectedAgeGroup.label}</Badge>
                        <Badge variant="outline">{topic}</Badge>
                      </div>
                    </div>
                    <PrintButton label="Print Plan" className="shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300">{generatedPlan.plan_overview}</p>
                </CardContent>
              </Card>

              {/* Live progress while the plan streams in batch-by-batch */}
              {isGenerating && (
                <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200" data-print-hidden>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                        Building your plan… day {genProgress.done} of {genProgress.total}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-indigo-100 dark:bg-indigo-950 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${genProgress.total ? Math.round((genProgress.done / genProgress.total) * 100) : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Daily Lessons */}
              <div className="space-y-4">
                {generatedPlan.daily_lessons.map((lesson, index) => (
                  <Card key={index} data-print-break-inside-avoid>
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
                          {(lesson.scripture_reading || []).map((passage, pIndex) => (
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
                          {(lesson.activities || []).map((activity, aIndex) => (
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
                          {(lesson.discussion_questions || []).map((q, qIndex) => (
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
                          {(lesson.prayer_points || []).map((prayer, prIndex) => (
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

              {/* Actions — disabled until the whole plan has finished streaming */}
              <div className="flex gap-3" data-print-hidden>
                <Button onClick={handleSavePlan} className="flex-1" size="lg" disabled={isGenerating}>
                  <Save className="w-5 h-5 mr-2" />
                  Save to My Plans
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  disabled={isGenerating || !generatedPlan}
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share to Community
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setGeneratedPlan(null)}
                  size="lg"
                  disabled={isGenerating}
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
