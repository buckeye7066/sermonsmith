import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Calendar } from "lucide-react";
import { api } from '@/api/apiClient';

export default function AdvancedSearch({ 
  open, 
  onClose, 
  onSearch, 
  userId,
  resourceType = 'all' // 'sermon', 'study', 'note', 'quiz', 'all'
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [dateRange, setDateRange] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [availableTags, setAvailableTags] = useState([]);
  const [availableCollections, setAvailableCollections] = useState([]);

  useEffect(() => {
    if (open) {
      loadFilters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [open, resourceType]);

  const loadFilters = async () => {
    try {
      // Load tags
      const tagFilter = resourceType === 'all' 
        ? { user_id: userId }
        : { user_id: userId, resource_type: resourceType };
      
      const tags = await api.entities.ResourceTag.filter(tagFilter);
      const uniqueTags = [...new Set(tags.map(t => t.tag))];
      setAvailableTags(uniqueTags);

      // Load collections
      const collectionFilter = resourceType === 'all'
        ? { user_id: userId }
        : { user_id: userId, resource_type: resourceType };
      
      const collections = await api.entities.Collection.filter(collectionFilter);
      setAvailableCollections(collections);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const handleSearch = () => {
    const filters = {
      searchTerm: searchTerm.trim(),
      tags: selectedTags,
      collections: selectedCollections,
      dateRange,
      sortBy
    };
    
    onSearch(filters);
    onClose();
  };

  const handleReset = () => {
    setSearchTerm("");
    setSelectedTags([]);
    setSelectedCollections([]);
    setDateRange("all");
    setSortBy("recent");
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const toggleCollection = (collectionId) => {
    setSelectedCollections(prev =>
      prev.includes(collectionId)
        ? prev.filter(c => c !== collectionId)
        : [...prev, collectionId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Advanced Search & Filter
          </DialogTitle>
          <DialogDescription>
            Find exactly what you're looking for with powerful filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Term */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search Keywords</label>
            <Input
              placeholder="Search by title, content, topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Tags Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Tags</label>
            {availableTags.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No tags available</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => toggleTag(tag)}
                  >
                    {selectedTags.includes(tag) && <X className="w-3 h-3 mr-1" />}
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
                className="mt-2"
              >
                Clear Tags
              </Button>
            )}
          </div>

          {/* Collections Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Collections</label>
            {availableCollections.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No collections available</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded">
                {availableCollections.map((collection) => (
                  <div key={collection.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={collection.id}
                      checked={selectedCollections.includes(collection.id)}
                      onCheckedChange={() => toggleCollection(collection.id)}
                    />
                    <label
                      htmlFor={collection.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {collection.name} ({collection.items_count || 0})
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Range
            </label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-sm font-medium mb-2 block">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
                <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm || selectedTags.length > 0 || selectedCollections.length > 0 || dateRange !== 'all') && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Active Filters:</h4>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Clear All
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {searchTerm && <p>• Searching: "{searchTerm}"</p>}
                {selectedTags.length > 0 && <p>• Tags: {selectedTags.length} selected</p>}
                {selectedCollections.length > 0 && <p>• Collections: {selectedCollections.length} selected</p>}
                {dateRange !== 'all' && <p>• Date: {dateRange}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}