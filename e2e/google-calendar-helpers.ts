import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * These helpers deliberately never drive Google's real OAuth consent
 * screen from a browser. Automating that is fragile (Google actively
 * detects and blocks automated browsers on its login/consent pages) and
 * not something this suite should depend on. Instead:
 *   - The refresh token is obtained ONCE, manually, via
 *     `node e2e/scripts/get-test-refresh-token.mjs` (a real human
 *     completes the consent screen exactly once, outside of any test
 *     run) and stored as an env var for CI/local runs from then on.
 *   - Tests seed that refresh token directly into Firestore (bypassing
 *     the app's own connect UI), then verify the *real* Calendar API
 *     behavior — the part that actually matters — by calling Google's
 *     API directly from the test itself, independent of the app.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export function hasGoogleCalendarTestConfig(): boolean {
  return Boolean(
    process.env.E2E_GOOGLE_TEST_REFRESH_TOKEN &&
    process.env.E2E_GOOGLE_TEST_EMAIL &&
    process.env.E2E_GOOGLE_OAUTH_CLIENT_ID &&
    process.env.E2E_GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.E2E_FIREBASE_SERVICE_ACCOUNT_PATH
  );
}

let adminApp: App | null = null;

function getAdminApp(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0];
    } else {
      adminApp = initializeApp({
        credential: cert(process.env.E2E_FIREBASE_SERVICE_ACCOUNT_PATH!),
      });
    }
  }
  return adminApp;
}

/**
 * Resolves an event's actual Firestore document ID from its admin key —
 * the two are different fields in this app's data model (adminKey is a
 * separate, opaque field; the document ID is config.id), and the Cloud
 * Functions key organizerCalendarTokens by document ID, not adminKey.
 */
async function resolveEventId(adminKey: string): Promise<string> {
  const db = getFirestore(getAdminApp());
  const snap = await db.collection('boothEvents').where('adminKey', '==', adminKey).limit(1).get();
  if (snap.empty) {
    throw new Error(`No boothEvents document found with adminKey ${adminKey}`);
  }
  return snap.docs[0].id;
}

/**
 * Writes a refresh token directly into organizerCalendarTokens, exactly
 * as the exchangeGoogleAuthCode Cloud Function would after a real OAuth
 * flow — skipping the browser-based consent screen, which this suite
 * never automates. Takes the event's adminKey (what tests have on hand
 * from the URL after creating an event) and resolves the real document
 * ID internally.
 */
export async function seedGoogleCalendarToken(adminKey: string): Promise<void> {
  const db = getFirestore(getAdminApp());
  const eventId = await resolveEventId(adminKey);
  await db.collection('organizerCalendarTokens').doc(eventId).set({
    refreshToken: process.env.E2E_GOOGLE_TEST_REFRESH_TOKEN,
    connectedAt: new Date().toISOString(),
  });
  await db.collection('boothEvents').doc(eventId).update({
    'config.googleCalendarConnected': true,
  });
}

export async function removeGoogleCalendarToken(adminKey: string): Promise<void> {
  const db = getFirestore(getAdminApp());
  const eventId = await resolveEventId(adminKey);
  await db.collection('organizerCalendarTokens').doc(eventId).delete();
  await db.collection('boothEvents').doc(eventId).update({
    'config.googleCalendarConnected': false,
  });
}

async function getTestAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.E2E_GOOGLE_TEST_REFRESH_TOKEN!,
      client_id: process.env.E2E_GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.E2E_GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to refresh test Google access token: ${json.error_description || res.status}`);
  }
  return json.access_token;
}

/**
 * Finds a calendar event on the test Google account by exact summary
 * text, polling briefly since the onEventWrite Cloud Function runs
 * asynchronously after a Firestore write — a test claiming a shift and
 * immediately checking the calendar would otherwise race the function.
 */
export async function findCalendarEventBySummary(
  summary: string,
  { timeoutMs = 20_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<{ id: string; start: { dateTime: string }; end: { dateTime: string }; attendees?: { email: string }[] } | null> {
  const accessToken = await getTestAccessToken();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?q=${encodeURIComponent(summary)}&singleEvents=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await res.json();
    const match = (json.items || []).find((e: { summary?: string }) => e.summary === summary);
    if (match) return match;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}

/**
 * Polls for a specific calendar event to disappear (used after releasing
 * a shift, to confirm the invite was actually cancelled).
 */
export async function waitForCalendarEventGone(
  summary: string,
  { timeoutMs = 20_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await findCalendarEventBySummary(summary, { timeoutMs: 1, intervalMs: 1 });
    if (!found) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
