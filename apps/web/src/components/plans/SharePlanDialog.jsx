import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Share2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function SharePlanDialog({ open, onClose, plan, user }) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!plan || !user) return;

    setIsSharing(true);

    try {
      // Share the plan publicly
      await api.entities.ReadingPlan.create({
        creator_id: user.id,
        creator_name: user.full_name || user.email,
        name: plan.plan_title,
        description: plan.plan_overview,
        duration_days: plan.duration,
        daily_readings: (plan.daily_lessons || []).map(lesson => ({
          // No 'N/A' defaults here: activities / discussion_questions /
          // prayer_points are arrays, and a string default breaks every
          // consumer that does (x || []).map(...).
          day: lesson?.day,
          passages: lesson?.scripture_reading,
          reflection: lesson?.devotional_context,
          activities: lesson?.activities,
          discussion_questions: lesson?.discussion_questions,
          prayer_points: lesson?.prayer_points
        })),
        category: 'topical',
        age_group: plan.age_group || 'adults',
        is_public: true,
        followers_count: 0
      });

      toast.success("Study plan shared with the community! 🎉");
      onClose();
    } catch (error) {
      console.error('Error sharing plan:', error);
      toast.error(`Failed to share plan: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            Share Study Plan
          </DialogTitle>
          <DialogDescription>
            Publish this study plan so community members can read and adapt it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Plan Details
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-1">
              <strong>Title:</strong> {plan?.plan_title}
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-1">
              <strong>Duration:</strong> {plan?.duration} days
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Age Group:</strong> {plan?.age_group}
            </p>
          </div>

        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSharing}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={isSharing || !plan || !user}>
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Share to Community
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
