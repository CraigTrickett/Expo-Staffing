import React, { Suspense, useEffect, useState } from 'react';
import { setLastEventId } from '@/lib/events';
import { SHARED_MODULE_IDS, syncModules } from '@/lib/moduleStore';
import { hrefs } from '@/lib/route';
import { PageSpinner } from '@/components/common/PageSpinner';
import { NotFoundPage } from '@/components/common/NotFoundPage';
import { EventsUnavailable } from '@/components/home/EventsUnavailable';
import { useEvents } from '@/components/home/useEvents';
import { resolveModuleScreen } from './moduleScreens';

interface ModulePageProps {
  eventId: string;
  moduleId: string;
}

const go = (hash: string) => {
  window.location.hash = hash;
};

/** One area of an event, as a page of its own at #/hub/<event>/<area>. */
export const ModulePage: React.FC<ModulePageProps> = ({ eventId, moduleId }) => {
  const { events, loading, failed, retry } = useEvents();
  const event = events.find((e) => e.id === eventId);
  const Screen = resolveModuleScreen(moduleId);
  const isExpoFloor = moduleId === 'expo-booths';

  // Stakeholders and keynote sessions are read by several areas, so the shared copies come in before any
  // area opens. Local data is used if the database is slow to answer.
  const [shared, setShared] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    syncModules(eventId, [...SHARED_MODULE_IDS]).finally(() => {
      if (!cancelled) setShared(eventId);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (event) setLastEventId(event.id);
  }, [event]);

  // Expo Booths is the expo floor, which has its own page.
  useEffect(() => {
    if (event && isExpoFloor) window.location.replace(hrefs.admin(event.adminKey));
  }, [event, isExpoFloor]);

  if (!event && loading) return <PageSpinner />;
  if (!event && failed) return <EventsUnavailable onRetry={retry} />;
  if (!event) return <NotFoundPage message="That event could not be found. It may have been deleted." />;
  if (isExpoFloor || shared !== eventId) return <PageSpinner />;
  if (!Screen) return <NotFoundPage message="That area does not exist." />;

  return (
    <Suspense fallback={<PageSpinner />}>
      <Screen
        event={event}
        onBack={() => go(hrefs.hub(event.id))}
        onOpenModule={(id) => go(id === 'expo-booths' ? hrefs.admin(event.adminKey) : hrefs.module(event.id, id))}
      />
    </Suspense>
  );
};
