import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { usePremiumAccess } from '@/components/hooks/usePremiumAccess';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Bookmark, TrendingUp, BookOpen, Loader2, Share2, Crown } from "lucide-react";
import { toast } from "sonner";

export function shareLinkSlugFromLocation({ hash = '', search = '' } = {}) {
  const queryIndex = hash.indexOf('?');
  const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : search;
  return new URLSearchParams(query).get('link');
}

export function pointPreviewText(point) {
  for (const field of ['explanation', 'content', 'exegesis', 'illustration', 'application']) {
    if (typeof point?.[field] === 'string' && point[field].trim()) return point[field];
  }
  return '';
}

export default function SharedContent({ publicShareOnly = false }) {
  const { user, isLoadingAuth } = useAuth();
  const { hasEntitlement, loading: accessLoading } = usePremiumAccess();
  const hasCommunityAccess = hasEntitlement('community');
  const [sharedContent, setSharedContent] = useState([]);
  const [myShared, setMyShared] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sharedLink, setSharedLink] = useState(null);
  const [shareLoading, setShareLoading] = useState(publicShareOnly);
  const [shareError, setShareError] = useState(null);

  useEffect(() => {
    // When the URL carries ?link=<slug> we resolve it through the dedicated
    // share route — the generic entity API would tenant-scope the lookup
    // away and return 404 even for legitimate share links.
    const linkSlug = shareLinkSlugFromLocation(window.location);
    if (linkSlug) {
      setShareLoading(true);
      api.community.share(linkSlug)
        .then((result) => setSharedLink(result))
        .catch((err) => {
          const message = logError('Could not load share link', err);
          setShareError(message);
          if (!publicShareOnly) toast.error(message);
        })
        .finally(() => setShareLoading(false));
    }
  }, [publicShareOnly]);

  useEffect(() => {
    if (publicShareOnly) {
      setIsLoading(false);
      return;
    }
    if (isLoadingAuth || accessLoading) return;
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAuth, accessLoading, user, filter, publicShareOnly, hasCommunityAccess]);

  const loadContent = async () => {
    setIsLoading(true);
    try {
      // Public discovery is Premium, while the owner-scoped private library is
      // a core account surface. Load them independently so an expired account
      // never loses access to private notes because the public feed returns 402.
      const [allContent, userContent] = await Promise.all([
        hasCommunityAccess ? api.community.sharedContent(filter) : Promise.resolve([]),
        user ? api.entities.SharedContent.filter(
          {},
          '-created_date',
          50
        ) : Promise.resolve([]),
      ]);
      setSharedContent(allContent);
      setMyShared(userContent);
    } catch (error) {
      toast.error(logError('Error loading shared content', error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (content) => {
    if (!user) {
      toast.error('Please log in to like content');
      return;
    }
    try {
      const updated = await api.community.like(content.id);
      setSharedContent((prev) =>
        prev.map((c) => (c.id === content.id ? { ...c, ...updated } : c))
      );
      toast.success('Liked!');
    } catch (error) {
      toast.error(logError('Failed to like', error));
    }
  };

  const handleSave = async (content) => {
    if (!user) {
      toast.error('Please log in to save content');
      return;
    }
    try {
      const updated = await api.community.save(content.id);
      setSharedContent((prev) =>
        prev.map((c) => (c.id === content.id ? { ...c, ...updated } : c))
      );
      toast.success('Saved to your collection!');
    } catch (error) {
      toast.error(logError('Failed to save', error));
    }
  };

  if (publicShareOnly) {
    const resource = sharedLink?.resource;
    const link = sharedLink?.link;
    const primaryText = resource?.content
      || resource?.body
      || resource?.overview
      || resource?.big_idea
      || resource?.description
      || '';

    return (
      <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-indigo-600" />
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">SermonSmith shared resource</p>
          </div>
          {shareLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
            </div>
          ) : shareError || !resource ? (
            <Card className="border-red-200">
              <CardContent className="space-y-3 py-10 text-center">
                <h1 className="text-2xl font-bold">This share link is unavailable</h1>
                <p className="text-gray-600 dark:text-gray-300">
                  It may be invalid, expired, or the resource may no longer be eligible for sharing.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">
                  {link?.title || resource.title || resource.name || 'Shared resource'}
                </CardTitle>
                {link?.description && <CardDescription>{link.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-5">
                {resource.anchor_passage && (
                  <Badge variant="outline"><BookOpen className="mr-1 h-3 w-3" />{resource.anchor_passage}</Badge>
                )}
                {primaryText && (
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{primaryText}</div>
                )}
                {Array.isArray(resource.points) && resource.points.length > 0 && (
                  <div className="space-y-4">
                    {resource.points.map((point, index) => (
                      <section key={`${point?.title || 'point'}-${index}`} className="rounded-lg border p-4">
                        <h2 className="font-semibold">{point?.title || `Point ${index + 1}`}</h2>
                        {pointPreviewText(point) && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                            {pointPreviewText(point)}
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                )}
                {!primaryText && (!Array.isArray(resource.points) || resource.points.length === 0) && (
                  <p className="text-gray-600 dark:text-gray-300">The resource is available, but it has no text preview.</p>
                )}
                <p className="border-t pt-4 text-xs text-gray-500">
                  Shared read-only. Verify Scripture wording, context, and citations before teaching or distributing it.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            Shared Content
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {hasCommunityAccess
              ? 'Discover community resources and manage your own shared or private content.'
              : 'Manage your private notes and content without publishing to the Community.'}
          </p>
        </div>

        {sharedLink && (
          <Card className="mb-6 border-purple-300 bg-purple-50 dark:bg-purple-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-purple-600" />
                Someone shared this with you
              </CardTitle>
              <CardDescription>
                {sharedLink.link?.title || 'Shared resource'} — {sharedLink.resource?.created_date && new Date(sharedLink.resource.created_date).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {sharedLink.resource?.content || sharedLink.resource?.body || sharedLink.resource?.title || 'No preview available'}
              </pre>
            </CardContent>
          </Card>
        )}

        {!user && (
          <Card className="mb-6 border-indigo-200">
            <CardContent className="py-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Sign in to like, save, and share your own content.</p>
                <p className="text-sm text-gray-500">Anyone can browse the public feed.</p>
              </div>
              <Button onClick={() => api.auth.redirectToLogin('/SharedContent' + window.location.search)}>Sign In</Button>
            </CardContent>
          </Card>
        )}

        {!hasCommunityAccess && (
          <Card className="mb-6 border-purple-200">
            <CardContent className="flex items-start gap-3 py-5">
              <Crown className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
              <div>
                <p className="font-medium">Community discovery requires Premium</p>
                <p className="text-sm text-gray-500">
                  Your private content remains available below. Public feeds, likes, and saves stay locked until Community access is active.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          key={hasCommunityAccess ? 'community' : 'personal'}
          defaultValue={hasCommunityAccess ? 'popular' : 'mine'}
          className="space-y-6"
        >
          <TabsList>
            {hasCommunityAccess && <TabsTrigger value="popular">Popular</TabsTrigger>}
            {hasCommunityAccess && <TabsTrigger value="recent">Recent</TabsTrigger>}
            <TabsTrigger value="mine">My Shared Content</TabsTrigger>
          </TabsList>

          {hasCommunityAccess && <>
          <div className="flex gap-2 mb-6">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'note' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('note')}
            >
              Notes
            </Button>
            <Button
              variant={filter === 'highlight' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('highlight')}
            >
              Highlights
            </Button>
            <Button
              variant={filter === 'study' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('study')}
            >
              Studies
            </Button>
            <Button
              variant={filter === 'sermon' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('sermon')}
            >
              Sermons
            </Button>
          </div>

          <TabsContent value="popular" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              </div>
            ) : sharedContent.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Share2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">No shared content yet</p>
                  <p className="text-gray-600">Be the first to share your insights!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...sharedContent].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).map((content) => (
                  <Card key={content.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{content.title}</CardTitle>
                          <CardDescription>by {content.user_name}</CardDescription>
                        </div>
                        <Badge>{content.content_type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 mb-3">
                        {content.content}
                      </p>
                      {content.scripture_reference && (
                        <Badge variant="outline" className="mb-3">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {content.scripture_reference}
                        </Badge>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <button 
                            onClick={() => handleLike(content)}
                            className="flex items-center gap-1 hover:text-red-500"
                          >
                            <Heart className="w-4 h-4" />
                            {content.likes_count || 0}
                          </button>
                          <span className="flex items-center gap-1">
                            <Bookmark className="w-4 h-4" />
                            {content.saves_count || 0}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSave(content)}
                        >
                          <Bookmark className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sharedContent.map((content) => (
                  <Card key={content.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{content.title}</CardTitle>
                          <CardDescription>
                            by {content.user_name} • {new Date(content.created_date).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge>{content.content_type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 mb-3">
                        {content.content}
                      </p>
                      {content.scripture_reference && (
                        <Badge variant="outline" className="mb-3">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {content.scripture_reference}
                        </Badge>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <button 
                            onClick={() => handleLike(content)}
                            className="flex items-center gap-1 hover:text-red-500"
                          >
                            <Heart className="w-4 h-4" />
                            {content.likes_count || 0}
                          </button>
                          <span className="flex items-center gap-1">
                            <Bookmark className="w-4 h-4" />
                            {content.saves_count || 0}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSave(content)}
                        >
                          <Bookmark className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          </>}

          <TabsContent value="mine" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
              </div>
            ) : myShared.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Share2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">You haven't shared anything yet</p>
                  <p className="text-gray-600 mb-4">Share your notes, highlights, or studies with the community!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myShared.map((content) => (
                  <Card key={content.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{content.title}</CardTitle>
                        <Badge>{content.content_type}</Badge>
                      </div>
                      <CardDescription>
                        {new Date(content.created_date).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 mb-3">
                        {content.content}
                      </p>
                      <Badge variant="outline" className="mb-3">
                        {content.visibility}
                      </Badge>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          {content.likes_count || 0} likes
                        </span>
                        <span className="flex items-center gap-1">
                          <Bookmark className="w-4 h-4" />
                          {content.saves_count || 0} saves
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
