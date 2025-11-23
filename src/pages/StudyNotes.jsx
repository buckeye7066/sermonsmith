import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, BookOpen, Trash2, Search, Pin, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORY_ICONS = {
  observation: '📝',
  interpretation: '💡',
  application: '✨',
  prayer: '🙏',
  question: '❓',
  insight: '🔍'
};

export default function StudyNotes() {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      loadNotes(userData);
    } catch (error) {
      toast.error("Please log in to view your study notes");
      setIsLoading(false);
    }
  };

  const loadNotes = async (currentUser) => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const userNotes = await base44.entities.StudyNote.filter(
        { user_id: currentUser.id },
        '-created_date'
      );
      setNotes(userNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
      toast.error("Failed to load your study notes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!confirm("Delete this study note?")) return;
    
    try {
      await base44.entities.StudyNote.delete(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      toast.success("Note deleted");
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  const togglePin = async (note) => {
    try {
      await base44.entities.StudyNote.update(note.id, {
        is_pinned: !note.is_pinned
      });
      
      setNotes(notes.map(n => 
        n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n
      ));
      
      toast.success(note.is_pinned ? "Note unpinned" : "Note pinned");
    } catch (error) {
      toast.error("Failed to update note");
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = !searchTerm || 
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.scripture_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || note.category === categoryFilter;
    
    const matchesTag = !tagFilter || 
      (note.tags && note.tags.some(tag => 
        tag.toLowerCase().includes(tagFilter.toLowerCase())
      ));
    
    return matchesSearch && matchesCategory && matchesTag;
  });

  const allTags = [...new Set(notes.flatMap(n => n.tags || []))];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            My Study Notes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Organize and review your Bible study insights
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="observation">📝 Observation</SelectItem>
                  <SelectItem value="interpretation">💡 Interpretation</SelectItem>
                  <SelectItem value="application">✨ Application</SelectItem>
                  <SelectItem value="prayer">🙏 Prayer</SelectItem>
                  <SelectItem value="question">❓ Question</SelectItem>
                  <SelectItem value="insight">🔍 Insight</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Filter by tag..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
            </div>
            
            {allTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Quick tags:</span>
                {allTags.slice(0, 10).map(tag => (
                  <Badge 
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => setTagFilter(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-500">
                {notes.length === 0 ? "No study notes yet" : "No notes match your filters"}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Use the Study Tools button on any verse to create notes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotes
              .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
              .map(note => (
                <Card key={note.id} className={note.is_pinned ? 'border-2 border-yellow-400' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{CATEGORY_ICONS[note.category]}</span>
                          <Badge variant="secondary">{note.category}</Badge>
                          {note.is_pinned && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Pin className="w-3 h-3 mr-1" />
                              Pinned
                            </Badge>
                          )}
                        </div>
                        {note.scripture_reference && (
                          <CardDescription className="font-semibold text-indigo-600">
                            {note.scripture_reference}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => togglePin(note)}
                          className="h-8 w-8"
                        >
                          <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(note.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                      {note.content}
                    </p>
                    
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-3">
                      {new Date(note.created_date).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}