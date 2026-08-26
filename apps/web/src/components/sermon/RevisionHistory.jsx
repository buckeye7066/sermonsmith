import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/api/apiClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const REVISION_PAGE_SIZE = 100;

function revisionLabel(revision) {
  const stamp = revision.created_date ? new Date(revision.created_date) : null;
  const when = stamp && !Number.isNaN(stamp.getTime()) ? stamp.toLocaleString() : 'Unknown time';
  return `${revision.snapshot?.title || 'Untitled'} · ${when}`;
}

export default function RevisionHistory({ entityType, entityId, canRestore = true, onRestored }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const page = await api.entities[entityType].revisions(entityId, REVISION_PAGE_SIZE, offset);
      setRevisions((current) => offset === 0 ? page : [...current, ...page]);
      setHasMore(page.length === REVISION_PAGE_SIZE);
    } catch (loadError) {
      console.error('Unable to load revision history:', loadError);
      setError('Revision history could not be loaded.');
    } finally {
      if (offset === 0) setLoading(false);
      else setLoadingMore(false);
    }
  }, [entityId, entityType]);

  useEffect(() => { load(0); }, [load]);

  const restore = async (revision) => {
    if (!confirm(`Restore “${revision.snapshot?.title || 'this version'}”? The current version will remain in history.`)) return;
    setRestoringId(revision.id);
    try {
      const restored = await api.entities[entityType].restoreRevision(entityId, revision.id);
      await load(0);
      onRestored?.(restored);
      toast.success('Version restored');
    } catch (restoreError) {
      console.error('Unable to restore revision:', restoreError);
      toast.error('Unable to restore that version');
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Revision history</CardTitle>
        <p className="text-sm text-gray-500">Each save preserves the version that came before it. Restoring also keeps the current version.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {revisions.length === 0 ? (
          <p className="text-sm text-gray-500">No earlier versions yet. The first save after creation will add one.</p>
        ) : revisions.map((revision) => (
          <div key={revision.id} className="flex items-center justify-between gap-3 rounded border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{revisionLabel(revision)}</p>
              <p className="text-xs text-gray-500">{revision.reason === 'before_restore' ? 'Before a restore' : 'Before a save'}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!canRestore || restoringId === revision.id}
              onClick={() => restore(revision)}
            >
              {restoringId === revision.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Restore
            </Button>
          </div>
        ))}
        {hasMore && (
          <Button
            variant="outline"
            className="w-full"
            disabled={loadingMore}
            onClick={() => load(revisions.length)}
          >
            {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load older versions
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
