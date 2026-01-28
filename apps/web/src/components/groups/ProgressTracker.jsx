import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle, Book, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function ProgressTracker({ group, isLeader }) {
  const [progress, setProgress] = useState(null);
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [group.id]);

  const loadProgress = async () => {
    try {
      const groupProgress = await base44.entities.GroupProgress.filter({ group_id: group.id });
      
      if (groupProgress.length > 0) {
        const prog = groupProgress[0];
        setProgress(prog);
        
        if (prog.plan_id) {
          const readingPlan = await base44.entities.ReadingPlan.filter({ id: prog.plan_id });
          if (readingPlan.length > 0) {
            setPlan(readingPlan[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markDayComplete = async (day) => {
    if (!progress || !isLeader) return;

    try {
      const completedDays = [...(progress.completed_days || []), day];
      const completionPercentage = (completedDays.length / progress.total_days) * 100;

      await base44.entities.GroupProgress.update(progress.id, {
        completed_days: completedDays,
        current_day: day + 1,
        completion_percentage: Math.round(completionPercentage)
      });

      toast.success("Day marked as complete!");
      loadProgress();
    } catch (error) {
      toast.error("Failed to update progress");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading progress...</div>;
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Book className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-4">No study plan assigned to this group yet</p>
          {isLeader && (
            <Button>Assign a Reading Plan</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Group Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan && (
          <div>
            <p className="font-semibold">{plan.name}</p>
            <p className="text-sm text-gray-600">{plan.description}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Completion</span>
            <span className="text-sm text-gray-600">
              {progress.completed_days?.length || 0} / {progress.total_days} days
            </span>
          </div>
          <Progress value={progress.completion_percentage || 0} className="h-3" />
          <p className="text-xs text-gray-500 mt-1">
            {progress.completion_percentage || 0}% complete
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Current Day: {progress.current_day}</span>
          </div>
          {progress.next_meeting_day && (
            <div className="flex items-center gap-2">
              <Book className="w-4 h-4" />
              <span className="text-sm">Next Meeting: Day {progress.next_meeting_day}</span>
            </div>
          )}
        </div>

        {plan?.daily_readings && (
          <div>
            <h4 className="font-semibold mb-2">Recent Days</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {plan.daily_readings.slice(0, 10).map((reading, idx) => {
                const day = reading.day;
                const isCompleted = progress.completed_days?.includes(day);
                const isCurrent = day === progress.current_day;

                return (
                  <div
                    key={day}
                    className={`p-3 border rounded-lg ${
                      isCurrent ? 'border-blue-500 bg-blue-50' : 
                      isCompleted ? 'bg-green-50 border-green-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
                        <span className="font-medium text-sm">Day {day}</span>
                        {isCurrent && <Badge>Current</Badge>}
                      </div>
                      {!isCompleted && isLeader && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markDayComplete(day)}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                    {reading.passages && (
                      <p className="text-xs text-gray-600 mt-1">
                        {reading.passages.join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}