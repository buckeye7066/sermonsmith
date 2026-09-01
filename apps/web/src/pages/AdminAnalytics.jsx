import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity,
  BookOpen,
  Loader2,
  Search,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

function activityActor(activity) {
  if (activity.user_id) return `User ${String(activity.user_id).slice(0, 8)}`;
  return activity.user_email || 'Unknown user';
}

export default function AdminAnalytics() {
  const { user, isLoadingAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      toast.error("Please log in");
      return;
    }
    if (user.role !== 'admin') {
      toast.error("Admin access required");
      return;
    }
    loadAnalytics();
  }, [isLoadingAuth, user]);

  const loadAnalytics = async () => {
    try {
      const allActivities = await api.entities.UserActivity.list('-created_date', 5000);
      setActivities(allActivities);

      // Calculate stats
      const now = new Date();
      const last24h = new Date(now - 24 * 60 * 60 * 1000);
      const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const recent24h = allActivities.filter(a => new Date(a.created_date) > last24h);
      const recent7d = allActivities.filter(a => new Date(a.created_date) > last7d);
      const recent30d = allActivities.filter(a => new Date(a.created_date) > last30d);

      // Count by action type
      const actionCounts = {};
      allActivities.forEach(a => {
        actionCounts[a.action_type] = (actionCounts[a.action_type] || 0) + 1;
      });

      // Count by page
      const pageCounts = {};
      allActivities.forEach(a => {
        if (a.page_name) {
          pageCounts[a.page_name] = (pageCounts[a.page_name] || 0) + 1;
        }
      });

      // Unique users
      const uniqueUsers24h = new Set(recent24h.map(a => a.user_id)).size;
      const uniqueUsers7d = new Set(recent7d.map(a => a.user_id)).size;
      const uniqueUsers30d = new Set(recent30d.map(a => a.user_id)).size;

      // Most active users
      const userActivityCounts = {};
      recent30d.forEach(a => {
        const userKey = a.user_id || a.user_email || 'unknown';
        userActivityCounts[userKey] = (userActivityCounts[userKey] || 0) + 1;
      });

      const topUsers = Object.entries(userActivityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      setStats({
        total: allActivities.length,
        last24h: recent24h.length,
        last7d: recent7d.length,
        last30d: recent30d.length,
        uniqueUsers24h,
        uniqueUsers7d,
        uniqueUsers30d,
        actionCounts,
        pageCounts,
        topUsers,
        topActions: Object.entries(actionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        topPages: Object.entries(pageCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
      });
    } catch (error) {
      // apiFetch surfaces error.status / error.data — not the axios
      // error.response / error.request shape, which is never present here.
      console.error("Error loading analytics:", error);
      if (error?.status) {
        toast.error(`Failed to load analytics (${error.status})`, {
          description: error?.data?.message,
        });
      } else {
        toast.error("Failed to load analytics. Please check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Admin Access Required</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-600 rounded-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Admin Analytics Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track user activity, popular features, and platform usage
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Activities</p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                    {stats.total?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-full">
                  <Activity className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Searches</p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                    {stats.actionCounts?.search_performed || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-200 dark:bg-purple-800 rounded-full">
                  <Search className="w-8 h-8 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Bible Reads</p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">
                    {stats.actionCounts?.bible_read || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-200 dark:bg-green-800 rounded-full">
                  <BookOpen className="w-8 h-8 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">AI Features</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-2">
                    {stats.actionCounts?.ai_feature_used || 0}
                  </p>
                </div>
                <div className="p-3 bg-amber-200 dark:bg-amber-800 rounded-full">
                  <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="popular">Popular Features</TabsTrigger>
            <TabsTrigger value="users">Active Users</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-gray-600">Last 24 Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.last24h}</div>
                  <p className="text-xs text-gray-500 mt-1">{stats.uniqueUsers24h} unique users</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-gray-600">Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.last7d}</div>
                  <p className="text-xs text-gray-500 mt-1">{stats.uniqueUsers7d} unique users</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-gray-600">Last 30 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{stats.last30d}</div>
                  <p className="text-xs text-gray-500 mt-1">{stats.uniqueUsers30d} unique users</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Breakdown of user actions across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.topActions?.slice(0, 8).map(([action, count]) => {
                    const percentage = ((count / stats.total) * 100).toFixed(1);
                    return (
                      <div key={action}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">{action.replace(/_/g, ' ')}</span>
                          <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Popular Features Tab */}
          <TabsContent value="popular" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Most Popular Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topActions?.map(([action, count], idx) => (
                      <div key={action} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">{idx + 1}</span>
                          </div>
                          <span className="font-medium capitalize">{action.replace(/_/g, ' ')}</span>
                        </div>
                        <Badge className="bg-indigo-600">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Most Visited Pages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topPages?.map(([page, count], idx) => (
                      <div key={page} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-300">{idx + 1}</span>
                          </div>
                          <span className="font-medium">{page}</span>
                        </div>
                        <Badge className="bg-blue-600">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Active Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  Most Active Users (Last 30 Days)
                </CardTitle>
                <CardDescription>Top users by activity count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topUsers?.map(([userKey, count], idx) => (
                    <div key={userKey} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900' :
                          idx === 1 ? 'bg-gray-200 dark:bg-gray-700' :
                          idx === 2 ? 'bg-orange-100 dark:bg-orange-900' :
                          'bg-green-100 dark:bg-green-900'
                        }`}>
                          <span className={`text-lg font-bold ${
                            idx === 0 ? 'text-yellow-600 dark:text-yellow-300' :
                            idx === 1 ? 'text-gray-600 dark:text-gray-300' :
                            idx === 2 ? 'text-orange-600 dark:text-orange-300' :
                            'text-green-600 dark:text-green-300'
                          }`}>
                            {idx + 1}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{userKey.includes('@') ? userKey : `User ${userKey.slice(0, 8)}`}</div>
                          <div className="text-xs text-gray-500">{count} total actions</div>
                        </div>
                      </div>
                      <Badge className="bg-green-600">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Recent Activity Stream
                </CardTitle>
                <CardDescription>Last 50 user activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {activities.slice(0, 50).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{activityActor(activity)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          <Badge variant="outline" className="mr-2">{activity.action_type.replace(/_/g, ' ')}</Badge>
                          {activity.page_name && <span>on {activity.page_name}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(activity.created_date).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}