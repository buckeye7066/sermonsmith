import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  dateKey,
  monthGrid,
  monthKey,
  monthLabel,
  schedulePatch,
  sermonsByScheduledDate,
  shiftMonth,
} from '@/lib/sermonCalendar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SermonCalendarPlanner({ sermons = [], onChanged }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [savingId, setSavingId] = useState(null);
  const days = useMemo(() => monthGrid(month), [month]);
  const scheduled = useMemo(() => sermonsByScheduledDate(sermons), [sermons]);
  const unscheduled = sermons.filter((sermon) => !dateKey(sermon.scheduled_date));

  const moveSermon = async (sermonId, key) => {
    setSavingId(sermonId);
    try {
      await api.entities.Sermon.update(sermonId, schedulePatch(key));
      await onChanged?.();
      toast.success(key ? 'Sermon scheduled' : 'Sermon moved to the unscheduled queue');
    } catch (error) {
      console.error('Unable to update sermon schedule:', error);
      toast.error('Unable to update the sermon schedule');
    } finally {
      setSavingId(null);
    }
  };

  const onDrop = (event, key) => {
    event.preventDefault();
    const sermonId = event.dataTransfer.getData('text/sermonsmith-sermon-id');
    if (sermonId) moveSermon(sermonId, key);
  };

  const sermonCard = (sermon) => (
    <div
      key={sermon.id}
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/sermonsmith-sermon-id', sermon.id)}
      className="rounded border bg-white dark:bg-gray-900 p-2 shadow-sm cursor-grab"
    >
      <p className="text-xs font-medium line-clamp-2">{sermon.title}</p>
      <div className="mt-2 flex items-center gap-1">
        <input
          type="date"
          value={dateKey(sermon.scheduled_date) || ''}
          onChange={(event) => moveSermon(sermon.id, event.target.value)}
          aria-label={`Schedule ${sermon.title}`}
          className="min-w-0 flex-1 rounded border bg-transparent px-1 py-1 text-[11px]"
        />
        {savingId === sermon.id && <Loader2 className="h-3 w-3 animate-spin" aria-label="Saving" />}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
            {monthLabel(month)}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setMonth(monthKey(new Date()))}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 border-l border-t text-center text-xs font-medium text-gray-500">
            {WEEKDAYS.map((weekday) => <div className="border-b border-r p-2" key={weekday}>{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7 border-l">
            {days.map((day) => (
              <div
                key={day.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, day.key)}
                className={`min-h-28 border-b border-r p-1 ${day.inMonth ? 'bg-white dark:bg-gray-950' : 'bg-gray-50 text-gray-400 dark:bg-gray-900'} ${day.isToday ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
                aria-label={day.key}
              >
                <span className="mb-1 block text-xs font-medium">{day.day}</span>
                <div className="space-y-1">
                  {(scheduled[day.key] || []).map(sermonCard)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(event, '')}
      >
        <CardHeader>
          <CardTitle className="text-base">Unscheduled ({unscheduled.length})</CardTitle>
          <p className="text-sm text-gray-500">Drag a sermon onto a day, or use its date field for keyboard access.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {unscheduled.length ? unscheduled.map(sermonCard) : (
            <p className="text-sm text-gray-500">Every sermon has a date.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
