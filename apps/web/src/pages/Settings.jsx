import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { logActivity } from "../components/admin/UserActivityLogger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Settings as SettingsIcon, User, Crown, Bell, Loader2, Sparkles, Mail, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";
import { isNativeApp } from "@/lib/platform";
import PreferencesManager from "@/components/profile/PreferencesManager";
import OnboardingWizard from "@/components/profile/OnboardingWizard";
import ProfileEditor from "@/components/profile/ProfileEditor";
import MobileUpdateCard from "@/components/settings/MobileUpdateCard";

export default function Settings() {
  const { user, isLoadingAuth, authError, checkAppState } = useAuth();
  const isLoading = isLoadingAuth;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [notificationSettings, setNotificationSettings] = useState({
    email_new_features: false,
    email_weekly_digest: false,
    email_tips: false
  });

  useEffect(() => {
    logActivity('page_view', { page_name: 'Settings' });
  }, []);

  // Sync notification-toggle UI from the centralised user object whenever
  // it refreshes (login, profile save, etc.).
  useEffect(() => {
    if (!user) return;
    setNotificationSettings({
      email_new_features: user.email_new_features ?? false,
      email_weekly_digest: user.email_weekly_digest ?? false,
      email_tips: user.email_tips ?? false
    });
  }, [user]);

  // Settings requires authentication — if the shared auth resolves to no
  // user (and there's no transient error we're retrying), kick to login.
  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      logError('Settings: no authenticated user', authError);
      api.auth.redirectToLogin?.();
    }
  }, [isLoadingAuth, user, authError]);

  // Stable refresh hook for child editors that update the profile.
  const refreshUser = () => checkAppState?.();

  const saveNotificationSettings = async () => {
    if (!user) return;
    
    setIsSavingNotifications(true);
    try {
      await api.entities.User.update(user.id, {
        email_new_features: notificationSettings.email_new_features,
        email_weekly_digest: notificationSettings.email_weekly_digest,
        email_tips: notificationSettings.email_tips
      });
      
      toast.success("Notification preferences saved!");
      logActivity('settings_updated', {
        page_name: 'Settings',
        setting_type: 'notifications'
      });
    } catch (error) {
      toast.error(logError('Failed to save notification preferences', error));
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Opens Stripe's hosted billing portal so users can update payment method,
  // change plan, or cancel. Backend mints a one-time portal session URL.
  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    try {
      const response = await api.functions.invoke('createBillingPortal');
      if (response.error) throw new Error(response.error);
      if (!response.url) throw new Error('No billing portal URL returned.');

      logActivity('billing_portal_opened', { page_name: 'Settings' });

      // Match Pricing.jsx: pop a new tab when embedded (Electron/iframe),
      // otherwise navigate in place.
      const inIframe = window.self !== window.top;
      if (inIframe) {
        const newWindow = window.open(response.url, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          toast.error('Please allow pop-ups to manage your subscription.');
        }
        setIsOpeningPortal(false);
      } else {
        window.location.href = response.url;
      }
    } catch (error) {
      toast.error(logError('Could not open billing portal', error));
      setIsOpeningPortal(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm account deletion.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await api.auth.deleteAccount();
      logActivity('account_deleted', { page_name: 'Settings' });
      toast.success('Your account has been deleted.');
      window.location.assign('/');
    } catch (error) {
      toast.error(logError('Could not delete account', error));
      setIsDeletingAccount(false);
    }
  };

  const handleNotificationToggle = (key, value) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const isPremium = user && (
    user.role === 'admin' ||
    user.role === 'dev' ||
    user.premium === true ||
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
            <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
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

              <PreferencesManager user={user} onUpdate={refreshUser} />
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <div className="space-y-4">
              <ProfileEditor user={user} onUpdate={refreshUser} />
              <Card className="border-red-200 dark:border-red-900/50">
                <CardHeader>
                  <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    Delete account
                  </CardTitle>
                  <CardDescription>
                    Soft-deletes your account, revokes sessions immediately, and stops sign-in.
                    Ministry content is retained for recovery/audit per the Privacy Policy; it is
                    no longer accessible through this login.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
                  <input
                    id="delete-confirm"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    autoComplete="off"
                  />
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete my account'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
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
                  ) : isNativeApp() ? (
                    // Store policy: no purchase flow or upgrade steering in
                    // the installed app.
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[220px] text-right">
                      Upgrades aren&apos;t available in this app.
                    </p>
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
                  <>
                    <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Premium unlocks configured AI and export tools for your account. Scripture wording
                        remains linked to registered providers and is available in the Reader for context.
                      </AlertDescription>
                    </Alert>

                    {isNativeApp() ? (
                      // The Stripe billing portal is an external payment
                      // surface — store policy keeps it out of native builds.
                      <div className="p-4 border rounded-lg">
                        <p className="font-medium">Manage Subscription</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Manage your subscription where you purchased it.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">Manage Subscription</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Update your payment method, change your plan, or cancel.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          disabled={isOpeningPortal}
                          className="w-full sm:w-auto"
                        >
                          {isOpeningPortal ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Opening...
                            </>
                          ) : (
                            'Manage Subscription'
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage your email notifications and communication preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <Label htmlFor="email-features" className="text-base font-medium">
                          New Features & Updates
                        </Label>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get notified when we release new features and improvements
                      </p>
                    </div>
                    <Switch
                      id="email-features"
                      checked={notificationSettings.email_new_features}
                      onCheckedChange={(checked) => handleNotificationToggle('email_new_features', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                        <Label htmlFor="email-digest" className="text-base font-medium">
                          Weekly Digest
                        </Label>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receive a weekly summary of your activity and trending content
                      </p>
                    </div>
                    <Switch
                      id="email-digest"
                      checked={notificationSettings.email_weekly_digest}
                      onCheckedChange={(checked) => handleNotificationToggle('email_weekly_digest', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <Label htmlFor="email-tips" className="text-base font-medium">
                          Tips & Inspiration
                        </Label>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get helpful tips and inspirational content for your ministry
                      </p>
                    </div>
                    <Switch
                      id="email-tips"
                      checked={notificationSettings.email_tips}
                      onCheckedChange={(checked) => handleNotificationToggle('email_tips', checked)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    onClick={saveNotificationSettings}
                    disabled={isSavingNotifications}
                  >
                    {isSavingNotifications ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Preferences'
                    )}
                  </Button>
                </div>

                <Alert>
                  <Bell className="w-4 h-4" />
                  <AlertDescription>
                    Browser notifications are managed through your device's settings. 
                    Check your browser's notification permissions to enable or disable push notifications.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Native app only: manual OTA content updates (renders nothing on web). */}
        <div className="mt-6">
          <MobileUpdateCard />
        </div>

        <OnboardingWizard
          open={showOnboarding}
          onClose={() => {
            setShowOnboarding(false);
            refreshUser();
          }}
          user={user}
        />
      </div>
    </div>
  );
}
