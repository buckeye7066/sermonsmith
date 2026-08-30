
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Layers,
  Loader2,
  BookOpen,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  Copy,
  Check,
  Save,
  Lightbulb,
  Target
} from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { ARLYNN_SYSTEM_PROMPT } from '@/ai/personas';
import { canonForDenomination, denominationPromptBlock } from '@/lib/denominations';
import { asArray, normalizeOutline, normalizeSermon, normalizeSeriesOutline } from '@/lib/aiStructured';
import { validateAiSermon } from '@/lib/scriptureRefs';
import { getAiErrorMessage } from '@/lib/aiErrors';
import { formatUserInputBlock } from '@/lib/aiPrompt';

const SERIES_LENGTHS = [
  { value: 3, label: "3-Part Series" },
  { value: 4, label: "4-Part Series" },
  { value: 6, label: "6-Part Series" },
  { value: 8, label: "8-Part Series" },
  { value: 12, label: "12-Part Series" }
];

const TEACHING_CONTEXTS = [
  { value: "sunday_service", label: "Sunday Service", desc: "Standard worship service" },
  { value: "sunday_school", label: "Sunday School", desc: "Age-graded teaching" },
  { value: "vbs", label: "VBS (Vacation Bible School)", desc: "5-day themed experience" },
  { value: "youth_group", label: "Youth Group", desc: "Teen-focused ministry" },
  { value: "small_group", label: "Small Group / Cell Group", desc: "Intimate discussion-based" },
  { value: "christian_school", label: "Christian School / Chapel", desc: "Academic chapel service" },
  { value: "midweek", label: "Midweek Bible Study", desc: "Deep-dive teaching" },
  { value: "retreat", label: "Retreat / Conference", desc: "Multi-session intensive" },
  { value: "mens_group", label: "Men's Ministry", desc: "Men-specific content" },
  { value: "womens_group", label: "Women's Ministry", desc: "Women-specific content" },
];

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "Psalms", "Proverbs", "Ecclesiastes",
  "Isaiah", "Jeremiah", "Ezekiel", "Daniel",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
  "Ephesians", "Philippians", "Colossians",
  "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "Revelation"
];

