import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Calendar, BookOpen, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function StudyGroups() {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    focus_book: '',
    theme: '',
    is_private: false,
    meeting_schedule: ''
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      toast.error("Please log in to view study groups");
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const [allGroups, memberships] = await Promise.all([
        base44.entities.StudyGroup.list('-member_count', 50),
        base44.entities.GroupMembership.filter({ user_id: user.id })
      ]);

      setGroups(allGroups);
      
      // Get groups where user is a member
      const myGroupIds = memberships.map(m => m.group_id);
      const userGroups = allGroups.filter(g => myGroupIds.includes(g.id));
      setMyGroups(userGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || !newGroup.description.trim()) {
      toast.error("Name and description are required");
      return;
    }

    try {
      const group = await base44.entities.StudyGroup.create({
        creator_id: user.id,
        ...newGroup,
        member_count: 1
      });

      // Add creator as leader
      await base44.entities.GroupMembership.create({
        group_id: group.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        role: 'leader',
        joined_date: new Date().toISOString()
      });

      toast.success("Study group created successfully!");
      setShowNewGroupDialog(false);
      setNewGroup({ name: '', description: '', focus_book: '', theme: '', is_private: false, meeting_schedule: '' });
      loadGroups();
    } catch (error) {
      toast.error("Failed to create group");
    }
  };

  const handleJoinGroup = async (group) => {
    try {
      // Check if already a member
      const existing = await base44.entities.GroupMembership.filter({
        group_id: group.id,
        user_id: user.id
      });

      if (existing.length > 0) {
        toast.info("You're already a member of this group");
        return;
      }

      await base44.entities.GroupMembership.create({
        group_id: group.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        role: 'member',
        joined_date: new Date().toISOString()
      });

      // Update member count
      await base44.entities.StudyGroup.update(group.id, {
        member_count: (group.member_count || 1) + 1
      });

      toast.success("Joined group successfully!");
      loadGroups();
    } catch (error) {
      toast.error("Failed to join group");
    }
  };

  const isMember = (groupId) => {
    return myGroups.some(g => g.id === groupId);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to view study groups</p>
            <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="w-8 h-8 text-green-500" />
              Study Groups
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Join or create groups to study Scripture together.
            </p>
          </div>

          <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Study Group</DialogTitle>
                <DialogDescription>Start a new group to study Scripture with others.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Group Name</label>
                  <Input
                    placeholder="e.g., Gospel of John Study"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="What will your group study?"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Focus Book (Optional)</label>
                    <Input
                      placeholder="e.g., John"
                      value={newGroup.focus_book}
                      onChange={(e) => setNewGroup({...newGroup, focus_book: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Theme (Optional)</label>
                    <Input
                      placeholder="e.g., Faith, Prayer"
                      value={newGroup.theme}
                      onChange={(e) => setNewGroup({...newGroup, theme: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Meeting Schedule (Optional)</label>
                  <Input
                    placeholder="e.g., Tuesdays at 7 PM"
                    value={newGroup.meeting_schedule}
                    onChange={(e) => setNewGroup({...newGroup, meeting_schedule: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="private"
                    checked={newGroup.is_private}
                    onChange={(e) => setNewGroup({...newGroup, is_private: e.target.checked})}
                    className="rounded"
                  />
                  <label htmlFor="private" className="text-sm">Make this a private group</label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewGroupDialog(false)}>Cancel</Button>
                <Button onClick={handleCreateGroup}>Create Group</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {myGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">My Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myGroups.map((group) => (
                <Card key={group.id} className="border-2 border-green-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.is_private && (
                        <Lock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <CardDescription>{group.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.focus_book && (
                        <div className="flex items-center gap-2 text-sm">
                          <BookOpen className="w-4 h-4" />
                          <span>Studying: {group.focus_book}</span>
                        </div>
                      )}
                      {group.meeting_schedule && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>{group.meeting_schedule}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4" />
                        <span>{group.member_count} members</span>
                      </div>
                    </div>
                    <Link to={createPageUrl('GroupDetail') + '?id=' + group.id}>
                      <Button className="w-full mt-4" variant="outline">View Group</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold mb-4">All Groups</h2>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-500" />
            </div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No study groups yet</p>
                <p className="text-gray-600 mb-4">Be the first to create a study group!</p>
                <Button onClick={() => setShowNewGroupDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.is_private && (
                        <Lock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <CardDescription>{group.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {group.focus_book && (
                        <div className="flex items-center gap-2 text-sm">
                          <BookOpen className="w-4 h-4" />
                          <span>Studying: {group.focus_book}</span>
                        </div>
                      )}
                      {group.theme && (
                        <Badge variant="outline">{group.theme}</Badge>
                      )}
                      {group.meeting_schedule && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{group.meeting_schedule}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4" />
                        <span>{group.member_count} members</span>
                      </div>
                    </div>
                    {isMember(group.id) ? (
                      <Link to={createPageUrl('GroupDetail') + '?id=' + group.id}>
                        <Button className="w-full" variant="outline">View Group</Button>
                      </Link>
                    ) : (
                      <Button className="w-full" onClick={() => handleJoinGroup(group)}>
                        Join Group
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}