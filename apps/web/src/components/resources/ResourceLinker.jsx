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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Plus, X, FileText, BookOpen, StickyNote, Brain, Folder } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

const RESOURCE_TYPES = [
  { value: 'sermon', label: 'Sermon', icon: FileText },
  { value: 'study', label: 'Bible Study', icon: BookOpen },
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'quiz', label: 'Quiz', icon: Brain },
  { value: 'collection', label: 'Collection', icon: Folder }
];

const LINK_TYPES = [
  { value: 'related', label: 'Related To', description: 'Generally connected' },
  { value: 'prerequisite', label: 'Prerequisite', description: 'Should be studied first' },
  { value: 'follow_up', label: 'Follow-up', description: 'Continues this topic' },
  { value: 'reference', label: 'Reference', description: 'Referenced in content' },
  { value: 'series', label: 'Part of Series', description: 'Same series' }
];

export default function ResourceLinker({ open, onClose, sourceType, sourceId, userId }) {
  const [linkedResources, setLinkedResources] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [selectedType, setSelectedType] = useState('sermon');
  const [selectedResource, setSelectedResource] = useState('');
  const [linkType, setLinkType] = useState('related');
  const [linkNotes, setLinkNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      loadLinkedResources();
      loadAvailableResources();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, selectedType]);

  const loadLinkedResources = async () => {
    try {
      const links = await api.entities.ResourceLink.filter({
        user_id: userId,
        source_id: sourceId,
        source_type: sourceType
      });

      // Fetch details for each linked resource
      const detailedLinks = await Promise.all(
        links.map(async (link) => {
          let resource = null;
          
          if (link.target_type === 'sermon') {
            const sermons = await api.entities.Sermon.filter({ id: link.target_id });
            resource = sermons[0];
          } else if (link.target_type === 'study') {
            const studies = await api.entities.BibleStudy.filter({ id: link.target_id });
            resource = studies[0];
          } else if (link.target_type === 'collection') {
            const collections = await api.entities.Collection.filter({ id: link.target_id });
            resource = collections[0];
          }
          
          return { ...link, resource };
        })
      );

      setLinkedResources(detailedLinks.filter(l => l.resource));
    } catch (error) {
      console.error('Error loading linked resources:', error);
    }
  };

  const loadAvailableResources = async () => {
    try {
      let resources = [];
      
      if (selectedType === 'sermon') {
        resources = await api.entities.Sermon.filter({ user_id: userId });
      } else if (selectedType === 'study') {
        resources = await api.entities.BibleStudy.filter({ user_id: userId });
      } else if (selectedType === 'quiz') {
        resources = await api.entities.Quiz.filter({ user_id: userId });
      } else if (selectedType === 'collection') {
        resources = await api.entities.Collection.filter({ user_id: userId });
      }

      // Filter out already linked and self
      const linkedIds = linkedResources
        .filter(l => l.target_type === selectedType)
        .map(l => l.target_id);
      
      resources = resources.filter(r => 
        r.id !== sourceId && !linkedIds.includes(r.id)
      );

      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        resources = resources.filter(r => 
          (r.title?.toLowerCase().includes(term)) ||
          (r.topic?.toLowerCase().includes(term)) ||
          (r.name?.toLowerCase().includes(term))
        );
      }

      setAvailableResources(resources);
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const handleAddLink = async () => {
    if (!selectedResource) {
      toast.error("Please select a resource");
      return;
    }

    try {
      await api.entities.ResourceLink.create({
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        target_type: selectedType,
        target_id: selectedResource,
        link_type: linkType,
        notes: linkNotes.trim() || null
      });

      toast.success("Resource linked!");
      setSelectedResource('');
      setLinkNotes('');
      loadLinkedResources();
      loadAvailableResources();
    } catch (error) {
      console.error('Error adding link:', error);
      toast.error("Failed to link resource");
    }
  };

  const handleRemoveLink = async (linkId) => {
    try {
      await api.entities.ResourceLink.delete(linkId);
      toast.success("Link removed");
      loadLinkedResources();
      loadAvailableResources();
    } catch (error) {
      console.error('Error removing link:', error);
      toast.error("Failed to remove link");
    }
  };

  const getResourceIcon = (type) => {
    const resourceType = RESOURCE_TYPES.find(t => t.value === type);
    return resourceType ? resourceType.icon : FileText;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-500" />
            Link Related Resources
          </DialogTitle>
          <DialogDescription>
            Connect related sermons, studies, notes, and collections for easy navigation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Links */}
          <div>
            <h3 className="font-medium mb-3">Linked Resources ({linkedResources.length})</h3>
            {linkedResources.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No linked resources yet</p>
            ) : (
              <div className="space-y-2">
                {linkedResources.map((link) => {
                  const Icon = getResourceIcon(link.target_type);
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="w-5 h-5 text-gray-600" />
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">
                            {link.resource?.title || link.resource?.name || 'Untitled'}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {link.link_type.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {link.target_type}
                            </span>
                          </div>
                          {link.notes && (
                            <p className="text-xs text-gray-600 mt-1">{link.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLink(link.id)}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Link */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Add New Link</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Resource Type</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Link Type</label>
                  <Select value={linkType} onValueChange={setLinkType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LINK_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Search Resources</label>
                <Input
                  placeholder="Search by title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Select Resource</label>
                {availableResources.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    No available {selectedType}s to link
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                    {availableResources.map((resource) => (
                      <div
                        key={resource.id}
                        onClick={() => setSelectedResource(resource.id)}
                        className={`p-2 rounded cursor-pointer transition-colors ${
                          selectedResource === resource.id
                            ? 'bg-blue-100 border-blue-500'
                            : 'hover:bg-gray-50 border-transparent'
                        } border`}
                      >
                        <p className="font-medium text-sm">
                          {resource.title || resource.name || 'Untitled'}
                        </p>
                        {resource.topic && (
                          <p className="text-xs text-gray-500">{resource.topic}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                <Textarea
                  placeholder="Why are these resources connected?"
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleAddLink}
                disabled={!selectedResource}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}