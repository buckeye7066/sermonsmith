import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { validateAiSermon } from '@/lib/scriptureRefs';
import { asArray, mergeUniqueStrings, normalizeSermon } from '@/lib/aiStructured';
import { parsePartialJson } from '@/lib/partialJson';
import { getAiErrorMessage } from '@/lib/aiErrors';
import { formatUserInputBlock } from '@/lib/aiPrompt';
import { DENOMINATION_GROUPS, denominationPromptBlock, resolveDenominationProfile } from '@/lib/denominations';
import { logError } from '@/lib/logError';
import { Button } from "@/components/ui/button";
import { logActivity } from "../components/admin/UserActivityLogger";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Loader2, BookOpen, Lightbulb, Users, Bot, Layers, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Link as RouterLink } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SermonEditor from "@/components/sermon/SermonEditor";
import SeriesBuilder from "@/components/sermon/SeriesBuilder";
import StreamingSermonPreview from "@/components/sermon/StreamingSermonPreview";

const SERMON_TONES = [
  { value: "inspirational", label: "Inspirational" },
  { value: "teaching", label: "Teaching" },
  { value: "evangelistic", label: "Evangelistic" },
  { value: "pastoral", label: "Pastoral/Caring" },
  { value: "prophetic", label: "Prophetic" }
];

const AUDIENCES = [
  { value: "general", label: "General Congregation" },
  { value: "youth", label: "Youth (13-18)" },
  { value: "young_adults", label: "Young Adults (18-30)" },
  { value: "children", label: "Children (6-12)" },
  { value: "seniors", label: "Seniors (60+)" }
];

const sermonGenerationSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    big_idea: { type: "string" },
    theological_notes: { type: "string" },
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
    conclusion: { type: "string" }
  }
};

