import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Calendar, BookOpen, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";

export default function StudyGroups() {
  const { user, isLoadingAuth } = useAuth();
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    focus_book: '',
    theme: '',
    meeting_schedule: '',
    is_private: false
  });

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user?.id) {
      // Must clear isLoading here: returning early without it left a
      // logged-out visitor staring at the spinner forever, with no message.
      toast.error("Please log in to view study groups");
      setIsLoading(false);
      return;
    }
    loadGroups();
  }, [isLoadingAuth, user]);

  const loadGroups = async () => {
    try {
      const allGroups = await api.community.studyGroups();
      setGroups(allGroups);
      setMyGroups(allGroups.filter((group) => group.is_member));
    } catch (error) {
      logError('Error loading study groups', error);
      toast.error('Failed to load study groups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || !newGroup.description.trim()) {
      toast.error("Name and description are required");
      return;
    }

    try {
      await api.community.createStudyGroup(newGroup);

      toast.success("Study group created successfully!");
      setShowNewGroupDialog(false);
      setNewGroup({ name: '', description: '', focus_book: '', theme: '', meeting_schedule: '', is_private: false });
      loadGroups();
    } catch (error) {
      logError('Failed to create group', error);
      toast.error(`Failed to create group: ${error?.message || 'Please try again.'}`);
    }
  };

  const handleJoinGroup = async (group) => {
    if (!user || !user.id) return;
    try {
      if (group.is_member) {
        toast.info("You're already a member of this group");
        return;
      }
      await api.community.joinStudyGroup(group.id);

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
            <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
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
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id="private-group"
                    checked={newGroup.is_private}
                    onCheckedChange={(checked) => setNewGroup({ ...newGroup, is_private: checked === true })}
                  />
                  <label htmlFor="private-group" className="cursor-pointer text-sm">
                    <span className="block font-medium">Private group</span>
                    <span className="text-gray-500">Only members added by a group leader can open or join this group.</span>
                  </label>
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
