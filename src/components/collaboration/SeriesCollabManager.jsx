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
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Plus, Mail, Trash2, UserCog, CheckCircle, Clock, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const SERIES_ROLES = [
  { value: "lead_pastor", label: "Lead Pastor", description: "Oversees entire series" },
  { value: "contributor", label: "Contributor", description: "Writes specific sermons" },
  { value: "reviewer", label: "Reviewer", description: "Reviews and comments only" }
];

export default function SeriesCollabManager({ open, onClose, series, sermons, user }) {
  const [collaborators, setCollaborators] = useState([]);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("contributor");
  const [assignedSermons, setAssignedSermons] = useState([]);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (open && series) {
      loadCollaborators();
    }
  }, [open, series]);

  const loadCollaborators = async () => {
    try {
      const collab = await base44.entities.SeriesCollaborator.filter({ series_id: series.id });
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
      await base44.entities.SeriesCollaborator.create({
        series_id: series.id,
        user_id: email,
        user_email: email,
        user_name: email,
        role: selectedRole,
        assigned_sermons: assignedSermons,
        status: "pending"
      });

      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setAssignedSermons([]);
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
      await base44.entities.SeriesCollaborator.delete(collabId);
      toast.success("Collaborator removed");
      loadCollaborators();
    } catch (error) {
      console.error("Error removing collaborator:", error);
      toast.error("Failed to remove collaborator");
    }
  };

  const updateRole = async (collabId, newRole) => {
    try {
      await base44.entities.SeriesCollaborator.update(collabId, { role: newRole });
      toast.success("Role updated");
      loadCollaborators();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const toggleSermonAssignment = (sermonId) => {
    setAssignedSermons(prev =>
      prev.includes(sermonId)
        ? prev.filter(id => id !== sermonId)
        : [...prev, sermonId]
    );
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Series Collaboration
          </DialogTitle>
          <DialogDescription>
            Manage team roles for "{series?.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Invite Team Member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERIES_ROLES.map((role) => (
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

              {selectedRole === "contributor" && sermons.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Assign Specific Sermons ({assignedSermons.length} selected)
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                    {sermons.map((sermon) => (
                      <div key={sermon.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={assignedSermons.includes(sermon.id)}
                          onCheckedChange={() => toggleSermonAssignment(sermon.id)}
                        />
                        <span className="text-sm">{sermon.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs">
                {SERIES_ROLES.map((role) => (
                  <div key={role.value} className="p-2 bg-gray-50 rounded">
                    <p className="font-semibold">{role.label}</p>
                    <p className="text-gray-600">{role.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Team */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Team Members ({collaborators.length})
            </h3>
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <Card key={collab.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
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
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERIES_ROLES.map((role) => (
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

                    {collab.assigned_sermons && collab.assigned_sermons.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-gray-600 mb-1">Assigned Sermons:</p>
                        <div className="flex flex-wrap gap-1">
                          {collab.assigned_sermons.map((sermonId) => {
                            const sermon = sermons.find(s => s.id === sermonId);
                            return sermon ? (
                              <Badge key={sermonId} variant="outline" className="text-xs">
                                {sermon.title}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {collaborators.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8 text-gray-500">
                    No team members yet. Invite others to collaborate!
                  </CardContent>
                </Card>
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