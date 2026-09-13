const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = defineSecret('GOOGLE_OAUTH_REDIRECT_URI');

const EVENTS_COLLECTION = 'boothEvents';
// Deliberately NOT covered by firestore.rules, so it's unreadable/unwritable
// from any client — only these Cloud Functions (running with admin
// privileges) ever touch it. Never expose refresh tokens to the browser.
const TOKENS_COLLECTION = 'organizerCalendarTokens';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Exchanges a one-time Google OAuth authorization code (from the admin's
 * "Connect Google Calendar" button) for a refresh token, and stores that
 * token server-side only. The admin key proves the caller actually holds
 * admin access to this event before we do anything.
 */
exports.exchangeGoogleAuthCode = onCall(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI] },
  async (request) => {
    const { eventId, adminKey, code } = request.data || {};
    if (!eventId || !adminKey || !code) {
      throw new HttpsError('invalid-argument', 'eventId, adminKey, and code are all required.');
    }

    const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', 'Event not found.');
    }
    if (eventSnap.data().adminKey !== adminKey) {
      throw new HttpsError('permission-denied', 'Admin key does not match this event.');
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
  const { eventId, adminKey } = request.data || {};
  if (!eventId || !adminKey) {
    throw new HttpsError('invalid-argument', 'eventId and adminKey are required.');
  }

  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new HttpsError('not-found', 'Event not found.');
  }
  if (eventSnap.data().adminKey !== adminKey) {
    throw new HttpsError('permission-denied', 'Admin key does not match this event.');
  }

  await db.collection(TOKENS_COLLECTION).doc(eventId).delete();
  await eventRef.update({ 'config.googleCalendarConnected': false });

  return { connected: false };
});

/**
 * Permanently deletes an event: its boothEvents document (config, slots,
 * roster, bookings) and any stored Google Calendar OAuth token for it.
 * Admin-key verified, same as the Calendar connect/disconnect functions.
 * Does not attempt to cancel any calendar invites already sent for
 * bookings on this event.
 */
exports.deleteEvent = onCall(async (request) => {
  const { eventId, adminKey } = request.data || {};
  if (!eventId || !adminKey) {
    throw new HttpsError('invalid-argument', 'eventId and adminKey are required.');
  }

  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    // Already gone — treat as success so the caller's cleanup proceeds.
    return { deleted: true };
  }
  if (eventSnap.data().adminKey !== adminKey) {
    throw new HttpsError('permission-denied', 'Admin key does not match this event.');
  }

  await db.collection(TOKENS_COLLECTION).doc(eventId).delete();
  await eventRef.delete();

  return { deleted: true };
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
            summary: `Expo Staffing: ${config.title}`,
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
