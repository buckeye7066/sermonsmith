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
import { Star, Loader2, CheckCircle } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function RatingDialog({ open, onClose, sermon, user }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [usedInMinistry, setUsedInMinistry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState(null);

  useEffect(() => {
    if (open && user && sermon) {
      checkExistingRating();
    }
  }, [open, user, sermon]);

  const checkExistingRating = async () => {
    try {
      const existing = await api.entities.SermonRating.filter({
        sermon_id: sermon.id,
        user_id: user.id
      });

      if (existing.length > 0) {
        setExistingRating(existing[0]);
        setRating(existing[0].rating);
        setReviewText(existing[0].review_text || "");
        setUsedInMinistry(existing[0].used_in_ministry || false);
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
        // Update existing rating
        await api.entities.SermonRating.update(existingRating.id, {
          rating,
          review_text: reviewText.trim(),
          used_in_ministry: usedInMinistry
        });
      } else {
        // Create new rating
        await api.entities.SermonRating.create({
          sermon_id: sermon.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          rating,
          review_text: reviewText.trim(),
          used_in_ministry: usedInMinistry
        });
      }

      // Update sermon's average rating
      const allRatings = await api.entities.SermonRating.filter({ sermon_id: sermon.id });
      const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

      await api.entities.SharedSermon.update(sermon.id, {
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
            Rate & Review
          </DialogTitle>
          <DialogDescription>
            Help the community by sharing your experience with "{sermon?.title}"
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
               'Excellent - Outstanding!'}
            </p>
          </div>

          {/* Review Text */}
          <div>
            <Label htmlFor="review">Your Review (Optional)</Label>
            <Textarea
              id="review"
              placeholder="Share your thoughts about this sermon. What did you like? How did you use it?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
            />
          </div>

          {/* Used in Ministry */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg">
            <input
              type="checkbox"
              id="used"
              checked={usedInMinistry}
              onChange={(e) => setUsedInMinistry(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="used" className="cursor-pointer flex-1">
              <div className="font-medium">I used this in my ministry</div>
              <div className="text-xs text-gray-500">
                This helps others know it's been field-tested
              </div>
            </Label>
            {usedInMinistry && <CheckCircle className="w-5 h-5 text-green-600" />}
          </div>

          {existingRating && (
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                You've already rated this sermon. Submitting will update your review.
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

function Alert({ children, className = "" }) {
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      {children}
    </div>
  );
}

function AlertDescription({ children, className = "" }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}