import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { formatUserInputBlock } from '@/lib/aiPrompt';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare, Plus, Heart, CheckCircle2, Loader2, Sparkles, Flag, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Forum() {
  const { user, isLoadingAuth } = useAuth();
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    post_type: 'discussion',
    scripture_reference: '',
    tags: []
  });
  const [newReply, setNewReply] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [likingPostId, setLikingPostId] = useState(null);
  const [contentActionId, setContentActionId] = useState(null);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      toast.error("Please log in to view the forum");
      setIsLoading(false);
      return;
    }
    loadPosts();
  // loadPosts is intentionally triggered only when authentication settles or
  // the signed-in user changes; including the render-local function would
  // refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAuth, user]);

  const loadPosts = async () => {
    try {
      // Public forum feed — every member's posts, not just the viewer's own.
      const requestedPostId = new URLSearchParams(window.location.search).get('post');
      const [allPosts, linkedPostResult] = await Promise.all([
        api.community.posts(),
        requestedPostId
          ? api.community.post(requestedPostId)
            .then((post) => ({ post }))
            .catch((error) => ({ error }))
          : Promise.resolve(null),
      ]);
      setPosts(allPosts);
      const requestedPost = linkedPostResult?.post;
      if (requestedPost) {
        setSelectedPost(requestedPost);
        await loadReplies(requestedPost.id);
      } else if (requestedPostId && linkedPostResult?.error) {
        toast.error(linkedPostResult.error?.data?.message || 'This forum post is unavailable.');
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error("Couldn't load forum posts. Please try again.");
    } finally {
      // Without this the initial spinner never clears — the forum looked
      // like an infinite load even after posts arrived.
      setIsLoading(false);
    }
  };

  const loadReplies = async (postId) => {
    try {
      // Public replies — see everyone's replies on the thread, not just yours.
      const postReplies = await api.community.postReplies(postId);
      setReplies(postReplies);
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    try {
      await api.community.createPost(newPost);

      toast.success("Post created successfully!");
      setShowNewPostDialog(false);
      setNewPost({ title: '', content: '', post_type: 'discussion', scripture_reference: '', tags: [] });
      loadPosts();
    } catch (error) {
      // Surface the server's actual reason (e.g. a validation message) instead
      // of an opaque "Failed to create post" that hides the real HTTP error.
      toast.error(error?.data?.message || error?.message || "Failed to create post");
    }
  };

  const handlePostReply = async () => {
    if (!newReply.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }

    try {
      // Single server call creates the reply AND bumps the post's count — works
      // even when replying to ANOTHER member's post (the old client-side count
      // update was owner-gated and 403'd on other people's posts).
      await api.community.replyToPost(selectedPost.id, {
        user_name: user.full_name || user.email,
        content: newReply,
      });

      toast.success("Reply posted!");
      setNewReply('');
      loadReplies(selectedPost.id);
      loadPosts();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Failed to post reply");
    }
  };

  const handleAIResponse = async () => {
    if (!selectedPost) return;

    setIsGeneratingAI(true);
    try {
      const prompt = `As a biblical assistant, provide a thoughtful, scripture-based response to this question or discussion:

${formatUserInputBlock('Title', selectedPost.title)}
${formatUserInputBlock('Content', selectedPost.content)}
${selectedPost.scripture_reference ? formatUserInputBlock('Scripture Reference', selectedPost.scripture_reference) : ''}

Provide a helpful, encouraging response that:
1. Addresses their question or topic directly
2. References relevant scripture
3. Offers practical application
4. Is warm and pastoral in tone

Keep response under 300 words.`;

      const aiResponse = await api.integrations.Core.InvokeLLM({ system_prompt: LARRY_SYSTEM_PROMPT, prompt, feature: 'community' });

      await api.community.replyToPost(selectedPost.id, {
        content: aiResponse,
        is_ai_response: true,
      });

      toast.success("AI response generated!");
      loadReplies(selectedPost.id);
      loadPosts();
    } catch (error) {
      toast.error("Failed to generate AI response");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const openPost = (post) => {
    setSelectedPost(post);
    loadReplies(post.id);
  };

  const toggleLike = async (post, event) => {
    event?.stopPropagation();
    setLikingPostId(post.id);
    try {
      const updated = post.likedByMe
        ? await api.community.unlikePost(post.id)
        : await api.community.likePost(post.id);
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...updated } : item));
      setSelectedPost((current) => current?.id === post.id ? { ...current, ...updated } : current);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not update this like');
    } finally {
      setLikingPostId(null);
    }
  };

  const canDelete = (item) => item?.user_id === user?.id || ['admin', 'dev'].includes(user?.role);

  const deletePost = async (post, event) => {
    event?.stopPropagation();
    if (!confirm('Delete this post and all of its replies?')) return;
    setContentActionId(`delete-post:${post.id}`);
    try {
      await api.community.deletePost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      if (selectedPost?.id === post.id) {
        setSelectedPost(null);
        setReplies([]);
      }
      toast.success('Post deleted');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not delete this post');
    } finally {
      setContentActionId(null);
    }
  };

  const deleteReply = async (reply) => {
    if (!confirm('Delete this reply?')) return;
    setContentActionId(`delete-reply:${reply.id}`);
    try {
      await api.community.deletePostReply(selectedPost.id, reply.id);
      setReplies((current) => current.filter((item) => item.id !== reply.id));
      setSelectedPost((current) => current ? {
        ...current,
        replies_count: Math.max(0, Number(current.replies_count || 0) - 1),
      } : current);
      setPosts((current) => current.map((item) => item.id === selectedPost.id ? {
        ...item,
        replies_count: Math.max(0, Number(item.replies_count || 0) - 1),
      } : item));
      toast.success('Reply deleted');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not delete this reply');
    } finally {
      setContentActionId(null);
    }
  };

  const reportPost = async (post, event) => {
    event?.stopPropagation();
    if (!confirm('Report this post to the moderation team?')) return;
    setContentActionId(`report-post:${post.id}`);
    try {
      await api.community.reportPost(post.id, { category: 'other', reason: 'Reported by a community member' });
      toast.success('Post reported for review');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not report this post');
    } finally {
      setContentActionId(null);
    }
  };

  const reportReply = async (reply) => {
    if (!confirm('Report this reply to the moderation team?')) return;
    setContentActionId(`report-reply:${reply.id}`);
    try {
      await api.community.reportPostReply(selectedPost.id, reply.id, {
        category: 'other',
        reason: 'Reported by a community member',
      });
      toast.success('Reply reported for review');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not report this reply');
    } finally {
      setContentActionId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to access the forum</p>
            <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" onClick={() => setSelectedPost(null)} className="mb-4">
            ← Back to Forum
          </Button>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl">{selectedPost.title}</CardTitle>
                  <CardDescription className="mt-2">
                    Posted by {selectedPost.user_name} • {new Date(selectedPost.created_date).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant={selectedPost.post_type === 'question' ? 'default' : 'secondary'}>
                  {selectedPost.post_type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-4">{selectedPost.content}</p>
              {selectedPost.scripture_reference && (
                <Badge variant="outline">{selectedPost.scripture_reference}</Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`mt-3 ${selectedPost.likedByMe ? 'text-red-600' : ''}`}
                disabled={likingPostId === selectedPost.id}
                onClick={(event) => toggleLike(selectedPost, event)}
              >
                <Heart className={`mr-1 h-4 w-4 ${selectedPost.likedByMe ? 'fill-current' : ''}`} />
                {selectedPost.likes_count || 0} likes
              </Button>
              {canDelete(selectedPost) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-red-600"
                  disabled={contentActionId === `delete-post:${selectedPost.id}`}
                  onClick={(event) => deletePost(selectedPost, event)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete post
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  disabled={contentActionId === `report-post:${selectedPost.id}`}
                  onClick={(event) => reportPost(selectedPost, event)}
                >
                  <Flag className="mr-1 h-4 w-4" />
                  Report post
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Replies ({replies.length})</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAIResponse}
                disabled={isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Get AI Response
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              {replies.map((reply) => (
                <Card key={reply.id} className={reply.is_ai_response ? 'border-purple-200 bg-purple-50/50 dark:bg-purple-900/10' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{reply.user_name}</span>
                        {reply.is_ai_response && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI-assisted
                          </Badge>
                        )}
                        {reply.is_accepted_answer && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Accepted
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          {new Date(reply.created_date).toLocaleDateString()}
                        </span>
                        {canDelete(reply) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600"
                            disabled={contentActionId === `delete-reply:${reply.id}`}
                            onClick={() => deleteReply(reply)}
                            aria-label="Delete reply"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            disabled={contentActionId === `report-reply:${reply.id}`}
                            onClick={() => reportReply(reply)}
                            aria-label="Report reply"
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{reply.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="pt-4">
                <Textarea
                  placeholder="Write your reply..."
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  className="mb-3"
                  rows={4}
                />
                <Button onClick={handlePostReply}>Post Reply</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-blue-500" />
              Discussion Forum
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Ask questions, share insights, and discuss Scripture together.
            </p>
          </div>

          <Dialog open={showNewPostDialog} onOpenChange={setShowNewPostDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Post</DialogTitle>
                <DialogDescription>Share a question, testimony, or start a discussion.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Post Type</label>
                  <Select value={newPost.post_type} onValueChange={(value) => setNewPost({...newPost, post_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="discussion">Discussion</SelectItem>
                      <SelectItem value="testimony">Testimony</SelectItem>
                      <SelectItem value="prayer_request">Prayer Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="What's your question or topic?"
                    value={newPost.title}
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    placeholder="Share your thoughts..."
                    value={newPost.content}
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                    rows={6}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Scripture Reference (Optional)</label>
                  <Input
                    placeholder="e.g., John 3:16"
                    value={newPost.scripture_reference}
                    onChange={(e) => setNewPost({...newPost, scripture_reference: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewPostDialog(false)}>Cancel</Button>
                <Button onClick={handleCreatePost}>Create Post</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No posts yet</p>
                <p className="text-gray-600 mb-4">Be the first to start a discussion!</p>
                <Button onClick={() => setShowNewPostDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openPost(post)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{post.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {post.user_name} • {new Date(post.created_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant={post.post_type === 'question' ? 'default' : 'secondary'}>
                      {post.post_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300 line-clamp-2 mb-3">{post.content}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {post.replies_count || 0} replies
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={post.likedByMe ? 'text-red-600' : ''}
                      disabled={likingPostId === post.id}
                      onClick={(event) => toggleLike(post, event)}
                    >
                      <Heart className={`mr-1 h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                      {post.likes_count || 0} likes
                    </Button>
                    {post.is_resolved && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Resolved
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
