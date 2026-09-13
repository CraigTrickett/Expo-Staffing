# Firebase setup (required)

This app requires a connected Firebase project to run at all — it does not
operate on browser-only storage. Without this configured, the app shows a
blocking "Database Not Connected" screen instead of the normal UI.

## 1. Create a Firebase project

Go to the [Firebase Console](https://console.firebase.google.com), create a
project (the free Spark plan is enough for the core app — only the
optional Google Calendar auto-invite feature needs the paid Blaze plan;
see `GOOGLE_CALENDAR_SETUP.md`).

## 2. Enable Firestore

Firestore Database → Create database → start in production mode.

**Important**: if you're prompted for a Database ID and anything other
than accepting the literal default is offered (this happens automatically
if Google AI Studio provisions the project for you — it creates a named
database, not the default one), you must also set
`VITE_FIREBASE_DATABASE_ID` (frontend) and `FIRESTORE_DATABASE_ID`
(`functions/.env`) to that exact ID. Skipping this produces a real but
easy-to-miss error in the browser console — `Database '(default)' not
found` — even though every other credential is correct, and the app will
hang on "Loading..." indefinitely rather than showing a clear error,
since Firestore's own retry behavior doesn't fail fast. Check your
project's Firestore Database page in the console for the exact ID if
you're not sure which situation you're in.

## 3. Deploy the security rules

Deploy `firestore.rules` exactly as committed in this repo — don't write
new rules:

```
firebase deploy --only firestore:rules
```

(or paste its contents into Firebase Console → Firestore Database → Rules
→ Publish).

## 4. Create a Web App and get its config

Project Settings → General → Add app → Web. Copy the config values it
gives you into these environment variables for this deployment (see
`.env.example`):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

None of these are secret — they identify which Firebase project to talk
to, not credentials to protect. It's still fine to keep them in your
deployment platform's env config rather than committing a real `.env`
file.

## 5. Confirm it worked

- Reload the app. The header badge next to "Expo Staffing" should read
  **Synced** (green dot), not **Local only** (amber dot). If it still
  says Local only, at least one of the six variables above is missing or
  empty.
- If any variable is missing, the app shows a full-screen "Database Not
  Connected" message instead of the normal UI — that's intentional, not a
  bug.
- Create an event, then open the Firebase Console → Firestore Database.
  You should see a `boothEvents` collection with a document for it. If you
  do, data really is in the database, not just this browser.
- For the most convincing proof: open the same event's link in a
  completely different browser or an incognito window (no shared local
  storage). If it loads there too, the sync is real.

## 6. Enable admin login (required)

Admin access (the dashboard, roster/capacity changes, deleting events)
requires signing in — there's no more "secret key in the URL" for admin.
Staff access is unaffected: they still just use the link you share with
them, no login involved.

1. Firebase Console → Authentication → Get started → enable the
   **Email/Password** sign-in provider.
2. Authentication → Users → Add user, once for each allowed admin
   address, each with its own password:
   - `craig_trickett@trimble.com`
   - `craigtrickett@gmail.com`

   There's no sign-up form in the app — these two accounts are the only
   ones that will ever exist, created here manually. To change a
   password later, use the "Forgot password?" link on the app's login
   screen (sends a reset email via Firebase), or reset it directly from
   this Users list.
3. These two addresses are hardcoded as the admin allowlist in both
   `src/lib/firebase.ts` (client-side check) and `functions/index.js`
   (the real enforcement — every sensitive Cloud Function verifies the
   caller's signed-in email against this list server-side). To change
   who's allowed, update `ALLOWED_ADMIN_EMAILS` in both files and
   redeploy functions.

### What's actually protected

- Signing in with anything other than these two addresses is rejected
  immediately, even if the password would otherwise be valid for some
  other account.
- Deleting an event, and connecting/disconnecting Google Calendar, are
  Cloud Functions that verify the caller's Firebase Auth identity
  server-side — not just checked in the app's UI.
- Creating a new event, and every roster/capacity/slot-assignment change,
  are all routed through that same authenticated Cloud Function
  (`adminUpdateEvent`), so the normal app UI can't perform any of them
  without a valid admin session. The wizard's "create new event" form and
  the footer's "Reset State" button are both hidden entirely unless
  you're signed in.
- One honest limit: Firestore's security rules still allow direct writes
  to the shared event document without authentication, because staff
  need to claim/release shifts that way without logging in — and there's
  no clean way in Firestore's rules language to allow "staff can edit
  bookings" while blocking "someone edits capacity" on the same document
  without a bigger data-model change (moving bookings to their own
  subcollection). In practice this means the *app* now requires a real
  admin login for all management actions, but a technically sophisticated
  person bypassing the app entirely and calling Firestore directly could
  still write to fields Cloud Functions don't gate. Worth knowing, not
  currently closed.

## Optional: Google Calendar auto-invites

A separate, opt-in feature on top of this — see `GOOGLE_CALENDAR_SETUP.md`.
It requires this Firebase setup to already be working first.
