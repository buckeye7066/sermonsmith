import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, MapPin, Video, Users, Clock, CheckCircle, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

function emptyMeeting(user) {
  return {
    title: "",
    description: "",
    meeting_type: "virtual",
    scheduled_date: "",
    duration_minutes: 60,
    location: "",
    discussion_leader_id: user?.id || "",
    discussion_leader_name: user?.full_name || user?.email || "",
    study_passage: "",
    agenda: []
  };
}

function toLocalDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function MeetingScheduler({ group, user, members = [], isLeader = false }) {
  const [meetings, setMeetings] = useState([]);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [newMeeting, setNewMeeting] = useState(() => emptyMeeting(user));

  useEffect(() => {
    loadMeetings();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [group.id]);

  const loadMeetings = async () => {
    try {
      const mtgs = await api.community.groupMeetings(group.id);
      setMeetings(mtgs);
    } catch (error) {
      console.error('Error loading meetings:', error);
    }
  };

  const resetMeetingForm = () => {
    setEditingMeetingId(null);
    setNewMeeting(emptyMeeting(user));
  };

  const handleDialogChange = (open) => {
    setShowNewMeeting(open);
    if (!open) resetMeetingForm();
  };

  const handleEditMeeting = (meeting) => {
    setEditingMeetingId(meeting.id);
    setNewMeeting({
      title: meeting.title || "",
      description: meeting.description || "",
      meeting_type: meeting.meeting_type || "virtual",
      scheduled_date: toLocalDateTime(meeting.scheduled_date),
      duration_minutes: meeting.duration_minutes || 60,
      location: meeting.location || "",
      discussion_leader_id: meeting.discussion_leader_id || user?.id || "",
      discussion_leader_name: meeting.discussion_leader_name || "",
      study_passage: meeting.study_passage || "",
      agenda: Array.isArray(meeting.agenda) ? meeting.agenda : [],
    });
    setShowNewMeeting(true);
  };

  const handleSaveMeeting = async () => {
    if (!newMeeting.title || !newMeeting.scheduled_date || !newMeeting.discussion_leader_id) {
      toast.error("Title, date, and leader are required");
      return;
    }

    try {
      // datetime-local has no zone information. Convert the user's chosen
      // local wall-clock time to an offset-independent ISO instant before it
      // crosses the API boundary, otherwise a UTC server shifts the meeting.
      const scheduledDate = new Date(newMeeting.scheduled_date);
      if (Number.isNaN(scheduledDate.getTime())) {
        toast.error('Enter a valid meeting date and time');
        return;
      }
      const payload = {
        ...newMeeting,
        scheduled_date: scheduledDate.toISOString(),
      };
      if (editingMeetingId) {
        await api.community.updateGroupMeeting(group.id, editingMeetingId, payload);
      } else {
        await api.community.createGroupMeeting(group.id, payload);
      }

      toast.success(editingMeetingId ? "Meeting updated!" : "Meeting scheduled!");
      setShowNewMeeting(false);
      resetMeetingForm();
      await loadMeetings();
    } catch (error) {
      toast.error(error?.message || (editingMeetingId ? "Failed to update meeting" : "Failed to schedule meeting"));
    }
  };

  const handleDeleteMeeting = async (meeting) => {
    if (!window.confirm(`Cancel “${meeting.title}”? Existing RSVPs will also be removed.`)) return;
    try {
      await api.community.deleteGroupMeeting(group.id, meeting.id);
      setMeetings((current) => current.filter((item) => item.id !== meeting.id));
      toast.success("Meeting canceled");
    } catch (error) {
      toast.error(error?.message || "Failed to cancel meeting");
    }
  };

  const handleRSVP = async (meeting, status) => {
    try {
      await api.community.rsvpGroupMeeting(group.id, meeting.id, status);

      toast.success(`RSVP updated to: ${status}`);
      loadMeetings();
    } catch (error) {
      toast.error("Failed to update RSVP");
    }
  };

  const getMeetingIcon = (type) => {
    switch (type) {
      case "virtual": return <Video className="w-5 h-5 text-blue-500" />;
      case "in_person": return <MapPin className="w-5 h-5 text-green-500" />;
      case "hybrid": return <Users className="w-5 h-5 text-purple-500" />;
      default: return <Calendar className="w-5 h-5" />;
    }
  };

  const upcomingMeetings = meetings.filter(m => 
    new Date(m.scheduled_date) > new Date() && m.status === 'scheduled'
  );
  const pastMeetings = meetings.filter(m => 
    new Date(m.scheduled_date) <= new Date() || m.status === 'completed'
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Meetings
            </CardTitle>
            {isLeader && <Dialog open={showNewMeeting} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetMeetingForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMeetingId ? "Edit Meeting" : "Schedule New Meeting"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Meeting Title</label>
                    <Input
                      value={newMeeting.title}
                      onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                      placeholder="e.g., Week 3: John Chapter 5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={newMeeting.description}
                      onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Meeting Type</label>
                      <Select
                        value={newMeeting.meeting_type}
                        onValueChange={(value) => setNewMeeting({...newMeeting, meeting_type: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="virtual">Virtual</SelectItem>
                          <SelectItem value="in_person">In Person</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Duration (minutes)</label>
                      <Input
                        type="number"
                        value={newMeeting.duration_minutes}
                        onChange={(e) => setNewMeeting({...newMeeting, duration_minutes: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={newMeeting.scheduled_date}
                      onChange={(e) => setNewMeeting({...newMeeting, scheduled_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Location / Video Link</label>
                    <Input
                      value={newMeeting.location}
                      onChange={(e) => setNewMeeting({...newMeeting, location: e.target.value})}
                      placeholder="Zoom link or physical address"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Discussion Leader</label>
                    <Select
                      value={newMeeting.discussion_leader_id}
                      onValueChange={(value) => {
                        const leader = members.find(m => m.user_id === value);
                        setNewMeeting({
                          ...newMeeting,
                          discussion_leader_id: value,
                          discussion_leader_name: leader?.user_name || ""
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map(member => (
                          <SelectItem key={member.id} value={member.user_id}>
                            {member.user_name} {member.role === 'leader' && '(Leader)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Study Passage</label>
                    <Input
                      value={newMeeting.study_passage}
                      onChange={(e) => setNewMeeting({...newMeeting, study_passage: e.target.value})}
                      placeholder="e.g., John 5:1-15"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleDialogChange(false)}>Cancel</Button>
                  <Button onClick={handleSaveMeeting}>
                    {editingMeetingId ? "Save Changes" : "Schedule Meeting"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {upcomingMeetings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Upcoming Meetings</h3>
              <div className="space-y-3">
                {upcomingMeetings.map(meeting => (
                  <Card key={meeting.id} className="border-2 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          {getMeetingIcon(meeting.meeting_type)}
                          <div>
                            <h4 className="font-semibold">{meeting.title}</h4>
                            <p className="text-sm text-gray-600">{meeting.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{meeting.meeting_type}</Badge>
                          {isLeader && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Edit ${meeting.title}`}
                                onClick={() => handleEditMeeting(meeting)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Cancel ${meeting.title}`}
                                onClick={() => handleDeleteMeeting(meeting)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{format(parseISO(meeting.scheduled_date), 'PPpp')} ({meeting.duration_minutes} min)</span>
                        </div>
                        {meeting.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{meeting.location}</span>
                          </div>
                        )}
                        {meeting.study_passage && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Passage: {meeting.study_passage}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Led by: {meeting.discussion_leader_name}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" onClick={() => handleRSVP(meeting, 'attending')}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Attending
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRSVP(meeting, 'maybe')}>
                          Maybe
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRSVP(meeting, 'not_attending')}>
                          <X className="w-4 h-4 mr-1" />
                          Can't Make It
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastMeetings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Past Meetings</h3>
              <div className="space-y-2">
                {pastMeetings.slice(0, 5).map(meeting => (
                  <div key={meeting.id} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{meeting.title}</p>
                        <p className="text-xs text-gray-500">
                          {format(parseISO(meeting.scheduled_date), 'PP')}
                        </p>
                      </div>
                      <Badge variant="outline">Completed</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meetings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No meetings scheduled yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
