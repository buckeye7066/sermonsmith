import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity,
  BookOpen,
  FileText,
  Brain,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function AdminAnalytics() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAnalytics();
    }
  }, [user]);

  const loadCurrentUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.role !== 'admin') {
        toast.error("Admin access required");
      }
    } catch (error) {
      toast.error("Please log in");
    }
  };

  const loadAnalytics = async () => {
    try {
      const allActivities = await base44.entities.UserActivity.list('-created_date', 5000);
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
        userActivityCounts[a.user_email] = (userActivityCounts[a.user_email] || 0) + 1;
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
      console.error("Error loading analytics:", error);
      toast.error("Failed to load analytics");
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Usage Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track user engagement and popular features
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total?.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">
                Last 24 Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.last24h}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.uniqueUsers24h} unique users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">
                Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.last7d}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.uniqueUsers7d} unique users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">
                Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.last30d}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.uniqueUsers30d} unique users
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Actions */}
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
                  <div key={action} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <span className="font-medium">{action.replace(/_/g, ' ')}</span>
                    </div>
                    <Badge className="bg-indigo-600">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Pages */}
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
                  <div key={page} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <span className="font-medium">{page}</span>
                    </div>
                    <Badge className="bg-blue-600">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Most Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Most Active Users (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topUsers?.map(([email, count], idx) => (
                <div key={email} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{idx + 1}</Badge>
                    <span className="font-medium">{email}</span>
                  </div>
                  <Badge className="bg-green-600">{count} actions</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Stream */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Recent Activity (Last 50)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activities.slice(0, 50).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between border-b pb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{activity.user_email}</div>
                    <div className="text-xs text-gray-500">
                      {activity.action_type.replace(/_/g, ' ')} 
                      {activity.page_name && ` • ${activity.page_name}`}
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
      </div>
    </div>
  );
}