import React, { useState, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, Loader2, CheckCircle } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function PlanRatingDialog({ open, onClose, plan, user }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [usedPlan, setUsedPlan] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState(null);

  useEffect(() => {
    if (open && user && plan) {
      checkExistingRating();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, user, plan]);

  const checkExistingRating = async () => {
    try {
      const existing = await api.entities.SharedPlanRating.filter({
        plan_id: plan.id,
        user_id: user.id
      });

      if (existing.length > 0) {
        setExistingRating(existing[0]);
        setRating(existing[0].rating);
        setReviewText(existing[0].review_text || "");
        setUsedPlan(existing[0].used_plan || false);
      }
    } catch (error) {
      console.error('Error checking existing rating:', error);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }

    setIsSubmitting(true);

    try {
      if (existingRating) {
        await api.entities.SharedPlanRating.update(existingRating.id, {
          rating,
          review_text: reviewText.trim(),
          used_plan: usedPlan
        });
      } else {
        await api.entities.SharedPlanRating.create({
          plan_id: plan.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          rating,
          review_text: reviewText.trim(),
          used_plan: usedPlan
        });
      }

      // Update plan's average rating
      const allRatings = await api.entities.SharedPlanRating.filter({ plan_id: plan.id });
      const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

      await api.entities.ReadingPlan.update(plan.id, {
        average_rating: avgRating,
        ratings_count: allRatings.length
      });

      toast.success(existingRating ? "Rating updated!" : "Thank you for your review! 🌟");
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error("Failed to submit rating");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Rate Study Plan
          </DialogTitle>
          <DialogDescription>
            Share your experience with "{plan?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Star Rating */}
          <div>
            <Label className="mb-3 block">Your Rating</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating)
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {rating === 0 ? 'Click to rate' :
               rating === 1 ? 'Poor - Not helpful' :
               rating === 2 ? 'Fair - Some issues' :
               rating === 3 ? 'Good - Useful' :
               rating === 4 ? 'Great - Very helpful' :
               'Excellent - Life-changing!'}
            </p>
          </div>

          {/* Review Text */}
          <div>
            <Label htmlFor="review">Your Review (Optional)</Label>
            <Textarea
              id="review"
              placeholder="How did this plan help your spiritual growth? What did you learn?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
            />
          </div>

          {/* Completed Plan */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg">
            <input
              type="checkbox"
              id="completed"
              checked={usedPlan}
              onChange={(e) => setUsedPlan(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="completed" className="cursor-pointer flex-1">
              <div className="font-medium">I completed this plan</div>
              <div className="text-xs text-gray-500">
                This helps others know it's been finished
              </div>
            </Label>
            {usedPlan && <CheckCircle className="w-5 h-5 text-green-600" />}
          </div>

          {existingRating && (
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                You've already rated this plan. Submitting will update your review.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Star className="w-4 h-4 mr-2" />
                Submit Review
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}