import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchModuleDoc = vi.fn();
const pushModuleDoc = vi.fn();
let configured = true;

vi.mock('./firebase', () => ({
  get isFirebaseConfigured() {
    return configured;
  },
  fetchModuleDoc: (...a: unknown[]) => fetchModuleDoc(...a),
  pushModuleDoc: (...a: unknown[]) => pushModuleDoc(...a),
}));

import { loadModule, saveModule, pullModule, readModuleLocal, seedModuleLocal, syncModules } from './moduleStore';

function stubBrowser() {
  const mem = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', ls);
}

beforeEach(() => {
  stubBrowser();
  configured = true;
  fetchModuleDoc.mockReset();
  pushModuleDoc.mockReset();
});

describe('moduleStore', () => {
  it('returns an empty, unsaved working copy when nothing is stored', () => {
    const env = loadModule('e1', 'budget', () => ({ n: 0 }));
    expect(env).toEqual({ data: { n: 0 }, updatedAt: '' });
    expect(readModuleLocal('e1', 'budget')).toBeNull();
  });

  it('saves locally first, then reports synced when the shared copy accepts it', async () => {
    pushModuleDoc.mockResolvedValue(true);
    const { envelope, status } = await saveModule('e1', 'budget', { n: 1 });
    expect(status).toBe('synced');
    expect(readModuleLocal('e1', 'budget')?.data).toEqual({ n: 1 });
    expect(pushModuleDoc).toHaveBeenCalledWith('e1', 'budget', { n: 1 }, envelope.updatedAt);
  });

  it('keeps the local save and says so when the shared write is refused', async () => {
    pushModuleDoc.mockResolvedValue(false);
    const { status } = await saveModule('e1', 'budget', { n: 2 });
    expect(status).toBe('not_synced');
    expect(readModuleLocal('e1', 'budget')?.data).toEqual({ n: 2 });
  });

  it('is local only, without touching Firebase, when it is not configured', async () => {
    configured = false;
    const { status } = await saveModule('e1', 'budget', { n: 3 });
    expect(status).toBe('local_only');
    expect(pushModuleDoc).not.toHaveBeenCalled();
    expect((await pullModule('e1', 'budget')).status).toBe('local_only');
  });

  it('adopts a newer shared copy', async () => {
    pushModuleDoc.mockResolvedValue(true);
    await saveModule('e1', 'budget', { n: 1 });
    fetchModuleDoc.mockResolvedValue({ data: { n: 9 }, updatedAt: '2999-01-01T00:00:00.000Z' });
    const r = await pullModule<{ n: number }>('e1', 'budget');
    expect(r.kind).toBe('updated');
    expect(readModuleLocal('e1', 'budget')?.data).toEqual({ n: 9 });
  });

  it('pushes a newer local copy instead of overwriting it', async () => {
    pushModuleDoc.mockResolvedValue(true);
    await saveModule('e1', 'budget', { n: 5 });
    pushModuleDoc.mockClear();
    fetchModuleDoc.mockResolvedValue({ data: { n: 1 }, updatedAt: '2000-01-01T00:00:00.000Z' });
    const r = await pullModule('e1', 'budget');
    expect(r).toEqual({ kind: 'unchanged', status: 'synced' });
    expect(pushModuleDoc).toHaveBeenCalledTimes(1);
    expect(readModuleLocal('e1', 'budget')?.data).toEqual({ n: 5 });
  });

  it('treats an unreadable shared copy as not synced, and leaves local untouched', async () => {
    pushModuleDoc.mockResolvedValue(true);
    await saveModule('e1', 'budget', { n: 7 });
    fetchModuleDoc.mockResolvedValue(undefined);
    expect(await pullModule('e1', 'budget')).toEqual({ kind: 'unchanged', status: 'not_synced' });
    expect(readModuleLocal('e1', 'budget')?.data).toEqual({ n: 7 });
  });

  it('pushes local data when the shared copy does not exist yet', async () => {
    pushModuleDoc.mockResolvedValue(true);
    await saveModule('e1', 'budget', { n: 4 });
    pushModuleDoc.mockClear();
    fetchModuleDoc.mockResolvedValue(null);
    expect((await pullModule('e1', 'budget')).status).toBe('synced');
    expect(pushModuleDoc).toHaveBeenCalledTimes(1);
  });
});


describe('sharing data that used to live on one device', () => {
  it('seeds a working copy with no timestamp, so any shared copy is newer', async () => {
    seedModuleLocal('e1', 'stakeholders', [{ id: 'a' }]);
    expect(readModuleLocal('e1', 'stakeholders')).toEqual({ data: [{ id: 'a' }], updatedAt: '' });
    fetchModuleDoc.mockResolvedValue({ data: [{ id: 'remote' }], updatedAt: '2026-05-01T00:00:00.000Z' });
    const result = await pullModule('e1', 'stakeholders');
    expect(result.kind).toBe('updated');
    expect(readModuleLocal<{ id: string }[]>('e1', 'stakeholders')!.data).toEqual([{ id: 'remote' }]);
    expect(pushModuleDoc).not.toHaveBeenCalled();
  });

  it('pushes the seeded copy when nothing has been shared yet', async () => {
    seedModuleLocal('e1', 'keynote', [{ id: 'k' }]);
    fetchModuleDoc.mockResolvedValue(null);
    pushModuleDoc.mockResolvedValue(true);
    const result = await pullModule('e1', 'keynote');
    expect(result).toEqual({ kind: 'unchanged', status: 'synced' });
    expect(pushModuleDoc).toHaveBeenCalledWith('e1', 'keynote', [{ id: 'k' }], '');
  });

  it('two devices that both seeded old data do not overwrite each other', async () => {
    seedModuleLocal('e1', 'keynote', [{ id: 'mine' }]);
    fetchModuleDoc.mockResolvedValue({ data: [{ id: 'theirs' }], updatedAt: '' });
    const result = await pullModule('e1', 'keynote');
    expect(result.kind).toBe('unchanged');
    expect(pushModuleDoc).not.toHaveBeenCalled();
  });
});

describe('syncModules', () => {
  it('brings in every module asked for', async () => {
    fetchModuleDoc.mockImplementation(async (_e: string, id: string) => ({ data: [id], updatedAt: '2026-05-01T00:00:00.000Z' }));
    await syncModules('e1', ['stakeholders', 'keynote']);
    expect(readModuleLocal('e1', 'stakeholders')!.data).toEqual(['stakeholders']);
    expect(readModuleLocal('e1', 'keynote')!.data).toEqual(['keynote']);
  });

  it('does nothing where Firebase is not set up', async () => {
    configured = false;
    await syncModules('e1', ['keynote']);
    expect(fetchModuleDoc).not.toHaveBeenCalled();
  });

  it('gives up waiting for a slow database and carries on', async () => {
    fetchModuleDoc.mockReturnValue(new Promise(() => {}));
    const started = Date.now();
    await syncModules('e1', ['keynote'], 50);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('a failed pull for one module does not stop the others', async () => {
    fetchModuleDoc.mockImplementation(async (_e: string, id: string) => {
      if (id === 'stakeholders') throw new Error('boom');
      return { data: ['ok'], updatedAt: '2026-05-01T00:00:00.000Z' };
    });
    await syncModules('e1', ['stakeholders', 'keynote']);
    expect(readModuleLocal('e1', 'keynote')!.data).toEqual(['ok']);
  });
});
