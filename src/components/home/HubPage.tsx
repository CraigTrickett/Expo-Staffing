import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Layers, MapPin, Plus, Search, ShieldCheck } from 'lucide-react';
import { ADMIN_MODULES } from '@/data/adminModules';
import { getLastEventId, pickDefaultEvent, setLastEventId } from '@/lib/events';
import { hrefs } from '@/lib/route';
import { formatDate } from '@/lib/utils';
import { MODULE_ICONS } from '@/components/admin/moduleIcons';
import { PageSpinner } from '@/components/common/PageSpinner';
import { GlassFilter, useGlassFilter } from './GlassFilter';
import { TiltGlassCard } from './TiltGlassCard';
import { EventsUnavailable } from './EventsUnavailable';
import { useEvents } from './useEvents';

interface HubPageProps {
  /** From the address. Left empty at the root, which opens on the last event used. */
  eventId?: string;
}

interface Card {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tag?: string;
  href: string;
}

const goTo = (hash: string) => {
  window.location.hash = hash;
};

const CARD_RADIUS = 32;

export const HubPage: React.FC<HubPageProps> = ({ eventId }) => {
  const { events, loading, failed, retry } = useEvents();
  const [searchQuery, setSearchQuery] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  const event = events.find((e) => e.id === eventId);

  // At the root, move to the menu for the event used last (or the newest). The address then names the event.
  useEffect(() => {
    if (eventId || loading) return;
    const target = pickDefaultEvent(events, getLastEventId());
    if (target) window.location.replace(hrefs.hub(target.id));
  }, [eventId, loading, events]);

  useEffect(() => {
    if (event) setLastEventId(event.id);
  }, [event]);

  const cards = useMemo<Card[]>(() => {
    if (!event) return [];
    const q = searchQuery.trim().toLowerCase();
    const modules = ADMIN_MODULES.filter((m) => !q || m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q)).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
    // Overview always leads and Other always closes.
    const pinned = (id: string) => modules.filter((m) => m.id === id);
    const ordered = [...pinned('overview'), ...modules.filter((m) => m.id !== 'overview' && m.id !== 'other'), ...pinned('other')];

    const list: Card[] = ordered.map((m) => ({
      id: m.id,
      title: m.title,
      subtitle: m.subtitle,
      icon: MODULE_ICONS[m.iconName] || Layers,
      tag: m.status === 'active' ? undefined : 'Not built yet',
      // Expo Booths is the expo floor, which has its own page.
      href: m.id === 'expo-booths' ? hrefs.admin(event.adminKey) : hrefs.module(event.id, m.id),
    }));

    // User Manager is about who can sign in, not about this event, so it sits last.
    const users = { id: 'user-manager', title: 'User Manager', subtitle: 'Admins and their access', icon: ShieldCheck, href: hrefs.users };
    if (!q || users.title.toLowerCase().includes(q) || users.subtitle.toLowerCase().includes(q)) list.push(users);
    return list;
  }, [event, searchQuery]);

  const sampleCard = useCallback(() => gridRef.current?.querySelector<HTMLElement>('.glass-card') ?? null, []);
  const glass = useGlassFilter(sampleCard, CARD_RADIUS, `${event?.id}:${cards.length > 0}`);

  if (loading && !event) return <PageSpinner />;

  // If the events could not be loaded, say so: it would be wrong to claim there are none, or that this one is gone.
  if (!event && failed) return <EventsUnavailable onRetry={retry} />;

  if (!event) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <h1 className="text-lg font-bold text-[#252a2e]">{eventId ? 'That event could not be found' : 'No events yet'}</h1>
        <p className="text-xs text-[#1f2f3d]">{eventId ? 'It may have been deleted. Choose another, or create a new one.' : 'Create your first event to get started.'}</p>
        <div className="flex gap-2">
          {eventId && (
            <a href={hrefs.events} className="focus-ring rounded border border-[#d8dce0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1f2f3d] hover:border-[#0063a3] hover:text-[#0063a3]">
              All events
            </a>
          )}
          <a href={hrefs.new} className="focus-ring flex items-center gap-1.5 rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005084]">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New event
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]" data-glass={glass ? 'svg' : 'blur'}>
      <GlassFilter glass={glass} />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#14284b]">{event.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#1f2f3d]">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {formatDate(event.startDate)} &ndash; {formatDate(event.endDate)}
                </span>
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="max-w-xs truncate">{event.location}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {events.length > 1 && (
              <select
                aria-label="Event"
                value={event.id}
                onChange={(e) => goTo(hrefs.hub(e.target.value))}
                className="focus-ring max-w-[16rem] cursor-pointer rounded border border-white/70 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#252a2e] backdrop-blur-sm"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            )}
            <a href={hrefs.events} className="focus-ring rounded border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#1f2f3d] backdrop-blur-sm hover:bg-white hover:text-[#0063a3]">
              All events
            </a>
            <a href={hrefs.new} className="focus-ring flex items-center gap-1.5 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New event
            </a>
          </div>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#1f2f3d]" aria-hidden="true" />
          <label htmlFor="hub-search" className="sr-only">
            Search event areas
          </label>
          <input
            id="hub-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded border border-white/70 bg-white/70 py-1.5 pl-8 pr-3 text-xs text-[#252a2e] backdrop-blur-sm focus:border-[#0063a3] focus:outline-hidden focus:shadow-[0_0_0_3px_rgba(0,99,163,0.18)]"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-xs text-[#1f2f3d] hover:text-[#252a2e]">
              &times;
            </button>
          )}
        </div>

        <div ref={gridRef} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <TiltGlassCard key={card.id} href={card.href} icon={card.icon} title={card.title} subtitle={card.subtitle} tag={card.tag} />
          ))}
        </div>

        {cards.length === 0 && <div className="py-12 text-center text-xs text-[#1f2f3d]">Nothing matches.</div>}
      </div>
    </div>
  );
};
