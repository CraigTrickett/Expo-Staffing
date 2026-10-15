import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  onSnapshot,
  limit,
  runTransaction,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type Auth,
} from 'firebase/auth';
import type { EventConfig, ShiftBooking, StoredEventData, TimeSlot, StaffMember, KeyStakeholder, KeynoteSession } from '@/types';
import { parseTimeToMinutes, updateSlotDerivedState } from './matrix';

const COLLECTION = 'boothEvents';
const PUBLIC_LINKS = 'publicLinks';

/**
 * The owners: always admins, and never revokable. Other admins are granted through
 * the user manager and stored in the adminUsers collection (see hasAdminAccess).
 * Kept in step with OWNER_EMAILS in functions/adminUsers.js and firestore.rules.
 *
 * Originally: only these two accounts were permitted admin access. Firebase Auth would
 * happily authenticate anyone who has a valid account, so this allowlist
 * is what actually restricts who "the admin" can be — enforced here on
 * sign-in, and again server-side in every Cloud Function that performs a
 * sensitive action, since a client-side check alone can be bypassed.
 */
export const ALLOWED_ADMIN_EMAILS = ['craig_trickett@trimble.com', 'craigtrickett@gmail.com'];

// Read optional Firebase environment credentials
const env: Record<string, string | undefined> = import.meta.env ?? {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
// Optional: only needed when Firestore was provisioned under a named
// database rather than the SDK's implicit "(default)" one — which is
// exactly how AI Studio's own setup provisions it. Omitting this when
// it's needed produces a real but easy-to-miss error: "Database
// '(default)' not found", even though every other credential is correct.
const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.trim().length > 0 &&
  firebaseConfig.projectId.trim().length > 0
);

/**
 * Tracks whether the database is *actually reachable right now*, based on
 * the real outcome of the most recent operation — not just whether
 * Firebase is configured. A misconfigured-but-present config, an
 * expired/invalid API key, or a genuine outage would all leave
 * isFirebaseConfigured true while every real call fails; UI that shows a
 * "connected" status should reflect this, not just the config check.
 */
export type ConnectivityStatus = 'unknown' | 'connected' | 'error';
let connectivityStatus: ConnectivityStatus = 'unknown';
const connectivityListeners = new Set<(status: ConnectivityStatus) => void>();

function reportConnectivity(ok: boolean): void {
  const next: ConnectivityStatus = ok ? 'connected' : 'error';
  if (next === connectivityStatus) return;
  connectivityStatus = next;
  connectivityListeners.forEach((cb) => cb(connectivityStatus));
}

