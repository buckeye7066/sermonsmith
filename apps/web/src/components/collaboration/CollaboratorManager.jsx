import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Plus, Mail, Trash2, Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

const ROLES = [
  { value: "editor", label: "Editor", description: "Can edit all content" },
  { value: "commenter", label: "Commenter", description: "Can only add comments" },
  { value: "viewer", label: "Viewer", description: "Read-only access" }
];

export default function CollaboratorManager({ open, onClose, sermon, user }) {
  const [collaborators, setCollaborators] = useState([]);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (open && sermon) {
      loadCollaborators();
    }
  }, [open, sermon]);

  const loadCollaborators = async () => {
    try {
      const collab = await api.entities.SermonCollaborator.filter({ sermon_id: sermon.id });
      setCollaborators(collab);
    } catch (error) {
      console.error("Error loading collaborators:", error);
    }
  };

  const inviteCollaborator = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email");
      return;
    }

    setIsInviting(true);
    try {
      await api.entities.SermonCollaborator.create({
        sermon_id: sermon.id,
        user_id: email, // Will be resolved on acceptance
        user_email: email,
        user_name: email,
        role: selectedRole,
        invited_by: user.id,
        status: "pending"
      });

      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      loadCollaborators();
    } catch (error) {
      console.error("Error inviting collaborator:", error);
      toast.error("Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const removeCollaborator = async (collabId) => {
    if (!confirm("Remove this collaborator?")) return;

    try {
      await api.entities.SermonCollaborator.delete(collabId);
      toast.success("Collaborator removed");
      loadCollaborators();
    } catch (error) {
      console.error("Error removing collaborator:", error);
      toast.error("Failed to remove collaborator");
    }
  };

  const updateRole = async (collabId, newRole) => {
    try {
      await api.entities.SermonCollaborator.update(collabId, { role: newRole });
      toast.success("Role updated");
      loadCollaborators();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const statusIcon = (status) => {
    switch (status) {
      case "accepted": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "declined": return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-600" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Manage Collaborators
          </DialogTitle>
          <DialogDescription>
            Invite others to work on "{sermon?.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Invite Collaborator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') inviteCollaborator();
                  }}
                />
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={inviteCollaborator} disabled={isInviting}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {ROLES.map((role) => (
                  <div key={role.value} className="p-2 bg-gray-50 rounded">
                    <p className="font-semibold">{role.label}</p>
                    <p className="text-gray-600">{role.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Collaborators */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Collaborators ({collaborators.length})
            </h3>
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <Card key={collab.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{collab.user_name}</p>
                          {statusIcon(collab.status)}
                          <Badge variant={collab.status === "accepted" ? "default" : "secondary"}>
                            {collab.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{collab.user_email}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={collab.role}
                          onValueChange={(role) => updateRole(collab.id, role)}
                          disabled={collab.role === "owner"}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {collab.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCollaborator(collab.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {collaborators.length === 0 && (
                <Alert>
                  <Users className="w-4 h-4" />
                  <AlertDescription>
                    No collaborators yet. Invite others to help with this sermon!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}