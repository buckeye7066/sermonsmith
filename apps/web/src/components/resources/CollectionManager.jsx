import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder, Plus, CheckCircle2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

const ICONS = ['folder', 'book', 'star', 'heart', 'bookmark', 'lightbulb', 'target'];
const COLORS = ['blue', 'green', 'purple', 'red', 'orange', 'pink', 'teal', 'indigo'];

const COLOR_BG = {
  blue: 'bg-blue-100', green: 'bg-green-100', purple: 'bg-purple-100', red: 'bg-red-100',
  orange: 'bg-orange-100', pink: 'bg-pink-100', teal: 'bg-teal-100', indigo: 'bg-indigo-100'
};
const COLOR_TEXT = {
  blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600', red: 'text-red-600',
  orange: 'text-orange-600', pink: 'text-pink-600', teal: 'text-teal-600', indigo: 'text-indigo-600'
};

export default function CollectionManager({ 
  open, 
  onClose, 
  resourceType, 
  resourceId, 
  userId,
  mode = 'add' // 'add' or 'create'
}) {
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    icon: 'folder',
    color: 'blue',
    resource_type: resourceType
  });

  useEffect(() => {
    if (open && mode === 'add') {
      loadCollections();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, mode]);

  const loadCollections = async () => {
    try {
      const userCollections = await api.entities.Collection.filter({ user_id: userId });
      setCollections(userCollections);

      // Load which collections already contain this resource
      const items = await api.entities.CollectionItem.filter({
        user_id: userId,
        resource_id: resourceId,
        resource_type: resourceType
      });
      
      setSelectedCollections(items.map(item => item.collection_id));
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const createCollection = async () => {
    if (!newCollection.name.trim()) {
      toast.error("Collection name is required");
      return;
    }

    try {
      const collection = await api.entities.Collection.create({
        user_id: userId,
        ...newCollection
      });

      toast.success("Collection created!");
      setCollections([...collections, collection]);
      setNewCollection({
        name: '',
        description: '',
        icon: 'folder',
        color: 'blue',
        resource_type: resourceType
      });
      setShowCreateNew(false);

      // If in add mode, automatically add resource to new collection
      if (mode === 'add') {
        await addToCollection(collection.id);
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error("Failed to create collection");
    }
  };

  const addToCollection = async (collectionId) => {
    try {
      // Check if already in collection
      if (selectedCollections.includes(collectionId)) {
        // Remove from collection
        const items = await api.entities.CollectionItem.filter({
          collection_id: collectionId,
          resource_id: resourceId
        });
        
        if (items[0]) {
          await api.entities.CollectionItem.delete(items[0].id);
          setSelectedCollections(selectedCollections.filter(id => id !== collectionId));
          
          // Update count
          const collection = collections.find(c => c.id === collectionId);
          if (collection) {
            await api.entities.Collection.update(collectionId, {
              items_count: Math.max(0, (collection.items_count || 1) - 1)
            });
          }
          
          toast.success("Removed from collection");
        }
      } else {
        // Add to collection
        await api.entities.CollectionItem.create({
          collection_id: collectionId,
          user_id: userId,
          resource_type: resourceType,
          resource_id: resourceId,
          order: 0
        });
        
        setSelectedCollections([...selectedCollections, collectionId]);
        
        // Update count
        const collection = collections.find(c => c.id === collectionId);
        if (collection) {
          await api.entities.Collection.update(collectionId, {
            items_count: (collection.items_count || 0) + 1
          });
        }
        
        toast.success("Added to collection");
      }
    } catch (error) {
      console.error('Error toggling collection:', error);
      toast.error("Failed to update collection");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-500" />
            {mode === 'add' ? 'Add to Collection' : 'Create Collection'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' 
              ? 'Organize your resources into collections for easy access'
              : 'Create a new collection to organize your resources'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {mode === 'add' && !showCreateNew && (
            <>
              {collections.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-4">No collections yet</p>
                  <Button onClick={() => setShowCreateNew(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Collection
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    {collections.map((collection) => (
                      <div
                        key={collection.id}
                        onClick={() => addToCollection(collection.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedCollections.includes(collection.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${COLOR_BG[collection.color] || 'bg-blue-100'}`}>
                              <Folder className={`w-5 h-5 ${COLOR_TEXT[collection.color] || 'text-blue-600'}`} />
                            </div>
                            <div>
                              <h4 className="font-medium">{collection.name}</h4>
                              {collection.description && (
                                <p className="text-sm text-gray-600">{collection.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {collection.items_count || 0} items
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {collection.resource_type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {selectedCollections.includes(collection.id) && (
                            <CheckCircle2 className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateNew(true)}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Collection
                  </Button>
                </>
              )}
            </>
          )}

          {(mode === 'create' || showCreateNew) && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Collection Name</label>
                <Input
                  placeholder="e.g., Sunday Sermons, Advent Series..."
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                <Textarea
                  placeholder="What's this collection for?"
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Icon</label>
                  <Select
                    value={newCollection.icon}
                    onValueChange={(value) => setNewCollection({ ...newCollection, icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICONS.map(icon => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Color</label>
                  <Select
                    value={newCollection.color}
                    onValueChange={(value) => setNewCollection({ ...newCollection, color: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map(color => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                {mode === 'add' && (
                  <Button variant="outline" onClick={() => setShowCreateNew(false)} className="flex-1">
                    Cancel
                  </Button>
                )}
                <Button onClick={createCollection} className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Collection
                </Button>
              </div>
            </div>
          )}
        </div>

        {mode === 'add' && !showCreateNew && (
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}