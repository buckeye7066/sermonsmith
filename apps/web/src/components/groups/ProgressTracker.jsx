import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle, Book, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProgressTracker({ group, isLeader }) {
  const [progress, setProgress] = useState(null);
  const [plan, setPlan] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [progressData, ownedPlans, publicPlans] = await Promise.all([
          api.community.groupProgress(group.id),
          isLeader ? api.entities.ReadingPlan.list('-created_date', 100) : Promise.resolve([]),
          isLeader ? api.community.readingPlans('newest') : Promise.resolve([]),
        ]);
        if (!active) return;
        setProgress(progressData.progress || null);
        setPlan(progressData.plan || null);
        const uniquePlans = new Map();
        for (const candidate of [...(ownedPlans || []), ...(publicPlans || [])]) {
          if (candidate?.id) uniquePlans.set(candidate.id, candidate);
        }
        const choices = [...uniquePlans.values()];
        setAvailablePlans(choices);
        setSelectedPlanId(progressData.plan?.id || choices[0]?.id || '');
      } catch (error) {
        console.error('Error loading group progress:', error);
        if (active) toast.error('Failed to load group progress');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [group.id, isLeader]);

  const loadProgress = async () => {
    try {
      const data = await api.community.groupProgress(group.id);
      setProgress(data.progress || null);
      setPlan(data.plan || null);
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const assignPlan = async () => {
    if (!isLeader || !selectedPlanId) return;
    if (progress && selectedPlanId !== plan?.id
      && !window.confirm('Assigning a different plan will reset this group’s recorded progress. Continue?')) {
      return;
    }
    setIsAssigning(true);
    try {
      const data = await api.community.assignGroupProgressPlan(group.id, selectedPlanId);
      setProgress(data.progress || null);
      setPlan(data.plan || null);
      toast.success(progress ? 'Group plan updated and progress reset' : 'Study plan assigned to the group');
    } catch (error) {
      console.error('Error assigning group plan:', error);
      toast.error(error.message || 'Failed to assign study plan');
    } finally {
      setIsAssigning(false);
    }
  };

  const assignmentControls = isLeader ? (
    <div className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-900">
      <div>
        <p className="font-medium">{progress ? 'Change study plan' : 'Assign a study plan'}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose one of your saved plans or a public Community plan.
          {progress ? ' Changing it resets the group’s progress.' : ''}
        </p>
      </div>
      {availablePlans.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Study plan"
            className="h-10 flex-1 rounded-md border bg-white px-3 text-sm dark:bg-gray-950"
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId(event.target.value)}
          >
            {availablePlans.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name || candidate.title || 'Untitled plan'}
                {candidate.duration_days ? ` (${candidate.duration_days} days)` : ''}
              </option>
            ))}
          </select>
          <Button onClick={assignPlan} disabled={!selectedPlanId || isAssigning}>
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {progress ? 'Update plan' : 'Assign plan'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Save a reading plan from Bible Study or fork one from the Community plan library first.
        </p>
      )}
    </div>
  ) : null;

  const markDayComplete = async (day) => {
    if (!progress || !isLeader) return;

    try {
      await api.community.completeGroupProgressDay(group.id, day);

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
        <CardContent className="space-y-4 pt-6">
          <div className="text-center">
            <Book className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No study plan assigned to this group yet</p>
          </div>
          {assignmentControls}
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
        {assignmentControls}
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
