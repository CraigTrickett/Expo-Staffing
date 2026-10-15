/**
 * An in-memory stand-in for firebase/firestore, for testing the client's database code.
 *
 * It also plays the part of the security rules for one question that matters here: can this caller
 * list a collection? Set `asAnonymous` to refuse listing, as the rules do for people who are not
 * admins. Every write is recorded, with the fields that actually changed, so a test can check them
 * against what the rules allow.
 */
type Doc = Record<string, unknown>;

interface Shared {
  store: Map<string, Doc>;
  writes: { op: 'set' | 'update'; path: string; keys: string[]; changed: string[] }[];
  calls: { getDocs: number; getDoc: number };
  mode: { asAnonymous: boolean; failReads: number };
}
// Kept on globalThis so the copy a test holds and the copy the mocked module uses are the same,
// even after vi.resetModules() loads this file a second time.
const g = globalThis as unknown as { __fakeFirestore?: Shared };
g.__fakeFirestore ??= { store: new Map(), writes: [], calls: { getDocs: 0, getDoc: 0 }, mode: { asAnonymous: false, failReads: 0 } };
export const { store, writes, calls, mode } = g.__fakeFirestore;

export function resetFake() {
  store.clear();
  writes.length = 0;
  calls.getDocs = 0;
  calls.getDoc = 0;
  mode.asAnonymous = false;
  mode.failReads = 0;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const refOf = (_db: unknown, ...segs: string[]) => ({ path: segs.join('/'), id: segs[segs.length - 1] });
const changedKeys = (before: Doc | undefined, after: Doc) => {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  return Array.from(keys).filter((k) => !same(before?.[k], after[k]));
};

const record = (op: 'set' | 'update', path: string, written: Doc, before: Doc | undefined, after: Doc) => {
  writes.push({ op, path, keys: Object.keys(written), changed: changedKeys(before, after) });
};

export const firestoreFake = {
  getFirestore: () => ({}),
  doc: refOf,
  collection: (_db: unknown, ...segs: string[]) => ({ collectionPath: segs.join('/') }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  limit: (n: number) => ({ limit: n }),
  query: (col: { collectionPath: string }, ...constraints: unknown[]) => ({ col, constraints }),
  getDoc: async (ref: { path: string; id: string }) => {
    calls.getDoc += 1;
    // failReads counts down: that many reads fail (as a dropped connection would), then they work.
    if (mode.failReads > 0) {
      mode.failReads -= 1;
      throw Object.assign(new Error('The client is offline.'), { code: 'unavailable' });
    }
    return { id: ref.id, exists: () => store.has(ref.path), data: () => clone(store.get(ref.path)) };
  },
  getDocs: async (q: { collectionPath?: string; col?: { collectionPath: string }; constraints?: { field: string; value: unknown }[] }) => {
    calls.getDocs += 1;
    if (mode.asAnonymous) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    const col = q.collectionPath ?? q.col!.collectionPath;
    const depth = col.split('/').length + 1;
    let docs = Array.from(store.entries())
      .filter(([p]) => p.startsWith(`${col}/`) && p.split('/').length === depth)
      .map(([p, data]) => ({ id: p.split('/').pop()!, data: () => clone(data) }));
    for (const c of q.constraints ?? []) docs = docs.filter((d) => (d.data() as Doc)[c.field] === c.value);
    return { empty: docs.length === 0, docs };
  },
  setDoc: async (ref: { path: string }, data: Doc) => {
    const before = store.get(ref.path);
    store.set(ref.path, clone(data));
    record('set', ref.path, data, before, data);
  },
  updateDoc: async (ref: { path: string }, data: Doc) => {
    const before = store.get(ref.path);
    if (!before) throw Object.assign(new Error('No document to update'), { code: 'not-found' });
    const after = { ...before, ...clone(data) };
    store.set(ref.path, after);
    record('update', ref.path, data, before, after);
  },
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      get: async (ref: { path: string; id: string }) => ({ id: ref.id, exists: () => store.has(ref.path), data: () => clone(store.get(ref.path)) }),
      update: (ref: { path: string }, data: Doc) => {
        const before = store.get(ref.path)!;
        const after = { ...before, ...clone(data) };
        store.set(ref.path, after);
        record('update', ref.path, data, before, after);
      },
      set: (ref: { path: string }, data: Doc) => {
        const before = store.get(ref.path);
        store.set(ref.path, clone(data));
        record('set', ref.path, data, before, data);
      },
    };
    return fn(tx);
  },
  onSnapshot: () => () => {},
};
