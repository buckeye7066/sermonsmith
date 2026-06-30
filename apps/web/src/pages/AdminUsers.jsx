import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Search,
  Crown,
  Mail,
  Calendar,
  Loader2,
  Trash2,
  Ban,
  Activity,
  AlertTriangle,
  Sparkles,
  Globe
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// User records come from the Prisma model (sanitizeUser) and carry `createdAt`,
// NOT the `created_date` that Entity blobs (activities, notes) expose. Reading
// `u.created_date` therefore yielded `new Date(undefined)` → "Invalid Date".
// Prefer createdAt, fall back to created_date, and guard so a missing/garbled
// value renders an em-dash instead of "Invalid Date".
function formatJoinedDate(u) {
  const raw = u?.createdAt || u?.created_date;
  if (!raw) return '—';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, isLoadingAuth } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [banConfirm, setBanConfirm] = useState(null);
  const [selectedUserActivities, setSelectedUserActivities] = useState(null);
  const [userLastLogin, setUserLastLogin] = useState({});
  // Global "free premium for all users" toggle.
  const [globalFree, setGlobalFree] = useState({ active: false, period: null, expires_at: null });
  const [globalPeriod, setGlobalPeriod] = useState('week'); // 'week' = 7 days, 'month' = 30
  const [globalBusy, setGlobalBusy] = useState(false);

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
    loadUsers();
    loadGlobalFree();
  }, [isLoadingAuth, user]);

  const loadGlobalFree = async () => {
    try {
      const state = await api.functions.invoke('getGlobalFreePremium', {});
      setGlobalFree(state || { active: false, period: null, expires_at: null });
      if (state?.period) setGlobalPeriod(state.period);
    } catch (error) {
      console.error('Error loading global free-premium state:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const allUsers = await api.entities.User.list('-created_date', 1000);
      setUsers(allUsers);

      // Last-active per user in ONE aggregate query (was an N+1 loop that fired
      // up to 1000 sequential requests on page load).
      try {
        const lastLoginData = await api.functions.invoke('getUsersLastActivity', {});
        setUserLastLogin(lastLoginData || {});
      } catch (error) {
        console.error('Failed to load last-activity map:', error);
        setUserLastLogin({});
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    try {
      await api.entities.User.delete(userId);
      toast.success("User deleted successfully");
      setDeleteConfirm(null);
      loadUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const banUser = async (userId) => {
    try {
      await api.entities.User.update(userId, { 
        is_banned: true,
        banned_at: new Date().toISOString()
      });
      toast.success("User banned successfully");
      setBanConfirm(null);
      loadUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user");
    }
  };

  const unbanUser = async (userId) => {
    try {
      await api.entities.User.update(userId, { 
        is_banned: false,
        banned_at: null
      });
      toast.success("User unbanned successfully");
      loadUsers();
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Failed to unban user");
    }
  };

  // Owner "free week / free month" comp (mirrors GrantFlow). Server sets
  // premium_until = now + 7/30 days; access expires automatically at that date.
  const grantFreePeriod = async (userId, period) => {
    try {
      const res = await api.functions.invoke('grantFreePeriod', { userId, period });
      const until = res?.premium_until ? new Date(res.premium_until).toLocaleDateString() : '';
      toast.success(`Granted free premium for a ${period === 'week' ? '7-day' : '30-day'} period${until ? ` (until ${until})` : ''}`);
      loadUsers();
    } catch (error) {
      console.error('Error granting free period:', error);
      toast.error(`Failed to grant free ${period}`);
    }
  };

  // Per-user revoke: clears the comp window. A paid subscription is untouched.
  const revokeFreePeriod = async (userId) => {
    try {
      await api.functions.invoke('grantFreePeriod', { userId, revoke: true });
      toast.success('Free premium trial revoked');
      loadUsers();
    } catch (error) {
      console.error('Error revoking free period:', error);
      toast.error('Failed to revoke free premium');
    }
  };

  // Master toggle: grant (or revoke) free premium for EVERY user at once.
  const toggleGlobalFree = async (enabled) => {
    setGlobalBusy(true);
    try {
      if (enabled) {
        const res = await api.functions.invoke('grantFreePeriod', { scope: 'all', period: globalPeriod });
        toast.success(`Free premium granted to all ${res?.granted ?? ''} users for ${globalPeriod === 'week' ? '7 days' : '30 days'}`);
      } else {
        const res = await api.functions.invoke('grantFreePeriod', { scope: 'all', revoke: true });
        toast.success(`Free premium revoked for all users${typeof res?.revoked === 'number' ? ` (${res.revoked})` : ''}`);
      }
      await loadGlobalFree();
      loadUsers();
    } catch (error) {
      console.error('Error toggling global free premium:', error);
      toast.error('Failed to update global free premium');
    } finally {
      setGlobalBusy(false);
    }
  };

  // A user is on a free trial when premium_until is in the future and they are
  // not a paid subscriber. (Paid `premium` accounts are shown as paid, not trial.)
  const trialActiveUntil = (u) => {
    if (u?.premium) return null;
    if (!u?.premium_until) return null;
    const until = new Date(u.premium_until);
    return until > new Date() ? until : null;
  };

  const viewUserActivity = async (userId, userEmail) => {
    try {
      const activities = await api.entities.UserActivity.filter({ 
        user_id: userId 
      }, '-created_date', 100);
      
      setSelectedUserActivities({ email: userEmail, activities });
    } catch (error) {
      console.error("Error loading user activities:", error);
      toast.error("Failed to load user activities");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.denomination?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Admin Access Required</p>
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
            <Users className="w-8 h-8 text-indigo-600" />
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {users.length} total users
          </p>
        </div>

        {/* Global free-premium toggle — grant/revoke for EVERY user at once */}
        <Card className="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <Globe className="w-6 h-6 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Free Premium for All Users
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {globalFree.active
                      ? `Active — every user has free premium until ${globalFree.expires_at ? new Date(globalFree.expires_at).toLocaleDateString() : '—'}.`
                      : 'Off — grant free premium to your entire user base with one switch.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Select value={globalPeriod} onValueChange={setGlobalPeriod} disabled={globalFree.active || globalBusy}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">7 Days Free</SelectItem>
                    <SelectItem value="month">30 Days Free</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  {globalBusy && <Loader2 className="w-4 h-4 animate-spin text-amber-600" />}
                  <Switch
                    checked={globalFree.active}
                    disabled={globalBusy}
                    onCheckedChange={toggleGlobalFree}
                    aria-label="Toggle free premium for all users"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by email, name, or denomination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((u) => {
              const isPremium = u.premium_override === true || 
                                u.subscription_tier === 'premium' ||
                                (u.premium_until && new Date(u.premium_until) > new Date());
              
              return (
                <Card key={u.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0 break-words">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{u.full_name || 'No name'}</h3>
                          {u.role === 'admin' && (
                            <Badge className="bg-purple-600">
                              <Crown className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {isPremium && (
                            <Badge className="bg-yellow-600">
                              <Crown className="w-3 h-3 mr-1" />
                              Premium
                            </Badge>
                          )}
                          {u.premium_override && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              Dev Override
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {u.email}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Joined {formatJoinedDate(u)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-600" />
                            <span className="text-green-600 font-medium">
                              Last active: {userLastLogin[u.id] ? new Date(userLastLogin[u.id]).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Never active'}
                            </span>
                          </div>
                          {u.denomination && (
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {u.denomination}
                            </div>
                          )}
                          {u.subscription_tier && (
                            <div className="text-xs mt-2">
                              <Badge variant="outline">
                                Tier: {u.subscription_tier}
                              </Badge>
                            </div>
                          )}
                          {u.premium_until && (
                            <div className="text-xs">
                              Premium until: {new Date(u.premium_until).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 sm:shrink-0">
                        <div className="text-right text-xs text-gray-500 mb-2">
                          <div>ID: {u.id?.substring(0, 8)}...</div>
                          {u.onboarding_completed && (
                            <Badge variant="secondary" className="mt-2">
                              Onboarded
                            </Badge>
                          )}
                          {u.is_banned && (
                            <Badge variant="destructive" className="mt-2">
                              BANNED
                            </Badge>
                          )}
                          {trialActiveUntil(u) && (
                            <Badge className="mt-2 bg-amber-500 hover:bg-amber-600">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Free until {trialActiveUntil(u).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewUserActivity(u.id, u.email)}
                            className="gap-1"
                          >
                            <Activity className="w-3 h-3" />
                            Activity
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => grantFreePeriod(u.id, 'week')}
                            className="gap-1 text-yellow-600 hover:text-yellow-700"
                            title="Grant 7 days of Premium free"
                          >
                            <Crown className="w-3 h-3" />
                            7 Days
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => grantFreePeriod(u.id, 'month')}
                            className="gap-1 text-yellow-600 hover:text-yellow-700"
                            title="Grant 30 days of Premium free"
                          >
                            <Crown className="w-3 h-3" />
                            30 Days
                          </Button>
                          {trialActiveUntil(u) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => revokeFreePeriod(u.id)}
                              className="gap-1 text-gray-600 hover:text-gray-800"
                              title="Revoke this user's free premium trial"
                            >
                              Revoke Free
                            </Button>
                          )}
                          {u.is_banned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unbanUser(u.id)}
                              className="gap-1"
                            >
                              Unban
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBanConfirm(u)}
                              className="gap-1 text-orange-600 hover:text-orange-700"
                            >
                              <Ban className="w-3 h-3" />
                              Ban
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirm(u)}
                            className="gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search query
              </p>
            </CardContent>
          </Card>
        )}
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete User?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirm?.email}</strong>? 
                This action cannot be undone. All their data will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteUser(deleteConfirm?.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Ban Confirmation Dialog */}
        <AlertDialog open={!!banConfirm} onOpenChange={() => setBanConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-orange-600" />
                Ban User?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to ban <strong>{banConfirm?.email}</strong>? 
                They will not be able to access the app until unbanned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => banUser(banConfirm?.id)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Ban User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* User Activity Dialog */}
        <AlertDialog open={!!selectedUserActivities} onOpenChange={() => setSelectedUserActivities(null)}>
          <AlertDialogContent className="max-w-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Activity Log: {selectedUserActivities?.email}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Last 100 activities for this user
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {selectedUserActivities?.activities?.length > 0 ? (
                selectedUserActivities.activities.map((activity) => (
                  <div key={activity.id} className="border-b pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">
                          {activity.action_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {activity.page_name && `Page: ${activity.page_name}`}
                          {activity.resource_type && ` • ${activity.resource_type}`}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(activity.created_date).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No activity recorded yet</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}