export function subscribeToConnectivity(callback: (status: ConnectivityStatus) => void): () => void {
  callback(connectivityStatus);
  connectivityListeners.add(callback);
  return () => connectivityListeners.delete(callback);
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let functionsClient: Functions | null = null;
let authClient: Auth | null = null;

function getDb(): Firestore | null {
  if (!isFirebaseConfigured) return null;

  if (!firestoreDb) {
    try {
      firebaseApp = initializeApp(firebaseConfig);
      firestoreDb = firestoreDatabaseId
        ? getFirestore(firebaseApp, firestoreDatabaseId)
        : getFirestore(firebaseApp);
    } catch (err) {
      console.warn('[Firebase] Failed to initialize, falling back to local mode:', err);
      return null;
    }
  }

  return firestoreDb;
}

function getFunctionsClient(): Functions | null {
  if (!isFirebaseConfigured) return null;
  if (!firebaseApp && !getDb()) return null; // ensures firebaseApp is initialized

  if (!functionsClient && firebaseApp) {
    try {
      functionsClient = getFunctions(firebaseApp);
    } catch (err) {
      console.warn('[Firebase] Failed to initialize Functions client:', err);
      return null;
    }
  }

  return functionsClient;
}

function getAuthClient(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (!firebaseApp && !getDb()) return null; // ensures firebaseApp is initialized

  if (!authClient && firebaseApp) {
    try {
      authClient = getAuth(firebaseApp);
    } catch (err) {
      console.warn('[Firebase] Failed to initialize Auth client:', err);
      return null;
    }
  }

  return authClient;
}

export function isOwnerEmail(email: string): boolean {
  const lower = (email || '').trim().toLowerCase();
  return ALLOWED_ADMIN_EMAILS.some((e) => e.toLowerCase() === lower);
}

/**
 * Whether this email is an admin: an owner, or someone granted access through the
 * user manager. Granted admins have a document in adminUsers, which a signed-in
 * person may read for their own email only. This is a convenience for the interface;
 * the Cloud Functions and Firestore rules make the same check for real.
 */
export type AdminCheck = 'admin' | 'not_admin' | 'error';

/** How many more times to try the access check, and how long to wait between tries, when it cannot be read. */
export const ADMIN_CHECK_RETRIES = 2;
export const ADMIN_CHECK_DELAY_MS = 600;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Whether this email may use the admin side. The owners always can. Anyone else has a document in
 * adminUsers. A failed read is its own answer, 'error', and is not the same as "no": telling a granted
 * admin they are not one because their connection dropped would be wrong, so it is retried first.
 */
export async function checkAdminAccess(email: string): Promise<AdminCheck> {
  const lower = (email || '').trim().toLowerCase();
  if (!lower) return 'not_admin';
  if (isOwnerEmail(lower)) return 'admin';
  const db = getDb();
  if (!db) return 'not_admin';
  for (let attempt = 0; ; attempt++) {
    try {
      const snap = await getDoc(doc(db, 'adminUsers', lower));
      return snap.exists() ? 'admin' : 'not_admin';
    } catch (err) {
      if (attempt >= ADMIN_CHECK_RETRIES) {
        console.warn('[Firebase] Could not check admin access:', err);
        return 'error';
      }
      await wait(ADMIN_CHECK_DELAY_MS * (attempt + 1));
    }
  }
}

export async function hasAdminAccess(email: string): Promise<boolean> {
  return (await checkAdminAccess(email)) === 'admin';
}

/**
 * Signs in with email/password, then enforces the admin allowlist: if the
 * account authenticates successfully but its email isn't one of the two
 * allowed addresses, immediately signs back out and reports it as a
 * failure rather than leaving an unauthorized session active. This is a
 * UX convenience, not the real security boundary — every sensitive Cloud
 * Function checks the caller's verified email itself regardless of what
 * the client believes.
 */
export async function signInAdmin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const auth = getAuthClient();
  if (!auth) return { ok: false, error: 'Authentication is not available right now.' };

  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const signedInEmail = (credential.user.email || '').toLowerCase();
    const access = await checkAdminAccess(signedInEmail);
    if (access === 'error') {
      await signOut(auth);
      return { ok: false, error: 'Could not check your access. Check your connection and try again.' };
    }
    if (access !== 'admin') {
      await signOut(auth);
      return { ok: false, error: 'This account is not authorized for admin access.' };
    }
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string }).code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return { ok: false, error: 'Incorrect email or password.' };
    }
    if (code.includes('too-many-requests')) {
      return { ok: false, error: 'Too many attempts. Please wait a moment and try again.' };
    }
    console.warn('[Firebase] signInAdmin failed:', err);
    return { ok: false, error: 'Could not sign in. Please try again.' };
  }
}

export async function signOutAdmin(): Promise<void> {
  const auth = getAuthClient();
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[Firebase] signOutAdmin failed:', err);
  }
}

export async function sendAdminPasswordReset(email: string): Promise<boolean> {
  const auth = getAuthClient();
  if (!auth) return false;
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return true;
  } catch (err) {
    console.warn('[Firebase] sendAdminPasswordReset failed:', err);
    return false;
  }
}

/**
 * Subscribes to auth state, but only ever reports a signed-in user whose
 * email is on the admin allowlist — an authenticated-but-unauthorized
 * session (which shouldn't normally happen given signInAdmin signs those
 * back out immediately, but could if a session persisted from before an
 * allowlist change) is reported as signed out, not as a valid admin.
 */
/** What the sign-in state is: nobody, an admin, someone who is not an admin, or someone whose access could not be checked. */
export type AdminAuthStatus = 'signed_out' | 'admin' | 'not_admin' | 'error';

let rerunAdminCheck: (() => void) | null = null;

/** Tries the access check again, after it failed. Does nothing if nobody is signed in. */
export function retryAdminCheck(): void {
  rerunAdminCheck?.();
}

