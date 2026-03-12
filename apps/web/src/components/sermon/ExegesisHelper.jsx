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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Loader2, 
  Languages,
  Users,
  Book,
  Lightbulb,
  Copy,
  Check,
  Search
} from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function ExegesisHelper({ open, onClose, initialPassage = "", denomination }) {
  const [passage, setPassage] = useState(initialPassage);
  const [isLoading, setIsLoading] = useState(false);
  const [exegesis, setExegesis] = useState(null);
  const [copied, setCopied] = useState(false);

  const performExegesis = async () => {
    if (!passage.trim()) {
      toast.error("Please enter a scripture passage");
      return;
    }

    setIsLoading(true);
    setExegesis(null);

    try {
      const prompt = `Larry, I need comprehensive biblical exegesis for sermon preparation!

Scripture Passage: ${passage}
Denomination: ${denomination || 'Non-Denominational'}

Provide deep exegetical analysis:

1. ORIGINAL LANGUAGE ANALYSIS:
   - Key Greek/Hebrew words and their meanings
   - Important grammatical structures
   - Nuances lost in translation
   - Word usage in other biblical contexts

2. HISTORICAL-CULTURAL CONTEXT:
   - When and why this was written
   - Original audience and their situation
   - Cultural practices referenced
   - Historical background

3. LITERARY CONTEXT:
   - What comes before and after this passage
   - How it fits in the book's structure
   - Literary genre and techniques
   - Author's purpose

4. THEOLOGICAL INTERPRETATION:
   - Main theological message
   - How it relates to broader biblical themes
   - ${denomination || 'Various denominational'} interpretation
   - Key doctrines illustrated

5. CROSS-REFERENCES:
   - 5-7 related scriptures
   - Old Testament connections (if NT passage)
   - New Testament fulfillment (if OT passage)
   - Parallel passages in other gospels/books

6. PRACTICAL APPLICATION:
   - What this meant to original audience
   - What it means for us today
   - Common misinterpretations to avoid
   - Preaching points

Be scholarly but accessible. Include specific examples.`;

      const response = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            passage_text: { type: "string" },
            original_language: {
              type: "object",
              properties: {
                key_words: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string" },
                      original: { type: "string" },
                      meaning: { type: "string" },
                      significance: { type: "string" }
                    }
                  }
                },
                grammar_notes: { type: "string" }
              }
            },
            historical_context: {
              type: "object",
              properties: {
                date_author: { type: "string" },
                audience: { type: "string" },
                cultural_background: { type: "string" },
                historical_situation: { type: "string" }
              }
            },
            literary_context: {
              type: "object",
              properties: {
                surrounding_text: { type: "string" },
                book_structure: { type: "string" },
                genre: { type: "string" },
                literary_devices: { type: "string" }
              }
            },
            theological_message: {
              type: "object",
              properties: {
                main_point: { type: "string" },
                broader_themes: { type: "string" },
                denominational_view: { type: "string" },
                key_doctrines: { type: "string" }
              }
            },
            cross_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  connection: { type: "string" }
                }
              }
            },
            application: {
              type: "object",
              properties: {
                original_meaning: { type: "string" },
                contemporary_meaning: { type: "string" },
                misinterpretations: { type: "string" },
                preaching_points: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      });

      setExegesis(response);
      toast.success("Larry completed the exegesis! 📖");
    } catch (error) {
      console.error("Error performing exegesis:", error);
      toast.error("Failed to perform exegesis");
    } finally {
      setIsLoading(false);
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
            <BookOpen className="w-6 h-6 text-blue-600" />
            Deep Exegesis with Larry
          </DialogTitle>
          <DialogDescription>
            Comprehensive biblical analysis for sermon preparation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Input Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Scripture Passage</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., John 3:16-17, Romans 8:28-39, Genesis 1:1-3"
                      value={passage}
                      onChange={(e) => setPassage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') performExegesis();
                      }}
                    />
                    <Button onClick={performExegesis} disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {!exegesis && !isLoading && (
                  <Alert>
                    <BookOpen className="w-4 h-4" />
                    <AlertDescription>
                      Larry will provide: Original language analysis • Historical context • Literary structure • Theological interpretation • Cross-references • Practical application
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-lg font-medium">Larry is analyzing the scripture...</p>
              <p className="text-sm text-gray-600 mt-2">This may take 30-60 seconds</p>
            </div>
          )}

          {exegesis && (
            <Tabs defaultValue="language">
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="language" className="text-xs">
                  <Languages className="w-3 h-3 mr-1" />
                  Language
                </TabsTrigger>
                <TabsTrigger value="historical" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  History
                </TabsTrigger>
                <TabsTrigger value="literary" className="text-xs">
                  <Book className="w-3 h-3 mr-1" />
                  Literary
                </TabsTrigger>
                <TabsTrigger value="theology" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  Theology
                </TabsTrigger>
                <TabsTrigger value="references" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  References
                </TabsTrigger>
                <TabsTrigger value="application" className="text-xs">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Apply
                </TabsTrigger>
              </TabsList>

              {/* Original Language */}
              <TabsContent value="language" className="space-y-4">
                <Alert>
                  <Languages className="w-4 h-4" />
                  <AlertDescription>
                    Original Greek/Hebrew word analysis and grammatical insights
                  </AlertDescription>
                </Alert>

                {exegesis.passage_text && (
                  <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="pt-4">
                      <p className="text-lg italic text-blue-900 dark:text-blue-100">{exegesis.passage_text}</p>
                    </CardContent>
                  </Card>
                )}

                {exegesis.original_language?.key_words?.map((word, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{word.word}</CardTitle>
                          <Badge variant="outline" className="mt-2">{word.original}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(`${word.word} (${word.original}): ${word.meaning}\n\n${word.significance}`)}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Meaning:</span>
                        <p className="text-gray-700 dark:text-gray-300">{word.meaning}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Significance:</span>
                        <p className="text-gray-700 dark:text-gray-300">{word.significance}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {exegesis.original_language?.grammar_notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Grammatical Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 dark:text-gray-300">{exegesis.original_language.grammar_notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Historical Context */}
              <TabsContent value="historical" className="space-y-4">
                <Alert>
                  <Users className="w-4 h-4" />
                  <AlertDescription>
                    When and why this was written, and what it meant to the original audience
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Date & Author</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.historical_context?.date_author}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Original Audience</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.historical_context?.audience}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cultural Background</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.historical_context?.cultural_background}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Historical Situation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.historical_context?.historical_situation}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Literary Context */}
              <TabsContent value="literary" className="space-y-4">
                <Alert>
                  <Book className="w-4 h-4" />
                  <AlertDescription>
                    How this passage fits within the broader text and literary structure
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Surrounding Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.literary_context?.surrounding_text}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Book Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.literary_context?.book_structure}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Genre & Literary Devices</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="font-semibold">Genre:</span>
                      <p className="text-gray-700 dark:text-gray-300">{exegesis.literary_context?.genre}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Literary Devices:</span>
                      <p className="text-gray-700 dark:text-gray-300">{exegesis.literary_context?.literary_devices}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Theological Interpretation */}
              <TabsContent value="theology" className="space-y-4">
                <Alert>
                  <BookOpen className="w-4 h-4" />
                  <AlertDescription>
                    What this passage teaches us about God, humanity, and salvation
                  </AlertDescription>
                </Alert>

                <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200">
                  <CardHeader>
                    <CardTitle>Main Theological Point</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium text-indigo-900 dark:text-indigo-100">
                      {exegesis.theological_message?.main_point}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Broader Biblical Themes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.theological_message?.broader_themes}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Denominational Interpretation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.theological_message?.denominational_view}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Key Doctrines Illustrated</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.theological_message?.key_doctrines}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cross References */}
              <TabsContent value="references" className="space-y-4">
                <Alert>
                  <BookOpen className="w-4 h-4" />
                  <AlertDescription>
                    Related scriptures that expand or illuminate this passage
                  </AlertDescription>
                </Alert>

                {exegesis.cross_references?.map((ref, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-purple-600" />
                          {ref.reference}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(`${ref.reference}: ${ref.connection}`)}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 dark:text-gray-300">{ref.connection}</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Application */}
              <TabsContent value="application" className="space-y-4">
                <Alert>
                  <Lightbulb className="w-4 h-4" />
                  <AlertDescription>
                    How to preach and apply this passage today
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Original Meaning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.application?.original_meaning}</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-900/20">
                  <CardHeader>
                    <CardTitle>Contemporary Application</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">{exegesis.application?.contemporary_meaning}</p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
                  <CardHeader>
                    <CardTitle>⚠️ Common Misinterpretations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-amber-900 dark:text-amber-100">{exegesis.application?.misinterpretations}</p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 dark:bg-blue-900/20">
                  <CardHeader>
                    <CardTitle>Preaching Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {exegesis.application?.preaching_points?.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">{index + 1}.</span>
                          <span className="text-gray-700 dark:text-gray-300">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {exegesis && (
            <Button
              variant="outline"
              onClick={() => {
                setExegesis(null);
                setPassage("");
              }}
            >
              New Exegesis
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}