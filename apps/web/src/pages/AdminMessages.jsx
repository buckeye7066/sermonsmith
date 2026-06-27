import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Clock,
  Mail,
  User,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "../components/admin/UserActivityLogger";

export default function AdminMessages() {
  const { user, isLoadingAuth } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [response, setResponse] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [userActivities, setUserActivities] = useState({});

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      logError('AdminMessages: no authenticated user');
      setIsLoading(false);
      return;
    }
    if (user.role !== 'admin') {
      toast.error("Admin access required");
      setIsLoading(false);
      return;
    }
    loadMessages().finally(() => setIsLoading(false));
  }, [isLoadingAuth, user]);

  const loadMessages = async () => {
    try {
      const allMessages = await api.entities.Message.list('-created_date');
      setMessages(allMessages);
      
      // Load last activity for each user
      const uniqueUserIds = [...new Set(allMessages.map(m => m.user_id))];
      const activities = {};
      
      for (const userId of uniqueUserIds) {
        try {
          const userActivities = await api.entities.UserActivity.filter(
            { user_id: userId },
            '-created_date',
            1
          );
          if (userActivities.length > 0) {
            activities[userId] = userActivities[0].created_date;
          }
        } catch (error) {
          console.error(`Failed to load activity for user ${userId}`);
        }
      }
      
      setUserActivities(activities);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const handleRespond = async () => {
    if (!response.trim() || !selectedMessage) {
      toast.error("Please enter a response");
      return;
    }

    setIsSending(true);
    try {
      await api.entities.Message.update(selectedMessage.id, {
        admin_response: response.trim(),
        responded_at: new Date().toISOString(),
        status: "resolved"
      });

      logActivity('message_resolved', {
        page_name: 'AdminMessages',
        resource_type: 'message',
        resource_id: selectedMessage.id,
        data_modified: 'admin_response_sent',
        previous_value: selectedMessage.status,
        new_value: 'resolved',
        metadata: {
          message_type: selectedMessage.message_type,
          user_email: selectedMessage.user_email,
          user_id: selectedMessage.user_id,
          response_length: response.trim().length,
          subject: selectedMessage.subject
        }
      });

      toast.success("Response sent!");
      setResponse("");
      setSelectedMessage(null);
      await loadMessages();
    } catch (error) {
      toast.error("Failed to send response");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (messageId, newStatus) => {
    try {
      const message = messages.find(m => m.id === messageId);
      const oldStatus = message?.status;
      
      await api.entities.Message.update(messageId, { status: newStatus });
      
      logActivity('message_status_changed', {
        page_name: 'AdminMessages',
        resource_type: 'message',
        resource_id: messageId,
        data_modified: 'message_status',
        previous_value: oldStatus,
        new_value: newStatus,
        metadata: {
          message_type: message?.message_type,
          user_email: message?.user_email,
          user_id: message?.user_id
        }
      });
      
      toast.success("Status updated");
      await loadMessages();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "resolved": return "bg-green-100 text-green-800";
      case "closed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "bug_report": return "🐛";
      case "feature_request": return "💡";
      case "question": return "❓";
      case "feedback": return "💬";
      default: return "📝";
    }
  };

  const filteredMessages = statusFilter === "all" 
    ? messages 
    : messages.filter(m => m.status === statusFilter);

  const newCount = messages.filter(m => m.status === "new").length;
  const inProgressCount = messages.filter(m => m.status === "in_progress").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Admin access required</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
            User Messages
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            View and respond to user messages
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">New Messages</p>
                  <p className="text-3xl font-bold text-blue-600">{newCount}</p>
                </div>
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-600">{inProgressCount}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Messages</p>
                  <p className="text-3xl font-bold text-gray-900">{messages.length}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Messages</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Messages</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-300" />
                <p className="mt-4 text-gray-500">No messages to display</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold">{msg.user_name}</span>
                          <span className="text-sm text-gray-500">{msg.user_email}</span>
                          <Badge className={getStatusColor(msg.status)}>
                            {msg.status.replace('_', ' ')}
                          </Badge>
                          {userActivities[msg.user_id] && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              Last active: {new Date(userActivities[msg.user_id]).toLocaleString()}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <span>{getTypeIcon(msg.message_type)}</span>
                          {msg.subject}
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">{msg.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(msg.created_date).toLocaleString()} • {msg.message_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    {msg.admin_response && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border-l-4 border-indigo-600">
                        <p className="font-semibold text-sm text-indigo-900 dark:text-indigo-100 mb-2">
                          Your Response:
                        </p>
                        <p className="text-sm text-indigo-800 dark:text-indigo-200">{msg.admin_response}</p>
                        <p className="text-xs text-indigo-600 mt-2">
                          {new Date(msg.responded_at).toLocaleString()}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Select
                        value={msg.status}
                        onValueChange={(value) => handleStatusChange(msg.id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      {!msg.admin_response && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedMessage(msg);
                            setResponse("");
                          }}
                        >
                          Respond
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Dialog */}
        {selectedMessage && (
          <Card className="border-indigo-500 border-2">
            <CardHeader>
              <CardTitle>Respond to: {selectedMessage.subject}</CardTitle>
              <CardDescription>From: {selectedMessage.user_name} ({selectedMessage.user_email})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-sm font-semibold mb-1">Original Message:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedMessage.message}</p>
              </div>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your response here..."
                rows={6}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleRespond}
                  disabled={isSending || !response.trim()}
                  className="flex items-center gap-2"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Response
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedMessage(null);
                    setResponse("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