export function subscribeToAdminAuth(callback: (email: string | null, status: AdminAuthStatus) => void): Unsubscribe | null {
  const auth = getAuthClient();
  if (!auth) {
    callback(null, 'signed_out');
    return null;
  }

  // Checking a granted admin takes a read, so results can arrive out of order if the
  // auth state changes quickly. Only the latest check is allowed to report.
  let latest = 0;
  const run = (email: string) => {
    const check = ++latest;
    checkAdminAccess(email).then((access) => {
      if (check !== latest) return;
      callback(access === 'admin' ? email : null, access === 'admin' ? 'admin' : access);
    });
  };
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user?.email) {
      latest += 1;
      rerunAdminCheck = null;
      callback(null, 'signed_out');
      return;
    }
    const email = user.email;
    rerunAdminCheck = () => run(email);
    run(email);
  });
  return () => {
    rerunAdminCheck = null;
    unsubscribe();
  };
}

export interface AdminUserRecord {
  email: string;
  addedBy: string;
  addedAt: string;
}

export interface AdminUserList {
  owners: string[];
  admins: AdminUserRecord[];
}

type CallResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Turns a Cloud Functions error into a sentence for the person, keeping the server's own message when it gave one. */
function describeCallError(err: unknown): string {
  const code = (err as { code?: string }).code || '';
  const message = (err as { message?: string }).message || '';
  if (code.includes('permission-denied')) return message || 'You do not have permission to do that.';
  if (code.includes('invalid-argument') || code.includes('failed-precondition') || code.includes('not-found')) {
    return message || 'That request was not valid.';
  }
  if (code.includes('unauthenticated')) return 'Sign in again to continue.';
  return 'Could not reach the server. Please try again.';
}

async function callAdminFunction<T>(name: string, payload?: Record<string, unknown>): Promise<CallResult<T>> {
  const functions = getFunctionsClient();
  if (!functions) return { ok: false, error: 'The server is not available in this deployment.' };
  try {
    const result = await httpsCallable(functions, name)(payload);
    return { ok: true, data: result.data as T };
  } catch (err) {
    console.warn(`[Firebase] ${name} failed:`, err);
    return { ok: false, error: describeCallError(err) };
  }
}

export const listAdminUsers = () => callAdminFunction<AdminUserList>('listAdminUsers');
export const grantAdminUser = (email: string) =>
  callAdminFunction<{ email: string; alreadyAdmin: boolean; accountCreated: boolean }>('grantAdminUser', { email });
export const revokeAdminUser = (email: string) => callAdminFunction<{ email: string }>('revokeAdminUser', { email });

/**
 * Completes the "Connect Google Calendar" flow: hands the one-time OAuth
 * authorization code from Google Identity Services to the
 * exchangeGoogleAuthCode Cloud Function, which exchanges it for a refresh
 * token and stores it server-side. Returns false on any failure (network,
 * not configured, admin key mismatch, etc.) — callers should show a
 * generic "couldn't connect" message rather than the raw error.
 */
export async function connectGoogleCalendar(eventId: string, code: string): Promise<boolean> {
  const functions = getFunctionsClient();
  if (!functions) return false;

  try {
    const callable = httpsCallable(functions, 'exchangeGoogleAuthCode');
    await callable({ eventId, code });
    return true;
  } catch (err) {
    console.warn('[Firebase] connectGoogleCalendar failed:', err);
    return false;
  }
}

/**
 * Disconnects Google Calendar for an event: deletes the stored refresh
 * token server-side. Does not attempt to cancel already-created events.
 */
export async function disconnectGoogleCalendar(eventId: string): Promise<boolean> {
  const functions = getFunctionsClient();
  if (!functions) return false;

  try {
    const callable = httpsCallable(functions, 'disconnectGoogleCalendar');
    await callable({ eventId });
    return true;
  } catch (err) {
    console.warn('[Firebase] disconnectGoogleCalendar failed:', err);
    return false;
  }
}

/**
 * Permanently deletes an event from the database. Admin-key verified
 * server-side. Does not attempt to cancel any Google Calendar invites
 * already sent for bookings on this event.
 */
export async function deleteEventRemote(eventId: string): Promise<boolean> {
  const functions = getFunctionsClient();
  if (!functions) return false;

  try {
    const callable = httpsCallable(functions, 'deleteEvent');
    await callable({ eventId });
    return true;
  } catch (err) {
    console.warn('[Firebase] deleteEventRemote failed:', err);
    return false;
  }
}

/**
 * Concurrency Testing Flag (dev/QA only — never exposed in production UI):
 * When enabled, the next shift claim will simulate a remote 409 Conflict
 * (as if another booth staff member tapped the exact same second).
 */
let simulateConflictFlag = false;

export const concurrencyTester = {
  isSimulatingConflict: () => simulateConflictFlag,
  setSimulateConflict: (val: boolean) => {
    simulateConflictFlag = val;
  },
  toggleSimulateConflict: () => {
    simulateConflictFlag = !simulateConflictFlag;
    return simulateConflictFlag;
  },
};

