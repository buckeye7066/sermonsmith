import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Save, Loader2, MessageSquare, ArrowLeft, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import CollaborativeEditor from "@/components/collaboration/CollaborativeEditor";
import CommentPanel from "@/components/collaboration/CommentPanel";
import CollaboratorManager from "@/components/collaboration/CollaboratorManager";

export default function CollaborativeSermonEditor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sermonId = searchParams.get('id');

  const { user, isLoadingAuth } = useAuth();
  const [sermon, setSermon] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [activeEditors, setActiveEditors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCollabManager, setShowCollabManager] = useState(false);
  const [hasEditAccess, setHasEditAccess] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      toast.error("Please log in");
      api.auth.redirectToLogin?.();
    }
  }, [isLoadingAuth, user]);

  useEffect(() => {
    if (user && sermonId) {
      loadSermon();
      loadCollaborators();
      const interval = setInterval(loadCollaborators, 5000);
      return () => clearInterval(interval);
    }
  }, [user, sermonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSermon = async () => {
    setIsLoading(true);
    try {
      const sermonData = await api.entities.Sermon.filter({ id: sermonId });
      if (sermonData.length === 0) {
        toast.error("Sermon not found");
        navigate(createPageUrl('MySermons'));
        return;
      }

      const s = sermonData[0];
      setSermon(s);

      // Check if user has edit access
      const isOwner = s.user_id === user.id;
      const collabAccess = await api.entities.SermonCollaborator.filter({
        sermon_id: sermonId,
        user_id: user.id,
        status: "accepted"
      });

      const hasAccess = isOwner || collabAccess.some(c => c.role === "editor" || c.role === "owner");
      setHasEditAccess(hasAccess);

      if (!hasAccess && !isOwner) {
        toast.error("You don't have edit access to this sermon");
      }
    } catch (error) {
      console.error("Error loading sermon:", error);
      toast.error("Failed to load sermon");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCollaborators = async () => {
    try {
      const collab = await api.entities.SermonCollaborator.filter({
        sermon_id: sermonId,
        status: "accepted"
      });
      setCollaborators(collab);

      // Check who's currently editing
      const edits = await api.entities.SermonEdit.filter({ sermon_id: sermonId });
      const now = new Date();
      const active = edits.filter(e => new Date(e.locked_until) > now);
      setActiveEditors(active);
    } catch (error) {
      console.error("Error loading collaborators:", error);
    }
  };

  const handleSave = async () => {
    if (!sermon) return;

    setIsSaving(true);
    try {
      await api.entities.Sermon.update(sermon.id, {
        title: sermon.title,
        topic: sermon.topic,
        anchor_passage: sermon.anchor_passage,
        big_idea: sermon.big_idea,
        points: sermon.points,
        conclusion: sermon.conclusion
      });

      toast.success("Sermon saved!");
    } catch (error) {
      console.error("Error saving sermon:", error);
      toast.error("Failed to save sermon");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field, value) => {
    setSermon({ ...sermon, [field]: value });
  };

  const updatePoint = (index, field, value) => {
    const newPoints = [...(sermon.points || [])];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setSermon({ ...sermon, points: newPoints });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!sermon) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('MySermons'))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Sermons
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Edit3 className="w-8 h-8 text-indigo-600" />
                Collaborative Editor
              </h1>
              <p className="text-gray-600 mt-1">
                Real-time collaboration with your team
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCollabManager(true)}
              >
                <Users className="w-4 h-4 mr-2" />
                Team ({collaborators.length})
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !hasEditAccess}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Active Editors Alert */}
        {activeEditors.length > 0 && (
          <Alert className="mb-6">
            <Users className="w-4 h-4" />
            <AlertDescription>
              Currently editing: {activeEditors.map(e => e.user_name).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {!hasEditAccess && sermon.user_id !== user.id && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              You have read-only access. Ask the owner to grant you editor permissions.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Sermon Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CollaborativeEditor
                  sermon={sermon}
                  field="title"
                  value={sermon.title || ""}
                  onChange={(val) => updateField('title', val)}
                  user={user}
                  label="Title"
                />

                <CollaborativeEditor
                  sermon={sermon}
                  field="topic"
                  value={sermon.topic || ""}
                  onChange={(val) => updateField('topic', val)}
                  user={user}
                  label="Topic"
                />

                <CollaborativeEditor
                  sermon={sermon}
                  field="anchor_passage"
                  value={sermon.anchor_passage || ""}
                  onChange={(val) => updateField('anchor_passage', val)}
                  user={user}
                  label="Anchor Passage"
                />

                <CollaborativeEditor
                  sermon={sermon}
                  field="big_idea"
                  value={sermon.big_idea || ""}
                  onChange={(val) => updateField('big_idea', val)}
                  user={user}
                  multiline
                  label="Big Idea"
                />
              </CardContent>
            </Card>

            {/* Points */}
            {sermon.points && sermon.points.map((point, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Point {index + 1}</CardTitle>
                    <Badge>{point.title || "Untitled"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CollaborativeEditor
                    sermon={sermon}
                    field={`point_${index}_title`}
                    value={point.title || ""}
                    onChange={(val) => updatePoint(index, 'title', val)}
                    user={user}
                    label="Point Title"
                  />

                  <CollaborativeEditor
                    sermon={sermon}
                    field={`point_${index}_exegesis`}
                    value={point.exegesis || ""}
                    onChange={(val) => updatePoint(index, 'exegesis', val)}
                    user={user}
                    multiline
                    label="Exegesis"
                  />

                  <CollaborativeEditor
                    sermon={sermon}
                    field={`point_${index}_illustration`}
                    value={point.illustration || ""}
                    onChange={(val) => updatePoint(index, 'illustration', val)}
                    user={user}
                    multiline
                    label="Illustration"
                  />

                  <CollaborativeEditor
                    sermon={sermon}
                    field={`point_${index}_application`}
                    value={point.application || ""}
                    onChange={(val) => updatePoint(index, 'application', val)}
                    user={user}
                    multiline
                    label="Application"
                  />
                </CardContent>
              </Card>
            ))}

            {/* Conclusion */}
            <Card>
              <CardHeader>
                <CardTitle>Conclusion</CardTitle>
              </CardHeader>
              <CardContent>
                <CollaborativeEditor
                  sermon={sermon}
                  field="conclusion"
                  value={sermon.conclusion || ""}
                  onChange={(val) => updateField('conclusion', val)}
                  user={user}
                  multiline
                  label="Conclusion"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="space-y-6">
            {/* General Comments */}
            <CommentPanel sermon={sermon} user={user} />

            {/* Point-specific Comments */}
            {sermon.points && sermon.points.map((point, index) => (
              <CommentPanel
                key={index}
                sermon={sermon}
                user={user}
                pointIndex={index}
              />
            ))}
          </TabsContent>
        </Tabs>

        <CollaboratorManager
          open={showCollabManager}
          onClose={() => setShowCollabManager(false)}
          sermon={sermon}
          user={user}
        />
      </div>
    </div>
  );
}