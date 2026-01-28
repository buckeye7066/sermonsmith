import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitFork, Wand2, Copy, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const ADAPTATION_OPTIONS = [
  { 
    id: 'copy', 
    label: 'Copy As-Is', 
    description: 'Save exact copy to your library',
    icon: Copy
  },
  { 
    id: 'adapt_denomination', 
    label: 'Adapt to My Denomination', 
    description: 'AI adjusts theology and examples',
    icon: Wand2
  },
  { 
    id: 'adapt_audience', 
    label: 'Adapt for Different Audience', 
    description: 'Modify for youth, children, etc.',
    icon: Wand2
  },
  { 
    id: 'expand', 
    label: 'Expand & Deepen', 
    description: 'Add more exegesis and depth',
    icon: Sparkles
  },
  { 
    id: 'condense', 
    label: 'Condense', 
    description: 'Make it shorter for time constraints',
    icon: Sparkles
  }
];

export default function ForkSermonDialog({ open, onClose, sermon, user }) {
  const [forkType, setForkType] = useState('copy');
  const [adaptationNotes, setAdaptationNotes] = useState("");
  const [isForking, setIsForking] = useState(false);

  const handleFork = async () => {
    if (!user) {
      toast.error("Please log in to fork sermons");
      return;
    }

    setIsForking(true);

    try {
      let forkedSermon = {
        user_id: user.id,
        title: `${sermon.title} (Forked)`,
        topic: sermon.topic,
        anchor_passage: sermon.anchor_passage,
        big_idea: sermon.big_idea,
        points: sermon.points,
        status: "draft"
      };

      // AI-powered adaptations
      if (forkType !== 'copy') {
        const adaptationPrompt = {
          adapt_denomination: `Adapt this sermon from ${sermon.denomination || 'Non-Denominational'} perspective to ${user.denomination || 'Non-Denominational'} theology.

Original Sermon:
Title: ${sermon.title}
Big Idea: ${sermon.big_idea}
Points: ${sermon.points?.map((p, i) => `${i+1}. ${p.title}`).join('\n')}

Adjust theological language, examples, and doctrinal emphasis while maintaining the core biblical message.`,

          adapt_audience: `Adapt this sermon for a different audience.

Original: ${sermon.title}
User's note: ${adaptationNotes || 'Modify for my specific congregation'}

Change illustrations, language complexity, and applications while keeping the biblical truth intact.`,

          expand: `Expand and deepen this sermon outline.

Original: ${sermon.title}
Points: ${sermon.points?.length || 0}

Add more exegesis, additional supporting scriptures, deeper theological insights, and more illustrations. Make it richer for teaching-style delivery.`,

          condense: `Condense this sermon for shorter delivery.

Original: ${sermon.title} (currently has ${sermon.points?.length || 0} points)

Keep the most crucial points, tighten illustrations, focus on core message. Make it punchier for 15-20 minute delivery.`
        };

        if (adaptationPrompt[forkType]) {
          const response = await base44.integrations.Core.InvokeLLM({
            prompt: adaptationPrompt[forkType],
            response_json_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                big_idea: { type: "string" },
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
                }
              }
            }
          });

          forkedSermon = {
            ...forkedSermon,
            title: response.title,
            big_idea: response.big_idea,
            points: response.points
          };
        }
      }

      // Save forked sermon
      await base44.entities.Sermon.create(forkedSermon);

      // Update fork count
      await base44.entities.SharedSermon.update(sermon.id, {
        forks_count: (sermon.forks_count || 0) + 1
      });

      toast.success("Sermon forked successfully! 🎉");
      onClose();
    } catch (error) {
      console.error('Error forking sermon:', error);
      toast.error("Failed to fork sermon");
    } finally {
      setIsForking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-green-500" />
            Fork & Adapt Sermon
          </DialogTitle>
          <DialogDescription>
            Create your own version of "{sermon.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Original by:</strong> {sermon.user_name}
                {sermon.denomination && ` • ${sermon.denomination}`}
              </p>
            </CardContent>
          </Card>

          <div>
            <Label className="mb-3 block text-base font-semibold">How would you like to adapt it?</Label>
            <RadioGroup value={forkType} onValueChange={setForkType}>
              <div className="space-y-3">
                {ADAPTATION_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.id}
                      className="flex items-start space-x-3 p-4 rounded-lg border hover:border-indigo-500 transition-colors cursor-pointer"
                      onClick={() => setForkType(option.id)}
                    >
                      <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                      <Label htmlFor={option.id} className="cursor-pointer flex-1">
                        <div className="flex items-center gap-2 font-medium mb-1">
                          <Icon className="w-4 h-4" />
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {forkType === 'adapt_audience' && (
            <div>
              <Label htmlFor="notes">Adaptation Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., Adapt for youth group, make it more conversational, add pop culture references..."
                value={adaptationNotes}
                onChange={(e) => setAdaptationNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {forkType !== 'copy' && (
            <Alert>
              <Wand2 className="w-4 h-4" />
              <AlertDescription>
                AI will {forkType === 'expand' ? 'expand and deepen' : 
                         forkType === 'condense' ? 'condense' : 'adapt'} this sermon. 
                This may take 30-60 seconds.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isForking}>
            Cancel
          </Button>
          <Button onClick={handleFork} disabled={isForking}>
            {isForking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {forkType === 'copy' ? 'Forking...' : 'AI Adapting...'}
              </>
            ) : (
              <>
                <GitFork className="w-4 h-4 mr-2" />
                Fork Sermon
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}