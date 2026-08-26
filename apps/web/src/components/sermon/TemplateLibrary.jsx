import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CopyPlus, Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  sermonDraftFromTemplate,
  sermonTemplateFromSermon,
  seriesDraftFromTemplate,
  seriesTemplateFromSeries,
} from '@/lib/sermonTemplates';

export default function TemplateLibrary({ sermons = [], onCreated, userId }) {
  const [templates, setTemplates] = useState([]);
  const [seriesTemplates, setSeriesTemplates] = useState([]);
  const [series, setSeries] = useState([]);
  const [sourceType, setSourceType] = useState('sermon');
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');

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
        const members = sermons.filter((sermon) => sermon.series_id === source.id);
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
    try {
      const drafts = seriesDraftFromTemplate(template);
      const createdSeries = await api.entities.SermonSeries.create(drafts.series);
      if (drafts.sermons.length > 0) {
        await api.entities.Sermon.bulkCreate(drafts.sermons.map((sermon) => ({
          ...sermon,
          series_id: createdSeries.id,
        })));
      }
      await onCreated?.();
      await load();
      toast.success('Series and sermon drafts created from template');
    } catch (error) {
      console.error('Unable to use series template:', error);
      toast.error('Unable to create a series from this template');
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
