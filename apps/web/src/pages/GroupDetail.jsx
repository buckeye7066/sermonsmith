import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Settings, ArrowLeft, MessageCircle, Calendar, TrendingUp, Crown, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import GroupChat from "../components/groups/GroupChat";
import MeetingScheduler from "../components/groups/MeetingScheduler";
import ProgressTracker from "../components/groups/ProgressTracker";

export default function GroupDetail() {
  const location = useLocation();
  const groupId = new URLSearchParams(location.search).get('id');
  const { user, isLoadingAuth } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [membership, setMembership] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      toast.error("Please log in");
    }
  }, [isLoadingAuth, user]);

  useEffect(() => {
    if (user && groupId) {
      loadGroupData();
    }
  }, [user, groupId]);

  const loadGroupData = async () => {
    try {
      const [groupData, groupMembers, userMembership] = await Promise.all([
        api.entities.StudyGroup.filter({ id: groupId }),
        api.entities.GroupMembership.filter({ group_id: groupId }),
        api.entities.GroupMembership.filter({ group_id: groupId, user_id: user.id })
      ]);

      if (groupData.length === 0) {
        toast.error("Group not found");
        return;
      }

      setGroup(groupData[0]);
      setMembers(groupMembers);
      setMembership(userMembership[0] || null);
    } catch (error) {
      toast.error("Failed to load group");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!membership) return;

    if (!confirm("Are you sure you want to leave this group?")) return;

    try {
      await api.entities.GroupMembership.delete(membership.id);
      await api.entities.StudyGroup.update(group.id, {
        member_count: Math.max(0, (group.member_count || 1) - 1)
      });

      toast.success("Left group");
      window.location.href = createPageUrl('StudyGroups');
    } catch (error) {
      toast.error("Failed to leave group");
    }
  };

  const handlePromoteToLeader = async (member) => {
    if (membership?.role !== 'leader') return;

    try {
      await api.entities.GroupMembership.update(member.id, { role: 'leader' });
      toast.success(`${member.user_name} is now a leader`);
      loadGroupData();
    } catch (error) {
      toast.error("Failed to promote member");
    }
  };

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl('StudyGroups')}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Groups
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

        <Tabs defaultValue="chat" className="space-y-6">
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
            <GroupChat group={group} user={user} />
          </TabsContent>

          <TabsContent value="meetings">
            <MeetingScheduler group={group} user={user} members={members} />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTracker group={group} isLeader={isLeader} />
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Members ({members.length})</CardTitle>
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
                            onClick={() => handlePromoteToLeader(member)}
                          >
                            Promote
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}