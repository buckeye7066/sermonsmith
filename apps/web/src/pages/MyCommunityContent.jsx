import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, MessageSquare, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MyCommunityContent() {
  const [content, setContent] = useState({ posts: [], replies: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await api.community.myForumContent();
      setContent({ posts: result.posts || [], replies: result.replies || [] });
    } catch (error) {
      const message = error?.data?.message || error?.message || 'Could not load your community content';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const removePost = async (post) => {
    if (!window.confirm('Permanently delete this post and its replies?')) return;
    setDeletingId(post.id);
    try {
      await api.community.deletePost(post.id);
      setContent((current) => ({
        posts: current.posts.filter((item) => item.id !== post.id),
        replies: current.replies.filter((item) => item.post_id !== post.id),
      }));
      toast.success('Post deleted');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not delete this post');
    } finally {
      setDeletingId(null);
    }
  };

  const removeReply = async (reply) => {
    if (!window.confirm('Permanently delete this reply?')) return;
    setDeletingId(reply.id);
    try {
      await api.community.deletePostReply(reply.post_id, reply.id);
      setContent((current) => ({
        ...current,
        replies: current.replies.filter((item) => item.id !== reply.id),
      }));
      toast.success('Reply deleted');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not delete this reply');
    } finally {
      setDeletingId(null);
    }
  };

  const empty = !content.posts.length && !content.replies.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <MessageSquare className="h-8 w-8 text-indigo-600" />
          My Community Content
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Review or permanently retract posts and replies you previously shared. This privacy control remains available if Premium expires.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
          <span className="sr-only">Loading your community content</span>
        </div>
      ) : loadError ? (
        <Card role="alert">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">Your community content could not be loaded.</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{loadError}</p>
            </div>
            <Button variant="outline" onClick={loadContent}>Try again</Button>
          </CardContent>
        </Card>
      ) : empty ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-600">
            You have not published any forum posts or replies.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="my-community-posts">
            <h2 id="my-community-posts" className="text-xl font-semibold">Posts ({content.posts.length})</h2>
            {content.posts.map((post) => (
              <Card key={post.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg">{post.title || 'Untitled discussion'}</CardTitle>
                    <Badge variant="outline">{post.status || 'active'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{post.content}</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={Boolean(deletingId)}
                    onClick={() => removePost(post)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete post
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-3" aria-labelledby="my-community-replies">
            <h2 id="my-community-replies" className="text-xl font-semibold">Replies ({content.replies.length})</h2>
            {content.replies.map((reply) => (
              <Card key={reply.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Reply className="h-4 w-4" />
                    {reply.parent_title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={Boolean(deletingId)}
                    onClick={() => removeReply(reply)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete reply
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
