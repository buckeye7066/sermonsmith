import React, { useState } from "react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { formatUserInputBlock } from '@/lib/aiPrompt';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  BookOpen,
  Loader2,
  Scale,
  Church,
  Eye,
  Layers,
  MessageSquare,
  Users
} from "lucide-react";
import { toast } from "sonner";

const CHRISTIAN_TRADITIONS = [
  { id: 'catholic', name: 'Roman Catholic', icon: '⛪', color: 'red' },
  { id: 'orthodox', name: 'Eastern Orthodox', icon: '☦️', color: 'gold' },
  { id: 'reformed', name: 'Reformed / Calvinist', icon: '📜', color: 'blue' },
  { id: 'wesleyan', name: 'Wesleyan / Methodist', icon: '🔥', color: 'green' },
  { id: 'pentecostal', name: 'Pentecostal / Charismatic', icon: '🕊️', color: 'purple' },
  { id: 'baptist', name: 'Baptist', icon: '💧', color: 'indigo' },
  { id: 'lutheran', name: 'Lutheran', icon: '⚡', color: 'amber' },
  { id: 'anglican', name: 'Anglican / Episcopal', icon: '🏰', color: 'teal' },
  { id: 'adventist', name: 'Seventh-day Adventist', icon: '📖', color: 'emerald' },
  { id: 'covenantal', name: 'Church of God / Holiness', icon: '✝️', color: 'rose' },
];

const WORLD_PERSPECTIVES = [
  { id: 'judaism', name: 'Jewish (Tanakh)', icon: '✡️' },
  { id: 'islam', name: 'Islamic (Quran)', icon: '☪️' },
  { id: 'academic', name: 'Academic / Historical-Critical', icon: '🎓' },
  { id: 'liberation', name: 'Liberation Theology', icon: '✊' },
  { id: 'feminist', name: 'Feminist Theology', icon: '♀️' },
  { id: 'black_theology', name: 'Black Theology', icon: '🌍' },
];

const perspectiveSchema = {
  type: "object",
  properties: {
    passage_context: {
      type: "object",
      properties: {
        original_language: { type: "string" },
        historical_setting: { type: "string" },
        literary_genre: { type: "string" },
        author_intent: { type: "string" }
      }
    },
    perspectives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tradition: { type: "string" },
          interpretation: { type: "string" },
          key_emphasis: { type: "string" },
          distinctive_insight: { type: "string" },
          practical_application: { type: "string" },
          notable_theologians: { type: "string" },
          potential_concerns: { type: "string" }
        }
      }
    },
    common_ground: {
      type: "array",
      items: { type: "string" }
    },
    key_disagreements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string" },
          viewpoints: { type: "string" }
        }
      }
    },
    study_questions: {
      type: "array",
      items: { type: "string" }
    },
    personal_reflection: { type: "string" }
  }
};

