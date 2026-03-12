import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Check, Trash2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { format } from "date-fns";

export default function CommentPanel({ sermon, user, pointIndex = null }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (sermon) {
      loadComments();
      const interval = setInterval(loadComments, 5000); // Poll for new comments
      return () => clearInterval(interval);
    }
  }, [sermon, pointIndex]);

  const loadComments = async () => {
    try {
      const allComments = await api.entities.SermonComment.filter({ sermon_id: sermon.id });
      const filtered = pointIndex !== null
        ? allComments.filter(c => c.point_index === pointIndex)
        : allComments.filter(c => c.point_index === null || c.point_index === undefined);
      
      setComments(filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const postComment = async () => {
    if (!newComment.trim()) return;

    setIsPosting(true);
    try {
      await api.entities.SermonComment.create({
        sermon_id: sermon.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        content: newComment,
        point_index: pointIndex,
        resolved: false
      });

      setNewComment("");
      loadComments();
      toast.success("Comment added");
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setIsPosting(false);
    }
  };

  const toggleResolved = async (commentId, currentStatus) => {
    try {
      await api.entities.SermonComment.update(commentId, { resolved: !currentStatus });
      loadComments();
    } catch (error) {
      console.error("Error updating comment:", error);
    }
  };

  const deleteComment = async (commentId) => {
    if (!confirm("Delete this comment?")) return;

    try {
      await api.entities.SermonComment.delete(commentId);
      loadComments();
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="w-4 h-4" />
          Comments {pointIndex !== null && `(Point ${pointIndex + 1})`}
          <Badge variant="secondary">{comments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment or suggestion..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={postComment} disabled={isPosting || !newComment.trim()} size="sm">
              <Send className="w-3 h-3 mr-2" />
              Comment
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg border ${
                comment.resolved ? 'bg-green-50 border-green-200' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{comment.user_name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(comment.created_date), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {comment.resolved && (
                    <Badge variant="secondary" className="text-xs">
                      Resolved
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => toggleResolved(comment.id, comment.resolved)}
                  >
                    <Check className={`w-3 h-3 ${comment.resolved ? 'text-green-600' : 'text-gray-400'}`} />
                  </Button>
                  {comment.user_id === user.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteComment(comment.id)}
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm">{comment.content}</p>
            </div>
          ))}

          {comments.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">
              No comments yet. Be the first to add feedback!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}