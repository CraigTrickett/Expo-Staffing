import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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
import type { EventConfig, ShiftBooking, StoredEventData, TimeSlot, StaffMember } from '@/types';
import { parseTimeToMinutes, updateSlotDerivedState } from './matrix';

const COLLECTION = 'boothEvents';

/**
 * Only these two accounts are permitted admin access. Firebase Auth would
 * happily authenticate anyone who has a valid account, so this allowlist
 * is what actually restricts who "the admin" can be — enforced here on
 * sign-in, and again server-side in every Cloud Function that performs a
 * sensitive action, since a client-side check alone can be bypassed.
 */
export const ALLOWED_ADMIN_EMAILS = ['craig_trickett@trimble.com', 'craigtrickett@gmail.com'];

// Read optional Firebase environment credentials
const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
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
    if (!ALLOWED_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(signedInEmail)) {
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
export function subscribeToAdminAuth(callback: (email: string | null) => void): Unsubscribe | null {
  const auth = getAuthClient();
  if (!auth) {
    callback(null);
    return null;
  }

  return onAuthStateChanged(auth, (user) => {
    const email = (user?.email || '').toLowerCase();
    if (user && ALLOWED_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
      callback(user.email);
    } else {
      callback(null);
    }
  });
}

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
  return { config: data.config, slots: data.slots, roster: data.roster };
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
      .map((d) => (d.data() as BoothEventDoc).config)
      .filter((c): c is EventConfig => Boolean(c));
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

    return null;
  } catch (err) {
    reportConnectivity(false);
    throw err;
  }
}

/**
 * Pushes the full current event state (config + slots + roster) to
 * Firestore. Fire-and-forget from the caller's perspective: failures are
 * logged but never block the local-first UX, since localStorage already
 * has the authoritative local copy.
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
    reportConnectivity(true);
    return true;
  } catch (err) {
    console.warn('[Firebase] Event push failed:', err);
    reportConnectivity(false);
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

      transaction.set(docRef, {
        adminKey: data.config.adminKey,
        publicKey: data.config.publicKey,
        config: data.config,
        slots: nextSlots,
        roster: nextRoster,
        updatedAt: new Date().toISOString(),
      });

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