export interface RemoteClaimResult {
  success: boolean;
  status: 200 | 409 | 500;
  message?: string;
  conflict?: boolean;
  // Present on a successful claim — the actual slots/roster as committed
  // by the transaction, which the caller should reconcile its local
  // state against rather than trusting its own pre-transaction guess,
  // since concurrent activity could mean the two differ.
  committedSlots?: TimeSlot[];
  committedRoster?: StaffMember[];
}

interface BoothEventDoc {
  adminKey: string;
  publicKey: string;
  config: EventConfig;
  slots: TimeSlot[];
  roster: StaffMember[];
  updatedAt: string;
}

function docToStoredEvent(data: BoothEventDoc): StoredEventData {
  // The document's own updatedAt moves on every staff change, but staff may not edit config, so the
  // config copy can lag behind. Report the later of the two so "most recently changed" stays true.
  const updatedAt = data.updatedAt && data.updatedAt > (data.config.updatedAt || '') ? data.updatedAt : data.config.updatedAt;
  return {
    config: { ...data.config, updatedAt },
    slots: data.slots,
    roster: data.roster,
  };
}

/**
 * Fetches every event stored in the database. Only ever called from
 * within the (now login-gated) admin dashboard's "My Events" list — not
 * exposed anywhere reachable before authentication.
 */
export async function fetchAllEvents(): Promise<EventConfig[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const snap = await getDocs(collection(db, COLLECTION));
    reportConnectivity(true);
    return snap.docs
      .map((d) => d.data() as BoothEventDoc)
      .filter((d) => Boolean(d.config))
      .map((d) => docToStoredEvent(d).config);
  } catch (err) {
    reportConnectivity(false);
    throw err;
  }
}

/**
 * Fetches a single event by its admin key or public key directly from
 * Firestore. Returns null only for a genuine "not found" (the query
 * succeeded, no matching document exists). Throws on any network/backend
 * failure — callers must handle that distinctly rather than treating a
 * connection problem the same as "this event doesn't exist."
 */
export async function fetchEventByKey(
  key: string
): Promise<{ data: StoredEventData; role: 'admin' | 'staff' } | null> {
  const db = getDb();
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    // Staff path, open to anyone with the link: the key points at an event through publicLinks,
    // and one event can be read by id without listing events.
    const link = await getDoc(doc(db, PUBLIC_LINKS, key));
    if (link.exists()) {
      const eventId = (link.data() as { eventId?: string }).eventId;
      if (eventId) {
        const snap = await getDoc(doc(db, COLLECTION, eventId));
        reportConnectivity(true);
        if (snap.exists()) {
          return { data: docToStoredEvent(snap.data() as BoothEventDoc), role: 'staff' };
        }
      }
    }

    // Admin path: look the key up among events. Listing events needs an admin, so for anyone else
    // this is refused and means "not found", not "offline".
    try {
      const eventsRef = collection(db, COLLECTION);
      const byAdmin = await getDocs(query(eventsRef, where('adminKey', '==', key), limit(1)));
      if (!byAdmin.empty) {
        reportConnectivity(true);
        return { data: docToStoredEvent(byAdmin.docs[0].data() as BoothEventDoc), role: 'admin' };
      }
      const byPublic = await getDocs(query(eventsRef, where('publicKey', '==', key), limit(1)));
      reportConnectivity(true);
      if (!byPublic.empty) {
        return { data: docToStoredEvent(byPublic.docs[0].data() as BoothEventDoc), role: 'staff' };
      }
    } catch (err) {
      if ((err as { code?: string }).code !== 'permission-denied') throw err;
      reportConnectivity(true);
    }

    return null;
  } catch (err) {
    reportConnectivity(false);
    throw err;
  }
}

/**
 * Writes a whole event, and the lookup that lets staff open it by its public key. Creating or replacing
 * an event is for admins, and the rules enforce that. Staff changes use pushStaffChange instead.
 */
export async function pushEventToFirebase(eventData: StoredEventData): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await setDoc(doc(db, COLLECTION, eventData.config.id), {
      adminKey: eventData.config.adminKey,
      publicKey: eventData.config.publicKey,
      config: eventData.config,
      slots: eventData.slots,
      roster: eventData.roster,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, PUBLIC_LINKS, eventData.config.publicKey), { eventId: eventData.config.id });
    reportConnectivity(true);
    return true;
  } catch (err) {
    console.warn('[Firebase] Event push failed:', err);
    reportConnectivity(false);
    return false;
  }
}

