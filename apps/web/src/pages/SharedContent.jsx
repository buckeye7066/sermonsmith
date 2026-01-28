import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Bookmark, TrendingUp, BookOpen, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function SharedContent() {
  const [user, setUser] = useState(null);
  const [sharedContent, setSharedContent] = useState([]);
  const [myShared, setMyShared] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadContent();
    }
  }, [user, filter]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      toast.error("Please log in to view shared content");
    } finally {
      setIsLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      let allContent;
      
      if (filter === 'all') {
        allContent = await base44.entities.SharedContent.filter({ visibility: 'public' }, '-created_date', 50);
      } else {
        allContent = await base44.entities.SharedContent.filter({ 
          visibility: 'public',
          content_type: filter
        }, '-created_date', 50);
      }

      const userContent = await base44.entities.SharedContent.filter({ user_id: user.id }, '-created_date');

      setSharedContent(allContent);
      setMyShared(userContent);
    } catch (error) {
      console.error('Error loading content:', error);
    }
  };

  const handleLike = async (content) => {
    try {
      await base44.entities.SharedContent.update(content.id, {
        likes_count: (content.likes_count || 0) + 1
      });
      toast.success("Liked!");
      loadContent();
    } catch (error) {
      toast.error("Failed to like");
    }
  };

  const handleSave = async (content) => {
    try {
      await base44.entities.SharedContent.update(content.id, {
        saves_count: (content.saves_count || 0) + 1
      });
      toast.success("Saved to your collection!");
      loadContent();
    } catch (error) {
      toast.error("Failed to save");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Share2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to view shared content</p>
            <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
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
            Discover notes, highlights, and insights shared by the community.
          </p>
        </div>

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