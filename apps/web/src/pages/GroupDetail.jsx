import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useLocation } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowLeft, MessageCircle, Calendar, TrendingUp, Crown, UserMinus, UserPlus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";
import GroupChat from "../components/groups/GroupChat";
import MeetingScheduler from "../components/groups/MeetingScheduler";
import ProgressTracker from "../components/groups/ProgressTracker";
import { usePremiumAccess } from '@/components/hooks/usePremiumAccess';

export default function GroupDetail() {
  const location = useLocation();
  const groupId = new URLSearchParams(location.search).get('id');
  const { user, isLoadingAuth } = useAuth();
  const { hasEntitlement, loading: accessLoading } = usePremiumAccess();
  const hasCommunityAccess = hasEntitlement('community');
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [membership, setMembership] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      toast.error("Please log in");
    }
  }, [isLoadingAuth, user]);

  useEffect(() => {
    if (user && groupId) {
      loadGroupData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [user, groupId]);

  const loadGroupData = async () => {
    try {
      const data = await api.community.studyGroup(groupId);
      setGroup(data.group);
      setMembers(data.members || []);
      setMembership(data.membership || null);
    } catch (error) {
      if (error?.status === 403) {
        toast.error("Join this group before opening its private activity");
      } else {
        toast.error("Failed to load group");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!membership) return;

    if (!confirm("Are you sure you want to leave this group?")) return;

    try {
      await api.community.leaveStudyGroup(group.id);

      toast.success("Left group");
      window.location.href = createPageUrl('StudyGroups');
    } catch (error) {
      toast.error("Failed to leave group");
    }
  };

  const handlePromoteToLeader = async (member) => {
    if (membership?.role !== 'leader') return;

    try {
      await api.community.promoteStudyGroupMember(group.id, member.id);
      toast.success(`${member.user_name} is now a leader`);
      loadGroupData();
    } catch (error) {
      toast.error("Failed to promote member");
    }
  };

  const handleRemoveMember = async (member) => {
    if (membership?.role !== 'leader' || member.user_id === user.id) return;
    if (!confirm(`Remove ${member.user_name} from this group?`)) return;

    setRemovingMemberId(member.id);
    try {
      await api.community.removeStudyGroupMember(group.id, member.id);
      toast.success(`${member.user_name} removed from the group`);
      await loadGroupData();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleMemberSearch = async () => {
    if (!memberQuery.trim()) {
      setMemberResults([]);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const result = await api.community.members({ q: memberQuery.trim(), limit: 20 });
      const currentIds = new Set(members.map((member) => member.user_id));
      setMemberResults((result.members || []).filter((member) => !currentIds.has(member.id)));
    } catch (error) {
      toast.error(error?.message || 'Failed to search members');
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleAddMember = async (member) => {
    try {
      await api.community.addStudyGroupMember(group.id, member.id);
      toast.success(`${member.name} added to the group`);
      setMemberResults((current) => current.filter((item) => item.id !== member.id));
      await loadGroupData();
    } catch (error) {
      toast.error(error?.message || 'Failed to add member');
    }
  };

  if (isLoading || accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-lg mb-4">Group not found</p>
            <Link to={createPageUrl('StudyGroups')}>
              <Button>Back to Study Groups</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-lg mb-4">You are not a member of this group</p>
            <Link to={createPageUrl('StudyGroups')}>
              <Button>Back to Study Groups</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLeader = membership.role === 'leader';
  const membersPanel = (allowAdding) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Members ({members.length})</CardTitle>
          {allowAdding && isLeader && (
            <Button size="sm" onClick={() => setShowAddMember(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{member.user_name}</p>
                <p className="text-xs text-gray-500">
                  Joined {new Date(member.joined_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.role === 'leader' ? 'default' : 'outline'}>
                  {member.role === 'leader' && <Crown className="w-3 h-3 mr-1" />}
                  {member.role}
                </Badge>
                {isLeader && member.role === 'member' && member.user_id !== user.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(removingMemberId)}
                    onClick={() => handlePromoteToLeader(member)}
                  >
                    Promote
                  </Button>
                )}
                {isLeader && member.user_id !== user.id && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={Boolean(removingMemberId)}
                    onClick={() => handleRemoveMember(member)}
                  >
                    {removingMemberId === member.id ? 'Removing…' : 'Remove'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl(hasCommunityAccess ? 'StudyGroups' : 'MyCommunityContent')}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {hasCommunityAccess ? 'Back to Groups' : 'Back to My Community Content'}
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{group.name}</CardTitle>
                <p className="text-gray-600">{group.description}</p>
                <div className="flex gap-2 mt-3">
                  {group.theme && <Badge variant="outline">{group.theme}</Badge>}
                  {group.focus_book && <Badge>Studying: {group.focus_book}</Badge>}
                  {isLeader && <Badge className="bg-yellow-500"><Crown className="w-3 h-3 mr-1" />Leader</Badge>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLeaveGroup}>
                <UserMinus className="w-4 h-4 mr-2" />
                Leave Group
              </Button>
            </div>
          </CardHeader>
        </Card>

        {!hasCommunityAccess && (
          <div className="space-y-4">
            <Card className="border-purple-200">
              <CardContent className="pt-6 text-sm text-gray-700 dark:text-gray-300">
                Your Community access has expired. Group chat, meetings, progress, member search, and new activity are paused,
                but you can still transfer leadership, remove members, or leave this group.
              </CardContent>
            </Card>
            {membersPanel(false)}
          </div>
        )}

        {hasCommunityAccess && <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="meetings">
              <Calendar className="w-4 h-4 mr-2" />
              Meetings
            </TabsTrigger>
            <TabsTrigger value="progress">
              <TrendingUp className="w-4 h-4 mr-2" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <GroupChat group={group} user={user} isLeader={isLeader} />
          </TabsContent>

          <TabsContent value="meetings">
            <MeetingScheduler group={group} user={user} members={members} isLeader={isLeader} />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTracker group={group} isLeader={isLeader} />
          </TabsContent>

          <TabsContent value="members">
            {membersPanel(true)}
          </TabsContent>
        </Tabs>}

        {hasCommunityAccess && <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a community member</DialogTitle>
              <DialogDescription>
                Search by member name. Added members can open private groups immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleMemberSearch(); }}
                placeholder="Search members"
              />
              <Button
                onClick={handleMemberSearch}
                disabled={isSearchingMembers}
                aria-label="Search community members"
              >
                {isSearchingMembers ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {memberResults.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    {member.denomination && <p className="truncate text-xs text-gray-500">{member.denomination}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddMember(member)}>Add</Button>
                </div>
              ))}
              {!isSearchingMembers && memberQuery.trim() && memberResults.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500">No eligible members found.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>}
      </div>
    </div>
  );
}
