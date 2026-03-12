import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Scale, X } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";

export default function ReligiousViewpointsDialog({ open, onClose, verse, user }) {
  const [viewpoints, setViewpoints] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && verse && !viewpoints) {
      generateViewpoints();
    }
  }, [open, verse]);

  const generateViewpoints = async () => {
    setIsLoading(true);
    
    try {
      const prompt = `Compare how different Christian denominations and theological traditions interpret this Bible verse:

${verse.book_name} ${verse.chapter}:${verse.verse}
"${verse.text}"

Provide interpretations from these perspectives:
1. **Catholic**: Traditional Catholic interpretation
2. **Protestant (Reformed)**: Reformed/Calvinist perspective
3. **Evangelical**: Modern evangelical interpretation
4. **Eastern Orthodox**: Orthodox Christian view
5. **Pentecostal/Charismatic**: Spirit-filled tradition perspective
6. **Liberal/Progressive**: Modern progressive Christian view

For each viewpoint, provide:
- Core interpretation (2-3 sentences)
- Key emphasis or unique insight
- How it affects practice/belief

Then add:
- **Common Ground**: What all traditions agree on
- **Key Differences**: Main theological distinctions

Be respectful, accurate, and balanced. About 400-500 words total.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            catholic: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                emphasis: { type: "string" },
                practice: { type: "string" }
              }
            },
            protestant_reformed: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                emphasis: { type: "string" },
                practice: { type: "string" }
              }
            },
            evangelical: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                emphasis: { type: "string" },
                practice: { type: "string" }
              }
            },
            eastern_orthodox: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                emphasis: { type: "string" },
                practice: { type: "string" }
              }
            },
            pentecostal: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                emphasis: { type: "string" },
                practice: { type: "string" }
              }
            },
            liberal_progressive: {
              type: "object",
              properties: {
                interpretation: { type: "string" },
                emphasis: { type: "string" },
                practice: { type: "string" }
              }
            },
            common_ground: { type: "string" },
            key_differences: { type: "string" }
          }
        }
      });

      setViewpoints(response);
    } catch (error) {
      console.error("Error generating viewpoints:", error);
      toast.error("Failed to generate religious viewpoints");
    } finally {
      setIsLoading(false);
    }
  };

  const traditions = [
    { key: 'catholic', label: 'Catholic', color: 'bg-yellow-50 border-yellow-200' },
    { key: 'protestant_reformed', label: 'Protestant (Reformed)', color: 'bg-blue-50 border-blue-200' },
    { key: 'evangelical', label: 'Evangelical', color: 'bg-green-50 border-green-200' },
    { key: 'eastern_orthodox', label: 'Eastern Orthodox', color: 'bg-purple-50 border-purple-200' },
    { key: 'pentecostal', label: 'Pentecostal/Charismatic', color: 'bg-red-50 border-red-200' },
    { key: 'liberal_progressive', label: 'Liberal/Progressive', color: 'bg-indigo-50 border-indigo-200' }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            Religious Viewpoints Comparison
          </DialogTitle>
        </DialogHeader>

        {verse && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription>
              <div className="font-semibold text-blue-900">
                {verse.book_name} {verse.chapter}:{verse.verse}
              </div>
              <div className="text-sm text-blue-800 mt-1 italic">
                "{verse.text}"
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3">Analyzing different theological perspectives...</span>
          </div>
        ) : viewpoints ? (
          <div className="space-y-4">
            {traditions.map((tradition) => {
              const data = viewpoints[tradition.key];
              if (!data) return null;
              
              return (
                <div key={tradition.key} className={`p-4 rounded-lg border-2 ${tradition.color}`}>
                  <h3 className="font-bold text-lg mb-2">{tradition.label}</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">Interpretation: </span>
                      {data.interpretation}
                    </div>
                    <div>
                      <span className="font-semibold">Key Emphasis: </span>
                      {data.emphasis}
                    </div>
                    <div>
                      <span className="font-semibold">Practice/Belief: </span>
                      {data.practice}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-4 border-t-2 space-y-4">
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <h3 className="font-bold text-lg mb-2 text-green-900">✅ Common Ground</h3>
                <p className="text-sm text-green-800">{viewpoints.common_ground}</p>
              </div>

              <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                <h3 className="font-bold text-lg mb-2 text-orange-900">🔍 Key Differences</h3>
                <p className="text-sm text-orange-800">{viewpoints.key_differences}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={generateViewpoints} disabled={isLoading}>
            Regenerate
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}