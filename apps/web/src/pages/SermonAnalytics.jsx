import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Eye, Copy, Star, Users, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function SermonAnalytics() {
  const { user, isLoadingAuth } = useAuth();
  const [sermons, setSermons] = useState([]);
  const [sharedSermons, setSharedSermons] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [series, setSeries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // days

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      toast.error("Please log in");
      api.auth.redirectToLogin?.();
      return;
    }
    loadAnalyticsData();
  }, [isLoadingAuth, user, timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAnalyticsData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [userSermons, publicSermons, allRatings, userSeries] = await Promise.all([
        api.entities.Sermon.filter({ user_id: user.id }),
        api.entities.SharedSermon.filter({ creator_id: user.id }),
        api.entities.SermonRating.list(),
        api.entities.SermonSeries.filter({ user_id: user.id })
      ]);

      setSermons(userSermons);
      setSharedSermons(publicSermons);
      setRatings(allRatings);
      setSeries(userSeries);
    } catch (error) {
      toast.error(logError('Failed to load analytics data', error));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate metrics
  const totalSermons = sermons.length;
  const totalShared = sharedSermons.length;
  const totalViews = sharedSermons.reduce((sum, s) => sum + (s.view_count || 0), 0);
  const totalForks = sharedSermons.reduce((sum, s) => sum + (s.fork_count || 0), 0);
  
  const userRatings = ratings.filter(r => 
    sharedSermons.some(s => s.sermon_id === r.sermon_id)
  );
  const avgRating = userRatings.length > 0
    ? (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1)
    : "N/A";

  // Engagement over time
  const getEngagementData = () => {
    const data = [];
    for (let i = timeRange - 1; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const dateStr = format(date, 'MMM dd');
      
      const daySermons = sharedSermons.filter(s => {
        const created = startOfDay(new Date(s.created_date));
        return created.getTime() === date.getTime();
      });

      data.push({
        date: dateStr,
        views: daySermons.reduce((sum, s) => sum + (s.view_count || 0), 0),
        forks: daySermons.reduce((sum, s) => sum + (s.fork_count || 0), 0),
        shared: daySermons.length
      });
    }
    return data;
  };

  // Popular topics
  const getTopicData = () => {
    const topicCount = {};
    sermons.forEach(s => {
      if (s.topic) {
        topicCount[s.topic] = (topicCount[s.topic] || 0) + 1;
      }
    });
    
    return Object.entries(topicCount)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  // Popular passages
  const getPassageData = () => {
    const passageCount = {};
    sermons.forEach(s => {
      if (s.anchor_passage) {
        passageCount[s.anchor_passage] = (passageCount[s.anchor_passage] || 0) + 1;
      }
    });
    
    return Object.entries(passageCount)
      .map(([passage, count]) => ({ passage, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  // Top performing sermons
  const getTopSermons = () => {
    return sharedSermons
      .map(shared => {
        const sermon = sermons.find(s => s.id === shared.sermon_id);
        const sermonRatings = ratings.filter(r => r.sermon_id === shared.sermon_id);
        const avgRating = sermonRatings.length > 0
          ? sermonRatings.reduce((sum, r) => sum + r.rating, 0) / sermonRatings.length
          : 0;
        
        return {
          ...shared,
          title: sermon ? sermon.title : "Unknown",
          topic: sermon?.topic || "",
          engagement: (shared.view_count || 0) + (shared.fork_count || 0) * 5 + avgRating * 10,
          avgRating
        };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);
  };

  // Series performance
  const getSeriesPerformance = () => {
    return series.map(s => {
      const seriesSermons = sermons.filter(sermon => sermon.series_id === s.id);
      const sharedCount = seriesSermons.filter(sermon => 
        sharedSermons.some(shared => shared.sermon_id === sermon.id)
      ).length;
      
      return {
        title: s.title,
        sermons: seriesSermons.length,
        shared: sharedCount,
        status: s.status
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const engagementData = getEngagementData();
  const topicData = getTopicData();
  const passageData = getPassageData();
  const topSermons = getTopSermons();
  const seriesPerformance = getSeriesPerformance();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Sermon Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Track your sermon impact and engagement
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={timeRange === 7 ? "default" : "outline"}
            onClick={() => setTimeRange(7)}
            size="sm"
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === 30 ? "default" : "outline"}
            onClick={() => setTimeRange(30)}
            size="sm"
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === 90 ? "default" : "outline"}
            onClick={() => setTimeRange(90)}
            size="sm"
          >
            90 Days
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-3xl font-bold mt-2">{totalSermons}</p>
              <p className="text-sm text-gray-600">Total Sermons</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-3xl font-bold mt-2">{totalShared}</p>
              <p className="text-sm text-gray-600">Shared Public</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Eye className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-3xl font-bold mt-2">{totalViews}</p>
              <p className="text-sm text-gray-600">Total Views</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Copy className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-3xl font-bold mt-2">{totalForks}</p>
              <p className="text-sm text-gray-600">Forks</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Star className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold mt-2">{avgRating}</p>
              <p className="text-sm text-gray-600">Avg Rating</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-8 h-8 text-pink-600" />
              </div>
              <p className="text-3xl font-bold mt-2">{userRatings.length}</p>
              <p className="text-sm text-gray-600">Total Ratings</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="engagement" className="space-y-6">
          <TabsList>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Over Time</CardTitle>
                <CardDescription>Views, forks, and shares in the last {timeRange} days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} />
                    <Line type="monotone" dataKey="forks" stroke="#06b6d4" strokeWidth={2} />
                    <Line type="monotone" dataKey="shared" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Sermons</CardTitle>
                <CardDescription>Based on views, forks, and ratings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSermons.map((sermon, index) => (
                    <div key={sermon.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <Badge className="text-lg font-bold w-8 h-8 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-semibold">{sermon.title}</p>
                          <p className="text-sm text-gray-600">{sermon.topic}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4 text-purple-600" />
                          <span>{sermon.view_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Copy className="w-4 h-4 text-orange-600" />
                          <span>{sermon.fork_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-600" />
                          <span>{sermon.avgRating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {topSermons.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      Share some sermons publicly to see performance data!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Popular Topics</CardTitle>
                  <CardDescription>Most preached topics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topicData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="topic" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Popular Passages</CardTitle>
                  <CardDescription>Most used anchor passages</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={passageData}
                        dataKey="count"
                        nameKey="passage"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {passageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Content Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{sermons.filter(s => s.status === 'draft').length}</p>
                    <p className="text-sm text-gray-600 mt-1">Drafts</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{sermons.filter(s => s.status === 'completed').length}</p>
                    <p className="text-sm text-gray-600 mt-1">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">{sermons.filter(s => s.series_id).length}</p>
                    <p className="text-sm text-gray-600 mt-1">In Series</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-3xl font-bold text-orange-600">{series.length}</p>
                    <p className="text-sm text-gray-600 mt-1">Total Series</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Series Performance</CardTitle>
                <CardDescription>Overview of your sermon series</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {seriesPerformance.map((s, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{s.title}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{s.status}</Badge>
                          <Badge variant="secondary">{s.sermons} sermons</Badge>
                          <Badge variant="secondary">{s.shared} shared</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">
                          {s.sermons > 0 ? Math.round((s.shared / s.sermons) * 100) : 0}%
                        </p>
                        <p className="text-xs text-gray-600">Share Rate</p>
                      </div>
                    </div>
                  ))}
                  {seriesPerformance.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No series created yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Rate</CardTitle>
                  <CardDescription>Views per shared sermon</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-5xl font-bold text-indigo-600">
                      {totalShared > 0 ? Math.round(totalViews / totalShared) : 0}
                    </p>
                    <p className="text-gray-600 mt-2">Views per sermon</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fork Rate</CardTitle>
                  <CardDescription>How often sermons are forked</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-5xl font-bold text-orange-600">
                      {totalViews > 0 ? ((totalForks / totalViews) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-gray-600 mt-2">Fork to view ratio</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}