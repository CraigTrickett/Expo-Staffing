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
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import type { EventConfig, ShiftBooking, StoredEventData, TimeSlot, StaffMember } from '@/types';

const COLLECTION = 'boothEvents';

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

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.trim().length > 0 &&
  firebaseConfig.projectId.trim().length > 0
);

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let functionsClient: Functions | null = null;

function getDb(): Firestore | null {
  if (!isFirebaseConfigured) return null;

  if (!firestoreDb) {
    try {
      firebaseApp = initializeApp(firebaseConfig);
      firestoreDb = getFirestore(firebaseApp);
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

/**
 * Completes the "Connect Google Calendar" flow: hands the one-time OAuth
 * authorization code from Google Identity Services to the
 * exchangeGoogleAuthCode Cloud Function, which exchanges it for a refresh
 * token and stores it server-side. Returns false on any failure (network,
 * not configured, admin key mismatch, etc.) — callers should show a
 * generic "couldn't connect" message rather than the raw error.
 */
export async function connectGoogleCalendar(
  eventId: string,
  adminKey: string,
  code: string
): Promise<boolean> {
  const functions = getFunctionsClient();
  if (!functions) return false;

  try {
    const callable = httpsCallable(functions, 'exchangeGoogleAuthCode');
    await callable({ eventId, adminKey, code });
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
export async function disconnectGoogleCalendar(eventId: string, adminKey: string): Promise<boolean> {
  const functions = getFunctionsClient();
  if (!functions) return false;

  try {
    const callable = httpsCallable(functions, 'disconnectGoogleCalendar');
    await callable({ eventId, adminKey });
    return true;
  } catch (err) {
    console.warn('[Firebase] disconnectGoogleCalendar failed:', err);
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

  const eventsRef = collection(db, COLLECTION);

  const byAdmin = await getDocs(query(eventsRef, where('adminKey', '==', key), limit(1)));
  if (!byAdmin.empty) {
    return { data: docToStoredEvent(byAdmin.docs[0].data() as BoothEventDoc), role: 'admin' };
  }

  const byPublic = await getDocs(query(eventsRef, where('publicKey', '==', key), limit(1)));
  if (!byPublic.empty) {
    return { data: docToStoredEvent(byPublic.docs[0].data() as BoothEventDoc), role: 'staff' };
  }

  return null;
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
    return true;
  } catch (err) {
    console.warn('[Firebase] Event push failed:', err);
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
 * Re-reads the live event from Firestore immediately before a shift claim
 * commits, to catch a real concurrent claim from another device. Falls
 * back to optimistic local success when Firebase isn't configured or is
 * unreachable, matching the app's offline-first design.
 */
export async function remoteClaimShiftGuard(
  eventId: string,
  slotId: string,
  booking: ShiftBooking,
  currentSlot: TimeSlot
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

  try {
    const snap = await getDoc(doc(db, COLLECTION, eventId));
    if (!snap.exists()) {
      return { success: true, status: 200 };
    }

    const data = snap.data() as BoothEventDoc;
    const liveSlot = data.slots?.find((s) => s.id === slotId) || currentSlot;

    if (liveSlot.bookings.length >= liveSlot.capacity) {
      return {
        success: false,
        status: 409,
        conflict: true,
        message: 'Slot was just claimed by someone else! Matrix updated.',
      };
    }

    if (liveSlot.bookings.some((b) => b.staffId === booking.staffId)) {
      return {
        success: false,
        status: 409,
        conflict: true,
        message: 'You are already booked for this slot on another device.',
      };
    }

    return { success: true, status: 200 };
  } catch (err) {
    console.warn('[Firebase] Concurrency check exception, proceeding locally:', err);
    return { success: true, status: 200 };
  }
}