export default function SermonBuilder() {
  const [topic, setTopic] = useState("");
  const [passage, setPassage] = useState("");
  const [tone, setTone] = useState("inspirational");
  const [audience, setAudience] = useState("general");
  // Per-sermon denomination viewpoint. Defaults to the user's profile
  // denomination but can be overridden for any individual sermon (e.g. a guest
  // preacher or a cross-tradition study) without changing the saved profile.
  const [denomination, setDenomination] = useState("Non-Denominational");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSermon, setGeneratedSermon] = useState(null);
  // Live partial sermon rendered while the response streams in.
  const [streamingSermon, setStreamingSermon] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const [suggestedPassages, setSuggestedPassages] = useState([]);
  const [isLoadingPassages, setIsLoadingPassages] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementType, setEnhancementType] = useState(null);
  const [isAdapting, setIsAdapting] = useState(false);
  const [showSeriesBuilder, setShowSeriesBuilder] = useState(false);

  useEffect(() => {
    logActivity('page_view', { page_name: 'SermonBuilder' });
  }, []);

  // Apply user study preferences when AuthContext resolves the user.
  useEffect(() => {
    if (user?.denomination) {
      setDenomination(user.denomination);
    }
    if (!user?.study_preferences) return;
    if (user.study_preferences.preferredSermonTone) {
      setTone(user.study_preferences.preferredSermonTone);
    }
    if (user.study_preferences.preferredAudience) {
      setAudience(user.study_preferences.preferredAudience);
    }
  }, [user]);

  const findPassages = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a sermon topic first");
      return;
    }

    setIsLoadingPassages(true);
    try {
      const prompt = `Hey Larry! I need 5-7 Bible passages that would be strong anchor texts for this user-provided sermon topic.

${formatUserInputBlock('Sermon topic', topic)}

Consider:
- Key passages that directly address this topic
- Well-known verses people can remember
- Passages with depth for exposition
- Mix of Old and New Testament if possible

Return as JSON array of objects with "reference" and "reason" fields.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            passages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });

      setSuggestedPassages(response.passages || []);
      toast.success("Larry found passages for your sermon!");
    } catch (error) {
      console.error("Error finding passages:", error);
      toast.error("Failed to find passages");
    } finally {
      setIsLoadingPassages(false);
    }
  };

  const generateSermon = async () => {
    if (!topic.trim() || !passage.trim()) {
      toast.error("Please provide both a topic and scripture passage");
      return;
    }

    setIsGenerating(true);
    setStreamingSermon(null);
    setGeneratedSermon(null);
    try {
      const audienceContext = {
        general: "general congregation with mixed ages and backgrounds",
        youth: "youth group (ages 13-18), using relatable examples and contemporary language",
        young_adults: "young adults (18-30), addressing life transitions and modern challenges",
        children: "children (ages 6-12), using simple language, stories, and concrete examples",
        seniors: "senior adults (60+), honoring their wisdom and life experience"
      };

      // Personalize prompt with user preferences
      const userTopics = user?.content_preferences?.favoriteTopics || [];
      const topicContext = userTopics.length > 0 
        ? `\n\n${formatUserInputBlock("User's areas of interest", userTopics.join(', '), 'None provided')}\nIf relevant to the sermon topic, incorporate these perspectives naturally.`
        : '';

      const prompt = `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

You are Larry, an expert AI sermon assistant helping pastors create powerful, biblical sermons. Generate a complete sermon outline using the fenced user inputs below.

${formatUserInputBlock('Sermon topic', topic)}
${formatUserInputBlock('Anchor passage', passage)}

${denominationPromptBlock(denomination)}

Tone: ${tone}
Audience: ${audienceContext[audience]}${topicContext}

Create a sermon that includes:
1. A compelling title that captures attention
2. A clear "Big Idea" - one memorable sentence summarizing the sermon
3. Theological notes explaining this tradition's perspective on the topic (per the denominational viewpoint above)
4. 3-4 main points, each with:
   - Point title (action-oriented)
   - Exegesis (2-3 paragraphs explaining the passage, aligned with the denominational viewpoint above)
   - Illustration (a story, example, or analogy that brings the point to life - make it ${tone} in nature)
   - Application (specific, practical ways to apply this truth)
   - 3-5 supporting scriptures that reinforce this point
5. A powerful conclusion that calls for response

Make it ${tone} in tone and perfect for ${audienceContext[audience]}. Be biblically accurate, engaging, and practical.`;

      const fallbackCtx = { topic, anchor_passage: passage, tone, audience, denomination };

      // Stream the sermon so the user watches it appear instead of waiting on a
      // blank spinner. Falls back to the non-streaming call if streaming isn't
      // available (older API, proxy that buffers, network quirk).
      let rawResponse;
      try {
        const fullText = await api.integrations.Core.StreamLLM(
          { system_prompt: LARRY_SYSTEM_PROMPT, prompt, response_json_schema: sermonGenerationSchema, feature: 'sermon' },
          (accumulated) => {
            const partial = parsePartialJson(accumulated);
            if (partial && typeof partial === 'object') {
              setStreamingSermon(normalizeSermon(partial, fallbackCtx));
            }
          },
        );
        rawResponse = parsePartialJson(fullText) || {};
      } catch (streamErr) {
        console.warn('[SermonBuilder] streaming unavailable, falling back to invoke:', streamErr?.message);
        rawResponse = await api.integrations.Core.InvokeLLM({
          system_prompt: LARRY_SYSTEM_PROMPT,
          prompt,
          response_json_schema: sermonGenerationSchema,
        });
      }

      const sermon = normalizeSermon(rawResponse, fallbackCtx);
      setStreamingSermon(null);
      setGeneratedSermon(sermon);

      logActivity('ai_feature_used', {
        page_name: 'SermonBuilder',
        resource_type: 'sermon',
        data_modified: 'new_sermon_generated',
        new_value: topic,
        metadata: {
          feature: 'generate_sermon',
          topic,
          passage,
          denomination,
          tone,
          audience,
          point_count: sermon.points.length,
        }
      });
      
      toast.success("Larry created your sermon! 🎉");
    } catch (error) {
      console.error('[SermonBuilder] Error generating sermon:', error);
      setStreamingSermon(null);
      toast.error(getAiErrorMessage(error, 'generate the sermon'));
    } finally {
      setIsGenerating(false);
    }
  };

  const enhanceIllustration = async (pointIndex) => {
    if (!generatedSermon) return;
    
    setIsEnhancing(true);
    setEnhancementType(`illustration-${pointIndex}`);
    
    try {
      const point = generatedSermon.points[pointIndex];
      
      const prompt = `Larry, I need a better illustration for this sermon point:

Title: ${point.title}
Current Illustration: ${point.illustration}
Main Idea: ${point.exegesis?.substring(0, 200)}

Can you create a more engaging ${tone} illustration that:
- Is memorable and relatable for ${audience === 'children' ? 'children' : audience === 'youth' ? 'teenagers' : 'adults'}
- Clarifies the theological point
- Connects to real life
- Inspires action

Give me just the new illustration (2-3 paragraphs).`;

      const newIllustration = await api.integrations.Core.InvokeLLM({ system_prompt: LARRY_SYSTEM_PROMPT, prompt });

      setGeneratedSermon((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          points: asArray(prev.points).map((p, index) =>
            index === pointIndex ? { ...p, illustration: newIllustration } : p
          ),
        };
      });

      toast.success("Larry enhanced your illustration!");
    } catch (error) {
      console.error("Error enhancing illustration:", error);
      toast.error("Failed to enhance illustration");
    } finally {
      setIsEnhancing(false);
      setEnhancementType(null);
    }
  };

  const suggestMoreScriptures = async (pointIndex) => {
    if (!generatedSermon) return;
    
    setIsEnhancing(true);
    setEnhancementType(`scriptures-${pointIndex}`);
    
    try {
      const point = generatedSermon.points[pointIndex];
      
      const prompt = `Larry, I need more supporting scriptures for this sermon point:

Point: ${point.title}
Content: ${point.exegesis?.substring(0, 300)}
Current Scriptures: ${point.supporting_scriptures?.join(', ')}

Suggest 3-5 additional Bible verses that:
- Support this point theologically
- Are easy to understand
- Come from different books if possible
- Don't duplicate what's already listed

Return as JSON array of verse references.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            verses: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setGeneratedSermon((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          points: asArray(prev.points).map((existingPoint, index) =>
            index === pointIndex
              ? {
                  ...existingPoint,
                  supporting_scriptures: mergeUniqueStrings(
                    existingPoint.supporting_scriptures,
                    response.verses
                  ),
                }
              : existingPoint
          ),
        };
      });

      toast.success("Larry added more scriptures!");
    } catch (error) {
      console.error("Error suggesting scriptures:", error);
      toast.error("Failed to suggest scriptures");
    } finally {
      setIsEnhancing(false);
      setEnhancementType(null);
    }
  };

  const adaptForAudience = async (newAudience) => {
    if (!generatedSermon || newAudience === audience) return;
    
    setIsAdapting(true);
    
    try {
      const audienceDescriptions = {
        general: "general congregation with mixed ages - use universal examples",
        youth: "teenagers (13-18) - use pop culture, social media, and school life examples",
        young_adults: "young adults (18-30) - address career, relationships, and finding purpose",
        children: "children (6-12) - use simple language, fun stories, and concrete examples",
        seniors: "seniors (60+) - honor their wisdom, use historical context, address legacy"
      };

      const prompt = `Larry, help me adapt this sermon for a different audience!

Original Sermon:
Title: ${generatedSermon.title}
Topic: ${generatedSermon.topic}
Current Audience: ${audience}
New Audience: ${newAudience}

Current Content Summary:
${asArray(generatedSermon.points).map((p, i) => `Point ${i+1}: ${p.title}\n${p.illustration?.substring(0, 150)}...`).join('\n\n')}

Please adapt the sermon for ${audienceDescriptions[newAudience]}:
- Keep the same biblical truth and structure
- Rewrite illustrations to be age-appropriate and relatable
- Adjust language complexity
- Modify applications to be practical for this audience
- Keep supporting scriptures (they work for all ages)

Return the full adapted sermon in the same JSON format.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: sermonGenerationSchema
      });

      const adapted = normalizeSermon(response, {
        topic: generatedSermon.topic,
        anchor_passage: generatedSermon.anchor_passage,
        tone: generatedSermon.tone,
        audience: newAudience,
        denomination: generatedSermon.denomination,
      });

      setGeneratedSermon(adapted);
      setAudience(newAudience);
      toast.success(`Larry adapted your sermon for ${audienceDescriptions[newAudience]}! 🎯`);
    } catch (error) {
      console.error("Error adapting sermon:", error);
      toast.error("Failed to adapt sermon");
    } finally {
      setIsAdapting(false);
    }
  };

  const handleSave = async (sermonToSave) => {
    if (!user) {
      toast.error("Please log in to save your sermon");
      return;
    }

    const sermon = sermonToSave || generatedSermon;
    if (!sermon) {
      toast.error("No sermon to save yet");
      return;
    }

    // Re-entrancy guard: a rapid double-click previously created two identical
    // records before any id was written back.
    if (isSaving) return;
    setIsSaving(true);

    // Normalize before validation/save so partial AI shapes (or shapes
    // mutated by the per-point enhancers) still satisfy the entity schema.
    const normalizedSermon = normalizeSermon(sermon);

    try {
      // Verify every Scripture reference the model produced. Unknown books
      // are flagged as `invalid_book` and we mark the entire sermon
      // `needs_review` so the UI surfaces a warning instead of letting a
      // hallucinated citation reach the pulpit.
      const validation = validateAiSermon(normalizedSermon);
      if (!validation.allValid) {
        toast.warning('Some Scripture references look invalid — please verify before publishing.');
      }

      const payload = {
        user_id: user.id,
        title: normalizedSermon.title,
        topic: normalizedSermon.topic,
        anchor_passage: normalizedSermon.anchor_passage,
        big_idea: normalizedSermon.big_idea,
        points: normalizedSermon.points,
        conclusion: normalizedSermon.conclusion,
        theological_notes: normalizedSermon.theological_notes,
        tone: normalizedSermon.tone,
        audience: normalizedSermon.audience,
        denomination: normalizedSermon.denomination,
        scripture_validation: validation.refs,
        status: validation.allValid ? 'draft' : 'needs_review',
      };

      // If this sermon was already saved (it carries an id), UPDATE it instead
      // of creating a second identical record. This fixes the silent
      // duplication when the user clicks Save again.
      const existingId = generatedSermon?.id || sermon?.id;
      const saved = existingId
        ? await api.entities.Sermon.update(existingId, payload)
        : await api.entities.Sermon.create(payload);

      // Write the id (and status) back onto the in-memory sermon so the viewer
      // reflects the saved state and the Export button unlocks (it was gated on
      // `sermonData.id`, which never got set before).
      setGeneratedSermon((prev) => ({ ...(prev || normalizedSermon), id: saved.id, status: payload.status }));

      logActivity('sermon_created', {
        page_name: 'SermonBuilder',
        resource_type: 'sermon',
        resource_id: saved.id,
        data_modified: existingId ? 'sermon_updated' : 'sermon_saved',
        new_value: normalizedSermon.title,
        metadata: {
          title: normalizedSermon.title,
          topic: normalizedSermon.topic,
          passage: normalizedSermon.anchor_passage,
          point_count: normalizedSermon.points.length,
          status: payload.status,
        }
      });

      toast.success(existingId ? "Sermon updated!" : "Sermon saved successfully!");
    } catch (error) {
      toast.error('Failed to save sermon: ' + logError('SermonBuilder save', error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-8 h-8 text-indigo-600" />
            Sermon Builder
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500" />
            Create powerful, biblical sermons with Larry, your AI sermon assistant
          </p>
        </div>

        {/* AI Assistants Card */}
        <Card className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Choose Your AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Larry - Single Sermon */}
              <Card className="border-2 border-blue-300 hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-6 h-6 text-blue-600" />
                    Larry - Sermon Assistant
                  </CardTitle>
                  <CardDescription>Perfect for individual sermons</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      Generate single sermon from topic
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      Find perfect scripture passages
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      Enhance illustrations & add scriptures
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      Adapt for different audiences
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ✅ Already active - use form below
                  </p>
                </CardContent>
              </Card>

              {/* Arlynn - Series Builder */}
              <Card className="border-2 border-purple-300 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setShowSeriesBuilder(true)}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="w-6 h-6 text-purple-600" />
                    Arlynn - Series Specialist
                  </CardTitle>
                  <CardDescription>Perfect for multi-week series</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Generate 3-12 week sermon series
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Theological trajectory planning
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Sermons that build on each other
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      Small group discussion questions
                    </li>
                  </ul>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setShowSeriesBuilder(true)}>
                    <Layers className="w-4 h-4 mr-2" />
                    Launch Series Builder
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {streamingSermon ? (
          <StreamingSermonPreview sermon={streamingSermon} />
        ) : !generatedSermon ? (
          <Card>
            <CardHeader>
              <CardTitle>Build Your Sermon</CardTitle>
              <CardDescription>
                Larry will help you create a complete sermon outline with illustrations and applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sermon Topic</label>
                <Input
                  placeholder="e.g., Faith, Grace, Prayer, Love..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center justify-between">
                  <span>Anchor Passage</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={findPassages}
                    disabled={isLoadingPassages || !topic.trim()}
                  >
                    {isLoadingPassages ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Larry is searching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Ask Larry for Ideas
                      </>
                    )}
                  </Button>
                </label>
                <Input
                  placeholder="e.g., John 3:16, Romans 8:28-39"
                  value={passage}
                  onChange={(e) => setPassage(e.target.value)}
                />
              </div>

              {suggestedPassages.length > 0 && (
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Larry's Passage Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {suggestedPassages.map((p, index) => (
                      <div
                        key={index}
                        onClick={() => setPassage(p.reference)}
                        className="p-3 bg-white dark:bg-gray-800 rounded border hover:border-blue-500 cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-blue-600">{p.reference}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.reason}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sermon Tone</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERMON_TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Target Audience</label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Denominational Viewpoint</label>
                <Select value={denomination} onValueChange={setDenomination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a tradition..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {DENOMINATION_GROUPS.map((group) => (
                      <SelectGroup key={group.family}>
                        <SelectLabel>{group.family}</SelectLabel>
                        {group.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {/* Preserve a profile denomination that isn't in the curated
                        list so the user's own saved tradition is always selectable. */}
                    {user?.denomination && !DENOMINATION_GROUPS.some((g) => g.options.includes(user.denomination)) && (
                      <SelectGroup>
                        <SelectLabel>Your Profile</SelectLabel>
                        <SelectItem value={user.denomination}>{user.denomination}</SelectItem>
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Sparkles className="w-4 h-4" />
                <AlertDescription>
                  Larry will preach from a <strong>{denomination}</strong> viewpoint —{' '}
                  {resolveDenominationProfile(denomination).summary}
                </AlertDescription>
              </Alert>

              {/* Kept clickable when fields are empty so the click surfaces a
                  clear "provide a topic and passage" toast — a disabled button
                  that silently does nothing reads as a broken app. */}
              <Button
                onClick={generateSermon}
                disabled={isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Larry is crafting your sermon...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Sermon with Larry
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Larry's Enhancement Tools */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  Larry's AI Tools
                </CardTitle>
                <CardDescription>
                  Enhance your sermon with AI-powered features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Audience Adaptation */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Adapt for Different Audience</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {AUDIENCES.map((aud) => (
                        <Button
                          key={aud.value}
                          variant={audience === aud.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => adaptForAudience(aud.value)}
                          disabled={isAdapting || audience === aud.value}
                          className="text-xs"
                        >
                          {isAdapting && audience !== aud.value ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Users className="w-3 h-3 mr-1" />
                          )}
                          {aud.value === 'general' ? 'General' :
                           aud.value === 'youth' ? 'Youth' :
                           aud.value === 'young_adults' ? 'Young Adult' :
                           aud.value === 'children' ? 'Children' : 'Seniors'}
                        </Button>
                      ))}
                    </div>
                    {isAdapting && (
                      <Alert className="mt-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <AlertDescription>
                          Larry is adapting your sermon... This may take 30-60 seconds
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Per-Point Enhancements:</strong> Click buttons within each sermon point to:
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Enhance Illustrations
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Add Scriptures
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sermon Editor with Enhancement Options */}
            <SermonEditor
              sermonData={generatedSermon}
              onSave={handleSave}
              user={user}
              onEnhanceIllustration={enhanceIllustration}
              onSuggestScriptures={suggestMoreScriptures}
              isEnhancing={isEnhancing}
              enhancementType={enhancementType}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedSermon(null);
                  setSuggestedPassages([]);
                }}
                className="flex-1"
              >
                Create New Sermon
              </Button>
              <RouterLink to={createPageUrl("MySermons")} className="flex-1">
                <Button variant="outline" className="w-full">
                  View My Sermons
                </Button>
              </RouterLink>
            </div>
          </div>
        )}
      </div>
      <SeriesBuilder
        open={showSeriesBuilder}
        onClose={() => setShowSeriesBuilder(false)}
        user={user}
      />
    </div>
  );
}
