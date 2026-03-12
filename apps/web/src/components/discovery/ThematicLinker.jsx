
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, BookOpen, FileText, TrendingUp, Link2, Calendar } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ThematicLinker({ 
  sourceType = 'verse', // 'verse', 'sermon', or 'plan'
  sourceData,
  user 
}) {
  const [relatedContent, setRelatedContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (sourceData) {
      findRelatedContent();
    }
  }, [sourceData]);

  const findRelatedContent = async () => {
    setIsLoading(true);

    try {
      let prompt = '';
      
      if (sourceType === 'verse') {
        prompt = `Analyze this Bible verse and identify its core themes and theological concepts:

Verse: ${sourceData.book_name} ${sourceData.chapter}:${sourceData.verse}
Text: "${sourceData.text}"

Identify:
1. PRIMARY THEMES (3-5): Main theological/spiritual themes in this verse
2. SERMON TOPICS (5-8): What sermon topics would naturally explore this verse?
3. LIFE APPLICATIONS (3-5): What practical life situations relate to this verse?
4. RELATED PASSAGES (3-5): Other verses that share these themes

Make connections that help someone discover related sermons and deepen their study.`;

      } else if (sourceType === 'sermon') {
        prompt = `Analyze this sermon and identify its themes for content discovery:

Sermon: "${sourceData.title}"
Topic: ${sourceData.topic}
Anchor Passage: ${sourceData.anchor_passage || sourceData.big_idea}
${sourceData.big_idea ? `Big Idea: ${sourceData.big_idea}` : ''}
${sourceData.points ? `Main Points: ${sourceData.points.map(p => p.title).join(', ')}` : ''}

Identify:
1. PRIMARY THEMES (3-5): Core theological themes
2. RELATED SERMON TOPICS (5-8): Connected topics
3. KEY VERSES (5-10): Bible verses that connect to this sermon
4. LIFE STAGES (2-4): When this sermon is especially relevant
5. STUDY PLAN TOPICS (3-5): What study plans would complement this sermon

Help users discover related content naturally.`;

      } else if (sourceType === 'plan') {
        prompt = `Analyze this Bible study plan and identify themes for discovery:

Plan: "${sourceData.name}"
Description: ${sourceData.description}
Duration: ${sourceData.duration_days} days
Age Group: ${sourceData.age_group || 'general'}

Identify:
1. PRIMARY THEMES (3-5): Core spiritual growth areas
2. RELATED SERMON TOPICS (5-8): Sermons that complement this plan
3. KEY VERSES (5-10): Verses that embody this plan's themes
4. RELATED PLAN TOPICS (3-5): Other study plan ideas that connect
5. LIFE APPLICATIONS (3-5): When someone needs this plan

Help users discover sermons and verses that deepen this study.`;
      }

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            primary_themes: { type: "array", items: { type: "string" } },
            sermon_topics: { type: "array", items: { type: "string" } },
            life_applications: { type: "array", items: { type: "string" } },
            related_passages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  connection: { type: "string" }
                }
              }
            },
            key_verses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  relevance: { type: "string" }
                }
              }
            },
            life_stages: { type: "array", items: { type: "string" } },
            study_plan_topics: { type: "array", items: { type: "string" } },
            related_plan_topics: { type: "array", items: { type: "string" } }
          }
        }
      });

      const themes = response.primary_themes || [];
      const topics = response.sermon_topics || [];
      
      // Fetch related sermons
      let relatedSermons = [];
      let relatedPlans = [];
      
      if (user) {
        try {
          const sharedSermons = await api.entities.SharedSermon.list('-views_count', 50);
          
          const filterPrompt = `Given these themes: ${themes.join(', ')}
And topics: ${topics.join(', ')}

From this list, identify the top 5 most relevant sermon titles:
${sharedSermons.slice(0, 20).map((s, i) => `${i+1}. "${s.title}" - ${s.topic}`).join('\n')}

Return indices (1-based) of the 5 most relevant.`;

          const relevantIndices = await api.integrations.Core.InvokeLLM({
            system_prompt: LARRY_SYSTEM_PROMPT,
            prompt: filterPrompt,
            response_json_schema: {
              type: "object",
              properties: { indices: { type: "array", items: { type: "number" } } }
            }
          });

          relatedSermons = relevantIndices.indices
            .map(idx => sharedSermons[idx - 1])
            .filter(Boolean)
            .slice(0, 5);

          // Fetch related plans if applicable
          if (sourceType !== 'plan') { // Only suggest plans if the source is not already a plan
            const publicPlans = await api.entities.ReadingPlan.filter(
              { is_public: true },
              '-followers_count',
              20
            );

            if (publicPlans.length > 0) {
              const planFilterPrompt = `Given these themes: ${themes.join(', ')}
And these related plan topics: ${response.related_plan_topics?.join(', ') || ''}

From these study plans, identify the top 3 most relevant:
${publicPlans.slice(0, 10).map((p, i) => `${i+1}. "${p.name}" - ${p.description?.substring(0, 100) || ''}`).join('\n')}

Return indices (1-based).`;

              const planIndices = await api.integrations.Core.InvokeLLM({
                system_prompt: LARRY_SYSTEM_PROMPT,
                prompt: planFilterPrompt,
                response_json_schema: {
                  type: "object",
                  properties: { indices: { type: "array", items: { type: "number" } } }
                }
              });

              relatedPlans = planIndices.indices
                .map(idx => publicPlans[idx - 1])
                .filter(Boolean)
                .slice(0, 3);
            }
          }
            
        } catch (error) {
          console.error('Error fetching related content:', error);
        }
      }

      setRelatedContent({
        ...response,
        relatedSermons,
        relatedPlans
      });

    } catch (error) {
      console.error('Error finding related content:', error);
      toast.error("Failed to find related content");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerseClick = (reference) => {
    const match = reference.match(/^(.+?)\s+(\d+):(\d+)/);
    if (match) {
      navigate(`${createPageUrl('Reader')}?book=${encodeURIComponent(match[1])}&chapter=${match[2]}&verse=${match[3]}`);
    }
  };

  const handleSermonClick = (sermonId) => {
    navigate(`${createPageUrl('SermonLibrary')}?sermon=${sermonId}`);
  };

  const handlePlanClick = (planId) => {
    navigate(`${createPageUrl('PlanLibrary')}?plan=${planId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            AI is finding related content...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!relatedContent) return null;

  const hasSermons = relatedContent.relatedSermons?.length > 0;
  const hasPlans = relatedContent.relatedPlans?.length > 0;
  const hasVerses = (relatedContent.related_passages?.length || 0) + (relatedContent.key_verses?.length || 0) > 0;

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Discover Related Content
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          AI-powered thematic connections to deepen your study
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="themes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="sermons">
              Sermons ({relatedContent.relatedSermons?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="plans">
              Plans ({relatedContent.relatedPlans?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="verses">
              Verses ({(relatedContent.related_passages?.length || 0) + (relatedContent.key_verses?.length || 0)})
            </TabsTrigger>
          </TabsList>

          {/* Themes Tab */}
          <TabsContent value="themes" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Primary Themes
              </h4>
              <div className="flex flex-wrap gap-2">
                {relatedContent.primary_themes?.map((theme, index) => (
                  <Badge key={index} className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Sermon Topics</h4>
              <div className="flex flex-wrap gap-2">
                {relatedContent.sermon_topics?.map((topic, index) => (
                  <Badge key={index} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            {relatedContent.life_applications && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Life Applications</h4>
                <div className="space-y-1">
                  {relatedContent.life_applications.map((app, index) => (
                    <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <span className="text-green-600">•</span>
                      {app}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {relatedContent.life_stages && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Especially Relevant For</h4>
                <div className="flex flex-wrap gap-2">
                  {relatedContent.life_stages.map((stage, index) => (
                    <Badge key={index} variant="secondary">
                      {stage}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {relatedContent.study_plan_topics && relatedContent.study_plan_topics.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Study Plan Ideas</h4>
                <div className="flex flex-wrap gap-2">
                  {relatedContent.study_plan_topics.map((topic, index) => (
                    <Badge key={index} variant="outline" className="bg-purple-50 dark:bg-purple-900/20">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Sermons Tab */}
          <TabsContent value="sermons" className="space-y-3 mt-4">
            {!hasSermons ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No related sermons found yet.</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    🎯 These sermons explore similar themes and could deepen your understanding
                  </p>
                </div>
                {relatedContent.relatedSermons?.map((sermon, index) => (
                  <Card 
                    key={sermon.id}
                    className="cursor-pointer hover:border-indigo-500 transition-colors"
                    onClick={() => handleSermonClick(sermon.id)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{sermon.title}</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            by {sermon.user_name}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs">{sermon.topic}</Badge>
                            {sermon.anchor_passage && (
                              <Badge variant="outline" className="text-xs">
                                {sermon.anchor_passage}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Link2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-3 mt-4">
            {!hasPlans ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No related study plans found yet.</p>
              </div>
            ) : (
              <>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-3">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    📚 These study plans dive deeper into related themes
                  </p>
                </div>
                {relatedContent.relatedPlans?.map((plan, index) => (
                  <Card 
                    key={plan.id}
                    className="cursor-pointer hover:border-purple-500 transition-colors"
                    onClick={() => handlePlanClick(plan.id)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{plan.name}</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            by {plan.creator_name}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs">
                              {plan.duration_days} days
                            </Badge>
                            {plan.age_group && (
                              <Badge variant="secondary" className="text-xs">
                                {plan.age_group}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* Verses Tab */}
          <TabsContent value="verses" className="space-y-3 mt-4">
            {!hasVerses ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No related verses found.</p>
              </div>
            ) : (
              <>
                {relatedContent.related_passages && relatedContent.related_passages.length > 0 && (
                  <>
                    <h4 className="font-semibold text-sm mb-2">Related Passages</h4>
                    {relatedContent.related_passages.map((passage, index) => (
                      <Card 
                        key={index}
                        className="cursor-pointer hover:border-blue-500 transition-colors"
                        onClick={() => handleVerseClick(passage.reference)}
                      >
                        <CardContent className="pt-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Badge variant="outline" className="font-mono text-xs mb-2">
                                {passage.reference}
                              </Badge>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {passage.connection}
                              </p>
                            </div>
                            <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}

                {relatedContent.key_verses && relatedContent.key_verses.length > 0 && (
                  <>
                    <h4 className="font-semibold text-sm mb-2 mt-4">Key Verses to Explore</h4>
                    {relatedContent.key_verses.map((verse, index) => (
                      <Card 
                        key={index}
                        className="cursor-pointer hover:border-green-500 transition-colors"
                        onClick={() => handleVerseClick(verse.reference)}
                      >
                        <CardContent className="pt-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Badge variant="outline" className="font-mono text-xs mb-2">
                                {verse.reference}
                              </Badge>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {verse.relevance}
                              </p>
                            </div>
                            <BookOpen className="w-4 h-4 text-green-600 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={findRelatedContent}
            className="w-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Refresh Suggestions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
