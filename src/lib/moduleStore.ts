import { fetchModuleDoc, isFirebaseConfigured, pushModuleDoc } from './firebase';

/**
 * Persistence for modules whose data is admin-only (budget, schedule, notes).
 * Local storage is the working copy, so the screen is instant and works offline.
 * Firestore holds the shared copy under boothEvents/{eventId}/modules/{moduleId}.
 *
 * Conflicts are last write wins per module, decided by updatedAt. That is enough
 * for one or two admins editing the same event, and no more than that.
 */
const PREFIX = 'boothduty_module_';

export interface ModuleEnvelope<T> {
  data: T;
  updatedAt: string;
}

export type SyncStatus =
  /** Written to the shared copy. */
  | 'synced'
  /** Firebase is not set up for this deployment: this device only, by design. */
  | 'local_only'
  /** Firebase is set up but the write was refused or failed: sign in as admin or check the connection. */
  | 'not_synced';

const keyFor = (eventId: string, moduleId: string) => `${PREFIX}${eventId}_${moduleId}`;
const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function readModuleLocal<T>(eventId: string, moduleId: string): ModuleEnvelope<T> | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(keyFor(eventId, moduleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModuleEnvelope<T>;
    return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed : null;
  } catch (err) {
    console.warn(`[moduleStore] Could not read ${moduleId}:`, err);
    return null;
  }
}

function writeModuleLocal<T>(eventId: string, moduleId: string, envelope: ModuleEnvelope<T>): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(keyFor(eventId, moduleId), JSON.stringify(envelope));
  } catch (err) {
    console.warn(`[moduleStore] Could not write ${moduleId}:`, err);
  }
}

/** The working copy, or a fresh empty one that is not persisted until first saved. */
export function loadModule<T>(eventId: string, moduleId: string, empty: () => T): ModuleEnvelope<T> {
  return readModuleLocal<T>(eventId, moduleId) ?? { data: empty(), updatedAt: '' };
}

export async function saveModule<T>(
  eventId: string,
  moduleId: string,
  data: T
): Promise<{ envelope: ModuleEnvelope<T>; status: SyncStatus }> {
  const envelope: ModuleEnvelope<T> = { data, updatedAt: new Date().toISOString() };
  writeModuleLocal(eventId, moduleId, envelope);
  if (!isFirebaseConfigured) return { envelope, status: 'local_only' };
  const ok = await pushModuleDoc(eventId, moduleId, data, envelope.updatedAt);
  return { envelope, status: ok ? 'synced' : 'not_synced' };
}

export type PullResult<T> =
  | { kind: 'updated'; envelope: ModuleEnvelope<T>; status: 'synced' }
  | { kind: 'unchanged'; status: SyncStatus };

/**
 * Brings in the shared copy when it is newer than the local one. If the local
 * copy is newer (edited offline, or never pushed) it is pushed up instead.
 */
export async function pullModule<T>(eventId: string, moduleId: string): Promise<PullResult<T>> {
  if (!isFirebaseConfigured) return { kind: 'unchanged', status: 'local_only' };

  const remote = await fetchModuleDoc(eventId, moduleId);
  if (remote === undefined) return { kind: 'unchanged', status: 'not_synced' };

  const local = readModuleLocal<T>(eventId, moduleId);

  if (remote && (!local || remote.updatedAt > local.updatedAt)) {
    const envelope: ModuleEnvelope<T> = { data: remote.data as T, updatedAt: remote.updatedAt };
    writeModuleLocal(eventId, moduleId, envelope);
    return { kind: 'updated', envelope, status: 'synced' };
  }

  if (local && (!remote || local.updatedAt > remote.updatedAt)) {
    const ok = await pushModuleDoc(eventId, moduleId, local.data, local.updatedAt);
    return { kind: 'unchanged', status: ok ? 'synced' : 'not_synced' };
  }

  return { kind: 'unchanged', status: 'synced' };
}

/**
 * Puts data that used to live on one device into the working copy, so it can be shared. It is stamped
 * with no time on purpose: if a shared copy already exists it is newer than this and wins, so an old
 * device never overwrites what others have since changed.
 */
export function seedModuleLocal<T>(eventId: string, moduleId: string, data: T): void {
  writeModuleLocal(eventId, moduleId, { data, updatedAt: '' });
}

/**
 * Brings the shared copies of several modules onto this device, so screens that read one module's data
 * while showing another (the Schedule reads stakeholders and keynote sessions) see the latest.
 * Gives up waiting after timeoutMs and carries on with what is local.
 */
export async function syncModules(eventId: string, moduleIds: string[], timeoutMs = 5000): Promise<void> {
  if (!isFirebaseConfigured) return;
  const pulls = Promise.all(moduleIds.map((id) => pullModule(eventId, id).catch(() => null)));
  await Promise.race([pulls, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** The modules other screens read from, so they are brought up to date before any screen opens. */
export const SHARED_MODULE_IDS = ['stakeholders', 'keynote'] as const;
