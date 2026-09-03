
import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Star,
  GitFork,
  Eye,
  Users,
  Search,
  Filter,
  Loader2,
  Baby,
  GraduationCap,
  User as UserIcon,
  Heart,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import ForkPlanDialog from "@/components/plans/ForkPlanDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CommentSection from "@/components/community/CommentSection";
import PlanRatingDialog from "@/components/plans/PlanRatingDialog";
import ThematicLinker from "@/components/discovery/ThematicLinker";

const AGE_GROUP_ICONS = {
  children: Baby,
  youth: GraduationCap,
  adults: UserIcon,
  seniors: Heart
};

export default function PlanLibrary() {
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgeFilter, setSelectedAgeFilter] = useState("all");
  const [viewingPlan, setViewingPlan] = useState(null);
  const [forkingPlan, setForkingPlan] = useState(null);
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingPlan, setRatingPlan] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    loadPlans();
  }, [sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterPlans();
  }, [plans, searchTerm, selectedAgeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const publicPlans = await api.community.readingPlans(sortBy);
      setPlans(publicPlans);
      // Immediately apply current filters to the newly loaded plans
      // This is handled by the filterPlans useEffect now that `plans` state is updated.
      // setFilteredPlans(publicPlans); // Removed this line to rely on the dedicated filterPlans useEffect
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error("Failed to load community plans");
    } finally {
      setIsLoading(false);
    }
  };

  const filterPlans = () => {
    let filtered = [...plans];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(plan =>
        plan.name?.toLowerCase().includes(term) ||
        plan.description?.toLowerCase().includes(term) ||
        plan.creator_name?.toLowerCase().includes(term)
      );
    }

    // Age group filter - check in daily_readings for age-specific content
    if (selectedAgeFilter !== 'all') {
      filtered = filtered.filter(plan => {
        // Check if plan description or activities mention the age group
        const checkAge = (text) => text?.toLowerCase().includes(selectedAgeFilter);
        return checkAge(plan.description) ||
               checkAge(plan.name) ||
               plan.age_group?.toLowerCase() === selectedAgeFilter || // Added check for direct age_group property
               plan.daily_readings?.some(day =>
                 day.activities?.some(act => checkAge(act.type) || checkAge(act.description))
               );
      });
    }

    setFilteredPlans(filtered);
  };

  const handleViewPlan = (plan) => {
    setViewingPlan(plan);
    setShowPlanViewer(true);
  };

  const handleForkPlan = (plan) => {
    if (!user) {
      toast.error("Please log in to fork plans");
      return;
    }
    setForkingPlan(plan);
    setShowForkDialog(true);
  };

  const handleRatePlan = (plan) => {
    if (!user) {
      toast.error("Please log in to rate plans");
      return;
    }
    setRatingPlan(plan);
    setShowRatingDialog(true);
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
            <Calendar className="w-8 h-8 text-purple-600" />
            Study Plans
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Discover and fork AI-generated Bible study plans from the community
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search plans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={selectedAgeFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgeFilter('all')}
                  >
                    All Ages
                  </Button>
                  <Button
                    variant={selectedAgeFilter === 'children' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgeFilter('children')}
                  >
                    <Baby className="w-3 h-3 mr-1" />
                    Children
                  </Button>
                  <Button
                    variant={selectedAgeFilter === 'youth' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgeFilter('youth')}
                  >
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Youth
                  </Button>
                  <Button
                    variant={selectedAgeFilter === 'adults' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAgeFilter('adults')}
                  >
                    <UserIcon className="w-3 h-3 mr-1" />
                    Adults
                  </Button>
                </div>
              </div>

              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-9 text-sm bg-background"
                >
                  <option value="newest">Newest First</option>
                  <option value="rating">Highest Rated</option>
                  <option value="popular">Most Forked</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans Grid */}
        {filteredPlans.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold mb-2">No plans found</h3>
              <p className="text-gray-600">
                {plans.length === 0
                  ? "Be the first to share a study plan!"
                  : "Try adjusting your filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlans.map((plan) => {
              const AgeIcon = AGE_GROUP_ICONS[plan.age_group] || Calendar;

              return (
                <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">{plan.name}</CardTitle>
                        <CardDescription className="mt-1">
                          by {plan.creator_name}
                        </CardDescription>
                      </div>
                      <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline">
                        {plan.duration_days} Days
                      </Badge>
                      <Badge variant="secondary">
                        {plan.category}
                      </Badge>
                      {plan.age_group && (
                        <Badge variant="outline" className="capitalize">
                          <AgeIcon className="w-3 h-3 mr-1" />
                          {plan.age_group}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {plan.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
                        {plan.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{plan.average_rating?.toFixed(1) || '0.0'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <GitFork className="w-4 h-4" />
                        <span>{plan.followers_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{plan.ratings_count || 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPlan(plan)}
                        className="flex-1"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleForkPlan(plan)}
                        className="flex-1"
                      >
                        <GitFork className="w-3 h-3 mr-1" />
                        Fork
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Plan Viewer Dialog */}
        <Dialog open={showPlanViewer} onOpenChange={setShowPlanViewer}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{viewingPlan?.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-3">
                <span>by {viewingPlan?.creator_name}</span>
                <Badge>{viewingPlan?.duration_days} days</Badge>
                {viewingPlan?.average_rating > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    {viewingPlan.average_rating.toFixed(1)}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  <GitFork className="w-3 h-3" />
                  {viewingPlan?.followers_count || 0} forks
                </Badge>
                {viewingPlan?.ratings_count > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {viewingPlan?.ratings_count || 0} reviews
                  </Badge>
                )}
                {viewingPlan?.age_group && (
                  <Badge variant="outline" className="capitalize flex items-center gap-1">
                    {React.createElement(AGE_GROUP_ICONS[viewingPlan.age_group] || Calendar, { className: "w-3 h-3" })}
                    {viewingPlan.age_group}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>

            {viewingPlan && (
              <div className="space-y-6">
                {/* Overview */}
                <div>
                  <h3 className="font-semibold mb-2">Overview</h3>
                  <p className="text-gray-700 dark:text-gray-300">{viewingPlan.description}</p>
                </div>

                {/* Daily Lessons Preview */}
                <div>
                  <h3 className="font-semibold mb-3">Daily Lessons ({viewingPlan.duration_days} days)</h3>
                  <div className="space-y-3">
                    {viewingPlan.daily_readings?.slice(0, 5).map((day, index) => (
                      <Card key={index} className="bg-gray-50 dark:bg-gray-800">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge>Day {day.day}</Badge>
                          </div>
                          {day.passages && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Scripture:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {day.passages.map((passage, pIndex) => (
                                  <Badge key={pIndex} variant="outline" className="text-xs">
                                    {passage}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {day.reflection && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {day.reflection}
                            </p>
                          )}
                          {day.activities && day.activities.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Activities:
                              </p>
                              <div className="text-xs text-gray-500">
                                {day.activities.slice(0, 2).map((act, aIdx) => (
                                  <div key={aIdx}>• {act.type}</div>
                                ))}
                                {day.activities.length > 2 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    + {day.activities.length - 2} more activities
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {viewingPlan.daily_readings?.length > 5 && (
                      <p className="text-sm text-gray-500 text-center">
                        + {viewingPlan.daily_readings.length - 5} more days
                      </p>
                    )}
                  </div>
                </div>

                {/* Related Content Discovery */}
                <ThematicLinker
                  sourceType="plan"
                  sourceData={viewingPlan}
                  user={user}
                />

                {/* Comments Section */}
                <CommentSection
                  contentType="plan"
                  contentId={viewingPlan.id}
                  contentCreatorId={viewingPlan.creator_id}
                  user={user}
                />

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      setShowPlanViewer(false);
                      handleForkPlan(viewingPlan);
                    }}
                    className="flex-1"
                  >
                    <GitFork className="w-4 h-4 mr-2" />
                    Fork This Plan
                  </Button>
                  <Button
                    onClick={() => {
                      handleRatePlan(viewingPlan);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Rate & Review
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fork Dialog */}
        <ForkPlanDialog
          open={showForkDialog}
          onClose={() => {
            setShowForkDialog(false);
            setForkingPlan(null);
          }}
          plan={forkingPlan}
          user={user}
        />

        <PlanRatingDialog
          open={showRatingDialog}
          onClose={() => {
            setShowRatingDialog(false);
            setRatingPlan(null);
            if (viewingPlan) {
              // Reload plans to show updated rating for the current viewing plan
              loadPlans(); // This will also trigger filterPlans due to plans state change
              // Optionally, could also update viewingPlan directly if the API returned it.
            }
          }}
          plan={ratingPlan}
          user={user}
        />
      </div>
    </div>
  );
}
