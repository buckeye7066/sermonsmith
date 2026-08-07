import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { logActivity } from "../components/admin/UserActivityLogger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
} from "@/components/ui/dialog";
import { FileText, Printer, Trash2, Loader2, CheckCircle, Tag, Folder, Search, Filter, FolderPlus, Plus, Wand2, Presentation, Users, MessageSquare, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router";
import { createPageUrl } from "@/utils";
import TagManager from "@/components/resources/TagManager";
import CollectionManager from "@/components/resources/CollectionManager";
import AdvancedSearch from "@/components/resources/AdvancedSearch";
import SermonAdaptation from "@/components/sermon/SermonAdaptation";
import PresentationMode from "@/components/sermon/PresentationMode";
import CollaboratorManager from "@/components/collaboration/CollaboratorManager";
import CommentPanel from "@/components/collaboration/CommentPanel";

export default function MySermons() {
  const [searchParams] = useSearchParams();
  const [sermons, setSermons] = useState([]);
  const [filteredSermons, setFilteredSermons] = useState([]);
  const [collections, setCollections] = useState([]);
  const [tags, setTags] = useState([]);
  const { user, isLoadingAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSermon, setSelectedSermon] = useState(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [activeView, setActiveView] = useState('all'); // 'all', 'collections'
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [adaptingSermon, setAdaptingSermon] = useState(null);
  const [showAdaptDialog, setShowAdaptDialog] = useState(false);
  const [presentingSermon, setPresentingSermon] = useState(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [collaboratingSermon, setCollaboratingSermon] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [commentingSermon, setCommentingSermon] = useState(null);

  useEffect(() => {
    logActivity('page_view', { page_name: 'MySermons' });
    const upgraded = searchParams.get('upgraded');
    if (upgraded === 'true') {
      toast.success("Successfully upgraded to Premium! 🎉", {
        description: "You now have access to all premium features."
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      toast.error("Please log in to view your sermons");
      setIsLoading(false);
      return;
    }
    loadSermons();
    loadCollections();
    loadTags();
    setIsLoading(false);
  }, [isLoadingAuth, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSermons = async () => {
    try {
      const userSermons = await api.entities.Sermon.filter({ user_id: user.id }, '-created_date');
      setSermons(userSermons);
      setFilteredSermons(userSermons);
      
      // Log viewing sermons list
      if (userSermons.length > 0) {
        logActivity('sermon_viewed', {
          page_name: 'MySermons',
          metadata: { count: userSermons.length }
        });
      }
    } catch (error) {
      console.error('Error loading sermons:', error);
      toast.error("Failed to load sermons");
    }
  };

  const loadCollections = async () => {
    try {
      const userCollections = await api.entities.Collection.filter({
        user_id: user.id,
        resource_type: 'sermon'
      });
      setCollections(userCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const loadTags = async () => {
    try {
      const userTags = await api.entities.ResourceTag.filter({
        user_id: user.id,
        resource_type: 'sermon'
      });
      setTags(userTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleDelete = async (sermonId) => {
    if (!confirm("Are you sure you want to delete this sermon?")) return;

    try {
      await api.entities.Sermon.delete(sermonId);
      
      // Delete associated tags
      const sermonTags = tags.filter(t => t.resource_id === sermonId);
      for (const tag of sermonTags) {
        await api.entities.ResourceTag.delete(tag.id);
      }
      
      // Delete collection items
      const collectionItems = await api.entities.CollectionItem.filter({
        resource_id: sermonId,
        resource_type: 'sermon'
      });
      for (const item of collectionItems) {
        await api.entities.CollectionItem.delete(item.id);
      }
      
      toast.success("Sermon deleted");
      loadSermons();
      loadTags();
    } catch (error) {
      toast.error("Failed to delete sermon");
    }
  };

  // Escape user-authored sermon fields before interpolating them into the
  // print window's raw HTML. Sermons can be forked/shared from other users,
  // so an unescaped title/point like `<img onerror=...>` would execute
  // same-origin script in the print window (real XSS, not just self-XSS).
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handlePrint = (sermon) => {
    logActivity('export_pdf', {
      page_name: 'MySermons',
      resource_type: 'sermon',
      resource_id: sermon.id
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(sermon.title)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #333; }
            h2 { color: #666; margin-top: 30px; }
            .meta { color: #999; margin: 20px 0; }
            .point { margin: 20px 0; padding: 20px; background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(sermon.title)}</h1>
          <p class="meta"><strong>Topic:</strong> ${escapeHtml(sermon.topic || 'N/A')}</p>
          <p class="meta"><strong>Passage:</strong> ${escapeHtml(sermon.anchor_passage || 'N/A')}</p>
          ${sermon.big_idea ? `<h2>Big Idea</h2><p>${escapeHtml(sermon.big_idea)}</p>` : ''}
          ${sermon.points && sermon.points.length > 0 ? `
            <h2>Main Points</h2>
            ${sermon.points.map((point, i) => `
              <div class="point">
                <h3>Point ${i + 1}: ${escapeHtml(point.title || '')}</h3>
                ${point.content ? `<p>${escapeHtml(point.content)}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getSermonTags = (sermonId) => {
    return tags.filter(t => t.resource_id === sermonId);
  };

  const handleAdvancedSearch = async (filters) => {
    logActivity('search_performed', {
      page_name: 'MySermons',
      metadata: { filters }
    });
    
    let results = [...sermons];

    // Search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(sermon =>
        sermon.title?.toLowerCase().includes(term) ||
        sermon.topic?.toLowerCase().includes(term) ||
        sermon.big_idea?.toLowerCase().includes(term)
      );
    }

    // Tags filter
    if (filters.tags.length > 0) {
      results = results.filter(sermon => {
        const sermonTags = getSermonTags(sermon.id);
        return filters.tags.some(tag => 
          sermonTags.some(st => st.tag === tag)
        );
      });
    }

    // Collections filter
    if (filters.collections.length > 0) {
      const collectionItems = await api.entities.CollectionItem.filter({
        user_id: user.id,
        resource_type: 'sermon'
      });
      
      const resourceIdsInCollections = collectionItems
        .filter(item => filters.collections.includes(item.collection_id))
        .map(item => item.resource_id);
      
      results = results.filter(sermon => resourceIdsInCollections.includes(sermon.id));
    }

    // Date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      results = results.filter(sermon => new Date(sermon.created_date) >= filterDate);
    }

    // Sort
    switch (filters.sortBy) {
      case 'recent':
        results.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        break;
      case 'oldest':
        results.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        break;
      case 'title':
        results.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        results.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'updated':
        results.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
        break;
    }

    setFilteredSermons(results);
    toast.success(`Found ${results.length} sermon(s)`);
  };

  const loadCollectionSermons = async (collectionId) => {
    try {
      const items = await api.entities.CollectionItem.filter({
        collection_id: collectionId,
        resource_type: 'sermon'
      });
      
      const sermonIds = items.map(item => item.resource_id);
      const collectionSermons = sermons.filter(s => sermonIds.includes(s.id));
      
      setFilteredSermons(collectionSermons);
      setSelectedCollection(collectionId);
    } catch (error) {
      console.error('Error loading collection sermons:', error);
    }
  };

  const handleAdaptSermon = (sermon) => {
    setAdaptingSermon(sermon);
    setShowAdaptDialog(true);
  };

  const handleSaveAdaptedSermon = async (adaptedData) => {
    try {
      await api.entities.Sermon.create({
        user_id: user.id,
        title: `${adaptedData.title} (Adapted)`,
        topic: adaptingSermon.topic,
        anchor_passage: adaptingSermon.anchor_passage,
        big_idea: adaptedData.big_idea,
        points: adaptedData.points,
        status: "draft"
      });

      toast.success("Adapted sermon saved as new draft!");
      loadSermons();
      setShowAdaptDialog(false);
      setAdaptingSermon(null);
    } catch (error) {
      console.error("Error saving adapted sermon:", error);
      toast.error("Failed to save adapted sermon");
    }
  };

  const handlePresentSermon = (sermon) => {
    setPresentingSermon(sermon);
    setShowPresentation(true);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-4">Please log in to view your sermons</p>
            <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-8 h-8 text-indigo-600" />
              My Sermons
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
              <span>{filteredSermons.length} of {sermons.length} sermons</span>
              {filteredSermons.length !== sermons.length && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto text-indigo-600"
                  onClick={() => {
                    setFilteredSermons(sermons);
                    setSelectedCollection(null);
                    setActiveView('all');
                  }}
                >
                  Show all {sermons.length}
                </Button>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAdvancedSearch(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Advanced Search
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedSermon(null);
                setShowCollectionManager(true);
              }}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Collection
            </Button>
            <Link to={createPageUrl('SermonBuilder')}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Sermon
              </Button>
            </Link>
          </div>
        </div>

        <Tabs value={activeView} onValueChange={setActiveView} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Sermons</TabsTrigger>
            <TabsTrigger value="collections">Collections ({collections.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {filteredSermons.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold mb-2">No sermons found</h3>
                  <p className="text-gray-600 mb-6">
                    {sermons.length === 0 
                      ? "Start creating your first sermon with AI assistance"
                      : "Try adjusting your filters"}
                  </p>
                  {sermons.length === 0 && (
                    <Link to={createPageUrl('SermonBuilder')}>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Sermon
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSermons.map((sermon) => {
                  const sermonTags = getSermonTags(sermon.id);
                  
                  return (
                    <Card key={sermon.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg line-clamp-2">{sermon.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {sermon.topic}
                            </CardDescription>
                          </div>
                          {sermon.status === 'completed' && (
                            <Badge variant="secondary" className="ml-2">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Done
                            </Badge>
                          )}
                        </div>
                        {sermonTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {sermonTags.slice(0, 3).map((tag) => (
                              <Badge key={tag.id} variant="outline" className="text-xs">
                                {tag.tag}
                              </Badge>
                            ))}
                            {sermonTags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{sermonTags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        {sermon.big_idea && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
                            {sermon.big_idea}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSermon(sermon);
                              setShowTagManager(true);
                            }}
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            Tags
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSermon(sermon);
                              setShowCollectionManager(true);
                            }}
                          >
                            <Folder className="w-3 h-3 mr-1" />
                            Add to
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCollaboratingSermon(sermon);
                              setShowCollaborators(true);
                            }}
                          >
                            <Users className="w-3 h-3 mr-1" />
                            Collab
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCommentingSermon(sermon);
                              setShowComments(true);
                            }}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Comments
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrint(sermon)}
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            Print
                          </Button>
                           <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAdaptSermon(sermon)}
                          >
                            <Wand2 className="w-3 h-3 mr-1" />
                            Adapt
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePresentSermon(sermon)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Presentation className="w-3 h-3 mr-1" />
                            Present
                          </Button>
                          <Link to={createPageUrl('CollaborativeSermonEditor') + `?id=${sermon.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sermon.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collections">
            {collections.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold mb-2">No collections yet</h3>
                  <p className="text-gray-600 mb-6">
                    Create collections to organize your sermons by series, topic, or season
                  </p>
                  <Button
                    onClick={() => {
                      setSelectedSermon(null);
                      setShowCollectionManager(true);
                    }}
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Create Your First Collection
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((collection) => (
                  <Card
                    key={collection.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      setActiveView('all');
                      loadCollectionSermons(collection.id);
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`p-3 rounded-lg bg-${collection.color}-100`}>
                          <Folder className={`w-6 h-6 text-${collection.color}-600`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{collection.name}</CardTitle>
                          {collection.description && (
                            <CardDescription className="mt-1">
                              {collection.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary">
                        {collection.items_count || 0} sermons
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedCollection && activeView === 'all' && (
          <Alert className="mb-4">
            <Filter className="w-4 h-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Showing sermons from collection: <strong>{collections.find(c => c.id === selectedCollection)?.name}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCollection(null);
                  setFilteredSermons(sermons);
                }}
              >
                Clear Filter
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {selectedSermon && (
          <>
            <TagManager
              open={showTagManager}
              onClose={() => {
                setShowTagManager(false);
                setSelectedSermon(null);
                loadTags();
              }}
              resourceType="sermon"
              resourceId={selectedSermon.id}
              userId={user.id}
              currentTags={getSermonTags(selectedSermon.id)}
            />

            <CollectionManager
              open={showCollectionManager && selectedSermon}
              onClose={() => {
                setShowCollectionManager(false);
                setSelectedSermon(null);
                loadCollections();
              }}
              resourceType="sermon"
              resourceId={selectedSermon.id}
              userId={user.id}
              mode="add"
            />
          </>
        )}

        <CollectionManager
          open={showCollectionManager && !selectedSermon}
          onClose={() => {
            setShowCollectionManager(false);
            loadCollections();
          }}
          resourceType="sermon"
          resourceId={null}
          userId={user.id}
          mode="create"
        />

        <AdvancedSearch
          open={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          onSearch={handleAdvancedSearch}
          userId={user.id}
          resourceType="sermon"
        />

        <SermonAdaptation
          open={showAdaptDialog}
          onClose={() => {
            setShowAdaptDialog(false);
            setAdaptingSermon(null);
          }}
          sermon={adaptingSermon || {}}
          onAdaptedSermon={handleSaveAdaptedSermon}
        />

        {showPresentation && presentingSermon && (
          <PresentationMode
            sermon={presentingSermon}
            onClose={() => {
              setShowPresentation(false);
              setPresentingSermon(null);
            }}
          />
        )}

        {collaboratingSermon && (
          <CollaboratorManager
            open={showCollaborators}
            onClose={() => {
              setShowCollaborators(false);
              setCollaboratingSermon(null);
            }}
            sermon={collaboratingSermon}
            user={user}
          />
        )}

        {commentingSermon && showComments && (
          <ShadcnDialog open={showComments} onOpenChange={setShowComments}>
            <ShadcnDialogContent className="max-w-3xl">
              <ShadcnDialogHeader>
                <ShadcnDialogTitle>Comments: {commentingSermon.title}</ShadcnDialogTitle>
              </ShadcnDialogHeader>
              <CommentPanel sermon={commentingSermon} user={user} />
            </ShadcnDialogContent>
          </ShadcnDialog>
        )}
      </div>
    </div>
  );
}