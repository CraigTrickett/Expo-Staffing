// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mode, resetFake, store } from '@/test/fakeFirestore';

const auth = { listener: null as null | ((user: { email: string } | null) => void) };
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => async () => ({ data: {} }) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  signInWithEmailAndPassword: async (_a: unknown, email: string) => ({ user: { email } }),
  signOut: async () => {},
  onAuthStateChanged: (_a: unknown, cb: (u: { email: string } | null) => void) => {
    auth.listener = cb;
    return () => {};
  },
  sendPasswordResetEmail: async () => {},
}));
vi.mock('firebase/firestore', async () => (await import('@/test/fakeFirestore')).firestoreFake);

const OWNER = 'craig_trickett@trimble.com';
const GRANTED = 'colleague@trimble.com';
let fb: typeof import('@/lib/firebase');

beforeEach(async () => {
  resetFake();
  auth.listener = null;
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fb = await import('@/lib/firebase');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => vi.advanceTimersByTimeAsync(10_000);
const grant = (email: string) => store.set(`adminUsers/${email}`, { addedBy: OWNER });

describe('checking admin access', () => {
  it('an owner is an admin without reading anything, even if the database is down', async () => {
    mode.failReads = 99;
    expect(await fb.checkAdminAccess(OWNER)).toBe('admin');
    expect(await fb.checkAdminAccess('CRAIG_TRICKETT@trimble.com')).toBe('admin');
  });

  it('a granted admin is an admin, and someone with no grant is not', async () => {
    grant(GRANTED);
    expect(await fb.checkAdminAccess(GRANTED)).toBe('admin');
    expect(await fb.checkAdminAccess('stranger@example.com')).toBe('not_admin');
    expect(await fb.checkAdminAccess('')).toBe('not_admin');
  });

  it('retries when the read fails, and succeeds if the connection comes back', async () => {
    grant(GRANTED);
    mode.failReads = 2; // the first two reads fail, the third works
    const result = fb.checkAdminAccess(GRANTED);
    await settle();
    expect(await result).toBe('admin');
  });

  it('reports "error", not "not an admin", when it cannot read at all', async () => {
    grant(GRANTED);
    mode.failReads = 99;
    const result = fb.checkAdminAccess(GRANTED);
    await settle();
    expect(await result).toBe('error');
  });

  it('hasAdminAccess is still true or false', async () => {
    grant(GRANTED);
    expect(await fb.hasAdminAccess(GRANTED)).toBe(true);
    expect(await fb.hasAdminAccess('stranger@example.com')).toBe(false);
  });
});

describe('the sign-in state the app sees', () => {
  const watch = () => {
    const seen: { email: string | null; status: string }[] = [];
    fb.subscribeToAdminAuth((email, status) => seen.push({ email, status }));
    return seen;
  };

  it('signed out', async () => {
    const seen = watch();
    auth.listener!(null);
    expect(seen).toEqual([{ email: null, status: 'signed_out' }]);
  });

  it('an owner', async () => {
    const seen = watch();
    auth.listener!({ email: OWNER });
    await settle();
    expect(seen).toEqual([{ email: OWNER, status: 'admin' }]);
  });

  it('a signed-in person who is not an admin', async () => {
    const seen = watch();
    auth.listener!({ email: 'stranger@example.com' });
    await settle();
    expect(seen).toEqual([{ email: null, status: 'not_admin' }]);
  });

  it('a granted admin on a dropped connection is told the check failed, not that they are not an admin, and can retry', async () => {
    grant(GRANTED);
    mode.failReads = 99;
    const seen = watch();
    auth.listener!({ email: GRANTED });
    await settle();
    expect(seen).toEqual([{ email: null, status: 'error' }]);

    mode.failReads = 0; // the connection returns
    fb.retryAdminCheck();
    await settle();
    expect(seen.at(-1)).toEqual({ email: GRANTED, status: 'admin' });
  });

  it('only the latest check reports, if the sign-in changes while one is running', async () => {
    grant(GRANTED);
    mode.failReads = 99;
    const seen = watch();
    auth.listener!({ email: GRANTED }); // slow, failing check
    auth.listener!({ email: OWNER }); // then an owner signs in
    await settle();
    expect(seen).toEqual([{ email: OWNER, status: 'admin' }]);
  });

  it('retrying with nobody signed in does nothing', () => {
    watch();
    auth.listener!(null);
    expect(() => fb.retryAdminCheck()).not.toThrow();
  });
});

describe('signing in', () => {
  it('says the access could not be checked, instead of calling the account unauthorised', async () => {
    grant(GRANTED);
    mode.failReads = 99;
    const result = fb.signInAdmin(GRANTED, 'pw');
    await settle();
    expect(await result).toEqual({ ok: false, error: 'Could not check your access. Check your connection and try again.' });
  });

  it('still refuses an account that is not an admin', async () => {
    expect(await fb.signInAdmin('stranger@example.com', 'pw')).toEqual({ ok: false, error: 'This account is not authorized for admin access.' });
  });

  it('lets an admin in', async () => {
    grant(GRANTED);
    expect(await fb.signInAdmin(GRANTED, 'pw')).toEqual({ ok: true });
  });
});
