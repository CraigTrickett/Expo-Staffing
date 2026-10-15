import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModule, pullModule, saveModule } from './moduleStore';
import type { SyncStatus } from './moduleStore';

export type SaveState = SyncStatus | 'saving' | 'checking';

/**
 * Loads one module's data, keeps it in React state, and saves every change
 * through the module store. A newer shared copy is brought in on mount. If
 * saves overlap, only the latest one reports its result.
 *
 * commit accepts either the next value or an updater, so several quick edits in
 * a row build on each other instead of on a stale render.
 */
export function useModuleData<T>(
  eventId: string,
  moduleId: string,
  empty: () => T,
  normalise: (raw: unknown) => T
) {
  const [data, setData] = useState<T>(() => normalise(loadModule<T>(eventId, moduleId, empty).data));
  const [saveState, setSaveState] = useState<SaveState>('checking');
  const dataRef = useRef(data);
  const seq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    pullModule<T>(eventId, moduleId).then((result) => {
      if (cancelled) return;
      if (result.kind === 'updated') {
        const next = normalise(result.envelope.data);
        dataRef.current = next;
        setData(next);
      }
      setSaveState(result.status);
    });
    return () => {
      cancelled = true;
    };
    // normalise is a stable module-level function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, moduleId]);

  const commit = useCallback(
    (update: T | ((prev: T) => T)) => {
      const next = typeof update === 'function' ? (update as (prev: T) => T)(dataRef.current) : update;
      dataRef.current = next;
      setData(next);
      setSaveState('saving');
      const n = ++seq.current;
      saveModule(eventId, moduleId, next).then(({ status }) => {
        if (mounted.current && n === seq.current) setSaveState(status);
      });
    },
    [eventId, moduleId]
  );

  return { data, commit, saveState };
}
