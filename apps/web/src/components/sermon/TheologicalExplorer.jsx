import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Loader2, 
  Lightbulb,
  MessageSquare,
  Scale,
  Users,
  History,
  GraduationCap,
  Copy,
  Check
} from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { formatUserInputBlock } from '@/lib/aiPrompt';

export default function TheologicalExplorer({ open, onClose, topic, passage, denomination }) {
  const [activeTab, setActiveTab] = useState("concepts");
  const [isLoading, setIsLoading] = useState(false);
  const [explorationData, setExplorationData] = useState(null);
  const [copied, setCopied] = useState(false);

  const exploreTheology = async () => {
    setIsLoading(true);
    setExplorationData(null);

    try {
      const prompt = `Larry, I need deep theological exploration for my sermon preparation!

${formatUserInputBlock('Topic', topic)}
${formatUserInputBlock('Scripture', passage)}
Denomination: ${denomination || 'Non-Denominational'}

Please provide comprehensive theological analysis:

1. RELATED THEOLOGICAL CONCEPTS (3-5 concepts):
   - List major theological concepts connected to this topic
   - Explain how each relates to the sermon
   - Include biblical foundations

2. DENOMINATIONAL COMPARATIVE ANALYSIS (6 traditions):
   Provide a detailed comparison of how these 6 major Christian traditions interpret this topic:
   - Roman Catholic
   - Eastern Orthodox
   - Lutheran
   - Baptist
   - Methodist/Wesleyan
   - Pentecostal/Charismatic
   
   For EACH tradition include:
   - Their specific theological interpretation
   - Key emphasis and distinctive approach
   - Biblical basis they prioritize
   
   Then provide:
   - SIMILARITIES: What do most traditions agree on?
   - DIFFERENCES: Where do they diverge and why?
   - The user's denomination (${denomination || 'Non-Denominational'}) perspective highlighted

3. COUNTER-ARGUMENTS & OBJECTIONS (3-4 arguments):
   - Common objections people raise
   - Difficult questions about this topic
   - How to address each thoughtfully
   - Scripture-based responses

4. HISTORICAL CONTEXT (2-3 points):
   - How this doctrine developed historically
   - Key church fathers or reformers who addressed it
   - Important historical debates
   - Modern applications

5. PRACTICAL IMPLICATIONS (3-4 implications):
   - How this theology affects daily Christian life
   - Contemporary applications
   - Common misunderstandings
   - Pastoral wisdom

Make this scholarly but accessible. Include scripture references throughout.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'exegesis',
        response_json_schema: {
          type: "object",
          properties: {
            related_concepts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  concept: { type: "string" },
                  explanation: { type: "string" },
                  scriptures: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            denominational_perspectives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tradition: { type: "string" },
                  view: { type: "string" },
                  emphasis: { type: "string" },
                  biblical_basis: { type: "string" }
                }
              }
            },
            comparative_summary: {
              type: "object",
              properties: {
                similarities: {
                  type: "array",
                  items: { type: "string" }
                },
                differences: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      area: { type: "string" },
                      description: { type: "string" }
                    }
                  }
                }
              }
            },
            counter_arguments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objection: { type: "string" },
                  response: { type: "string" },
                  scripture_support: { type: "string" }
                }
              }
            },
            historical_context: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  period: { type: "string" },
                  development: { type: "string" },
                  key_figures: { type: "string" }
                }
              }
            },
            practical_implications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  application: { type: "string" },
                  warning: { type: "string" }
                }
              }
            }
          }
        }
      });

      setExplorationData(response);
      toast.success("Larry explored the theology! 🎓");
    } catch (error) {
      console.error("Error exploring theology:", error);
      toast.error(`Failed to explore theology: ${error?.message || 'Unknown error'}`);
    } finally {
      if (!explorationData) {
        setIsLoading(false);
      }
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            Theological Exploration
          </DialogTitle>
          <DialogDescription>
            Deep theological analysis with Larry for {topic}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!explorationData && !isLoading && (
            <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <GraduationCap className="w-16 h-16 mx-auto text-indigo-600" />
                  <h3 className="text-xl font-semibold">Ready to Explore?</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Larry will provide comprehensive theological analysis including:
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm text-left mt-4">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <span>Related Concepts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>Denominational Views</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      <span>Counter-Arguments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-600" />
                      <span>Historical Context</span>
                    </div>
                  </div>
                  <Button
                    onClick={exploreTheology}
                    className="mt-6"
                    size="lg"
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Start Exploration
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-indigo-600 mb-4" />
              <p className="text-lg font-medium">Larry is diving deep into theology...</p>
              <p className="text-sm text-gray-600 mt-2">This may take 30-60 seconds</p>
            </div>
          )}

          {explorationData && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="concepts" className="text-xs">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Concepts
                </TabsTrigger>
                <TabsTrigger value="perspectives" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Views
                </TabsTrigger>
                <TabsTrigger value="arguments" className="text-xs">
                  <Scale className="w-3 h-3 mr-1" />
                  Arguments
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  <History className="w-3 h-3 mr-1" />
                  History
                </TabsTrigger>
                <TabsTrigger value="practical" className="text-xs">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Practical
                </TabsTrigger>
              </TabsList>

              {/* Related Concepts */}
              <TabsContent value="concepts" className="space-y-4">
                <Alert>
                  <Lightbulb className="w-4 h-4" />
                  <AlertDescription>
                    Key theological concepts connected to your sermon topic
                  </AlertDescription>
                </Alert>
                {explorationData.related_concepts?.map((concept, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{concept.concept}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(concept.explanation)}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-gray-700 dark:text-gray-300">{concept.explanation}</p>
                      {concept.scriptures && concept.scriptures.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm font-medium text-gray-600">Scriptures:</span>
                          {concept.scriptures.map((scripture, sIndex) => (
                            <Badge key={sIndex} variant="outline">
                              <BookOpen className="w-3 h-3 mr-1" />
                              {scripture}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Denominational Perspectives */}
              <TabsContent value="perspectives" className="space-y-4">
                <Alert>
                  <Users className="w-4 h-4" />
                  <AlertDescription>
                    Comparative analysis of how 6 major Christian traditions interpret this topic
                  </AlertDescription>
                </Alert>

                {/* Comparative Summary */}
                {explorationData.comparative_summary && (
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Scale className="w-5 h-5 text-blue-600" />
                        Comparative Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Similarities */}
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                          ✓ Common Ground (What Most Traditions Agree On)
                        </h4>
                        <ul className="space-y-2">
                          {explorationData.comparative_summary.similarities?.map((sim, index) => (
                            <li key={index} className="flex items-start gap-2 text-green-800 dark:text-green-200">
                              <span className="text-green-600 mt-1">•</span>
                              <span>{sim}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Differences */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                          ⚖️ Key Differences (Where Traditions Diverge)
                        </h4>
                        <div className="space-y-3">
                          {explorationData.comparative_summary.differences?.map((diff, index) => (
                            <div key={index} className="border-l-2 border-amber-400 pl-3">
                              <span className="font-medium text-amber-900 dark:text-amber-100">{diff.area}:</span>
                              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{diff.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Individual Denomination Cards */}
                <h3 className="text-lg font-semibold mt-6 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Individual Tradition Views
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {explorationData.denominational_perspectives?.map((perspective, index) => {
                    const isUserDenom = denomination && perspective.tradition.toLowerCase().includes(denomination.toLowerCase());
                    return (
                      <Card key={index} className={isUserDenom ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : ''}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Users className="w-4 h-4 text-blue-600" />
                              {perspective.tradition}
                              {isUserDenom && (
                                <Badge className="bg-indigo-600 text-xs">Your Tradition</Badge>
                              )}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(`${perspective.tradition}: ${perspective.view}`)}
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Interpretation:</span>
                            <p className="mt-1 text-gray-600 dark:text-gray-400">{perspective.view}</p>
                          </div>
                          {perspective.emphasis && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                              <span className="font-semibold text-purple-900 dark:text-purple-100 text-xs">Key Emphasis:</span>
                              <p className="text-purple-800 dark:text-purple-200 text-xs mt-1">{perspective.emphasis}</p>
                            </div>
                          )}
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            <span className="font-semibold text-blue-900 dark:text-blue-100 text-xs flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              Biblical Basis:
                            </span>
                            <p className="text-blue-800 dark:text-blue-200 text-xs mt-1">{perspective.biblical_basis}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Counter-Arguments */}
              <TabsContent value="arguments" className="space-y-4">
                <Alert>
                  <Scale className="w-4 h-4" />
                  <AlertDescription>
                    Common objections and how to address them biblically
                  </AlertDescription>
                </Alert>
                {explorationData.counter_arguments?.map((argument, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-orange-600" />
                        Objection #{index + 1}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                        <span className="font-semibold text-orange-900 dark:text-orange-100">The Objection:</span>
                        <p className="mt-1 text-orange-800 dark:text-orange-200">{argument.objection}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <span className="font-semibold text-green-900 dark:text-green-100">Your Response:</span>
                        <p className="mt-1 text-green-800 dark:text-green-200">{argument.response}</p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                        <span className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          Scripture Support:
                        </span>
                        <p className="mt-1 text-purple-800 dark:text-purple-200">{argument.scripture_support}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(`Objection: ${argument.objection}\n\nResponse: ${argument.response}\n\nScripture: ${argument.scripture_support}`)}
                      >
                        <Copy className="w-3 h-3 mr-2" />
                        Copy Full Response
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Historical Context */}
              <TabsContent value="history" className="space-y-4">
                <Alert>
                  <History className="w-4 h-4" />
                  <AlertDescription>
                    How this doctrine developed throughout church history
                  </AlertDescription>
                </Alert>
                {explorationData.historical_context?.map((context, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <History className="w-5 h-5 text-purple-600" />
                        {context.period}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Development:</span>
                        <p className="mt-1 text-gray-700 dark:text-gray-300">{context.development}</p>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                        <span className="font-semibold text-indigo-900 dark:text-indigo-100">Key Figures:</span>
                        <p className="mt-1 text-indigo-800 dark:text-indigo-200">{context.key_figures}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Practical Implications */}
              <TabsContent value="practical" className="space-y-4">
                <Alert>
                  <MessageSquare className="w-4 h-4" />
                  <AlertDescription>
                    How this theology impacts daily Christian living
                  </AlertDescription>
                </Alert>
                {explorationData.practical_implications?.map((implication, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">{implication.area}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <span className="font-semibold text-green-900 dark:text-green-100">Application:</span>
                        <p className="mt-1 text-green-800 dark:text-green-200">{implication.application}</p>
                      </div>
                      {implication.warning && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border-l-4 border-amber-500">
                          <span className="font-semibold text-amber-900 dark:text-amber-100">⚠️ Important Note:</span>
                          <p className="mt-1 text-amber-800 dark:text-amber-200">{implication.warning}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {explorationData && (
            <Button variant="outline" onClick={() => setExplorationData(null)}>
              Explore Again
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}