export default function MultiPerspectiveStudy({ open, onClose, user }) {
  const [passage, setPassage] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedPerspectives, setSelectedPerspectives] = useState(['reformed', 'wesleyan', 'catholic']);
  const [includeWorldViews, setIncludeWorldViews] = useState(false);
  const [selectedWorldViews, setSelectedWorldViews] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const togglePerspective = (id) => {
    setSelectedPerspectives(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleWorldView = (id) => {
    setSelectedWorldViews(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const generateMultiPerspective = async () => {
    if (!passage.trim() && !topic.trim()) {
      toast.error("Please enter a passage or topic");
      return;
    }
    if (selectedPerspectives.length < 2) {
      toast.error("Please select at least 2 perspectives");
      return;
    }

    setIsGenerating(true);

    try {
      const allPerspectives = [
        ...selectedPerspectives.map(id => CHRISTIAN_TRADITIONS.find(t => t.id === id)?.name).filter(t => t),
        ...(includeWorldViews ? selectedWorldViews.map(id => WORLD_PERSPECTIVES.find(w => w.id === id)?.name).filter(w => w) : [])
      ];

      const userDenom = user?.denomination || "Non-Denominational";

      const prompt = `You are Larry, a scholarly yet pastoral AI Bible study assistant who helps people understand Scripture from multiple interpretive traditions.

IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture.

${passage ? formatUserInputBlock('PASSAGE', passage) : ''}
${topic ? formatUserInputBlock('TOPIC', topic) : ''}

The user (${userDenom}) wants to understand how these traditions interpret this ${passage ? 'passage' : 'topic'}:
${allPerspectives.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Provide a comprehensive multi-perspective analysis:

1. PASSAGE CONTEXT:
   - Original language insights (Hebrew/Greek key words and their nuances)
   - Historical setting and audience
   - Literary genre and structure
   - Author's likely intent

2. PERSPECTIVES (for each selected tradition):
   - How this tradition interprets the passage/topic
   - What they uniquely emphasize
   - Their distinctive insight that others might miss
   - How they apply it practically
   - Notable theologians who've written on this
   - Potential concerns or blind spots of this view

3. COMMON GROUND: What all perspectives agree on

4. KEY DISAGREEMENTS: Where traditions diverge and why

5. STUDY QUESTIONS: 5-7 questions that help compare perspectives thoughtfully

6. PERSONAL REFLECTION: A brief pastoral note encouraging the reader to seek truth humbly

Be fair, accurate, and respectful to every tradition. Present each view charitably, as its adherents would recognize it. Do not caricature any position.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'multi_perspective_study',
        response_json_schema: perspectiveSchema
      });

      setResult(response);
      toast.success("Larry completed the multi-perspective analysis!");
    } catch (error) {
      console.error("Error generating perspectives:", error);
      toast.error(error.message || "Failed to generate analysis");
    } finally {
      setIsGenerating(false);
    }
  };

  

  const perspectiveColors = {
    'Roman Catholic': 'border-red-500 bg-red-50 dark:bg-red-900/20',
    'Eastern Orthodox': 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    'Reformed / Calvinist': 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    'Wesleyan / Methodist': 'border-green-500 bg-green-50 dark:bg-green-900/20',
    'Pentecostal / Charismatic': 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
    'Baptist': 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
    'Lutheran': 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
    'Anglican / Episcopal': 'border-teal-500 bg-teal-50 dark:bg-teal-900/20',
    'Seventh-day Adventist': 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
    'Church of God / Holiness': 'border-rose-500 bg-rose-50 dark:bg-rose-900/20',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-6 h-6 text-indigo-600" />
            Multi-Perspective Bible Study
          </DialogTitle>
          <DialogDescription>
            Larry helps you see Scripture through different theological lenses
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <CardContent className="pt-6">
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Understanding how different traditions read the same passage deepens your own understanding
                  and prepares you for meaningful dialogue. Larry presents each view charitably and accurately.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Scripture Passage</label>
                <Input
                  placeholder="e.g., John 6:53-58, Romans 9:1-23"
                  value={passage}
                  onChange={(e) => setPassage(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Or Topic / Doctrine</label>
                <Input
                  placeholder="e.g., Baptism, Predestination, Eucharist"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Church className="w-4 h-4" />
                Christian Traditions (select 2+)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {CHRISTIAN_TRADITIONS.map((tradition) => (
                  <Button
                    key={tradition.id}
                    variant={selectedPerspectives.includes(tradition.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePerspective(tradition.id)}
                    className="h-auto py-2 text-xs justify-start"
                  >
                    <span className="mr-1">{tradition.icon}</span>
                    {tradition.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>Include World Perspectives</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIncludeWorldViews(!includeWorldViews)}
                  className="text-xs"
                >
                  {includeWorldViews ? 'Hide' : 'Show'}
                </Button>
              </label>
              {includeWorldViews && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {WORLD_PERSPECTIVES.map((wp) => (
                    <Button
                      key={wp.id}
                      variant={selectedWorldViews.includes(wp.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleWorldView(wp.id)}
                      className="h-auto py-2 text-xs justify-start"
                    >
                      <span className="mr-1">{wp.icon}</span>
                      {wp.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={generateMultiPerspective}
              disabled={isGenerating || (!passage.trim() && !topic.trim()) || selectedPerspectives.length < 2}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Larry is analyzing perspectives...
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  Generate Multi-Perspective Study
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Passage Context */}
            {result.passage_context && (
              <Card className="border-l-4 border-indigo-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    Passage Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.passage_context.original_language && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <h4 className="font-semibold text-sm mb-1">Original Language</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{result.passage_context.original_language}</p>
                    </div>
                  )}
                  {result.passage_context.historical_setting && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <h4 className="font-semibold text-sm mb-1">Historical Setting</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{result.passage_context.historical_setting}</p>
                    </div>
                  )}
                  {result.passage_context.literary_genre && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <h4 className="font-semibold text-sm mb-1">Literary Genre</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{result.passage_context.literary_genre}</p>
                    </div>
                  )}
                  {result.passage_context.author_intent && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <h4 className="font-semibold text-sm mb-1">Author's Intent</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{result.passage_context.author_intent}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Perspectives */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Interpretive Perspectives
              </h3>

              {result.perspectives?.map((perspective, index) => {
                const colorClass = perspectiveColors[perspective.tradition] || 'border-gray-500 bg-gray-50 dark:bg-gray-800';
                return (
                  <Card key={index} className={`border-l-4 ${colorClass}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{perspective.tradition}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Interpretation</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{perspective.interpretation}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-white/50 dark:bg-gray-900/50 rounded">
                          <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400 mb-1">Key Emphasis</h4>
                          <p className="text-sm">{perspective.key_emphasis}</p>
                        </div>
                        <div className="p-3 bg-white/50 dark:bg-gray-900/50 rounded">
                          <h4 className="font-semibold text-xs text-gray-600 dark:text-gray-400 mb-1">Distinctive Insight</h4>
                          <p className="text-sm">{perspective.distinctive_insight}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Practical Application</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{perspective.practical_application}</p>
                      </div>
                      {perspective.notable_theologians && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Notable voices: {perspective.notable_theologians}
                        </div>
                      )}
                      {perspective.potential_concerns && (
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-200">
                          Potential concerns: {perspective.potential_concerns}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Common Ground */}
            {result.common_ground?.length > 0 && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-300">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    Common Ground
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.common_ground.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-600">+</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Key Disagreements */}
            {result.key_disagreements?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Scale className="w-5 h-5 text-amber-600" />
                    Key Disagreements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    {result.key_disagreements.map((item, i) => (
                      <AccordionItem key={i} value={`d-${i}`}>
                        <AccordionTrigger className="text-sm font-medium">
                          {item.issue}
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{item.viewpoints}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {/* Study Questions */}
            {result.study_questions?.length > 0 && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    Discussion Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 list-decimal list-inside">
                    {result.study_questions.map((q, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{q}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Personal Reflection */}
            {result.personal_reflection && (
              <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-300">
                <CardContent className="pt-6">
                  <p className="text-sm text-purple-800 dark:text-purple-200 italic leading-relaxed">
                    {result.personal_reflection}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setResult(null)} className="flex-1">
                New Study
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
