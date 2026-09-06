import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopyPlus, Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  sermonDraftFromTemplate,
  sermonTemplateFromSermon,
  seriesTemplateFromSeries,
} from '@/lib/sermonTemplates';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function pendingInstantiationStorageKey(userId, templateId) {
  return `sermonsmith:series-template:${encodeURIComponent(userId)}:${encodeURIComponent(templateId)}`;
}

function storedInstantiationId(key) {
  try {
    const value = globalThis.sessionStorage?.getItem(key);
    return UUID.test(value || '') ? value : null;
  } catch {
    return null;
  }
}

function rememberInstantiationId(key, value) {
  try { globalThis.sessionStorage?.setItem(key, value); } catch { /* in-memory fallback remains */ }
}

function forgetInstantiationId(key) {
  try { globalThis.sessionStorage?.removeItem(key); } catch { /* in-memory copy is cleared below */ }
}

export default function TemplateLibrary({ sermons = [], onCreated, userId }) {
  const [templates, setTemplates] = useState([]);
  const [seriesTemplates, setSeriesTemplates] = useState([]);
  const [series, setSeries] = useState([]);
  const [sourceType, setSourceType] = useState('sermon');
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const pendingInstantiationIds = useRef(new Map());

  const load = useCallback(async () => {
    if (!userId) return;
    const [sermonItems, seriesItems, ownedSeries] = await Promise.all([
      api.entities.SermonTemplate.filter({ user_id: userId }, '-created_date', 200),
      api.entities.SeriesTemplate.filter({ user_id: userId }, '-created_date', 200),
      api.entities.SermonSeries.filter({ user_id: userId }, '-created_date', 200),
    ]);
    setTemplates(sermonItems);
    setSeriesTemplates(seriesItems);
    setSeries(ownedSeries);
  }, [userId]);

  useEffect(() => {
    load().catch((error) => {
      console.error('Unable to load templates:', error);
      toast.error('Unable to load templates');
    });
  }, [load]);

  const sources = sourceType === 'sermon' ? sermons : series;
  const source = useMemo(() => sources.find((item) => item.id === sourceId), [sourceId, sources]);

  const createTemplate = async () => {
    if (!source) return toast.error('Choose a sermon or series first');
    setBusy('create');
    try {
      if (sourceType === 'sermon') {
        await api.entities.SermonTemplate.create(sermonTemplateFromSermon(source, name || source.title));
      } else {
        // The parent page intentionally pages its sermon list. Query the
        // selected series directly so a reusable template cannot silently
        // omit members that were outside that unrelated page.
        const members = await api.entities.Sermon.filter(
          { user_id: userId, series_id: source.id },
          '-created_date',
          53,
        );
        if (members.length > 52) throw new Error('Series templates support up to 52 sermons.');
        await api.entities.SeriesTemplate.create(seriesTemplateFromSeries(source, members, name || source.title));
      }
      setName('');
      await load();
      toast.success('Template saved');
    } catch (error) {
      console.error('Unable to create template:', error);
      toast.error('Unable to save the template');
    } finally {
      setBusy('');
    }
  };

  const instantiateSermonTemplate = async (template) => {
    setBusy(template.id);
    try {
      await api.entities.Sermon.create(sermonDraftFromTemplate(template));
      await onCreated?.();
      toast.success('Sermon draft created from template');
    } catch (error) {
      console.error('Unable to use sermon template:', error);
      toast.error('Unable to create a sermon from this template');
    } finally {
      setBusy('');
    }
  };

  const instantiateSeriesTemplate = async (template) => {
    setBusy(template.id);
    let creationComplete = false;
    const storageKey = pendingInstantiationStorageKey(userId, template.id);
    let requestId = pendingInstantiationIds.current.get(template.id)
      || storedInstantiationId(storageKey);
    if (!requestId) {
      requestId = globalThis.crypto.randomUUID();
      pendingInstantiationIds.current.set(template.id, requestId);
      rememberInstantiationId(storageKey, requestId);
    }
    try {
      await api.entities.SeriesTemplate.instantiate(template.id, requestId);
      creationComplete = true;
      pendingInstantiationIds.current.delete(template.id);
      forgetInstantiationId(storageKey);
      await onCreated?.();
      await load();
      toast.success('Series and sermon drafts created from template');
    } catch (error) {
      // A 4xx response definitively rejected the request before creation; an
      // absent status or 5xx can be a lost response after commit, so retain the
      // key and let a manual retry replay the same server-idempotent request.
      if (!creationComplete && error?.status >= 400 && error.status < 500) {
        pendingInstantiationIds.current.delete(template.id);
        forgetInstantiationId(storageKey);
      }
      console.error('Unable to use series template:', error);
      toast.error(creationComplete
        ? 'Series drafts were created, but the list could not refresh.'
        : 'Unable to confirm series creation. Trying again is safe.');
    } finally {
      setBusy('');
    }
  };

  const remove = async (type, id) => {
    if (!confirm('Delete this template? Existing sermons and series will not change.')) return;
    setBusy(id);
    try {
      await api.entities[type].delete(id);
      await load();
      toast.success('Template deleted');
    } catch (error) {
      console.error('Unable to delete template:', error);
      toast.error('Unable to delete the template');
    } finally {
      setBusy('');
    }
  };

  const templateCard = (template, type) => {
    const isSeries = type === 'SeriesTemplate';
    return (
      <Card key={template.id}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isSeries ? <Layers className="h-4 w-4" /> : <CopyPlus className="h-4 w-4" />}
            {template.name}
          </CardTitle>
          {template.description && <p className="text-sm text-gray-500">{template.description}</p>}
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            size="sm"
            onClick={() => isSeries ? instantiateSeriesTemplate(template) : instantiateSermonTemplate(template)}
            disabled={Boolean(busy)}
          >
            {busy === template.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create draft{isSeries ? 's' : ''}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => remove(type, template.id)} disabled={Boolean(busy)} aria-label={`Delete ${template.name}`}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Save reusable structure</CardTitle>
          <p className="text-sm text-gray-500">Templates copy content structure only. New items always start as private, unscheduled drafts.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select value={sourceType} onChange={(event) => { setSourceType(event.target.value); setSourceId(''); }} className="rounded border bg-transparent px-3 py-2">
            <option value="sermon">Sermon</option>
            <option value="series">Series</option>
          </select>
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="rounded border bg-transparent px-3 py-2" aria-label="Template source">
            <option value="">Choose a {sourceType}</option>
            {sources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name (optional)" maxLength={200} className="rounded border bg-transparent px-3 py-2" />
          <Button onClick={createTemplate} disabled={!source || Boolean(busy)}>
            {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Save template
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Sermon templates ({templates.length})</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.length ? templates.map((template) => templateCard(template, 'SermonTemplate')) : <p className="text-sm text-gray-500">No sermon templates yet.</p>}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Series templates ({seriesTemplates.length})</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {seriesTemplates.length ? seriesTemplates.map((template) => templateCard(template, 'SeriesTemplate')) : <p className="text-sm text-gray-500">No series templates yet.</p>}
        </div>
      </div>
    </div>
  );
}
