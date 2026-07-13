import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Link2, RefreshCw } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";

export default function CrossReferencePanel({ open, onClose, verse, onNavigate }) {
  const [crossRefs, setCrossRefs] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (open && verse && !crossRefs) {
      generateCrossReferences();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, verse]);

  const generateCrossReferences = async () => {
    setIsLoading(true);

    try {
      const prompt = `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

Analyze this Bible verse and find comprehensive cross-references and thematic connections:

Verse: ${verse.book_name} ${verse.chapter}:${verse.verse}
Text: "${verse.text}"

Provide:

1. DIRECT CROSS-REFERENCES (4-5 verses): same event/teaching, parallel passages, OT references quoted, prophecies fulfilled.
2. THEMATIC CONNECTIONS (4-5 verses): same theological theme, similar application, complementary or contrasting teaching.
3. CONTEXTUAL PASSAGES (2-3 verses): verses immediately before/after or key verses in the same chapter/book.
4. PRACTICAL CONNECTIONS (2-3 verses): other verses applying this same truth, or character examples living it out.

For each reference provide: scripture reference, text_snippet (the ACTUAL opening words of that verse, under 15 words — never leave it empty), why it connects (one short sentence), and the type of connection. Be concise — this must fit in a single response. Make it useful for Bible study and sermon prep!`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'reader_insight',
        // This is a multi-section structured output; without an explicit budget
        // it hit the 1500-token default and truncated ("response too long"),
        // failing with an empty modal. Give it room to finish.
        max_tokens: 4096,
        response_json_schema: {
          type: "object",
          properties: {
            direct_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  text_snippet: { type: "string" },
                  connection: { type: "string" },
                  type: { type: "string" }
                }
              }
            },
            thematic_connections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  text_snippet: { type: "string" },
                  connection: { type: "string" },
                  theme: { type: "string" }
                }
              }
            },
            contextual_passages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  text_snippet: { type: "string" },
                  connection: { type: "string" }
                }
              }
            },
            practical_connections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  text_snippet: { type: "string" },
                  connection: { type: "string" }
                }
              }
            }
          }
        }
      });

      setCrossRefs(response);
    } catch (error) {
      console.error('Error generating cross-references:', error);
      toast.error("Failed to generate cross-references");
    } finally {
      setIsLoading(false);
    }
  };

  const parseReference = (ref) => {
    // Parse "Genesis 1:1" into { book: "Genesis", chapter: 1, verse: 1 }
    const match = ref.match(/^(.+?)\s+(\d+):(\d+)/);
    if (match) {
      return {
        book: match[1],
        chapter: parseInt(match[2]),
        verse: parseInt(match[3])
      };
    }
    return null;
  };

  const handleNavigate = (reference) => {
    const parsed = parseReference(reference);
    if (parsed && onNavigate) {
      onNavigate(parsed.book, parsed.chapter, parsed.verse);
      onClose();
      // The reader jumps to a different book/chapter here — say so, or the
      // sudden context switch reads as a glitch.
      toast.success(`Opened ${reference}`);
    }
  };

  const handleRegenerate = () => {
    setCrossRefs(null);
    generateCrossReferences();
  };

  // Spread from the LLM response, whose schema field is snake_case
  // `text_snippet` — destructuring it as camelCase left the snippet
  // permanently undefined (rendered as an empty "" quote pair).
  const ReferenceCard = ({ reference, text_snippet: textSnippet, connection, type, theme }) => (
    <div
      className="p-3 bg-white dark:bg-gray-800 rounded-lg border hover:border-indigo-500 transition-colors cursor-pointer"
      onClick={() => handleNavigate(reference)}
      title={`Open ${reference} in the reader`}
    >
      <div className="flex items-start justify-between mb-2">
        <Badge variant="outline" className="font-mono text-xs">
          {reference}
        </Badge>
        {(type || theme) && (
          <Badge variant="secondary" className="text-xs">
            {type || theme}
          </Badge>
        )}
      </div>
      {/* The model occasionally returns an empty snippet; rendering "" as a
          bare pair of quotes looks broken, so skip the line entirely. */}
      {textSnippet?.trim() && (
        <p className="text-sm italic text-gray-600 dark:text-gray-400 mb-2">
          "{textSnippet}"
        </p>
      )}
      <p className="text-xs text-gray-500">
        💡 {connection}
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Cross-References & Connections
          </DialogTitle>
          <DialogDescription>
            AI-powered verse connections for {verse?.book_name} {verse?.chapter}:{verse?.verse}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI is analyzing connections...
            </p>
          </div>
        ) : crossRefs ? (
          <Tabs defaultValue="direct" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="direct">
                Direct ({crossRefs.direct_references?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="thematic">
                Thematic ({crossRefs.thematic_connections?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="contextual">
                Context ({crossRefs.contextual_passages?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="practical">
                Practical ({crossRefs.practical_connections?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="space-y-3 mt-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  📖 These verses directly reference the same event, teaching, or fulfill related prophecies
                </p>
              </div>
              {crossRefs.direct_references?.map((ref, index) => (
                <ReferenceCard key={index} {...ref} />
              ))}
            </TabsContent>

            <TabsContent value="thematic" className="space-y-3 mt-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-3">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  🎯 These verses share the same theological themes and spiritual truths
                </p>
              </div>
              {crossRefs.thematic_connections?.map((ref, index) => (
                <ReferenceCard key={index} {...ref} />
              ))}
            </TabsContent>

            <TabsContent value="contextual" className="space-y-3 mt-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-3">
                <p className="text-sm text-green-800 dark:text-green-200">
                  📚 These verses provide important context from the surrounding passage
                </p>
              </div>
              {crossRefs.contextual_passages?.map((ref, index) => (
                <ReferenceCard key={index} {...ref} />
              ))}
            </TabsContent>

            <TabsContent value="practical" className="space-y-3 mt-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg mb-3">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  ✨ These verses show practical application of the same truth
                </p>
              </div>
              {crossRefs.practical_connections?.map((ref, index) => (
                <ReferenceCard key={index} {...ref} />
              ))}
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleRegenerate} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
