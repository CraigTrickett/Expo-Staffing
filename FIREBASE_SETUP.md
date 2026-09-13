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

## Optional: Google Calendar auto-invites

A separate, opt-in feature on top of this — see `GOOGLE_CALENDAR_SETUP.md`.
It requires this Firebase setup to already be working first.
