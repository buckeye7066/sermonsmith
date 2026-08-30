import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { formatUserInputBlock } from '@/lib/aiPrompt';
import { toast } from "sonner";

export default function AIExplanation({ open, onClose, verse, user }) {
  const [explanation, setExplanation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (open && verse && !explanation) {
      generateExplanation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, verse]);

  const generateExplanation = async () => {
    setIsLoading(true);
    try {
      const userDenomination = user && typeof user.denomination === 'string' ? user.denomination : "general Christian";
      const preachingStyle = user && typeof user.preaching_style === 'string' ? user.preaching_style : "balanced";
      const ministryFocus = user && Array.isArray(user.ministry_focus) ? user.ministry_focus : [];
      const audience = user && typeof user.primary_audience === 'string' ? user.primary_audience : "general";
      
      const focusContext = ministryFocus.length > 0
        ? `\n\n${formatUserInputBlock('Ministry focus', ministryFocus.join(', '))}`
        : "";

      const prompt = `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

Provide a clear, insightful explanation of this Bible verse from a ${userDenomination} perspective, using a ${preachingStyle} teaching style${focusContext ? ' with focus on the fenced ministry areas below' : ''}:

"${verse.text}"
- ${verse.book_name} ${verse.chapter}:${verse.verse}${focusContext}

Tailor this explanation for: ${audience}

Include:
1. **Historical Context**: What was happening when this was written?
2. **Meaning**: What does this verse mean in its original context?
3. **Application**: How can this apply to daily life today? Make this practical for ${audience}.
4. **Key Insights**: Important theological or spiritual insights from a ${userDenomination} viewpoint
5. **Cross References**: Brief mention of related verses

Keep it accessible, encouraging, and practical in a ${preachingStyle} tone. About 250-300 words.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'reader_insight',
        response_json_schema: {
          type: "object",
          properties: {
            historical_context: { type: "string" },
            meaning: { type: "string" },
            application: { type: "string" },
            key_insights: { type: "string" },
            cross_references: { type: "string" }
          }
        }
      });

      setExplanation(response);
    } catch (error) {
      console.error("Error generating explanation:", error);
      toast.error("Failed to generate explanation. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setExplanation(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Scripture Explanation
          </DialogTitle>
          <DialogDescription>
            {verse?.book_name} {verse?.chapter}:{verse?.verse}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
            <p className="mt-4 text-gray-600">Generating explanation...</p>
          </div>
        ) : explanation ? (
          <div className="space-y-4">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <CardContent className="pt-6">
                <p className="text-lg italic text-gray-800 dark:text-gray-200">
                  "{verse.text}"
                </p>
                <p className="text-right text-blue-600 font-semibold mt-2">
                  - {verse.book_name} {verse.chapter}:{verse.verse}
                </p>
              </CardContent>
            </Card>

            <div>
              <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                📜 Historical Context
              </h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {explanation.historical_context}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                💡 Meaning
              </h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {explanation.meaning}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                🎯 Application
              </h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {explanation.application}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                ✨ Key Insights
              </h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {explanation.key_insights}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                🔗 Cross References
              </h4>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {explanation.cross_references}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}