import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { Button } from "@/components/ui/button";
import { logActivity } from "../components/admin/UserActivityLogger";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Save, Loader2, BookOpen, Lightbulb, Users, Bot, Wand2, Layers, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Link as RouterLink } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SermonEditor from "@/components/sermon/SermonEditor";
import SeriesBuilder from "@/components/sermon/SeriesBuilder";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSermon, setGeneratedSermon] = useState(null);
  const [user, setUser] = useState(null);
  const [suggestedPassages, setSuggestedPassages] = useState([]);
  const [isLoadingPassages, setIsLoadingPassages] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementType, setEnhancementType] = useState(null);
  const [isAdapting, setIsAdapting] = useState(false);
  const [showSeriesBuilder, setShowSeriesBuilder] = useState(false);

  useEffect(() => {
    loadUser();
    logActivity('page_view', { page_name: 'SermonBuilder' });
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      
      // Apply user preferences as defaults
      if (currentUser?.study_preferences) {
        if (currentUser.study_preferences.preferredSermonTone) {
          setTone(currentUser.study_preferences.preferredSermonTone);
        }
        if (currentUser.study_preferences.preferredAudience) {
          setAudience(currentUser.study_preferences.preferredAudience);
        }
      }
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const findPassages = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a sermon topic first");
      return;
    }

    setIsLoadingPassages(true);
    try {
      const prompt = `Hey Larry! I need to preach a sermon on "${topic}". Can you suggest 5-7 Bible passages that would be perfect anchor texts for this topic? 

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
    console.log('[SermonBuilder] Generating sermon with topic:', topic, 'passage:', passage);
    try {
      const denomination = user?.denomination || "Non-Denominational";
      
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
        ? `\n\nUser's areas of interest: ${userTopics.join(', ')}. If relevant to "${topic}", incorporate these perspectives naturally.`
        : '';

      const prompt = `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

      You are Larry, an expert AI sermon assistant helping pastors create powerful, biblical sermons. Generate a complete sermon outline on the topic "${topic}" using ${passage} as the anchor passage.

Denomination: ${denomination}
Tone: ${tone}
Audience: ${audienceContext[audience]}${topicContext}

Create a sermon that includes:
1. A compelling title that captures attention
2. A clear "Big Idea" - one memorable sentence summarizing the sermon
3. Theological notes about ${denomination} perspective on this topic
4. 3-4 main points, each with:
   - Point title (action-oriented)
   - Exegesis (2-3 paragraphs explaining the passage, aligned with ${denomination} doctrine)
   - Illustration (a story, example, or analogy that brings the point to life - make it ${tone} in nature)
   - Application (specific, practical ways to apply this truth)
   - 3-5 supporting scriptures that reinforce this point
5. A powerful conclusion that calls for response

Make it ${tone} in tone and perfect for ${audienceContext[audience]}. Be biblically accurate, engaging, and practical.`;

      console.log('[SermonBuilder] Calling InvokeLLM...');
      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: sermonGenerationSchema
      });

      console.log('[SermonBuilder] Got response:', response);
      setGeneratedSermon({
        ...response,
        topic,
        anchor_passage: passage,
        tone,
        audience,
        denomination
      });
      
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
          point_count: response?.points?.length || 0
        }
      });
      
      toast.success("Larry created your sermon! 🎉");
    } catch (error) {
      console.error('[SermonBuilder] Error generating sermon:', error);
      console.error('[SermonBuilder] Error details:', error.message, error.stack);
      toast.error("Failed to generate sermon: " + (error.message || "Please try again"));
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
      
      const updatedSermon = { ...generatedSermon };
      updatedSermon.points[pointIndex].illustration = newIllustration;
      setGeneratedSermon(updatedSermon);
      
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

      const updatedSermon = { ...generatedSermon };
      updatedSermon.points[pointIndex].supporting_scriptures = [
        ...point.supporting_scriptures,
        ...(response.verses || [])
      ];
      setGeneratedSermon(updatedSermon);
      
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
${generatedSermon.points.map((p, i) => `Point ${i+1}: ${p.title}\n${p.illustration?.substring(0, 150)}...`).join('\n\n')}

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

      setGeneratedSermon({
        ...response,
        topic: generatedSermon.topic,
        anchor_passage: generatedSermon.anchor_passage,
        tone: generatedSermon.tone,
        audience: newAudience,
        denomination: generatedSermon.denomination
      });
      
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

    try {
      const saved = await api.entities.Sermon.create({
        user_id: user.id,
        title: sermon.title,
        topic: sermon.topic,
        anchor_passage: sermon.anchor_passage,
        big_idea: sermon.big_idea,
        points: sermon.points,
        conclusion: sermon.conclusion,
        theological_notes: sermon.theological_notes,
        tone: sermon.tone,
        audience: sermon.audience,
        denomination: sermon.denomination,
        status: "draft"
      });

      logActivity('sermon_created', {
        page_name: 'SermonBuilder',
        resource_type: 'sermon',
        resource_id: saved.id,
        data_modified: 'sermon_saved',
        new_value: sermon.title,
        metadata: { 
          title: sermon.title, 
          topic: sermon.topic,
          passage: sermon.anchor_passage,
          point_count: sermon.points?.length || 0,
          status: 'draft'
        }
      });
      
      toast.success("Sermon saved successfully!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save sermon: " + (error.message || "Please try again"));
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

        {!generatedSermon ? (
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

              {user?.denomination && (
                <Alert>
                  <Sparkles className="w-4 h-4" />
                  <AlertDescription>
                    Larry will align this sermon with <strong>{user.denomination}</strong> theology
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={generateSermon}
                disabled={isGenerating || !topic.trim() || !passage.trim()}
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