/**
 * What staff are allowed to change on the open staff page: shifts and roster, and when it happened.
 * Nothing else, so the database rules can allow exactly this and refuse the rest. The names here are
 * checked against firestore.rules by a test.
 */
export const STAFF_WRITABLE_FIELDS = ['slots', 'roster', 'updatedAt'] as const;

export async function pushStaffChange(eventId: string, slots: TimeSlot[], roster: StaffMember[]): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await updateDoc(doc(db, COLLECTION, eventId), { slots, roster, updatedAt: new Date().toISOString() });
    reportConnectivity(true);
    return true;
  } catch (err) {
    console.warn('[Firebase] Staff change failed:', err);
    reportConnectivity(false);
    return false;
  }
}

/**
 * Makes sure every event has its public-link entry, so existing staff links keep working under the
 * rules. Safe to run again. Admins only: it lists events. Returns how many entries it added.
 */
export async function ensurePublicLinks(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    let added = 0;
    for (const d of snap.docs) {
      const data = d.data() as BoothEventDoc;
      const key = data.publicKey || data.config?.publicKey;
      if (!key) continue;
      const link = await getDoc(doc(db, PUBLIC_LINKS, key));
      if (!link.exists()) {
        await setDoc(doc(db, PUBLIC_LINKS, key), { eventId: d.id });
        added += 1;
      }
    }
    return added;
  } catch (err) {
    console.warn('[Firebase] ensurePublicLinks failed:', err);
    return 0;
  }
}

/**
 * Module data (budget, schedule, notes and so on) lives in admin-only documents
 * under the event: boothEvents/{eventId}/modules/{moduleId}. That keeps it out of
 * the shared event document, which staff can read and write without signing in,
 * and out of reach of pushEventToFirebase, which overwrites that document whole.
 * The rules for this path require the admin sign-in (see firestore.rules).
 *
 * Returns undefined when Firebase is unavailable or the read was refused, null
 * when the document simply doesn't exist yet. Connectivity is deliberately not
 * reported from here: a refused read means "not signed in", not "offline".
 */
export async function fetchModuleDoc(
  eventId: string,
  moduleId: string
): Promise<{ data: unknown; updatedAt: string } | null | undefined> {
  const db = getDb();
  if (!db) return undefined;
  try {
    const snap = await getDoc(doc(db, COLLECTION, eventId, 'modules', moduleId));
    if (!snap.exists()) return null;
    const raw = snap.data() as { data?: unknown; updatedAt?: string };
    return { data: raw.data, updatedAt: raw.updatedAt || '' };
  } catch (err) {
    console.warn(`[Firebase] fetchModuleDoc(${moduleId}) failed:`, err);
    return undefined;
  }
}

export async function pushModuleDoc(
  eventId: string,
  moduleId: string,
  data: unknown,
  updatedAt: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    // Firestore rejects undefined field values; a JSON round trip drops them.
    const clean = JSON.parse(JSON.stringify(data));
    await setDoc(doc(db, COLLECTION, eventId, 'modules', moduleId), {
      data: clean,
      updatedAt,
      schemaVersion: 1,
    });
    return true;
  } catch (err) {
    console.warn(`[Firebase] pushModuleDoc(${moduleId}) failed:`, err);
    return false;
  }
}

/**
 * Same purpose as pushEventToFirebase, but for admin-only changes
 * (capacity, roster, slot assignment): routed through the
 * adminUpdateEvent Cloud Function so the write is verified against the
 * caller's real signed-in identity, rather than written directly from
 * the client the way staff's claim/release actions are.
 */
const linkedThisSession = new Set<string>();

/**
 * Makes sure staff can find this event from its public key. The server function also does this, but the
 * app does not depend on it: this is an admin writing, which the rules allow, so a new event's staff
 * link works even if the functions have not been redeployed. Once per key per session, and never fatal.
 */
async function ensurePublicLink(publicKey: string | undefined, eventId: string): Promise<void> {
  const db = getDb();
  if (!db || !publicKey || linkedThisSession.has(publicKey)) return;
  try {
    await setDoc(doc(db, PUBLIC_LINKS, publicKey), { eventId });
    linkedThisSession.add(publicKey);
  } catch (err) {
    console.warn('[Firebase] Could not write the staff link entry:', err);
  }
}

