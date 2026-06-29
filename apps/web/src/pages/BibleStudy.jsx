import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { logActivity } from "../components/admin/UserActivityLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BookOpen, Loader2, Lightbulb, Link2, Bot, GraduationCap, Calendar, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link as RouterLink } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StudyGuideViewer from "@/components/study/StudyGuideViewer";
import StudyPlanGenerator from "@/components/study/StudyPlanGenerator";
import MultiPerspectiveStudy from "@/components/study/MultiPerspectiveStudy";

const STUDY_TYPES = [
  { value: "personal", label: "Personal Study" },
  { value: "group", label: "Group Study" }, // Modified label
  { value: "youth", label: "Youth Study" },   // Modified label
  { value: "children", label: "Children's Study" } // Modified label
];

const studyGenerationSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    overview: { type: "string" },
    key_verses: {
      type: "array",
      items: { type: "string" }
    },
    study_sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          scripture: { type: "string" },
          insights: { type: "string" },
          questions: {
            type: "array",
            items: { type: "string" }
          },
          application: { type: "string" }
        }
      }
    },
    conclusion: { type: "string" }
  }
};

export default function BibleStudy() {
  const [topic, setTopic] = useState("");
  const [studyType, setStudyType] = useState("personal");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStudy, setGeneratedStudy] = useState(null);
  const { user } = useAuth();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementType, setEnhancementType] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState({
    summary: null,
    relatedStudies: [],
    relatedScriptures: []
  });
  const [showPlanGenerator, setShowPlanGenerator] = useState(false);
  const [showMultiPerspective, setShowMultiPerspective] = useState(false);

  useEffect(() => {
    logActivity('page_view', { page_name: 'BibleStudy' });
  }, []);

  // Apply user study preferences once they're available from AuthContext.
  useEffect(() => {
    if (user?.study_preferences?.preferredStudyType) {
      setStudyType(user.study_preferences.preferredStudyType);
    }
  }, [user]);

  const generateStudy = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a study topic");
      return;
    }

    setIsGenerating(true);
    try {
      const denomination = user?.denomination || "Non-Denominational";
      
      // Personalize with user topics
      const userTopics = user?.content_preferences?.favoriteTopics || [];
      const topicContext = userTopics.length > 0 
        ? `\n\nUser's areas of interest: ${userTopics.join(', ')}. If these relate to "${topic}", incorporate relevant perspectives.`
        : '';
      
      const prompt = `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

      You are Larry, a friendly and knowledgeable AI Bible study assistant. Create a comprehensive Bible study on the topic: "${topic}" for a ${studyType} setting.

Denomination: ${denomination}${topicContext}

Generate a Bible study guide that includes:
1. A clear, engaging title
2. An overview that sets context
3. 3-5 key Bible verses related to the topic
4. 4-6 study sections, each with:
   - Section title
   - Relevant scripture passage
   - Theological insights (2-3 paragraphs, aligned with ${denomination} doctrine)
   - 3-5 discussion questions that encourage deep thinking
   - Practical application for daily life
5. A conclusion that ties everything together

Make it engaging, biblically sound, and appropriate for ${studyType} study. Use clear, accessible language.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: studyGenerationSchema
      });

      setGeneratedStudy(response);
      
      logActivity('ai_feature_used', {
        page_name: 'BibleStudy',
        resource_type: 'study',
        data_modified: 'new_study_generated',
        new_value: topic,
        metadata: { 
          feature: 'study_generation', 
          topic,
          study_type: studyType,
          denomination: user?.denomination || 'Non-Denominational',
          section_count: response?.study_sections?.length || 0,
          key_verse_count: response?.key_verses?.length || 0
        }
      });
      
      toast.success("Larry has created your Bible study! 🎉");
    } catch (error) {
      console.error("Error generating study:", error);
      toast.error("Failed to generate study. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAISummary = async () => {
    if (!generatedStudy) return;
    
    setIsEnhancing(true);
    setEnhancementType('summary');
    
    try {
      const prompt = `Hi Larry! Please provide a concise, impactful summary of this Bible study in 2-3 sentences. Focus on the key spiritual takeaways and practical applications.

Study Title: ${generatedStudy.title}
Overview: ${generatedStudy.overview}
Key Sections: ${generatedStudy.study_sections.map(s => s.title).join(', ')}

Give me a powerful summary that captures the heart of this study.`;

      const summary = await api.integrations.Core.InvokeLLM({ system_prompt: LARRY_SYSTEM_PROMPT, prompt });
      
      setAiSuggestions(prev => ({ ...prev, summary }));
      toast.success("Larry created a summary!");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setIsEnhancing(false);
      setEnhancementType(null);
    }
  };

  const suggestRelatedScriptures = async () => {
    if (!generatedStudy) return;
    
    setIsEnhancing(true);
    setEnhancementType('scriptures');
    
    try {
      const prompt = `Hey Larry! Based on this Bible study about "${generatedStudy.title}" (topic: ${generatedStudy.topic}), suggest 5-8 additional Bible verses or passages that would deepen understanding of this topic. 

Current key verses: ${generatedStudy.key_verses.join(', ')}

Provide verses that complement but don't duplicate what's already included. Format as a JSON array of strings, where each string is a verse reference (e.g., "John 3:16", "Romans 8:28").`;

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

      setAiSuggestions(prev => ({ ...prev, relatedScriptures: response.verses || [] }));
      toast.success("Larry found related scriptures!");
    } catch (error) {
      console.error("Error suggesting scriptures:", error);
      toast.error("Failed to suggest scriptures");
    } finally {
      setIsEnhancing(false);
      setEnhancementType(null);
    }
  };

  const suggestRelatedStudies = async () => {
    if (!generatedStudy) return;
    
    setIsEnhancing(true);
    setEnhancementType('studies');
    
    try {
      const prompt = `Larry, based on this Bible study about "${generatedStudy.title}" (topic: ${generatedStudy.topic}), suggest 4-6 related study topics that would be natural follow-ups or complementary studies.

Think about:
- Prerequisite topics someone should study first
- Natural next steps after this study
- Related theological concepts
- Practical applications that need deeper exploration

Return as a JSON array of objects, each with "title" and "reason" fields explaining why it's related.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            studies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAiSuggestions(prev => ({ ...prev, relatedStudies: response.studies || [] }));
      toast.success("Larry suggested related studies!");
    } catch (error) {
      console.error("Error suggesting studies:", error);
      toast.error("Failed to suggest related studies");
    } finally {
      setIsEnhancing(false);
      setEnhancementType(null);
    }
  };

  const enhanceWithDiscussionQuestions = async (sectionIndex) => {
    if (!generatedStudy) return;
    
    setIsEnhancing(true);
    setEnhancementType(`questions-${sectionIndex}`);
    
    try {
      const section = generatedStudy.study_sections[sectionIndex];
      
      const prompt = `Larry, I need 3-5 additional thought-provoking discussion questions for this study section:

Title: ${section.title}
Scripture: ${section.scripture}
Insights: ${section.insights}

Current questions: ${section.questions.join('; ')}

Generate questions that:
- Encourage personal reflection
- Connect to real-life situations
- Prompt deeper theological thinking
- Are appropriate for ${studyType} setting
- Don't duplicate existing questions

Return as JSON array of strings.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      // Add new questions to the section
      const updatedStudy = { ...generatedStudy };
      updatedStudy.study_sections[sectionIndex].questions = [
        ...section.questions,
        ...(response.questions || [])
      ];
      
      setGeneratedStudy(updatedStudy);
      toast.success("Larry added more discussion questions!");
    } catch (error) {
      console.error("Error enhancing questions:", error);
      toast.error("Failed to add questions");
    } finally {
      setIsEnhancing(false);
      setEnhancementType(null);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Please log in to save your study");
      return;
    }

    try {
      const saved = await api.entities.BibleStudy.create({
        user_id: user.id,
        title: generatedStudy.title,
        topic: generatedStudy.topic,
        study_type: studyType,
        overview: generatedStudy.overview,
        key_verses: generatedStudy.key_verses,
        study_sections: generatedStudy.study_sections,
        conclusion: generatedStudy.conclusion,
        denomination: user.denomination || "Non-Denominational"
      });

      logActivity('study_created', {
        page_name: 'BibleStudy',
        resource_type: 'study',
        resource_id: saved.id,
        data_modified: 'study_saved',
        new_value: generatedStudy.title,
        metadata: { 
          title: generatedStudy.title,
          topic: generatedStudy.topic,
          study_type: studyType,
          section_count: generatedStudy.study_sections?.length || 0,
          key_verse_count: generatedStudy.key_verses?.length || 0
        }
      });

      toast.success("Bible study saved successfully!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save study");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto" data-print-full-width>
        <div className="mb-8" data-print-hidden={!!generatedStudy || undefined}>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-indigo-600" /> {/* Changed icon */}
            Bible Study Generator {/* Changed title */}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create comprehensive Bible studies with AI assistance {/* Changed description */}
          </p>
        </div>

        {/* Study Plan Generator Button */}
        <Card className="mb-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200" data-print-hidden>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                    Interactive Study Plans
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Create age-specific study plans with daily activities and questions
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowPlanGenerator(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Perspective Study Card */}
        <Card className="mb-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200" data-print-hidden>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-8 h-8 text-indigo-600" />
                <div>
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">
                    Multi-Perspective Bible Study
                  </h3>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    See how Catholic, Orthodox, Reformed, Wesleyan, and other traditions interpret the same passage
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowMultiPerspective(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Eye className="w-4 h-4 mr-2" />
                Explore Perspectives
              </Button>
            </div>
          </CardContent>
        </Card>

        {!generatedStudy ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Your Bible Study</CardTitle>
              <CardDescription>
                Larry will create a comprehensive study guide tailored to your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Study Topic</label>
                <Input
                  placeholder="e.g., Prayer, Faith, Love, Grace, Forgiveness..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && generateStudy()}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Study Type</label>
                <Select value={studyType} onValueChange={setStudyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {user?.denomination && (
                <Alert>
                  <Sparkles className="w-4 h-4" />
                  <AlertDescription>
                    Larry will tailor this study to <strong>{user.denomination}</strong> theology
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={generateStudy}
                disabled={isGenerating || !topic.trim()}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Larry is creating your study...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Study with Larry
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Larry's AI Enhancement Tools */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800" data-print-hidden>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  Larry's AI Tools
                </CardTitle>
                <CardDescription>
                  Enhance your study with AI-powered insights and suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={generateAISummary}
                    disabled={isEnhancing}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {isEnhancing && enhancementType === 'summary' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Lightbulb className="w-5 h-5 text-yellow-600" />
                    )}
                    <span className="font-medium">Generate Summary</span>
                    <span className="text-xs text-gray-600">Key takeaways</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={suggestRelatedScriptures}
                    disabled={isEnhancing}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {isEnhancing && enhancementType === 'scriptures' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-green-600" />
                    )}
                    <span className="font-medium">Related Scriptures</span>
                    <span className="text-xs text-gray-600">Expand study</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={suggestRelatedStudies}
                    disabled={isEnhancing}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {isEnhancing && enhancementType === 'studies' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Link2 className="w-5 h-5 text-purple-600" />
                    )}
                    <span className="font-medium">Related Studies</span>
                    <span className="text-xs text-gray-600">Next steps</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Suggestions Display */}
            {(aiSuggestions.summary || aiSuggestions.relatedScriptures.length > 0 || aiSuggestions.relatedStudies.length > 0) && (
              <div className="grid grid-cols-1 gap-6">
                {aiSuggestions.summary && (
                  <Card className="border-l-4 border-yellow-500">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-yellow-600" />
                        Larry's Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {aiSuggestions.summary}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {aiSuggestions.relatedScriptures.length > 0 && (
                  <Card className="border-l-4 border-green-500">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-green-600" />
                        Related Scriptures
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {aiSuggestions.relatedScriptures.map((verse, index) => (
                          <Badge key={index} variant="outline" className="text-sm">
                            {verse}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {aiSuggestions.relatedStudies.length > 0 && (
                  <Card className="border-l-4 border-purple-500">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-purple-600" />
                        Suggested Follow-up Studies
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {aiSuggestions.relatedStudies.map((study, index) => (
                          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h4 className="font-medium mb-1">{study.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{study.reason}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Study Guide Viewer with Enhancement Options */}
            <StudyGuideViewer
              studyData={generatedStudy}
              onSave={handleSave}
              user={user}
              onEnhanceQuestions={enhanceWithDiscussionQuestions}
              isEnhancing={isEnhancing}
              enhancementType={enhancementType}
            />

            <div className="flex gap-3" data-print-hidden>
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedStudy(null);
                  setAiSuggestions({ summary: null, relatedStudies: [], relatedScriptures: [] });
                }}
                className="flex-1"
              >
                Create New Study
              </Button>
              <RouterLink to={createPageUrl("MyStudies")} className="flex-1">
                <Button variant="outline" className="w-full">
                  View My Studies
                </Button>
              </RouterLink>
            </div>
          </div>
        )}
        <StudyPlanGenerator
          open={showPlanGenerator}
          onClose={() => setShowPlanGenerator(false)}
          user={user}
        />
        <MultiPerspectiveStudy
          open={showMultiPerspective}
          onClose={() => setShowMultiPerspective(false)}
          user={user}
        />
      </div>
    </div>
  );
}
