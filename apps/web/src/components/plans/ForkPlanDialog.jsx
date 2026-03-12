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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GitFork, Wand2, Copy, Baby, GraduationCap, User, Heart } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

const AGE_GROUPS = [
  { value: 'children', label: 'Children (6-12)', icon: Baby },
  { value: 'youth', label: 'Youth (13-18)', icon: GraduationCap },
  { value: 'adults', label: 'Adults (18+)', icon: User },
  { value: 'seniors', label: 'Seniors (60+)', icon: Heart }
];

const FORK_OPTIONS = [
  { 
    id: 'copy', 
    label: 'Copy As-Is', 
    description: 'Save exact copy to your library',
    icon: Copy
  },
  { 
    id: 'adapt_age', 
    label: 'Adapt for Different Age Group', 
    description: 'AI adjusts activities and language',
    icon: Wand2
  },
  { 
    id: 'extend', 
    label: 'Extend Duration', 
    description: 'Add more days with deeper content',
    icon: Wand2
  },
  { 
    id: 'condense', 
    label: 'Shorten Duration', 
    description: 'Keep core content, fewer days',
    icon: Wand2
  }
];

export default function ForkPlanDialog({ open, onClose, plan, user }) {
  const [forkType, setForkType] = useState('copy');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(plan?.age_group || 'adults');
  const [adaptationNotes, setAdaptationNotes] = useState("");
  const [isForking, setIsForking] = useState(false);

  const handleFork = async () => {
    if (!user || !plan) return;

    setIsForking(true);

    try {
      let forkedPlan = {
        creator_id: user.id,
        creator_name: user.full_name || user.email,
        name: `${plan.name} (Forked)`,
        description: plan.description,
        duration_days: plan.duration_days,
        daily_readings: plan.daily_readings,
        category: plan.category,
        is_public: false
      };

      // AI-powered adaptations
      if (forkType !== 'copy') {
        const adaptationPrompt = {
          adapt_age: `Adapt this ${plan.duration_days}-day Bible study plan for ${selectedAgeGroup}:

Original Plan: "${plan.name}"
Original Age: ${plan.age_group || 'general'}
Target Age: ${selectedAgeGroup}

Original Daily Structure:
${plan.daily_readings.slice(0, 2).map((day, i) => `
Day ${i+1}: ${day.reflection?.substring(0, 100)}
Activities: ${JSON.stringify(day.activities?.slice(0, 2))}
`).join('\n')}

Create age-appropriate:
- Activities (crafts/games for children, discussions for youth, reflection for adults, legacy for seniors)
- Language complexity
- Illustrations and examples
- Discussion questions
- Applications

Keep the same scripture and core biblical truth.`,

          extend: `Extend this ${plan.duration_days}-day plan to ${plan.duration_days + 7} days:

Original: "${plan.name}"
Add 7 more days that:
- Deepen the themes
- Add related topics
- Include more practice/application
- Build on previous lessons
- Conclude powerfully

Maintain consistency with original style and age group.`,

          condense: `Condense this ${plan.duration_days}-day plan to ${Math.max(7, Math.floor(plan.duration_days / 2))} days:

Original: "${plan.name}"
Keep the most essential:
- Core biblical truths
- Key scriptures
- Main applications
- Critical activities

Make it punchier while preserving the journey.`
        };

        if (adaptationPrompt[forkType]) {
          const response = await api.integrations.Core.InvokeLLM({
            prompt: adaptationPrompt[forkType],
            response_json_schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                duration_days: { type: "number" },
                daily_readings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "number" },
                      passages: {
                        type: "array",
                        items: { type: "string" }
                      },
                      reflection: { type: "string" },
                      activities: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            description: { type: "string" }
                          }
                        }
                      },
                      discussion_questions: {
                        type: "array",
                        items: { type: "string" }
                      },
                      prayer_points: {
                        type: "array",
                        items: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          });

          forkedPlan = {
            ...forkedPlan,
            name: response.name,
            description: response.description,
            duration_days: response.duration_days,
            daily_readings: response.daily_readings
          };
        }
      }

      // Save forked plan
      await api.entities.ReadingPlan.create(forkedPlan);

      // Update fork count
      await api.entities.ReadingPlan.update(plan.id, {
        followers_count: (plan.followers_count || 0) + 1
      });

      toast.success("Study plan forked successfully! 🎉");
      onClose();
    } catch (error) {
      console.error('Error forking plan:', error);
      toast.error("Failed to fork plan");
    } finally {
      setIsForking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-green-500" />
            Fork & Adapt Study Plan
          </DialogTitle>
          <DialogDescription>
            Create your own version of "{plan?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Original by:</strong> {plan?.creator_name}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Duration:</strong> {plan?.duration_days} days
              </p>
            </CardContent>
          </Card>

          <div>
            <Label className="mb-3 block text-base font-semibold">How would you like to adapt it?</Label>
            <RadioGroup value={forkType} onValueChange={setForkType}>
              <div className="space-y-3">
                {FORK_OPTIONS.map((option) => {
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

          {forkType === 'adapt_age' && (
            <div>
              <Label className="mb-3 block">Target Age Group</Label>
              <div className="grid grid-cols-2 gap-3">
                {AGE_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <Button
                      key={group.value}
                      variant={selectedAgeGroup === group.value ? 'default' : 'outline'}
                      className="h-auto py-3 justify-start"
                      onClick={() => setSelectedAgeGroup(group.value)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {group.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {forkType !== 'copy' && (
            <Alert>
              <Wand2 className="w-4 h-4" />
              <AlertDescription>
                AI will {forkType === 'extend' ? 'extend' : forkType === 'condense' ? 'condense' : 'adapt'} this plan. 
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
                Fork Plan
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}