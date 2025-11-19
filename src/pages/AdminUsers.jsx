import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search, Crown, Mail, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadUsers();
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

  const loadUsers = async () => {
    try {
      const allUsers = await base44.entities.User.list('-created_date', 1000);
      setUsers(allUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
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
                            Joined {new Date(u.created_date).toLocaleDateString()}
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
                      
                      <div className="text-right text-xs text-gray-500">
                        <div>ID: {u.id?.substring(0, 8)}...</div>
                        {u.onboarding_completed && (
                          <Badge variant="secondary" className="mt-2">
                            Onboarded
                          </Badge>
                        )}
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
      </div>
    </div>
  );
}