export async function pushEventToFirebaseAsAdmin(eventData: StoredEventData): Promise<boolean> {
  const functions = getFunctionsClient();
  if (!functions) return false;

  try {
    const callable = httpsCallable(functions, 'adminUpdateEvent');
    await callable({
      eventId: eventData.config.id,
      config: eventData.config,
      slots: eventData.slots,
      roster: eventData.roster,
    });
    await ensurePublicLink(eventData.config.publicKey, eventData.config.id);
    reportConnectivity(true);
    return true;
  } catch (err) {
    console.warn('[Firebase] pushEventToFirebaseAsAdmin failed:', err);
    reportConnectivity(false);
    return false;
  }
}

/**
 * Subscribes to live changes on a single event document, so every device
 * viewing the same event updates within roughly a second of any other
 * device's change — no polling needed. Returns an unsubscribe function;
 * callers must call it when switching events or tearing down.
 */
export function subscribeToEvent(
  eventId: string,
  onChange: (data: StoredEventData) => void
): Unsubscribe | null {
  const db = getDb();
  if (!db) return null;

  return onSnapshot(
    doc(db, COLLECTION, eventId),
    (snap) => {
      if (!snap.exists()) return;
      onChange(docToStoredEvent(snap.data() as BoothEventDoc));
    },
    (err) => {
      console.warn('[Firebase] Live subscription error:', err);
    }
  );
}

/**
 * Atomically claims a shift via a real Firestore transaction — this is
 * the fix for a genuine race condition the previous implementation had:
 * a plain read-then-separately-write pattern has a real time window
 * where two near-simultaneous claims on the last open spot could both
 * pass their capacity check (each reading the state before the other's
 * write lands), resulting in either an over-capacity slot or, worse,
 * one claim's full-document overwrite silently erasing the other's
 * booking entirely. A Firestore transaction closes that window: it
 * reads the document fresh *inside* the transaction, re-validates
 * against that fresh read, and Firestore itself detects and retries the
 * whole transaction if another write lands in between — so the
 * validation and the write are atomic relative to any concurrent claim,
 * not just "recently checked."
 *
 * Falls back to optimistic local success when Firebase isn't configured
 * or is unreachable, matching the app's offline-first design — this
 * mirrors the previous function's fallback behavior exactly.
 */
export async function claimShiftAtomic(
  eventId: string,
  slotId: string,
  booking: ShiftBooking,
  durationHours: number
): Promise<RemoteClaimResult> {
  if (simulateConflictFlag) {
    simulateConflictFlag = false;
    return {
      success: false,
      status: 409,
      conflict: true,
      message: 'Slot was just claimed by someone else! Matrix updated.',
    };
  }

  const db = getDb();
  if (!db) {
    return { success: true, status: 200 };
  }

  const docRef = doc(db, COLLECTION, eventId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        return { success: true as const, status: 200 as const };
      }

      const data = snap.data() as BoothEventDoc;
      const slotIndex = data.slots.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) {
        return { success: true as const, status: 200 as const };
      }

      const liveSlot = data.slots[slotIndex];

      if (liveSlot.bookings.length >= liveSlot.capacity) {
        return {
          success: false as const,
          status: 409 as const,
          conflict: true,
          message: 'Slot was just claimed by someone else! Matrix updated.',
        };
      }

      if (liveSlot.bookings.some((b) => b.staffId === booking.staffId)) {
        return {
          success: false as const,
          status: 409 as const,
          conflict: true,
          message: 'You are already booked for this slot on another device.',
        };
      }

      const updatedSlot = updateSlotDerivedState({
        ...liveSlot,
        bookings: [...liveSlot.bookings, booking],
      });
      const nextSlots = [...data.slots];
      nextSlots[slotIndex] = updatedSlot;

      const nextRoster = data.roster.map((m) =>
        m.id === booking.staffId
          ? { ...m, totalBookedHours: Math.round((m.totalBookedHours + durationHours) * 10) / 10 }
          : m
      );

      transaction.update(docRef, { slots: nextSlots, roster: nextRoster, updatedAt: new Date().toISOString() });

      return {
        success: true as const,
        status: 200 as const,
        committedSlots: nextSlots,
        committedRoster: nextRoster,
      };
    });

    reportConnectivity(true);
    return result;
  } catch (err) {
    console.warn('[Firebase] claimShiftAtomic transaction failed, proceeding locally:', err);
    reportConnectivity(false);
    return { success: true, status: 200 };
  }
}