export default function SeriesBuilder({ open, onClose, user }) {
  const [mode, setMode] = useState('outline'); // 'outline' or 'series'
  const [step, setStep] = useState(1); // 1=input, 2=outline, 3=individual sermons (for series mode)

  // Outline mode state
  const [outlineTopic, setOutlineTopic] = useState("");
  const [outlinePassage, setOutlinePassage] = useState("");
  const [outlineTheme, setOutlineTheme] = useState("");
  const [outlineContext, setOutlineContext] = useState("sunday_service");
  const [generatedOutline, setGeneratedOutline] = useState(null);

  // Series mode state (existing)
  const [seriesType, setSeriesType] = useState("theme");
  const [themeInput, setThemeInput] = useState("");
  const [bookInput, setBookInput] = useState("");
  const [seriesLength, setSeriesLength] = useState(4);
  const [seriesContext, setSeriesContext] = useState("sunday_service");
  const [seriesOutline, setSeriesOutline] = useState(null);
  const [currentSermonIndex, setCurrentSermonIndex] = useState(0);
  const [generatedSermons, setGeneratedSermons] = useState([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateSermonOutline = async () => {
    if (!outlineTopic.trim() && !outlinePassage.trim() && !outlineTheme.trim()) {
      toast.error("Please provide at least a topic, passage, or theme");
      return;
    }

    setIsGenerating(true);

    try {
      const contextInfo = TEACHING_CONTEXTS.find(c => c.value === outlineContext) || TEACHING_CONTEXTS[0];
      const prompt = `Hi, I'm Arlynn - your AI sermon outline specialist! I create comprehensive, preaching-ready sermon outlines.

Request:
${formatUserInputBlock('Topic', outlineTopic)}
${formatUserInputBlock('Scripture', outlinePassage, 'Choose best passage')}
${formatUserInputBlock('Theme', outlineTheme)}

${denominationPromptBlock(user?.denomination)}

Teaching Context: ${contextInfo?.label || 'Sunday Service'} (${contextInfo?.desc || ''})

Create a complete sermon outline with:

1. TITLE:
   - Compelling sermon title

2. BIG IDEA:
   - One memorable sentence that captures the entire message
   - Clear, compelling, repeatable
   - Connects scripture to life application

3. MAIN POINTS (3-4 points):
   For each point provide:
   - Engaging title (action-oriented, clear)
   - 2-3 sentence explanation of what this point covers
   - Why this point matters (theological significance)

4. SUPPORTING SCRIPTURES:
   For each point, provide 4-6 scripture references that:
   - Reinforce the main point
   - Come from different books when possible
   - Include both Old and New Testament
   - Are easy to understand and remember

5. KEY TAKEAWAYS & APPLICATIONS:
   For each point, provide 3-4 specific applications:
   - What this looks like in daily life (name a concrete situation, not a platitude)
   - Practical action steps (each ONE specific thing to do - what, when, and how; never "pray more" or "trust God" without saying what that looks like here)
   - How to implement this week
   - Questions for personal reflection
   Vary the applications across points so they never repeat.

6. ILLUSTRATION SUGGESTIONS:
   For each point, suggest 2-3 illustration ideas:
   - Real-life scenarios
   - Historical examples
   - Modern-day parallels
   - Object lessons or metaphors
   - What would make this point memorable

7. COMPELLING CONCLUSION:
   - Recap of big idea
   - Call to action
   - Final illustration or story idea
   - Invitation to respond
   - Next steps for congregation

Make this biblically accurate, aligned with the stated denominational/theological preference, and ready to preach!`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: ARLYNN_SYSTEM_PROMPT,
        prompt,
        feature: 'sermon_outline',
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            big_idea: { type: "string" },
            main_points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  number: { type: "number" },
                  title: { type: "string" },
                  explanation: { type: "string" },
                  significance: { type: "string" },
                  supporting_scriptures: {
                    type: "array",
                    items: { type: "string" }
                  },
                  applications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        area: { type: "string" },
                        action: { type: "string" },
                        reflection_question: { type: "string" }
                      }
                    }
                  },
                  illustration_suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        idea: { type: "string" }
                      }
                    }
                  }
                }
              }
            },
            conclusion: {
              type: "object",
              properties: {
                recap: { type: "string" },
                call_to_action: { type: "string" },
                final_illustration_idea: { type: "string" },
                invitation: { type: "string" },
                next_steps: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          },
          required: ["title", "big_idea", "main_points", "conclusion"]
        }
      });

      const outline = normalizeOutline(response);
      setGeneratedOutline(outline);
      toast.success("Arlynn created your sermon outline! 📋");
    } catch (error) {
      console.error("Error generating outline:", error);
      toast.error(getAiErrorMessage(error, 'generate the sermon outline'));
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSeriesOutline = async () => {
    setIsGenerating(true);

    try {
      const seriesSource = seriesType === 'theme' ? themeInput : `Book of ${bookInput}`;
      const seriesInput = formatUserInputBlock(
        seriesType === 'theme' ? 'Series theme' : 'Bible book',
        seriesSource
      );
      const contextInfo = TEACHING_CONTEXTS.find(c => c.value === seriesContext);

      const prompt = `Hi, I'm Arlynn - your AI Series Specialist! I create comprehensive, multi-week sermon series that build on each other.

Series Request:
Type: ${seriesType === 'theme' ? 'Thematic Series' : 'Book Study'}
${seriesInput}
Length: ${seriesLength} sermons

${denominationPromptBlock(user?.denomination)}

Teaching Context: ${contextInfo?.label || 'Sunday Service'} (${contextInfo?.desc || ''})

IMPORTANT: Adapt all content, language, illustrations, and applications for a ${contextInfo?.label || 'Sunday Service'} context.

Please create a complete series outline with:

1. SERIES OVERVIEW:
   - Compelling series title (catchy, memorable)
   - Series description (2-3 sentences)
   - Overall goal and vision
   - Target audience considerations

2. THEOLOGICAL TRAJECTORY:
   - How the series progresses theologically
   - Key doctrines to cover
   - How each sermon builds on the previous
   - Culmination point
   - Connection to broader biblical narrative

3. INDIVIDUAL SERMON OUTLINES (${seriesLength} sermons):
   For each sermon provide:
   - Sermon title (engaging, connected to series theme)
   - Main scripture passage(s)
   - Big idea (one sentence summary)
   - Key theological focus
   - How it builds on previous sermons
   - Preview of next sermon

4. SMALL GROUP DISCUSSION QUESTIONS:
   For each sermon, provide 5-6 discussion questions that:
   - Review the sermon content
   - Go deeper into the theology
   - Apply to real life
   - Encourage vulnerability and sharing
   - Build community

5. SERIES PROMOTION:
   - Social media tagline
   - Bulletin description
   - Email announcement text

Make this comprehensive but practical. Ensure each sermon clearly connects to the next!`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: ARLYNN_SYSTEM_PROMPT,
        prompt,
        feature: 'sermon_series',
        response_json_schema: {
          type: "object",
          properties: {
            series_title: { type: "string" },
            series_description: { type: "string" },
            series_goal: { type: "string" },
            target_audience: { type: "string" },
            theological_trajectory: {
              type: "object",
              properties: {
                progression: { type: "string" },
                key_doctrines: {
                  type: "array",
                  items: { type: "string" }
                },
                build_pattern: { type: "string" },
                culmination: { type: "string" },
                biblical_connection: { type: "string" }
              }
            },
            sermons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  week: { type: "number" },
                  title: { type: "string" },
                  scripture: { type: "string" },
                  big_idea: { type: "string" },
                  theological_focus: { type: "string" },
                  builds_on_previous: { type: "string" },
                  preview_next: { type: "string" },
                  discussion_questions: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            promotion: {
              type: "object",
              properties: {
                social_tagline: { type: "string" },
                bulletin_text: { type: "string" },
                email_text: { type: "string" }
              }
            }
          }
        }
      });

      const outline = normalizeSeriesOutline(response, seriesLength);
      setSeriesOutline(outline);
      setStep(2);
      toast.success("Arlynn created your series outline! 🎯");
    } catch (error) {
      console.error("Error generating series:", error);
      toast.error(getAiErrorMessage(error, 'generate the series outline'));
    } finally {
      setIsGenerating(false);
    }
  };

  const generateIndividualSermon = async (sermonIndex) => {
    setIsGenerating(true);
    setCurrentSermonIndex(sermonIndex);

    try {
      const sermonOutline = seriesOutline.sermons[sermonIndex];
      const previousSermons = generatedSermons.slice(0, sermonIndex);

      const prompt = `Arlynn here! I'm creating Week ${sermonOutline.week} of your sermon series.

SERIES CONTEXT:
Series: "${seriesOutline.series_title}"
Overall Goal: ${seriesOutline.series_goal}
Theological Trajectory: ${seriesOutline.theological_trajectory?.progression || 'Progressive revelation'}

THIS SERMON:
Week ${sermonOutline.week}: "${sermonOutline.title}"
Scripture: ${sermonOutline.scripture}
Big Idea: ${sermonOutline.big_idea}
Theological Focus: ${sermonOutline.theological_focus}

${previousSermons.length > 0 ? `
PREVIOUS SERMONS IN SERIES:
${previousSermons.map((s, i) => `
Week ${i + 1}: ${s.title}
Key Point: ${s.big_idea}
`).join('\n')}

BUILD ON THESE: ${sermonOutline.builds_on_previous}
` : 'This is the FIRST sermon - lay strong foundation!'}

${sermonIndex < seriesOutline.sermons.length - 1 ? `
PREVIEW NEXT WEEK: ${sermonOutline.preview_next}
` : 'This is the FINAL sermon - bring powerful conclusion!'}

Create a COMPLETE sermon that:
1. References previous sermons in the series (if any)
2. Advances the theological trajectory
3. Stands alone but connects to the whole
4. Builds anticipation for next week (if not final)
5. Is preached from the denominational viewpoint below:

${denominationPromptBlock(user?.denomination)}

Include:
- Title and Big Idea
- 3-4 main points with full exegesis
- Engaging illustrations (clearly hypothetical unless source material was provided)
- Practical applications (each ONE concrete, specific step a listener could take this week - what, when, and how; varied across points; never generic advice like "pray more" without saying what it looks like)
- Supporting scriptures
- Series connection notes
- Conclusion with next week teaser (if applicable)`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: ARLYNN_SYSTEM_PROMPT,
        prompt,
        feature: 'sermon_series',
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            big_idea: { type: "string" },
            series_connection: { type: "string" },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  exegesis: { type: "string" },
                  illustration: { type: "string" },
                  application: { type: "string" },
                  supporting_scriptures: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            conclusion: { type: "string" },
            next_week_teaser: { type: "string" }
          }
        }
      });

      const normalized = normalizeSermon(response, {
        week: sermonOutline.week,
        scripture: sermonOutline.scripture,
        discussion_questions: sermonOutline.discussion_questions,
      });

      // Replace any prior version of this week (so retrying / generating
      // sermons out of order doesn't leave stale duplicates) and keep the
      // list ordered.
      setGeneratedSermons((prev) => {
        const next = prev.filter((item) => item.week !== normalized.week);
        next.push(normalized);
        return next.sort((a, b) => a.week - b.week);
      });
      toast.success(`Week ${sermonOutline.week} sermon ready! 🎤`);
    } catch (error) {
      console.error("Error generating sermon:", error);
      toast.error(getAiErrorMessage(error, 'generate the sermon'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOutline = async () => {
    if (!user) {
      toast.error("Please log in to save sermon");
      return;
    }
    if (!generatedOutline) {
      toast.error("No outline generated to save.");
      return;
    }

    try {
      const outline = normalizeOutline(generatedOutline);

      const points = asArray(outline.main_points).map((point) => ({
        title: point.title,
        exegesis: `${point.explanation}\n\n${point.significance}`,
        illustration: asArray(point.illustration_suggestions)
          .map((ill) => `${ill.type}: ${ill.idea}`)
          .join('\n\n'),
        application: asArray(point.applications)
          .map((app) => `${app.area}: ${app.action} \nReflection: ${app.reflection_question}`)
          .join('\n\n'),
        supporting_scriptures: asArray(point.supporting_scriptures),
      }));

      // Run the same Scripture validation Larry's path uses so an outline
      // with hallucinated book names is saved as needs_review rather than
      // silently shipping to the user's library as draft.
      const validation = validateAiSermon({
        anchor_passage: outlinePassage,
        points,
        conclusion: outline.conclusion ? [
          outline.conclusion.recap,
          outline.conclusion.call_to_action,
          outline.conclusion.invitation,
        ].filter(Boolean).join('\n\n') : '',
      }, { canon: canonForDenomination(user?.denomination) });

      await api.entities.Sermon.create({
        user_id: user.id,
        title: outline.title,
        topic: outlineTopic || outlineTheme || outlinePassage,
        anchor_passage: outlinePassage,
        big_idea: outline.big_idea,
        points,
        scripture_validation: validation.refs,
        status: validation.allValid ? 'draft' : 'needs_review',
      });

      toast.success("Sermon outline saved! 🎉");
      onClose();
    } catch (error) {
      console.error("Error saving outline:", error);
      toast.error("Failed to save outline");
    }
  };

  const handleSaveAllSermons = async () => {
    if (!user) {
      toast.error("Please log in to save sermons");
      return;
    }

    try {
      const items = generatedSermons.map((sermon) => {
        const normalized = normalizeSermon(sermon);
        const validation = validateAiSermon(normalized, { canon: canonForDenomination(user?.denomination) });

        return {
          title: `${seriesOutline.series_title} - Week ${normalized.week}: ${normalized.title}`,
          topic: seriesOutline.series_title,
          anchor_passage: normalized.scripture,
          big_idea: normalized.big_idea,
          points: normalized.points,
          conclusion: normalized.conclusion,
          discussion_questions: normalized.discussion_questions,
          scripture_validation: validation.refs,
          status: validation.allValid ? 'draft' : 'needs_review',
        };
      });

      await api.entities.Sermon.bulkCreate(items);

      toast.success(`Saved all ${items.length} sermons! 🎉`);
      onClose();
    } catch (error) {
      console.error("Error saving sermons:", error);
      toast.error("Failed to save sermons");
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Arlynn - AI Sermon Specialist
          </DialogTitle>
          <DialogDescription>
            Create detailed sermon outlines or complete multi-week series
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(val) => { setMode(val); setStep(1); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="outline">
              <FileText className="w-4 h-4 mr-2" />
              Sermon Outline
            </TabsTrigger>
            <TabsTrigger value="series">
              <Layers className="w-4 h-4 mr-2" />
              Sermon Series
            </TabsTrigger>
          </TabsList>

          {/* SERMON OUTLINE MODE */}
          <TabsContent value="outline" className="space-y-6 mt-4">
            {!generatedOutline ? (
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-600 rounded-full">
                        <Target className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">Sermon Outline Generator</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                          Arlynn creates comprehensive sermon outlines with:
                        </p>
                        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <li>✓ Compelling Big Idea</li>
                          <li>✓ 3-4 Main Points with titles</li>
                          <li>✓ 4-6 Supporting scriptures per point</li>
                          <li>✓ Practical applications for each point</li>
                          <li>✓ Illustration suggestions</li>
                          <li>✓ Powerful conclusion with call to action</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>What's your sermon about?</CardTitle>
                    <CardDescription>Provide at least one: topic, passage, or theme</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Sermon Topic</label>
                      <Input
                        placeholder="e.g., Faith, Prayer, Grace, The Cross..."
                        value={outlineTopic}
                        onChange={(e) => setOutlineTopic(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Scripture Passage</label>
                      <Input
                        placeholder="e.g., John 3:16, Romans 8:28-39, Philippians 4:4-7..."
                        value={outlinePassage}
                        onChange={(e) => setOutlinePassage(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Theme (Optional)</label>
                      <Textarea
                        placeholder="e.g., How to overcome fear with faith, Living generously in a selfish world..."
                        value={outlineTheme}
                        onChange={(e) => setOutlineTheme(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Teaching Context</label>
                      <Select value={outlineContext} onValueChange={setOutlineContext}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEACHING_CONTEXTS.map((ctx) => (
                            <SelectItem key={ctx.value} value={ctx.value}>
                              {ctx.label} - {ctx.desc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={generateSermonOutline}
                      disabled={isGenerating || (!outlineTopic.trim() && !outlinePassage.trim() && !outlineTheme.trim())}
                      className="w-full"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Arlynn is creating your outline...
                        </>
                      ) : (
                        <>
                          <Target className="w-5 h-5 mr-2" />
                          Generate Sermon Outline
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Title & Big Idea */}
                <Card className="border-l-4 border-blue-600">
                  <CardHeader>
                    <CardTitle className="text-2xl">{generatedOutline.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Big Idea</h3>
                      <p className="text-lg font-medium text-blue-800 dark:text-blue-200">
                        {generatedOutline.big_idea}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Main Points */}
                {asArray(generatedOutline.main_points).map((point, index) => {
                  const supportingScriptures = asArray(point.supporting_scriptures);
                  const applications = asArray(point.applications);
                  const illustrationSuggestions = asArray(point.illustration_suggestions);
                  return (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-indigo-600">Point {point.number}</Badge>
                          </div>
                          <CardTitle className="text-xl">{point.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(`Point ${point.number}: ${point.title}\n\n${point.explanation}\n\nScriptures: ${supportingScriptures.join(', ')}\n\nApplications:\n${applications.map(app => `${app.area}: ${app.action} (Reflection: ${app.reflection_question})`).join('\n')}\n\nIllustrations:\n${illustrationSuggestions.map(ill => `${ill.type}: ${ill.idea}`).join('\n')}`)}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Explanation */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Explanation</h4>
                        <p className="text-gray-700 dark:text-gray-300">{point.explanation}</p>
                      </div>

                      {/* Significance */}
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
                        <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-1">
                          Why This Matters
                        </h4>
                        <p className="text-purple-800 dark:text-purple-200 text-sm">{point.significance}</p>
                      </div>

                      {/* Supporting Scriptures */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          Supporting Scriptures ({supportingScriptures.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {supportingScriptures.map((scripture, sIndex) => (
                            <Badge key={sIndex} variant="outline">{scripture}</Badge>
                          ))}
                        </div>
                      </div>

                      {/* Applications */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          Key Applications
                        </h4>
                        <div className="space-y-2">
                          {applications.map((app, aIndex) => (
                            <div key={aIndex} className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                              <div className="font-semibold text-sm text-green-900 dark:text-green-100">
                                {app.area}
                              </div>
                              <p className="text-sm text-green-800 dark:text-green-200 mt-1">{app.action}</p>
                              <p className="text-xs text-green-700 dark:text-green-300 mt-1 italic">
                                🤔 Reflection: {app.reflection_question}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Illustration Suggestions */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                          <Lightbulb className="w-4 h-4" />
                          Illustration Ideas
                        </h4>
                        <div className="space-y-2">
                          {illustrationSuggestions.map((ill, iIndex) => (
                            <div key={iIndex} className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border-l-2 border-yellow-500">
                              <div className="font-semibold text-xs text-yellow-900 dark:text-yellow-100">
                                {ill.type}
                              </div>
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">{ill.idea}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}

                {/* Conclusion */}
                <Card className="border-l-4 border-green-600">
                  <CardHeader>
                    <CardTitle>Conclusion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Recap</h4>
                      <p className="text-gray-700 dark:text-gray-300">{generatedOutline.conclusion.recap}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                      <h4 className="font-semibold text-sm text-green-900 dark:text-green-100 mb-1">
                        Call to Action
                      </h4>
                      <p className="text-green-800 dark:text-green-200">{generatedOutline.conclusion.call_to_action}</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                      <h4 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100 mb-1">
                        Final Illustration Idea
                      </h4>
                      <p className="text-yellow-800 dark:text-yellow-200">{generatedOutline.conclusion.final_illustration_idea}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Invitation</h4>
                      <p className="text-gray-700 dark:text-gray-300">{generatedOutline.conclusion.invitation}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Next Steps</h4>
                      <ul className="space-y-1">
                        {asArray(generatedOutline.conclusion?.next_steps).map((step, sIndex) => (
                          <li key={sIndex} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button onClick={handleSaveOutline} className="flex-1" size="lg">
                    <Save className="w-5 h-5 mr-2" />
                    Save Outline
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setGeneratedOutline(null)}
                    size="lg"
                  >
                    Create New Outline
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* SERMON SERIES MODE - keep all existing series code */}
          <TabsContent value="series" className="space-y-6 mt-4">
            {step === 1 && (
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-600 rounded-full">
                        <Layers className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">Series Builder</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                          I create complete sermon series with:
                        </p>
                        <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <li>✓ Compelling series outline with theological trajectory</li>
                          <li>✓ Individual sermon drafts that build on each other</li>
                          <li>✓ Small group discussion questions for each sermon</li>
                          <li>✓ Series promotion materials</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>What kind of series?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant={seriesType === 'theme' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2"
                        onClick={() => setSeriesType('theme')}
                      >
                        <Sparkles className="w-6 h-6" />
                        <div>
                          <div className="font-semibold">Thematic Series</div>
                          <div className="text-xs opacity-80">Based on a topic or theme</div>
                        </div>
                      </Button>
                      <Button
                        variant={seriesType === 'book' ? 'default' : 'outline'}
                        className="h-24 flex flex-col gap-2"
                        onClick={() => setSeriesType('book')}
                      >
                        <BookOpen className="w-6 h-6" />
                        <div>
                          <div className="font-semibold">Book Study</div>
                          <div className="text-xs opacity-80">Through a book of the Bible</div>
                        </div>
                      </Button>
                    </div>

                    {seriesType === 'theme' && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Series Theme</label>
                        <Input
                          placeholder="e.g., Living with Purpose, The Character of God, Prayer, Identity in Christ..."
                          value={themeInput}
                          onChange={(e) => setThemeInput(e.target.value)}
                        />
                      </div>
                    )}

                    {seriesType === 'book' && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Book of the Bible</label>
                        <Select value={bookInput} onValueChange={setBookInput}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a book..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {BIBLE_BOOKS.map((book) => (
                              <SelectItem key={book} value={book}>{book}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium mb-2 block">Series Length</label>
                      <Select value={seriesLength.toString()} onValueChange={(val) => setSeriesLength(parseInt(val))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERIES_LENGTHS.map((length) => (
                            <SelectItem key={length.value} value={length.value.toString()}>
                              {length.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Teaching Context</label>
                      <Select value={seriesContext} onValueChange={setSeriesContext}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEACHING_CONTEXTS.map((ctx) => (
                            <SelectItem key={ctx.value} value={ctx.value}>
                              {ctx.label} - {ctx.desc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={generateSeriesOutline}
                      disabled={isGenerating || (seriesType === 'theme' && !themeInput.trim()) || (seriesType === 'book' && !bookInput)}
                      className="w-full"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Arlynn is planning your series...
                        </>
                      ) : (
                        <>
                          <Layers className="w-5 h-5 mr-2" />
                          Generate Series Outline
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === 2 && seriesOutline && (
              <div className="space-y-6">
                {/* Series Overview */}
                <Card className="border-l-4 border-indigo-600">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{seriesOutline.series_title}</CardTitle>
                        <CardDescription className="text-base">{seriesOutline.series_description}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-lg px-4 py-2">
                        {seriesLength} Weeks
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Series Goal</h3>
                      <p className="text-gray-700 dark:text-gray-300">{seriesOutline.series_goal}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Target Audience</h3>
                      <p className="text-gray-700 dark:text-gray-300">{seriesOutline.target_audience}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Theological Trajectory */}
                <Card className="bg-purple-50 dark:bg-purple-900/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      Theological Trajectory
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Progression</h4>
                      <p className="text-gray-700 dark:text-gray-300">{seriesOutline.theological_trajectory.progression}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Key Doctrines</h4>
                      <div className="flex flex-wrap gap-2">
                        {asArray(seriesOutline.theological_trajectory?.key_doctrines).map((doctrine, index) => (
                          <Badge key={index} variant="outline">{doctrine}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Build Pattern</h4>
                      <p className="text-gray-700 dark:text-gray-300">{seriesOutline.theological_trajectory.build_pattern}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Culmination</h4>
                      <p className="text-gray-700 dark:text-gray-300">{seriesOutline.theological_trajectory.culmination}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Individual Sermon Outlines */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Sermon Outlines</h3>
                    <Button onClick={() => setStep(3)}>
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Full Sermons
                    </Button>
                  </div>

                  {asArray(seriesOutline.sermons).map((sermon, index) => {
                    const discussionQuestions = asArray(sermon.discussion_questions) || [];
                    return (
                    <Card key={index} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>Week {sermon.week}</Badge>
                              {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                            </div>
                            <CardTitle className="text-lg">{sermon.title}</CardTitle>
                            <CardDescription className="mt-2">
                              <BookOpen className="w-3 h-3 inline mr-1" />
                              {sermon.scripture}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Big Idea:</span>
                          <p className="text-gray-700 dark:text-gray-300">{sermon.big_idea}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Theological Focus:</span>
                          <p className="text-gray-700 dark:text-gray-300">{sermon.theological_focus}</p>
                        </div>
                        {sermon.builds_on_previous && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                            <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">Builds On Previous:</span>
                            <p className="text-blue-800 dark:text-blue-200 text-sm">{sermon.builds_on_previous}</p>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              Discussion Questions ({discussionQuestions.length})
                            </span>
                          </div>
                          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {discussionQuestions.slice(0, 2).map((q, qIndex) => (
                              <li key={qIndex}>• {q}</li>
                            ))}
                            {discussionQuestions.length > 2 && (
                              <li className="text-gray-500">+ {discussionQuestions.length - 2} more questions</li>
                            )}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>

                {/* Promotion Materials */}
                <Card className="bg-green-50 dark:bg-green-900/20">
                  <CardHeader>
                    <CardTitle>Series Promotion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">Social Media Tagline</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(seriesOutline.promotion.social_tagline)}
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{seriesOutline.promotion.social_tagline}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">Bulletin Text</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(seriesOutline.promotion.bulletin_text)}
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{seriesOutline.promotion.bulletin_text}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === 3 && seriesOutline && (
              <div className="space-y-6">
                <Alert>
                  <Layers className="w-4 h-4" />
                  <AlertDescription>
                    Arlynn will now generate complete sermon drafts for each week. Each sermon builds on the previous ones.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {asArray(seriesOutline.sermons).map((outline, index) => {
                    const sermon = generatedSermons.find(s => s.week === outline.week); // Find by week to handle async order
                    const isGenerated = !!sermon;
                    const isSermonGenerating = currentSermonIndex === index && isGenerating;

                    return (
                      <Card key={index} className={isGenerated ? 'border-green-500 border-2' : ''}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge>Week {outline.week}</Badge>
                                {isGenerated && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Generated
                                  </Badge>
                                )}
                              </div>
                              <CardTitle className="text-lg">{outline.title}</CardTitle>
                            </div>
                            {!isGenerated && (
                              <Button
                                onClick={() => generateIndividualSermon(index)}
                                disabled={isSermonGenerating}
                              >
                                {isSermonGenerating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Generate
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        {sermon && (
                          <CardContent className="space-y-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                              <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">Big Idea:</span>
                              <p className="text-blue-800 dark:text-blue-200">{sermon.big_idea}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-sm">Points:</span>
                              <ul className="mt-1 space-y-1">
                                {asArray(sermon.points).map((point, pIndex) => (
                                  <li key={pIndex} className="text-sm text-gray-700 dark:text-gray-300">
                                    {pIndex + 1}. {point.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {sermon.next_week_teaser && (
                              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
                                <span className="font-semibold text-sm text-purple-900 dark:text-purple-100">Next Week Preview:</span>
                                <p className="text-purple-800 dark:text-purple-200 text-sm">{sermon.next_week_teaser}</p>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {generatedSermons.length === asArray(seriesOutline.sermons).length ? (
                  <div className="flex gap-3">
                    <Button onClick={handleSaveAllSermons} className="flex-1" size="lg">
                      <Save className="w-5 h-5 mr-2" />
                      Save All {generatedSermons.length} Sermons
                    </Button>
                    <Button variant="outline" onClick={() => setStep(2)} size="lg">
                      Back to Outline
                    </Button>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Some sermons are still being generated. Please wait until all are ready.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {mode === 'series' && step > 1 && (
            <Button variant="ghost" onClick={() => setStep(Math.max(1, step - 1))}>
              Back
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
