import { useCallback, useEffect, useState } from 'react';
import type { EventConfig } from '@/types';
import { storage } from '@/lib/storage';
import { fetchAllEvents } from '@/lib/firebase';
import { mergeEvents, sortEvents } from '@/lib/events';

/** How long to wait for the database before treating it as unreachable. */
export const EVENTS_TIMEOUT_MS = 10_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The database did not answer in time.')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });

/**
 * Every event, newest first. Events on this device appear at once; the database's copy arrives after
 * and replaces them. If the database cannot be reached (an error, or no answer within the time limit),
 * the local ones stay, `failed` is true, and `retry` tries again. `failed` is the honest answer to
 * "why is the list empty?": it means "could not check", not "there are none".
 */
export function useEvents() {
  const [events, setEvents] = useState<EventConfig[]>(() => sortEvents(Object.values(storage.getAll()).map((item) => item.config)));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const local = Object.values(storage.getAll()).map((item) => item.config);
    withTimeout(fetchAllEvents(), EVENTS_TIMEOUT_MS)
      .then((remote) => {
        if (cancelled) return;
        setEvents(mergeEvents(remote, local));
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[useEvents] Could not load events from the database, using this device:', err);
        if (cancelled) return;
        setEvents(sortEvents(local));
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const remove = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id));
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { events, loading, failed, retry, remove };
}
