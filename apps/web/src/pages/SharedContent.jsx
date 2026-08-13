import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Bookmark, TrendingUp, BookOpen, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function SharedContent() {
  const { user, isLoadingAuth } = useAuth();
  const [sharedContent, setSharedContent] = useState([]);
  const [myShared, setMyShared] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sharedLink, setSharedLink] = useState(null);

  useEffect(() => {
    // Ensure this code only runs on the client side
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const linkSlug = params.get('link');
      if (linkSlug) {
        api.community.share(linkSlug)
          .then((result) => setSharedLink(result))
          .catch((err) => {
            toast.error(logError('Could not load share link', err));
          });
      }
    }
  }, []);

  useEffect(() => {
    if (isLoadingAuth) return;
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAuth, user, filter]);

  const loadContent = async () => {
    setIsLoading(true);
    try {
      // Public feed uses the dedicated /api/community route so we actually
      // see other users' public content. Without this, the generic entity
      // API tenant-scopes to the caller and the "public" tab is empty.
      const allContent = await api.community.sharedContent(filter);
      setSharedContent(allContent);

      if (user) {
        const userContent = await api.entities.SharedContent.filter(
          {},
          '-created_date',
          50
        );
        setMyShared(userContent);
      } else {
        setMyShared([]);
      }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            Shared Content
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Discover notes, highlights, and insights shared by the community.
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

        <Tabs defaultValue="popular" className="space-y-6">
          <TabsList>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="mine">My Shared Content</TabsTrigger>
          </TabsList>

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

          <TabsContent value="mine" className="space-y-4">
            {myShared.length === 0 ? (
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
