import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Pin, MessageCircle, Book, Heart, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function GroupChat({ group, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000); // Poll for new messages
    return () => clearInterval(interval);
  }, [group.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const msgs = await base44.entities.GroupMessage.filter(
        { group_id: group.id },
        '-created_date',
        100
      );
      setMessages(msgs.reverse());
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await base44.entities.GroupMessage.create({
        group_id: group.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        message: newMessage,
        message_type: messageType
      });

      setNewMessage("");
      loadMessages();
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case "scripture_reference": return <Book className="w-4 h-4" />;
      case "prayer_request": return <Heart className="w-4 h-4" />;
      case "announcement": return <Megaphone className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getMessageColor = (type) => {
    switch (type) {
      case "scripture_reference": return "bg-blue-100 border-blue-300";
      case "prayer_request": return "bg-purple-100 border-purple-300";
      case "announcement": return "bg-yellow-100 border-yellow-300";
      default: return "bg-white";
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Group Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg border ${getMessageColor(msg.message_type)} ${
                  msg.user_id === user.id ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[80%]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{msg.user_name}</span>
                  {getMessageIcon(msg.message_type)}
                  {msg.is_pinned && <Pin className="w-3 h-3 text-yellow-600" />}
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <span className="text-xs text-gray-500 mt-1 block">
                  {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                </span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="border-t p-4 space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={messageType === "text" ? "default" : "outline"}
              onClick={() => setMessageType("text")}
            >
              Text
            </Button>
            <Button
              size="sm"
              variant={messageType === "scripture_reference" ? "default" : "outline"}
              onClick={() => setMessageType("scripture_reference")}
            >
              <Book className="w-4 h-4 mr-1" />
              Scripture
            </Button>
            <Button
              size="sm"
              variant={messageType === "prayer_request" ? "default" : "outline"}
              onClick={() => setMessageType("prayer_request")}
            >
              <Heart className="w-4 h-4 mr-1" />
              Prayer
            </Button>
            <Button
              size="sm"
              variant={messageType === "announcement" ? "default" : "outline"}
              onClick={() => setMessageType("announcement")}
            >
              <Megaphone className="w-4 h-4 mr-1" />
              Announce
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}