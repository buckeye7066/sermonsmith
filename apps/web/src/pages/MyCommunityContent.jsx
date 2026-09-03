import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, BookOpen, Loader2, MessageSquare, Reply, Star, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { createPageUrl } from '@/utils';

async function loadEveryPage(loader, keys) {
  const collected = Object.fromEntries(keys.map((key) => [key, []]));
  const seenOffsets = new Set();
  let offset = 0;
  for (;;) {
    if (seenOffsets.has(offset)) throw new Error('The server returned a non-advancing community page');
    seenOffsets.add(offset);
    const page = await loader({ offset, limit: 100 });
    for (const key of keys) collected[key].push(...(page?.[key] || []));
    if (page?.next_offset === null || page?.next_offset === undefined) return collected;
    const nextOffset = Number(page.next_offset);
    if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
      throw new Error('The server returned an invalid community page');
    }
    offset = nextOffset;
  }
}

export default function MyCommunityContent() {
  const [content, setContent] = useState({ posts: [], replies: [], ratings: [], series: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [forum, ratingResult, seriesResult, groupResult] = await Promise.all([
        loadEveryPage(api.community.myForumContent, ['posts', 'replies']),
        loadEveryPage(api.community.myRatings, ['ratings']),
        loadEveryPage(api.community.mySharedSeries, ['series']),
        loadEveryPage(api.community.myStudyGroups, ['groups']),
      ]);
      setContent({ ...forum, ...ratingResult, ...seriesResult, ...groupResult });
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
        ...current,
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

  const removeRating = async (rating) => {
    if (!window.confirm('Permanently delete this public rating?')) return;
    setDeletingId(rating.id);
    try {
      await api.community.deleteRating(rating.id);
      setContent((current) => ({
        ...current,
        ratings: current.ratings.filter((item) => item.id !== rating.id),
      }));
      toast.success('Rating deleted');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not delete this rating');
    } finally {
      setDeletingId(null);
    }
  };

  const removeSeries = async (series) => {
    if (!window.confirm('Permanently withdraw this shared series?')) return;
    setDeletingId(series.id);
    try {
      await api.community.unshareSeries(series.id);
      setContent((current) => ({
        ...current,
        series: current.series.filter((item) => item.id !== series.id),
      }));
      toast.success('Shared series withdrawn');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not withdraw this shared series');
    } finally {
      setDeletingId(null);
    }
  };

  const empty = !content.posts.length && !content.replies.length && !content.ratings.length
    && !content.series.length && !content.groups.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <MessageSquare className="h-8 w-8 text-indigo-600" />
          My Community Content
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Manage groups and permanently retract posts, replies, ratings, and series you previously shared. These privacy controls remain available if Premium expires.
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
            You have no community memberships or published community content.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="my-community-groups">
            <h2 id="my-community-groups" className="text-xl font-semibold">Groups ({content.groups.length})</h2>
            {content.groups.map((group) => (
              <Card key={group.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" />{group.name || 'Study group'}</p>
                    <p className="mt-1 text-sm text-gray-600">Your role: {group.membership_role || 'member'}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`${createPageUrl('GroupDetail')}?id=${encodeURIComponent(group.id)}`}>Manage membership</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-3" aria-labelledby="my-community-series">
            <h2 id="my-community-series" className="text-xl font-semibold">Shared series ({content.series.length})</h2>
            {content.series.map((series) => (
              <Card key={series.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <p className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" />{series.title || series.name || 'Untitled series'}</p>
                  <Button variant="destructive" size="sm" disabled={Boolean(deletingId)} onClick={() => removeSeries(series)}>
                    <Trash2 className="mr-2 h-4 w-4" />Withdraw series
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-3" aria-labelledby="my-community-ratings">
            <h2 id="my-community-ratings" className="text-xl font-semibold">Ratings ({content.ratings.length})</h2>
            {content.ratings.map((rating) => (
              <Card key={rating.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="flex items-center gap-2 font-semibold"><Star className="h-4 w-4" />{rating.target_title}</p>
                    <p className="mt-1 text-sm text-gray-600">{rating.rating} / 5 · {rating.target_type === 'sermon' ? 'Sermon' : 'Reading plan'}</p>
                  </div>
                  <Button variant="destructive" size="sm" disabled={Boolean(deletingId)} onClick={() => removeRating(rating)}>
                    <Trash2 className="mr-2 h-4 w-4" />Delete rating
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

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
