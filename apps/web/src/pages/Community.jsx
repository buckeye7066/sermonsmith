import React, { useState, useEffect, useMemo } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Heart,
  Calendar,
  Crown,
  Search,
  UserPlus,
  UserCheck,
  Loader2,
} from "lucide-react";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";


export default function Community() {
  const { user, isLoadingAuth: loading } = useAuth();
  const [recentPosts, setRecentPosts] = useState([]);
  const [popularShared, setPopularShared] = useState([]);
  const [activeGroups, setActiveGroups] = useState([]);
  const [readingPlans, setReadingPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [interactionId, setInteractionId] = useState(null);

  // Derive premium status from the shared user object; keep the dev-list
  // overrides that existed in the previous local fetch.
  const isPremium = useMemo(() => {
    if (!user) return false;
    const devEmails = ['buckeye7066@gmail.com', 'anyawhite@rocketmail.com', 'whiterobert1201@icloud.com', 'tishka1201@icloud.com'];
    const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
    const emailMatch = user && user.email && devEmails.includes(user.email.toLowerCase());
    const phoneMatch = user.promotionalPhone && devPhones.some(p =>
      user.promotionalPhone.replace(/[\s\-()]/g, '').includes(p.replace(/[\s\-()+]/g, ''))
    );
    return user.subscription_tier === 'premium' ||
           user.premium_override === true ||
           emailMatch || phoneMatch ||
           (user.premium_until && new Date(user.premium_until) > new Date());
  }, [user]);

  useEffect(() => {
    if (user) loadCommunityData();
  }, [user]);

  const [error, setError] = useState(null);

  const loadCommunityData = async () => {
    try {
      // Public community feeds (across all members) — the old entity-API reads
      // were tenant-scoped, so the landing only ever showed the viewer's own
      // content and looked empty.
      const [posts, shared, groups, plans, memberResult] = await Promise.all([
        api.community.posts(),
        api.community.sharedContent('all'),
        api.community.studyGroups(),
        api.community.readingPlans(),
        api.community.members(),
      ]);

      setRecentPosts((posts || []).slice(0, 5));
      setPopularShared(
        (shared || []).slice().sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 5),
      );
      setActiveGroups((groups || []).slice(0, 5));
      setReadingPlans((plans || []).slice(0, 5));
      setMembers(memberResult?.members || []);
    } catch (error) {
      logError('Error loading community data', error);
      setError('There was a problem loading community data. Please try again later.');
    }
  };

  const searchMembers = async (event) => {
    event?.preventDefault();
    setMembersLoading(true);
    try {
      const result = await api.community.members({ q: memberQuery.trim() });
      setMembers(result?.members || []);
    } catch (searchError) {
      logError('Error searching community members', searchError);
      toast.error('Member search failed. Please try again.');
    } finally {
      setMembersLoading(false);
    }
  };

  const toggleFollow = async (member) => {
    setInteractionId(`member:${member.id}`);
    try {
      if (member.followedByMe) await api.community.unfollowMember(member.id);
      else await api.community.followMember(member.id);
      setMembers((current) => current.map((item) => item.id === member.id ? {
        ...item,
        followedByMe: !member.followedByMe,
        followerCount: Math.max(0, Number(item.followerCount || 0) + (member.followedByMe ? -1 : 1)),
      } : item));
      toast.success(member.followedByMe ? `Unfollowed ${member.name}` : `Following ${member.name}`);
    } catch (followError) {
      logError('Error updating member follow', followError);
      toast.error('Could not update this connection.');
    } finally {
      setInteractionId(null);
    }
  };

  const togglePostLike = async (post) => {
    setInteractionId(`post:${post.id}`);
    try {
      const updated = post.likedByMe
        ? await api.community.unlikePost(post.id)
        : await api.community.likePost(post.id);
      setRecentPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...updated } : item));
    } catch (likeError) {
      logError('Error updating post like', likeError);
      toast.error('Could not update this like.');
    } finally {
      setInteractionId(null);
    }
  };

  const likeSharedContent = async (content) => {
    setInteractionId(`shared:${content.id}`);
    try {
      const updated = await api.community.like(content.id);
      setPopularShared((current) => current.map((item) => item.id === content.id ? { ...item, ...updated } : item));
    } catch (likeError) {
      logError('Error liking shared content', likeError);
      toast.error('Could not like this item.');
    } finally {
      setInteractionId(null);
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

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </div>
        )}

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

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="members">Find Members</TabsTrigger>
            <TabsTrigger value="recent">Recent Activity</TabsTrigger>
            <TabsTrigger value="popular">Popular Content</TabsTrigger>
            <TabsTrigger value="plans">Reading Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Find Community Members</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Search by name, discover ministry interests, and follow people whose work you value.
              </p>
            </div>
            <form onSubmit={searchMembers} className="flex gap-2 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  aria-label="Search community members"
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="Search members by name"
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={membersLoading}>
                {membersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </form>

            {members.length === 0 && !membersLoading ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
                  <p>No members matched that search.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
                            {member.name?.slice(0, 1)?.toUpperCase() || 'M'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-lg">{member.name}</CardTitle>
                          <CardDescription>
                            {member.denomination || member.preachingStyle || 'Community member'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {member.ministryFocus?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {member.ministryFocus.slice(0, 4).map((focus) => (
                            <Badge key={focus} variant="secondary">{focus}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{member.followerCount || 0} followers</span>
                        <span>{member.followingCount || 0} following</span>
                      </div>
                      <Button
                        type="button"
                        variant={member.followedByMe ? 'outline' : 'default'}
                        className="w-full"
                        disabled={interactionId === `member:${member.id}`}
                        onClick={() => toggleFollow(member)}
                      >
                        {interactionId === `member:${member.id}` ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : member.followedByMe ? (
                          <UserCheck className="mr-2 h-4 w-4" />
                        ) : (
                          <UserPlus className="mr-2 h-4 w-4" />
                        )}
                        {member.followedByMe ? 'Following' : 'Follow'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

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
                        {post.replies_count || 0} replies
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={post.likedByMe ? 'text-red-600' : ''}
                        disabled={interactionId === `post:${post.id}`}
                        onClick={() => togglePostLike(post)}
                      >
                        <Heart className={`mr-1 h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                        {post.likes_count || 0} likes
                      </Button>
                      <Link to={`${createPageUrl('Forum')}?post=${encodeURIComponent(post.id)}`}>
                        <Button variant="outline" size="sm">Open discussion</Button>
                      </Link>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={interactionId === `shared:${content.id}`}
                          onClick={() => likeSharedContent(content)}
                        >
                          <Heart className="mr-1 h-4 w-4" />
                          {content.likes_count || 0}
                        </Button>
                        <span>{content.saves_count || 0} saves</span>
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
