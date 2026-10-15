const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { createAdminUserService, ServiceError, normaliseEmail, OWNER_EMAILS } = require('./adminUsers');

initializeApp();
// Optional: only needed when Firestore was provisioned under a named
// database rather than the implicit "(default)" one — which is exactly
// how this project's Firestore was set up. Must match
// VITE_FIREBASE_DATABASE_ID on the client side. See
// functions/.env.example.
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID;
const db = FIRESTORE_DATABASE_ID ? getFirestore(FIRESTORE_DATABASE_ID) : getFirestore();

const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = defineSecret('GOOGLE_OAUTH_REDIRECT_URI');

const EVENTS_COLLECTION = 'boothEvents';
// Deliberately NOT covered by firestore.rules, so it's unreadable/unwritable
// from any client — only these Cloud Functions (running with admin
// privileges) ever touch it. Never expose refresh tokens to the browser.
const TOKENS_COLLECTION = 'organizerCalendarTokens';
// Finds an event from its public (staff) key. See firestore.rules.
const PUBLIC_LINKS_COLLECTION = 'publicLinks';

// Owners are fixed in adminUsers.js (kept in step with ALLOWED_ADMIN_EMAILS in
// src/lib/firebase.ts and firestore.rules). Other admins are granted and revoked
// through the user manager and stored in the adminUsers collection. This is the
// real enforcement point: the client-side check is only a convenience, and could
// be bypassed by anyone calling these functions directly, so every sensitive action
// re-checks the caller's verified Firebase Auth identity here.
const adminUsers = createAdminUserService({ db, auth: getAuth(), owners: OWNER_EMAILS });

/**
 * Throws if the caller isn't signed in as an owner or a granted admin.
 * request.auth is populated by Firebase from the caller's ID token, so it
 * cannot be forged by a client claiming to be someone else.
 */
async function requireAdmin(request) {
  const email = normaliseEmail(request.auth && request.auth.token && request.auth.token.email);
  if (!request.auth || !(await adminUsers.isAdmin(email))) {
    throw new HttpsError('permission-denied', 'You must be signed in as an authorized admin.');
  }
  return email;
}

/** Maps a ServiceError from adminUsers.js onto the matching HttpsError. */
function asHttpsError(err) {
  if (err instanceof ServiceError) return new HttpsError(err.code, err.message);
  console.error('[adminUsers] unexpected failure:', err);
  return new HttpsError('internal', 'Something went wrong. Please try again.');
}

exports.listAdminUsers = onCall(async (request) => {
  await requireAdmin(request);
  try {
    return await adminUsers.list();
  } catch (err) {
    throw asHttpsError(err);
  }
});

exports.grantAdminUser = onCall(async (request) => {
  const caller = await requireAdmin(request);
  try {
    return await adminUsers.grant(caller, (request.data || {}).email);
  } catch (err) {
    throw asHttpsError(err);
  }
});

exports.revokeAdminUser = onCall(async (request) => {
  const caller = await requireAdmin(request);
  try {
    return await adminUsers.revoke(caller, (request.data || {}).email);
  } catch (err) {
    throw asHttpsError(err);
  }
});

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Exchanges a one-time Google OAuth authorization code (from the admin's
 * "Connect Google Calendar" button) for a refresh token, and stores that
 * token server-side only.
 */
exports.exchangeGoogleAuthCode = onCall(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI] },
  async (request) => {
    await requireAdmin(request);

    const { eventId, code } = request.data || {};
    if (!eventId || !code) {
      throw new HttpsError('invalid-argument', 'eventId and code are required.');
    }

    const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', 'Event not found.');
    }

    let tokenJson;
    try {
      const tokenResponse = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID.value(),
          client_secret: GOOGLE_CLIENT_SECRET.value(),
          redirect_uri: GOOGLE_REDIRECT_URI.value(),
          grant_type: 'authorization_code',
        }),
      });
      tokenJson = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenJson.refresh_token) {
        console.warn('[exchangeGoogleAuthCode] Token exchange failed:', tokenJson);
        throw new Error(tokenJson.error_description || 'No refresh token returned.');
      }
    } catch (err) {
      throw new HttpsError('internal', `Failed to exchange authorization code: ${err.message}`);
    }

    await db.collection(TOKENS_COLLECTION).doc(eventId).set({
      refreshToken: tokenJson.refresh_token,
      connectedAt: new Date().toISOString(),
    });

    await eventRef.update({ 'config.googleCalendarConnected': true });

    return { connected: true };
  }
);

/**
 * Lets an admin disconnect Google Calendar for their event: deletes the
 * stored refresh token and flips the client-visible status flag off.
 * Does not attempt to cancel already-created calendar events.
 */
exports.disconnectGoogleCalendar = onCall(async (request) => {
  await requireAdmin(request);

  const { eventId } = request.data || {};
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'eventId is required.');
  }

  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new HttpsError('not-found', 'Event not found.');
  }

  await db.collection(TOKENS_COLLECTION).doc(eventId).delete();
  await eventRef.update({ 'config.googleCalendarConnected': false });

  return { connected: false };
});

/**
 * Permanently deletes an event: its boothEvents document (config, slots,
 * roster, bookings) and any stored Google Calendar OAuth token for it.
 * Does not attempt to cancel any calendar invites already sent for
 * bookings on this event.
 */
