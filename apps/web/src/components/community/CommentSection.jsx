import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, Send, Heart, Pin, Loader2, Trash2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function CommentSection({ contentType, contentId, contentCreatorId, user }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (contentId) {
      loadComments();
    }
  }, [contentId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const contentComments = await api.entities.Comment.filter(
        { content_type: contentType, content_id: contentId },
        '-created_date',
        100
      );
      setComments(contentComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }

    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.entities.Comment.create({
        user_id: user.id,
        user_name: user.full_name || user.email,
        content_type: contentType,
        content_id: contentId,
        comment: newComment.trim(),
        likes_count: 0,
        is_pinned: false
      });

      setNewComment("");
      toast.success("Comment posted!");
      loadComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (comment) => {
    if (!user) {
      toast.error("Please log in to like comments");
      return;
    }

    try {
      await api.entities.Comment.update(comment.id, {
        likes_count: (comment.likes_count || 0) + 1
      });
      loadComments();
    } catch (error) {
      toast.error("Failed to like comment");
    }
  };

  const handleDelete = async (comment) => {
    if (!user || comment.user_id !== user.id) return;

    if (!confirm("Delete this comment?")) return;

    try {
      await api.entities.Comment.delete(comment.id);
      toast.success("Comment deleted");
      loadComments();
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  const handlePin = async (comment) => {
    if (!user || contentCreatorId !== user.id) return;

    try {
      await api.entities.Comment.update(comment.id, {
        is_pinned: !comment.is_pinned
      });
      toast.success(comment.is_pinned ? "Comment unpinned" : "Comment pinned!");
      loadComments();
    } catch (error) {
      toast.error("Failed to pin comment");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment Form */}
        {user ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Share your thoughts or ask a question..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !newComment.trim()}
                size="sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Post Comment
              </Button>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Please log in to join the conversation
            </AlertDescription>
          </Alert>
        )}

        {/* Comments List */}
        {isLoading ? (
          <div className="text-center py-6">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No comments yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card key={comment.id} className={comment.is_pinned ? 'border-indigo-500 border-2' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{comment.user_name}</span>
                      {comment.is_pinned && (
                        <Badge variant="secondary" className="text-xs">
                          <Pin className="w-3 h-3 mr-1" />
                          Pinned
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {user && contentCreatorId === user.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handlePin(comment)}
                          title={comment.is_pinned ? "Unpin" : "Pin comment"}
                        >
                          <Pin className="w-3 h-3" />
                        </Button>
                      )}
                      {user && comment.user_id === user.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500"
                          onClick={() => handleDelete(comment)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                    {comment.comment}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(comment)}
                      disabled={!user}
                      className="text-xs"
                    >
                      <Heart className={`w-3 h-3 mr-1 ${comment.likes_count > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                      {comment.likes_count || 0}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}