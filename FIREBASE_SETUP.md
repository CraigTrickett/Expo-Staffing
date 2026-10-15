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

Deploy `firestore.rules` exactly as committed in this repo. Don't write new rules:

```
firebase deploy --only firestore:rules
```

(or paste its contents into Firebase Console, Firestore Database, Rules, then Publish).

**Redeploy these rules whenever `firestore.rules` changes.** The admin email list in the
rules must match `ALLOWED_ADMIN_EMAILS` in `src/lib/firebase.ts` and `OWNER_EMAILS` in
`functions/adminUsers.js`.

### Who can do what

| | Not signed in (has a staff link) | Admin |
|---|---|---|
| Open one event, by its id | yes | yes |
| List every event | **no** | yes |
| Claim or release a shift, add yourself to the roster | yes | yes |
| Change an event's details, capacity or keys | **no** | yes |
| Create or delete an event | **no** | yes |
| Budget, schedule, stakeholders, keynote and other module data | **no** | yes |

The expo floor staff page stays open to anyone with its link, with no sign-in. Staff reach
an event through a `publicLinks/{publicKey}` entry that points at the event's id, so they
never need to list events.

### After deploying: sign in as an admin once

Events created before this change have no `publicLinks` entry yet. **Signing in as an admin
creates the missing ones automatically.** Until someone does, the staff links of those
older events will say the event was not found. Deploy the rules and functions (section 3b)
together, then sign in straight away.

### Test the rules before you deploy them

`rules-tests/firestore.rules.test.mjs` checks every row of the table above against the
Firebase emulator. It needs the Firebase CLI and Java:

```
npm run test:rules
```

### Deploying from Google AI Studio

AI Studio's build environment has no signed-in Firebase account and no Java, so `firebase deploy`
and `npm run test:rules` cannot run there. Use these instead:

- **Rules:** ask Gemini to put the contents of `firestore.rules` in place and deploy them the same
  way it has deployed rules before. The database is a named one, so the rules must go to that
  database (its id is in `firebase-applet-config.json`).
- **Test without the emulator:** in the Firebase console, Firestore, Rules, open the **Rules
  playground**. Check: an unauthenticated *get* of `boothEvents/<an event id>` is allowed; an
  unauthenticated *list* of `boothEvents` is denied; an unauthenticated *delete* is denied; a *get* of
  `publicLinks/<a public key>` is allowed and a *list* is denied; an unauthenticated *get* of
  `boothEvents/<id>/modules/budget` is denied. Then do the two checks in the app listed below.
- **Cloud Functions** cannot be deployed from AI Studio. The app does not depend on them for staff
  links any more (it writes the link itself), but the user manager, calendar and event deletion do.
  Deploy them from Google Cloud Shell (shell.cloud.google.com, which has Java, Node and the Firebase
  CLI): upload or clone the project, `cd functions && npm install`, `firebase login --no-localhost`,
  then `firebase deploy --only functions --project <project id>`.
- **Roll back** if anything is wrong: Firebase console, Firestore, Rules, the history (clock) icon,
  pick the previous version, Publish.
- **Never give Gemini a service-account key or token.** Nothing here needs one.

After deploying the rules, check in the app, as an admin: sign in once (this creates the staff-link
entries for older events), then in a private window, not signed in: the staff link opens and a shift
can be claimed and released, and the main address shows only the sign-in screen.

### What the rules cannot do

Shifts and the roster live in one document per event. So anyone holding a staff link could
in principle rewrite any shift or roster entry of that event, and the roster (names and
emails) is readable by anyone with the link. Closing that means giving every booking its own
document, which is a larger change. The staff link is the only thing protecting those two
things, so share it only with the people who should have it.

## 3b. Deploy the Cloud Functions (needed for the user manager)

The user manager (the **User Manager** card on the menu) grants and revokes admin
access through three Cloud Functions: `listAdminUsers`, `grantAdminUser` and
`revokeAdminUser`. Granting an admin creates their sign-in account if they do not
have one, and the app then emails them a link to set a password. Deploy them
with the rules:

```
firebase deploy --only functions,firestore:rules
```

The functions also keep the staff-link lookup (`publicLinks`) in step: saving an event
adds its entry, and deleting an event removes the entry and the event's module data.

How it works, so you know what to expect:

- **Owners** are the two emails fixed in `functions/adminUsers.js`,
  `src/lib/firebase.ts` and `firestore.rules`. They are always admins and the
  user manager cannot revoke them. Change an owner by editing all three.
- **Granted admins** are stored one document each in the `adminUsers` collection.
  Only the Cloud Functions write there, and a signed-in person can read only
  their own document, which is how the app knows they are an admin.
- **Any admin can grant or revoke other admins**, but nobody can revoke an owner
  or themselves. Revoking takes effect at once for data and functions: every
  check reads `adminUsers` when it is made. A revoked person's open browser tab
  keeps showing the admin screens until it is reloaded, but it can no longer read
  or change anything.
- If the password email does not arrive, the new admin can use **Forgot password**
  on the sign-in screen.

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

- Reload the app and sign in as an admin, then open Budget and change a figure.
  The header under the title should say **Saved and shared**, not **Saved on
  this device only**. If it says the latter, the Firestore rules have not been
  deployed, or at least one of the six variables above is missing or empty.
  The header itself shows a **Connection issue** badge only when the database
  cannot be reached.
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

- Signing in with anything other than an owner or a granted admin is rejected immediately.
  If the access check cannot be read (a dropped connection), the app retries and then says
  so, rather than telling a real admin they are not one.
- The menu, every area page, the Events page and the create page need a signed-in admin.
  The staff page does not.
- Deleting an event and connecting or disconnecting Google Calendar are Cloud Functions that
  verify the caller's identity on the server.
- Creating an event and every roster, capacity and slot-assignment change by an admin go
  through the authenticated `adminUpdateEvent` function.
- The database rules (section 3) enforce the same limits for anyone calling Firestore
  directly: no listing events, no creating or deleting, and staff can change only shifts and
  roster. See "What the rules cannot do" for the limit that remains.

### The Firebase web API key

The key in `firebase-applet-config.json` is public by design: it identifies the project, it
does not grant access. Restrict it to your site's address in Google Cloud Console
(APIs & Services, Credentials, the key, Application restrictions, HTTP referrers) and consider
turning on App Check, so only your app can call the project.

## Optional: Google Calendar auto-invites

A separate, opt-in feature on top of this — see `GOOGLE_CALENDAR_SETUP.md`.
It requires this Firebase setup to already be working first.