exports.deleteEvent = onCall(async (request) => {
  await requireAdmin(request);

  const { eventId } = request.data || {};
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'eventId is required.');
  }

  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    // Already gone — treat as success so the caller's cleanup proceeds.
    return { deleted: true };
  }

  const publicKey = (eventSnap.data() || {}).publicKey;
  await db.collection(TOKENS_COLLECTION).doc(eventId).delete();
  if (publicKey) await db.collection(PUBLIC_LINKS_COLLECTION).doc(String(publicKey)).delete();
  // recursiveDelete also removes the event's module documents (budget, schedule and so on),
  // which a plain delete would leave behind.
  await db.recursiveDelete(eventRef);

  return { deleted: true };
});

/**
 * Persists an admin-only change (capacity, roster, slot assignment) to
 * an event. The client computes the new config/slots/roster locally —
 * same trust model as the existing staff-side claim/release sync — this
 * function's job is purely to verify the caller is an authenticated
 * admin before writing it, since a direct client-side Firestore write
 * would have no way to check that.
 */
exports.adminUpdateEvent = onCall(async (request) => {
  await requireAdmin(request);

  const { eventId, config, slots, roster } = request.data || {};
  if (!eventId || !config || !slots || !roster) {
    throw new HttpsError('invalid-argument', 'eventId, config, slots, and roster are all required.');
  }

  // merge: keeps anything else on the document, instead of rebuilding it from only these fields.
  await db.collection(EVENTS_COLLECTION).doc(eventId).set(
    {
      adminKey: config.adminKey,
      publicKey: config.publicKey,
      config,
      slots,
      roster,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  // Staff open the event through this entry, so it must exist for every event.
  if (config.publicKey) {
    await db.collection(PUBLIC_LINKS_COLLECTION).doc(String(config.publicKey)).set({ eventId });
  }

  return { success: true };
});

async function getAccessToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID.value(),
      client_secret: GOOGLE_CLIENT_SECRET.value(),
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || 'Failed to refresh Google access token.');
  }
  return json.access_token;
}

/**
 * Finds bookings present in `after` but not `before` (newly claimed), and
 * bookings present in `before` but not `after` (released/removed),
 * matched purely by booking id — never by deep equality — so that this
 * function's own later update (adding googleCalendarEventId) is never
 * misread as a new booking on the next trigger invocation.
 */
function diffBookings(beforeSlots, afterSlots) {
  const beforeById = new Map();
  for (const slot of beforeSlots || []) {
    for (const booking of slot.bookings || []) {
      beforeById.set(booking.id, { slot, booking });
    }
  }

  const afterIds = new Set();
  const added = [];
  for (const slot of afterSlots || []) {
    for (const booking of slot.bookings || []) {
      afterIds.add(booking.id);
      if (!beforeById.has(booking.id)) {
        added.push({ slot, booking });
      }
    }
  }

  const removed = [];
  for (const [id, entry] of beforeById.entries()) {
    if (!afterIds.has(id)) {
      removed.push(entry);
    }
  }

  return { added, removed };
}

/**
 * Fires on every write to a boothEvents/{eventId} document. Diffs the
 * bookings before/after to find newly claimed or released shifts, and —
 * only if the organizer has connected Google Calendar — creates or
 * cancels the matching calendar invite. A no-op (returns early) when
 * nothing relevant changed, including on its own follow-up write.
 */
exports.onEventWrite = onDocumentWritten(
  {
    document: `${EVENTS_COLLECTION}/{eventId}`,
    database: FIRESTORE_DATABASE_ID || undefined,
    secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET],
  },
  async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;
    if (!after) return; // event document deleted

    const { added, removed } = diffBookings(before?.slots, after.slots);
    if (added.length === 0 && removed.length === 0) return;

    const tokenSnap = await db.collection(TOKENS_COLLECTION).doc(event.params.eventId).get();
    if (!tokenSnap.exists) return; // organizer hasn't connected Google Calendar

    let accessToken;
    try {
      accessToken = await getAccessToken(tokenSnap.data().refreshToken);
    } catch (err) {
      console.warn('[onEventWrite] Could not refresh Google access token:', err.message);
      return;
    }

    const config = after.config;
    const nextSlots = after.slots.map((s) => ({ ...s, bookings: s.bookings.map((b) => ({ ...b })) }));
    let slotsChanged = false;

    for (const { slot, booking } of added) {
      if (!booking.staffEmail) continue; // nothing to invite

      try {
        const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events?sendUpdates=all`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `Showrunner: ${config.title}`,
            location: config.location,
            description: `Shift for ${booking.staffName} — ${config.title}`,
            start: { dateTime: `${slot.date}T${slot.startTime}:00`, timeZone: config.timezone || 'UTC' },
            end: { dateTime: `${slot.date}T${slot.endTime}:00`, timeZone: config.timezone || 'UTC' },
            attendees: [{ email: booking.staffEmail, displayName: booking.staffName }],
          }),
        });
        const json = await res.json();
        if (res.ok && json.id) {
          const targetSlot = nextSlots.find((s) => s.id === slot.id);
          const targetBooking = targetSlot && targetSlot.bookings.find((b) => b.id === booking.id);
          if (targetBooking) {
            targetBooking.googleCalendarEventId = json.id;
            slotsChanged = true;
          }
        } else {
          console.warn('[onEventWrite] Calendar event creation failed:', json);
        }
      } catch (err) {
        console.warn('[onEventWrite] Calendar event creation exception:', err.message);
      }
    }

    for (const { booking } of removed) {
      if (!booking.googleCalendarEventId) continue;
      try {
        await fetch(
          `${CALENDAR_API_BASE}/calendars/primary/events/${booking.googleCalendarEventId}?sendUpdates=all`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } catch (err) {
        console.warn('[onEventWrite] Calendar event cancellation exception:', err.message);
      }
    }

    if (slotsChanged) {
      await event.data.after.ref.update({ slots: nextSlots });
    }
  }
);
