import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Search,
  Star,
  TrendingUp,
  Clock,
  Eye,
  GitFork,
  Loader2,
  Sparkles,
  Filter,
  Users,
  FileText,
  Layers,
  Heart,
  Share2,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SermonViewer from "@/components/library/SermonViewer";
import ShareSermonDialog from "@/components/library/ShareSermonDialog";
import ForkSermonDialog from "@/components/library/ForkSermonDialog";
import RatingDialog from "@/components/library/RatingDialog";
import ThematicLinker from "@/components/discovery/ThematicLinker";
import SermonTagsNotesDialog from "@/components/library/SermonTagsNotesDialog";
import SeriesManager from "@/components/library/SeriesManager";

export default function SermonLibrary() {
  const [user, setUser] = useState(null);
  const [sermons, setSermons] = useState([]); // Renamed from sharedSermons
  const [sharedSeries, setSharedSeries] = useState([]);
  const [mySermons, setMySermons] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Overall loading for the page
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedDenomination, setSelectedDenomination] = useState("all");
  const [selectedSeries, setSelectedSeries] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [sortBy, setSortBy] = useState("popular");
  const [viewMode, setViewMode] = useState("sermons"); // sermons or series
  const [selectedSermon, setSelectedSermon] = useState(null); // Used for viewing, sharing, forking, rating
  const [showSermonViewer, setShowSermonViewer] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [recommendations, setRecommendations] = useState([]); // For button-triggered AI recommendations
  const [recommendedSermons, setRecommendedSermons] = useState([]); // New state for personalized recommendations
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [showThematicLinks, setShowThematicLinks] = useState(false);
  const [selectedForThematic, setSelectedForThematic] = useState(null);
  const [showTagsNotesDialog, setShowTagsNotesDialog] = useState(false);
  const [showSeriesManager, setShowSeriesManager] = useState(false);

  // Effect for initial user load
  useEffect(() => {
    loadUser();
  }, []);

  // Effect for loading data based on user and sortBy, and generating personalized recommendations
  useEffect(() => {
    const fetchDataAndRecommendations = async () => {
      setIsLoading(true); // Start general loading
      try {
        await loadData(); // Load public sermons (with current sortBy), series, and tags.
        if (user) {
          await loadMySermons(); // Load user's sermons if logged in

          // Generate personalized recommendations if user has preferences AND sermons are loaded
          // Pass `sermons` state which `loadData` just updated.
          if (user.content_preferences?.favoriteTopics?.length > 0 && sermons.length > 0) {
            generatePersonalizedRecommendations(user, sermons);
          }
        }
      } catch (error) {
        console.error('Error fetching user-related data or public data:', error);
        toast.error("Failed to load library content.");
      } finally {
        setIsLoading(false); // End general loading
      }
    };

    fetchDataAndRecommendations();
  }, [user, sortBy]); // Rerun when user changes (login/logout) or sortBy changes

  // Effect for filtering content locally
  useEffect(() => {
    filterContent();
  }, [sermons, sharedSeries, searchQuery, selectedTags, selectedDenomination, selectedSeries, dateRange, viewMode]); // Removed sortBy because loadData now handles sort order for sermons

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not logged in");
      setUser(null); // Explicitly set user to null if not logged in
    }
  };

  const loadData = async () => {
    try {
      const currentSortBy =
        sortBy === 'rating' ? '-average_rating' :
        sortBy === 'popular' ? '-forks_count' : // Changed to forks_count for popular as per outline
        '-created_date'; // Default to recent if no specific sort applies

      const [fetchedSermons, fetchedSeries] = await Promise.all([
        base44.entities.SharedSermon.list(currentSortBy, 100),
        base44.entities.SharedSeries.list('-average_rating', 50)
      ]);

      setSermons(fetchedSermons); // Update sermons state (renamed from sharedSermons)
      setSharedSeries(fetchedSeries);

      // Extract all unique tags
      const tags = new Set();
      fetchedSermons.forEach(s => {
        s.ai_tags?.forEach(tag => tags.add(tag));
        s.style_tags?.forEach(tag => tags.add(tag));
      });
      setAllTags([...tags]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Failed to load shared content");
      throw error; // Re-throw to propagate error to the caller's catch block
    }
  };

  const loadMySermons = async () => {
    try {
      const userSermons = await base44.entities.Sermon.filter({ user_id: user.id });
      setMySermons(userSermons);
    } catch (error) {
      console.error('Error loading my sermons:', error);
      // Not re-throwing, as failure here shouldn't stop other loading.
    }
  };

  const filterContent = () => {
    let results = viewMode === 'sermons' ? [...sermons] : [...sharedSeries]; // Use `sermons` state

    // Search filter - enhanced with keywords
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(item =>
        item.title?.toLowerCase().includes(query) ||
        (item.series_title && item.series_title.toLowerCase().includes(query)) ||
        item.topic?.toLowerCase().includes(query) ||
        item.big_idea?.toLowerCase().includes(query) ||
        item.anchor_passage?.toLowerCase().includes(query) ||
        item.user_notes?.toLowerCase().includes(query) ||
        item.user_tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Tags filter - now includes user tags
    if (selectedTags.length > 0) {
      results = results.filter(item =>
        selectedTags.some(tag =>
          item.ai_tags?.includes(tag) || 
          item.style_tags?.includes(tag) ||
          item.user_tags?.includes(tag)
        )
      );
    }

    // Denomination filter
    if (selectedDenomination !== 'all') {
      results = results.filter(item => item.denomination === selectedDenomination);
    }

    // Series filter
    if (selectedSeries !== 'all') {
      results = results.filter(item => item.series_id === selectedSeries);
    }

    // Date range filter
    if (dateRange.start) {
      results = results.filter(item => new Date(item.created_date) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      results = results.filter(item => new Date(item.created_date) <= new Date(dateRange.end));
    }

    // IMPORTANT: Remove sorting for sermons, as `loadData` now fetches them pre-sorted by `sortBy`.
    // Only sort series if `viewMode` is 'series' and apply relevant sorting logic for series.
    if (viewMode === 'series') {
        switch (sortBy) {
            case 'popular':
            case 'rating': // Apply rating/popular for series as well, if applicable
                results.sort((a, b) => b.average_rating - a.average_rating);
                break;
            case 'recent':
                results.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
                break;
            case 'forked':
                results.sort((a, b) => b.forks_count - a.forks_count);
                break;
            // 'views' is generally for sermons, not series, so skip for series
            default:
                break; // No specific sort for series if sortBy is not directly applicable
        }
    }

    setFilteredContent(results);
  };

  const generateRecommendations = async () => { // Existing button-triggered recommendations
    if (!user || mySermons.length === 0) {
      toast.info("Save some sermons first to get personalized recommendations");
      return;
    }

    setIsLoadingRecommendations(true);

    try {
      const myTopics = mySermons.map(s => s.topic).filter(Boolean);
      const myPassages = mySermons.map(s => s.anchor_passage).filter(Boolean);

      const prompt = `I'm analyzing a user's sermon library to recommend sermons from our community.

User's Sermon Topics: ${myTopics.slice(0, 10).join(', ')}
User's Scripture Focus: ${myPassages.slice(0, 10).join(', ')}
User's Denomination: ${user.denomination || 'Non-Denominational'}

Available Community Sermons:
${sermons.slice(0, 20).map((s, i) => `
${i + 1}. "${s.title}" - ${s.topic} (${s.anchor_passage})
   Tags: ${s.ai_tags?.join(', ')}
   Rating: ${s.average_rating}⭐ (${s.ratings_count} reviews)
`).join('\n')}

Recommend 5-8 sermons that:
- Align with user's interests and topics
- Complement their existing library (not duplicate)
- Match their denomination when possible
- Have good ratings
- Offer fresh perspectives or related themes

Return sermon IDs with brief reason for recommendation.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sermon_id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Map recommendations to actual sermons
      const recommended = response.recommendations
        .map(rec => ({
          sermon: sermons.find(s => s.id === rec.sermon_id), // Use `sermons` state
          reason: rec.reason
        }))
        .filter(r => r.sermon);

      setRecommendations(recommended);
      toast.success(`Found ${recommended.length} personalized recommendations!`);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast.error("Failed to generate recommendations");
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const generatePersonalizedRecommendations = async (userData, availableSermons) => { // New function for auto-generated recommendations
    setIsLoadingRecommendations(true);

    try {
      const favoriteTopics = userData.content_preferences?.favoriteTopics || [];
      const denomination = userData.denomination;
      const audience = userData.study_preferences?.preferredAudience;

      if (favoriteTopics.length === 0 || availableSermons.length === 0) {
        setIsLoadingRecommendations(false);
        return;
      }

      const prompt = `Based on this user's preferences, recommend 5 sermons from the library:

User Profile:
- Favorite Topics: ${favoriteTopics.join(', ')}
- Denomination: ${denomination || 'Non-Denominational'}
- Ministry Audience: ${audience || 'General'}

Available Sermons (titles only):
${availableSermons.slice(0, 30).map((s, i) => `${i+1}. "${s.title}" - Topic: ${s.topic} - Denomination: ${s.denomination || 'N/A'}`).join('\n')}

Return the indices (1-based) of the 5 most relevant sermons for this user, prioritizing:
1. Topics they love
2. Denominational alignment
3. Audience fit
4. High ratings

Be strategic and personalized.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            indices: { type: "array", items: { type: "number" } },
            reasoning: { type: "string" }
          }
        }
      });

      const recommended = response.indices
        .map(idx => availableSermons[idx - 1])
        .filter(Boolean)
        .slice(0, 5);

      setRecommendedSermons(recommended);
      if (recommended.length > 0) {
        toast.success("Personalized recommendations loaded!");
      }
    } catch (error) {
      console.error('Error generating personalized recommendations:', error);
      toast.error("Failed to generate personalized recommendations.");
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleView = async (sermon) => {
    setSelectedSermon(sermon);
    setShowSermonViewer(true);

    // Increment view count
    try {
      await base44.entities.SharedSermon.update(sermon.id, {
        views_count: (sermon.views_count || 0) + 1
      });
      // Optionally update the sermon in `sermons` locally
      setSermons(prevSermons => prevSermons.map(s => s.id === sermon.id ? { ...s, views_count: (s.views_count || 0) + 1 } : s));
    } catch (error) {
      console.error('Error updating views:', error);
    }
  };

  const handleFork = (sermon) => {
    if (!user) {
      toast.error("Please log in to fork sermons");
      return;
    }
    setSelectedSermon(sermon);
    setShowForkDialog(true);
  };

  const handleRate = (sermon) => {
    if (!user) {
      toast.error("Please log in to rate sermons");
      return;
    }
    setSelectedSermon(sermon);
    setShowRatingDialog(true);
  };

  const handleDiscoverRelated = (sermon) => {
    setSelectedForThematic(sermon);
    setShowThematicLinks(true);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Sermon Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Discover, share, and adapt sermons from the community
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search sermons, topics, passages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="forked">Most Forked</SelectItem>
              <SelectItem value="views">Most Viewed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={generateRecommendations}
            disabled={isLoadingRecommendations || !user}
            variant="outline"
          >
            {isLoadingRecommendations ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            AI Recommendations
          </Button>

          {user && (
            <>
              <Button onClick={() => setShowSeriesManager(true)} variant="outline">
                <Layers className="w-4 h-4 mr-2" />
                Manage Series
              </Button>
              <Button onClick={() => setShowShareDialog(true)}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Sermon
              </Button>
            </>
          )}
        </div>

        {/* Advanced Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Filter by Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 15).map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-indigo-50 transition-colors"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTags([])}
                    className="mt-2"
                  >
                    Clear Tags
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">Denomination</Label>
                  <Select value={selectedDenomination} onValueChange={setSelectedDenomination}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Denominations</SelectItem>
                      <SelectItem value="Baptist">Baptist</SelectItem>
                      <SelectItem value="Methodist">Methodist</SelectItem>
                      <SelectItem value="Presbyterian">Presbyterian</SelectItem>
                      <SelectItem value="Pentecostal">Pentecostal</SelectItem>
                      <SelectItem value="Lutheran">Lutheran</SelectItem>
                      <SelectItem value="Catholic">Catholic</SelectItem>
                      <SelectItem value="Non-Denominational">Non-Denominational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">Sermon Series</Label>
                  <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Series</SelectItem>
                      {mySermons
                        .filter(s => s.series_id)
                        .reduce((acc, s) => {
                          if (!acc.find(x => x.series_id === s.series_id)) {
                            acc.push(s);
                          }
                          return acc;
                        }, [])
                        .map((s) => (
                          <SelectItem key={s.series_id} value={s.series_id}>
                            Series {s.series_id.substring(0, 8)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">Date Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {(selectedTags.length > 0 || selectedDenomination !== 'all' || selectedSeries !== 'all' || dateRange.start || dateRange.end) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTags([]);
                    setSelectedDenomination('all');
                    setSelectedSeries('all');
                    setDateRange({ start: '', end: '' });
                  }}
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Personalized Recommendations (new section) */}
        {recommendedSermons.length > 0 && user && (
          <Card className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-2 border-indigo-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Recommended For You
              </CardTitle>
              <CardDescription>
                Based on your interests: {user?.content_preferences?.favoriteTopics?.slice(0, 3).join(', ')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedSermons.map((sermon) => (
                  <Card key={sermon.id} className="hover:shadow-lg transition-shadow cursor-pointer border-indigo-200">
                    <CardHeader>
                      <CardTitle className="text-base line-clamp-2">{sermon.title}</CardTitle>
                      <CardDescription>by {sermon.user_name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span>{sermon.average_rating?.toFixed(1) || '0.0'}</span>
                        </div>
                        <Badge variant="outline">{sermon.topic}</Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(sermon)}
                        className="w-full"
                      >
                        View Sermon
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing AI Recommendations (from button) */}
        {recommendations.length > 0 && (
          <Card className="mb-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Recommendations From AI
              </CardTitle>
              <CardDescription>Based on your sermon library and interests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleView(rec.sermon)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{rec.sermon.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.reason}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{rec.sermon.topic}</Badge>
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span>{rec.sermon.average_rating?.toFixed(1) || '0.0'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="sermons">
              <FileText className="w-4 h-4 mr-2" />
              Individual Sermons ({sermons.length}) {/* Use `sermons` state */}
            </TabsTrigger>
            <TabsTrigger value="series">
              <Layers className="w-4 h-4 mr-2" />
              Sermon Series ({sharedSeries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sermons" className="mt-6">
            {filteredContent.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold mb-2">No sermons found</h3>
                  <p className="text-gray-600 mb-6">
                    {sermons.length === 0
                      ? "Be the first to share a sermon!"
                      : "Try adjusting your filters"}
                  </p>
                  {user && (
                    <Button onClick={() => setShowShareDialog(true)}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share Your First Sermon
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredContent.map((sermon) => (
                    <Card key={sermon.id} className="hover:shadow-xl transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg line-clamp-2">{sermon.title}</CardTitle>
                            <CardDescription className="mt-1">
                              by {sermon.user_name}
                            </CardDescription>
                          </div>
                        </div>
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="outline" className="text-xs">{sermon.topic}</Badge>
                          {sermon.denomination && (
                            <Badge variant="secondary" className="text-xs">{sermon.denomination}</Badge>
                          )}
                          {sermon.ai_tags?.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardHeader>

                      <CardContent>
                        {sermon.big_idea && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-4">
                            {sermon.big_idea}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span>{sermon.average_rating?.toFixed(1) || '0.0'}</span>
                            <span className="text-xs">({sermon.ratings_count || 0})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <GitFork className="w-4 h-4" />
                            <span>{sermon.forks_count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{sermon.views_count || 0}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleView(sermon)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFork(sermon)}
                          >
                            <GitFork className="w-3 h-3 mr-1" />
                            Fork
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRate(sermon)}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            Rate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiscoverRelated(sermon)}
                            title="Discover related content"
                          >
                            <Sparkles className="w-3 h-3" />
                          </Button>
                          {user && sermon.user_id === user.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSermon(sermon);
                                setShowTagsNotesDialog(true);
                              }}
                              title="Edit tags & notes"
                            >
                              <FileText className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Thematic Links Section */}
                {showThematicLinks && selectedForThematic && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold">Related to: {selectedForThematic.title}</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowThematicLinks(false);
                          setSelectedForThematic(null);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                    <ThematicLinker
                      sourceType="sermon"
                      sourceData={selectedForThematic}
                      user={user}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="series" className="mt-6">
            {filteredContent.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold mb-2">No series found</h3>
                  <p className="text-gray-600">
                    {sharedSeries.length === 0
                      ? "Create sermon series to organize your content and share with your congregation"
                      : "Try adjusting your filters"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredContent.map((series) => (
                  <Card key={series.id} className="hover:shadow-xl transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge>{series.series_length} Weeks</Badge>
                            <Badge variant="outline">{series.series_type}</Badge>
                          </div>
                          <CardTitle className="text-xl">{series.series_title}</CardTitle>
                          <CardDescription className="mt-2">
                            {series.series_description}
                          </CardDescription>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            {series.user_name}
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span>{series.average_rating?.toFixed(1) || '0.0'}</span>
                          <span className="text-xs">({series.ratings_count || 0})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <GitFork className="w-4 h-4" />
                          <span>{series.forks_count || 0}</span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="default" size="sm">
                          <Eye className="w-3 h-3 mr-1" />
                          View Series
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="w-3 h-3 mr-1" />
                          Fork All
                        </Button>
                        <Button variant="outline" size="sm">
                          <Star className="w-3 h-3 mr-1" />
                          Rate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {selectedSermon && (
          <>
            <SermonViewer
              open={showSermonViewer}
              onClose={() => {
                setShowSermonViewer(false);
                setSelectedSermon(null);
              }}
              sermon={selectedSermon}
              onFork={() => {
                setShowSermonViewer(false);
                setShowForkDialog(true);
              }}
              onRate={() => {
                setShowSermonViewer(false);
                setShowRatingDialog(true);
              }}
            />

            <ForkSermonDialog
              open={showForkDialog}
              onClose={() => {
                setShowForkDialog(false);
                setSelectedSermon(null);
                // After fork, reload all data to update fork counts and potentially personalized recommendations
                if (user) loadData(); // Reload general library
                loadMySermons(); // Reload user's sermons
              }}
              sermon={selectedSermon}
              user={user}
            />

            <RatingDialog
              open={showRatingDialog}
              onClose={() => {
                setShowRatingDialog(false);
                setSelectedSermon(null);
                loadData(); // Reload data to update ratings
              }}
              sermon={selectedSermon}
              user={user}
            />
          </>
        )}

        {user && (
          <>
            <ShareSermonDialog
              open={showShareDialog}
              onClose={() => {
                setShowShareDialog(false);
                loadData();
              }}
              user={user}
              mySermons={mySermons}
            />

            <SermonTagsNotesDialog
              open={showTagsNotesDialog}
              onClose={() => {
                setShowTagsNotesDialog(false);
                setSelectedSermon(null);
              }}
              sermon={selectedSermon}
              onSave={() => {
                loadMySermons();
              }}
            />

            <SeriesManager
              open={showSeriesManager}
              onClose={() => setShowSeriesManager(false)}
              user={user}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Label({ children, className = "", ...props }) {
  return (
    <label className={`text-sm font-medium ${className}`} {...props}>
      {children}
    </label>
  );
}