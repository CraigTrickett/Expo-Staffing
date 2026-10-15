import React, { useMemo, useState } from 'react';
import { Clock, ExternalLink, History, Loader2, MapPin, Plus, Search, Trash2, Users } from 'lucide-react';
import { deleteEventRemote } from '@/lib/firebase';
import { storage } from '@/lib/storage';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';
import type { EventConfig } from '@/types';
import { useEvents } from './useEvents';

export const EventsPage: React.FC = () => {
  const { events, loading, failed, retry, remove } = useEvents();
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q) || (e.location && e.location.toLowerCase().includes(q)));
  }, [events, query]);

  const handleDelete = async (evt: EventConfig) => {
    if (!window.confirm(`Permanently delete "${evt.title}"? This removes it for everyone and cannot be undone.`)) return;
    setDeletingId(evt.id);
    const ok = await deleteEventRemote(evt.id);
    setDeletingId(null);
    // Also remove from local storage regardless
    storage.deleteEvent(evt.id);
    remove(evt.id);
    if (ok) toast.success(`"${evt.title}" was deleted.`);
    else toast.info(`"${evt.title}" was removed locally.`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded border border-[#b9dcf0] bg-[#e5f2f8] p-2 text-[#0063a3]">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#252a2e]">Events</h1>
            <p className="mt-0.5 max-w-sm text-xs text-[#1f2f3d]">Select an event to open its workspace, or create a brand new expo schedule.</p>
          </div>
        </div>
        <a href="#/new" className="focus-ring flex items-center gap-1.5 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New event
        </a>
      </div>

      {failed && events.length > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded border border-[#f1d68c] bg-[#fef3d6] px-3 py-2 text-xs text-[#6e4600]">
          <span>Could not reach the database. These are the events saved on this device.</span>
          <button type="button" onClick={retry} className="focus-ring cursor-pointer rounded font-semibold underline">
            Try again
          </button>
        </p>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#1f2f3d]" aria-hidden="true" />
        <label htmlFor="events-search" className="sr-only">Filter events</label>
        <input
          id="events-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter events by name or location..."
          className="w-full rounded border border-[#d8dce0] bg-white py-1.5 pl-8 pr-3 text-xs text-[#252a2e] focus:border-[#0063a3] focus:outline-hidden focus:shadow-[0_0_0_3px_rgba(0,99,163,0.18)]"
        />
      </div>

      {loading && events.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 py-14 text-xs text-[#1f2f3d]" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-[#0063a3]" aria-hidden="true" />
          <span className="font-medium">Loading events from database...</span>
        </div>
      ) : failed && events.length === 0 ? (
        <div className="space-y-3 py-12 text-center text-xs">
          <p className="font-semibold text-[#9e1b16]">Your events could not be loaded. Check your connection and try again.</p>
          <button type="button" onClick={retry} className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005084]">
            Try again
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="space-y-3 py-12 text-center text-xs text-[#1f2f3d]">
          <p>{query ? 'No events matched your search filter.' : 'No events found.'}</p>
          {!query && (
            <a href="#/new" className="focus-ring inline-flex items-center gap-1.5 rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005084]">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create your first event</span>
            </a>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((evt) => (
            <li key={evt.id} className="flex flex-col gap-3 rounded border border-[#d8dce0] bg-[#f8f9fa] p-3.5 hover:border-[#b9dcf0] hover:bg-white sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-bold text-[#252a2e]">{evt.title}</h2>
                  <span className="shrink-0 rounded bg-[#e5f2f8] px-1.5 py-0.5 text-[10px] font-semibold text-[#0063a3]">{evt.staffCapacityPerSlot} staff/shift</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#1f2f3d]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#0063a3]" aria-hidden="true" />
                    <span>
                      {formatDate(evt.startDate)} &ndash; {formatDate(evt.endDate)}
                    </span>
                  </span>
                  {evt.location && (
                    <span className="flex max-w-xs items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      <span className="truncate">{evt.location}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <a href={`#/hub/${evt.id}`} aria-label={`Open ${evt.title}`} className="focus-ring flex items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
                  Open
                </a>
                <a href={`#/event/${evt.publicKey}`} aria-label={`Staff sign-up for ${evt.title}`} className="focus-ring flex items-center gap-1 rounded border border-[#0063a3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0063a3] hover:bg-[#f1f3f6]">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Staff</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(evt)}
                  disabled={deletingId === evt.id}
                  aria-label={`Delete ${evt.title}`}
                  title="Permanently delete this event"
                  className="focus-ring cursor-pointer rounded border border-transparent p-1.5 text-[#da3832] hover:border-[#f5b5b3] hover:bg-[#fdf2f2] disabled:opacity-60"
                >
                  {deletingId === evt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 border-t border-[#d8dce0] pt-3.5 text-[11px] text-[#1f2f3d]">
        <ExternalLink className="h-3 w-3 shrink-0 text-[#0063a3]" aria-hidden="true" />
        <span>Staff claim shifts via their public link without signing in.</span>
      </p>
    </div>
  );
};
