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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Plus, Save, Trash2, GripVertical, Users } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import SeriesCollabManager from "@/components/collaboration/SeriesCollabManager";

export default function SeriesManager({ open, onClose, user }) {
  const [mySeries, setMySeries] = useState([]);
  const [sermons, setSermons] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSeries, setNewSeries] = useState({
    title: "",
    description: "",
    denomination: user?.denomination || ""
  });
  const [selectedSermons, setSelectedSermons] = useState([]);
  const [showSeriesCollab, setShowSeriesCollab] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null);

  useEffect(() => {
    if (open && user) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, user]);

  const loadData = async () => {
    try {
      const [userSeries, userSermons] = await Promise.all([
        api.entities.SermonSeries.filter({ user_id: user.id }),
        api.entities.Sermon.filter({ user_id: user.id })
      ]);
      
      setMySeries(userSeries);
      setSermons(userSermons);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load series data");
    }
  };

  const createSeries = async () => {
    if (!newSeries.title.trim()) {
      toast.error("Please enter a series title");
      return;
    }

    try {
      const createdSeries = await api.entities.SermonSeries.create({
        user_id: user.id,
        title: newSeries.title,
        description: newSeries.description,
        denomination: newSeries.denomination,
        length: selectedSermons.length,
        status: "in_progress"
      });

      // Update selected sermons with series info
      for (let i = 0; i < selectedSermons.length; i++) {
        await api.entities.Sermon.update(selectedSermons[i], {
          series_id: createdSeries.id,
          series_order: i + 1
        });
      }

      toast.success("Series created!");
      setIsCreating(false);
      setNewSeries({ title: "", description: "", denomination: user?.denomination || "" });
      setSelectedSermons([]);
      loadData();
    } catch (error) {
      console.error("Error creating series:", error);
      toast.error("Failed to create series");
    }
  };

  const deleteSeries = async (seriesId) => {
    if (!confirm("Delete this series? Sermons will remain but series info will be removed.")) {
      return;
    }

    try {
      // Remove series reference from sermons
      const sermonsInSeries = sermons.filter(s => s.series_id === seriesId);
      for (const sermon of sermonsInSeries) {
        await api.entities.Sermon.update(sermon.id, {
          series_id: null,
          series_order: null
        });
      }

      await api.entities.SermonSeries.delete(seriesId);
      toast.success("Series deleted");
      loadData();
    } catch (error) {
      console.error("Error deleting series:", error);
      toast.error("Failed to delete series");
    }
  };

  const toggleSermonSelection = (sermonId) => {
    setSelectedSermons(prev =>
      prev.includes(sermonId)
        ? prev.filter(id => id !== sermonId)
        : [...prev, sermonId]
    );
  };

  const availableSermons = sermons.filter(s => !s.series_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Manage Sermon Series
          </DialogTitle>
          <DialogDescription>
            Organize your sermons into multi-week series
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Series */}
          {!isCreating ? (
            <Button onClick={() => setIsCreating(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Create New Series
            </Button>
          ) : (
            <Card className="border-2 border-indigo-200">
              <CardHeader>
                <CardTitle>New Series</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Series Title (e.g., 'The Gospel of John')"
                  value={newSeries.title}
                  onChange={(e) => setNewSeries({ ...newSeries, title: e.target.value })}
                />
                <Textarea
                  placeholder="Series Description"
                  value={newSeries.description}
                  onChange={(e) => setNewSeries({ ...newSeries, description: e.target.value })}
                  rows={3}
                />
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Sermons for Series ({selectedSermons.length} selected)
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2">
                    {availableSermons.map((sermon) => (
                      <div key={sermon.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                        <Checkbox
                          checked={selectedSermons.includes(sermon.id)}
                          onCheckedChange={() => toggleSermonSelection(sermon.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{sermon.title}</div>
                          <div className="text-xs text-gray-500">{sermon.topic}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {availableSermons.length === 0 && (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No available sermons. Create some sermons first!
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={createSeries} disabled={!newSeries.title.trim() || selectedSermons.length === 0}>
                    <Save className="w-4 h-4 mr-2" />
                    Create Series
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsCreating(false);
                    setNewSeries({ title: "", description: "", denomination: user?.denomination || "" });
                    setSelectedSermons([]);
                  }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Series */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Your Series ({mySeries.length})</h3>
            <div className="space-y-3">
              {mySeries.map((series) => {
                const sermonsInSeries = sermons.filter(s => s.series_id === series.id)
                  .sort((a, b) => (a.series_order || 0) - (b.series_order || 0));
                
                return (
                  <Card key={series.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{series.title}</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">{series.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge>{sermonsInSeries.length} Sermons</Badge>
                            <Badge variant="outline">{series.status}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedSeries(series);
                              setShowSeriesCollab(true);
                            }}
                            title="Manage collaborators"
                          >
                            <Users className="w-4 h-4 text-indigo-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSeries(series.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {sermonsInSeries.map((sermon, index) => (
                          <div key={sermon.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                            <GripVertical className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-600">{index + 1}.</span>
                            <span className="flex-1">{sermon.title}</span>
                            <Badge variant="secondary" className="text-xs">{sermon.topic}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {mySeries.length === 0 && !isCreating && (
                <Card>
                  <CardContent className="text-center py-12">
                    <Layers className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600">No series yet. Create your first sermon series!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>

      {selectedSeries && (
        <SeriesCollabManager
          open={showSeriesCollab}
          onClose={() => {
            setShowSeriesCollab(false);
            setSelectedSeries(null);
          }}
          series={selectedSeries}
          sermons={sermons.filter(s => s.series_id === selectedSeries.id)}
          user={user}
        />
      )}
    </Dialog>
  );
}
