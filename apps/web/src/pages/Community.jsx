import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare, BookOpen, TrendingUp, Heart, Calendar, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function Community() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState([]);
  const [popularShared, setPopularShared] = useState([]);
  const [activeGroups, setActiveGroups] = useState([]);
  const [readingPlans, setReadingPlans] = useState([]);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadCommunityData();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      
      // Check premium status
      const devEmails = ['buckeye7066@gmail.com', 'anyawhite@rocketmail.com', 'whiterobert1201@icloud.com', 'tishka1201@icloud.com'];
      const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
      const emailMatch = currentUser.email && devEmails.includes(currentUser.email.toLowerCase());
      const phoneMatch = currentUser.phone && devPhones.some(p => 
        currentUser.phone.replace(/[\s\-()]/g, '').includes(p.replace(/[\s\-()+]/g, ''))
      );
      const premium = currentUser.subscription_tier === 'premium' || 
                      currentUser.premium_override === true ||
                      emailMatch || phoneMatch ||
                      (currentUser.premium_until && new Date(currentUser.premium_until) > new Date());
      setIsPremium(premium);
    } catch (error) {
      console.log("User not logged in");
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityData = async () => {
    try {
      const [posts, shared, groups, plans] = await Promise.all([
        api.entities.CommunityPost.list('-created_date', 5),
        api.entities.SharedContent.list('-likes_count', 5),
        api.entities.StudyGroup.list('-member_count', 5),
        api.entities.ReadingPlan.list('-followers_count', 5)
      ]);

      setRecentPosts(posts);
      setPopularShared(shared);
      setActiveGroups(groups);
      setReadingPlans(plans);
    } catch (error) {
      console.error('Error loading community data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-8 text-white text-center">
            <Users className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Join the Community</h2>
            <p className="text-lg mb-6">Connect with fellow believers, share insights, and grow together in faith.</p>
            <Button onClick={() => api.auth.redirectToLogin()} className="bg-white text-indigo-600 hover:bg-gray-100">
              Sign In to Join
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white text-center">
            <Crown className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Community Features - Premium</h2>
            <p className="text-lg mb-6">
              Connect with other believers, join study groups, and share your insights with the community.
            </p>
            <Link to={createPageUrl('Pricing')}>
              <Button className="bg-white text-indigo-600 hover:bg-gray-100">
                Upgrade to Premium
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            Community
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Connect, learn, and grow together with fellow believers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to={createPageUrl('Forum')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <MessageSquare className="w-12 h-12 text-blue-500 mb-3" />
                <h3 className="text-xl font-semibold mb-2">Discussion Forum</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ask questions, share insights, and discuss Scripture with the community.
                </p>
                <Badge className="mt-3">{recentPosts.length} recent posts</Badge>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('StudyGroups')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <BookOpen className="w-12 h-12 text-green-500 mb-3" />
                <h3 className="text-xl font-semibold mb-2">Study Groups</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Join or create groups to study specific books or themes together.
                </p>
                <Badge className="mt-3">{activeGroups.length} active groups</Badge>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('SharedContent')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <TrendingUp className="w-12 h-12 text-purple-500 mb-3" />
                <h3 className="text-xl font-semibold mb-2">Shared Content</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Discover notes, highlights, and insights shared by the community.
                </p>
                <Badge className="mt-3">{popularShared.length} popular items</Badge>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList>
            <TabsTrigger value="recent">Recent Activity</TabsTrigger>
            <TabsTrigger value="popular">Popular Content</TabsTrigger>
            <TabsTrigger value="plans">Reading Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-4">
            <h2 className="text-2xl font-bold">Recent Discussions</h2>
            {recentPosts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No posts yet. Be the first to start a discussion!</p>
                  <Link to={createPageUrl('Forum')}>
                    <Button className="mt-4">Start a Discussion</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              recentPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{post.title}</CardTitle>
                        <CardDescription>
                          by {post.user_name} • {new Date(post.created_date).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant={post.post_type === 'question' ? 'default' : 'secondary'}>
                        {post.post_type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{post.content}</p>
                    {post.scripture_reference && (
                      <Badge variant="outline" className="mt-2">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {post.scripture_reference}
                      </Badge>
                    )}
                    <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {post.replies_count} replies
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {post.likes_count} likes
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="popular" className="space-y-4">
            <h2 className="text-2xl font-bold">Popular Shared Content</h2>
            {popularShared.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No shared content yet. Share your insights with the community!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {popularShared.map((content) => (
                  <Card key={content.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{content.title}</CardTitle>
                          <CardDescription>
                            by {content.user_name}
                          </CardDescription>
                        </div>
                        <Badge>{content.content_type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{content.content}</p>
                      {content.scripture_reference && (
                        <Badge variant="outline" className="mt-2">
                          {content.scripture_reference}
                        </Badge>
                      )}
                      <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          {content.likes_count}
                        </span>
                        <span>{content.saves_count} saves</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <h2 className="text-2xl font-bold">Community Reading Plans</h2>
            {readingPlans.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No reading plans yet. Create one to share with the community!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {readingPlans.map((plan) => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>by {plan.creator_name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{plan.description}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="outline">{plan.duration_days} days</Badge>
                        <Badge variant="outline">{plan.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{plan.followers_count} following</span>
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