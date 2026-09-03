import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, GitFork, Eye, Users, BookOpen, Lightbulb, Target, Sparkles } from "lucide-react";
import ThematicLinker from "../discovery/ThematicLinker";
import CommentSection from "../community/CommentSection";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';

export default function SermonViewer({ open, onClose, sermon, onFork, onRate }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [showRelatedContent, setShowRelatedContent] = useState(false);

  useEffect(() => {
    if (open && sermon) {
      loadReviews();
    }
  }, [open, sermon]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReviews = async () => {
    try {
      const data = await api.community.sermonRatings(sermon.id);
      setReviews((data.ratings || []).slice(0, 10));
    } catch (error) {
      logError('Error loading sermon reviews', error);
    }
  };

  if (!sermon) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{sermon.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {sermon.user_name}
            </Badge>
            <Badge variant="outline">{sermon.topic}</Badge>
            {sermon.denomination && <Badge variant="outline">{sermon.denomination}</Badge>}
            {sermon.anchor_passage && (
              <Badge variant="secondary">
                <BookOpen className="w-3 h-3 mr-1" />
                {sermon.anchor_passage}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold">{sermon.average_rating?.toFixed(1) || '0.0'}</span>
              <span>({sermon.ratings_count || 0} reviews)</span>
            </div>
            <div className="flex items-center gap-2">
              <GitFork className="w-5 h-5" />
              <span className="font-semibold">{sermon.forks_count || 0}</span>
              <span>forks</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              <span>{sermon.views_count || 0} views</span>
            </div>
          </div>

          <div className="space-y-2">
            {sermon.ai_tags && sermon.ai_tags.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  AI Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {sermon.ai_tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {sermon.style_tags && sermon.style_tags.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Style</p>
                <div className="flex flex-wrap gap-2">
                  {sermon.style_tags.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {sermon.big_idea && (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Big Idea</h3>
                <p className="text-lg font-medium text-blue-800 dark:text-blue-200">
                  {sermon.big_idea}
                </p>
              </CardContent>
            </Card>
          )}

          {sermon.points && sermon.points.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Sermon Points</h3>
                <Accordion type="single" collapsible className="space-y-2">
                  {sermon.points.map((point, index) => (
                    <AccordionItem key={index} value={`point-${index}`} className="border rounded-lg px-4">
                      <AccordionTrigger>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-indigo-600">{index + 1}</Badge>
                          <span className="font-semibold">{point.title}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-4">
                        {point.exegesis && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                              <BookOpen className="w-4 h-4 text-blue-600" />
                              Exegesis
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                              {point.exegesis}
                            </p>
                          </div>
                        )}
                        {point.illustration && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border-l-2 border-yellow-500">
                            <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                              <Lightbulb className="w-4 h-4 text-yellow-600" />
                              Illustration
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                              {point.illustration}
                            </p>
                          </div>
                        )}
                        {point.application && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border-l-2 border-green-500">
                            <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                              <Target className="w-4 h-4 text-green-600" />
                              Application
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                              {point.application}
                            </p>
                          </div>
                        )}
                        {point.supporting_scriptures && point.supporting_scriptures.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Supporting Scriptures</h4>
                            <div className="flex flex-wrap gap-2">
                              {point.supporting_scriptures.map((scripture, sIndex) => (
                                <Badge key={sIndex} variant="outline">{scripture}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                      Discover Related Content
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Find verses and other sermons that explore similar themes
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowRelatedContent(!showRelatedContent)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {showRelatedContent ? 'Hide' : 'Discover'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {showRelatedContent && (
            <ThematicLinker 
              sourceType="sermon"
              sourceData={sermon}
              user={user}
            />
          )}

          <CommentSection
            contentType="sermon"
            contentId={sermon.id}
            contentCreatorId={sermon.user_id}
            user={user}
          />

          {reviews.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Top Reviews</h3>
                <div className="space-y-3">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{review.user_name}</span>
                        {review.used_in_ministry && (
                          <Badge variant="secondary" className="text-xs">Used in Ministry</Badge>
                        )}
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">{review.review_text}</p>
                      )}
                    </div>
                  ))}
                  {reviews.length > 3 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      + {reviews.length - 3} more reviews
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={onFork} variant="default" className="flex-1">
              <GitFork className="w-4 h-4 mr-2" />
              Fork & Adapt
            </Button>
            <Button onClick={onRate} variant="outline" className="flex-1">
              <Star className="w-4 h-4 mr-2" />
              Rate & Review
            </Button>
          </div>

          <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              💡 Always review shared content for theological accuracy before using in your ministry
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
