import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, User, Crown, Bell, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PreferencesManager from "@/components/profile/PreferencesManager";
import OnboardingWizard from "@/components/profile/OnboardingWizard";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
      await base44.auth.redirectToLogin();
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = user && (
    user.subscription_tier === 'premium' ||
    user.premium_override === true ||
    (user.premium_until && new Date(user.premium_until) > new Date())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-medium mb-4">Please log in to access settings</p>
            <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your account and preferences
          </p>
        </div>

        <Tabs defaultValue="preferences" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preferences">
              <Sparkles className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <Crown className="w-4 h-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences">
            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">
                        🎯 Personalized Experience
                      </h3>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        Your preferences help AI create better sermons and recommendations
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOnboarding(true)}
                    >
                      Reset Wizard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <PreferencesManager user={user} onUpdate={loadUser} />
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Name</p>
                  <p className="text-lg font-medium mt-1">{user.full_name || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</p>
                  <p className="text-lg font-medium mt-1">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Denomination</p>
                  <p className="text-lg font-medium mt-1">{user.denomination || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Member Since</p>
                  <p className="text-lg font-medium mt-1">
                    {new Date(user.created_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>

                {user.study_preferences?.preferredAudience && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Primary Ministry</p>
                    <Badge className="mt-1">{user.study_preferences.preferredAudience}</Badge>
                  </div>
                )}

                {user.content_preferences?.favoriteTopics?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Favorite Topics</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {user.content_preferences.favoriteTopics.slice(0, 10).map((topic, index) => (
                        <Badge key={index} variant="secondary">{topic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current Plan</p>
                    <p className="text-2xl font-bold">
                      {isPremium ? (
                        <span className="text-purple-600">Premium</span>
                      ) : (
                        <span className="text-gray-900 dark:text-white">Free</span>
                      )}
                    </p>
                  </div>
                  {isPremium ? (
                    <Crown className="w-12 h-12 text-purple-600" />
                  ) : (
                    <Link to={createPageUrl('Pricing')}>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        <Crown className="w-4 h-4 mr-2" />
                        Upgrade
                      </Button>
                    </Link>
                  )}
                </div>

                {isPremium && (
                  <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      ✅ You have access to all premium features including multi-language translation, 
                      export tools, and advanced AI features!
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Coming soon - manage your email and app notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Bell className="w-4 h-4" />
                  <AlertDescription>
                    Notification settings will be available in a future update
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <OnboardingWizard
          open={showOnboarding}
          onClose={() => {
            setShowOnboarding(false);
            loadUser();
          }}
          user={user}
        />
      </div>
    </div>
  );
}