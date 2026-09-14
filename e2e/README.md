# E2E test suite

These tests exercise the real app against a real Firebase backend — there
is deliberately no mocking layer, since the bugs this suite exists to
catch (data not actually syncing, calendar invites at the wrong time,
auth gaps) only show up when the real backend is involved.

## What you need before running these

1. **A Firebase project reachable by the running app** — either:
   - The Firebase Emulator Suite (`firebase emulators:start`), pointed at
     by the same `VITE_FIREBASE_*` env vars the dev server uses, or
   - A real (ideally non-production) Firebase project, fully set up per
     `FIREBASE_SETUP.md`.
2. **Firestore rules and Cloud Functions deployed/emulated**, matching
   this repo's `firestore.rules` and `functions/index.js`.
3. **Two admin test accounts must exist in Firebase Auth**, matching
   `ALLOWED_ADMIN_EMAILS` in `src/lib/firebase.ts` — see
   `FIREBASE_SETUP.md`, "Enable admin login."
4. **Environment variables for the test runner itself**:

   ```
   E2E_ADMIN_EMAIL=<one of the two allowed admin emails>
   E2E_ADMIN_PASSWORD=<its real password>
   E2E_BASE_URL=http://localhost:3000   # optional, this is the default
   ```

   One test in `auth.spec.ts` (rejecting a non-admin account) also
   needs `E2E_NON_ADMIN_EMAIL` / `E2E_NON_ADMIN_PASSWORD` for a real,
   registered-but-not-allowlisted account; it's skipped automatically if
   these aren't set.

5. **Playwright's browser binaries**, which aren't installed by
   `npm install` alone:

   ```
   npx playwright install chromium
   ```

## Running

```
npm run test:e2e
```

This starts the dev server automatically (see `playwright.config.ts`) if
one isn't already running, and runs every `*.spec.ts` file in this
directory against Chromium.

To run a single file or watch results as they happen:

```
npx playwright test e2e/cross-device-sync.spec.ts
npx playwright test --ui
```

## What each file covers

- `auth.spec.ts` — sign-in, the admin allowlist, wrong-password/wrong-account
  rejection, sign-out, password reset.
- `event-lifecycle.spec.ts` — creating, modifying (capacity, roster), and
  deleting an event; confirming deletion requires confirmation.
- `staff-shift-claiming.spec.ts` — the no-login staff flow: adding
  yourself, claiming, releasing, and capacity limits.
- `calendar-export.spec.ts` — the ICS download and the "Create Calendar
  Event" Google Calendar link, specifically checking for the timezone
  bug class this app has actually shipped before.
- `cross-device-sync.spec.ts` — the most important file: verifies changes
  on one device show up on another device's already-open page, without a
  manual reload, since that's the entire point of the Firebase migration.
- `messaging-truthfulness.spec.ts` — checks specific user-facing claims
  (the connectivity badge, "All Events" accuracy, error visibility)
  against actual system state, rather than trusting the copy.

## Data hygiene

These tests create real events with timestamped titles (e.g.
`E2E Test Event 1234567890`) in whatever Firebase project they're pointed
at. Tests that create an event generally also delete it, but a failed
test partway through can leave one behind. If running against a shared
project rather than a disposable emulator, periodically clean up via
"All Events" in the admin dashboard, filtering for titles containing
"Test".

## Known gaps in this suite (be aware, not blocked)

- No visual regression testing (screenshots) — this suite checks
  behavior and text content, not pixel-level appearance.
- `messaging-truthfulness.spec.ts`'s connectivity-badge test has a soft
  first assertion (see the `.catch()` in it) because the exact timing of
  the very first database read on page load isn't fully deterministic;
  the meaningful assertion is the second one, after a deliberate action.

## Google Calendar auto-invite testing

Automating Google's real OAuth consent screen from a browser test is a
known anti-pattern — Google actively detects and blocks automated
browsers on its login/consent pages, so any test that tried would be
fragile at best. This suite instead splits Calendar testing into two
files with two different strategies:

- **`google-calendar-connect-ui.spec.ts`** — always runs, no extra setup.
  Mocks Google Identity Services entirely (a fake `window.google`) and
  mocks the Cloud Function's HTTP response, so it purely tests this
  app's own code: does clicking Connect call GIS with the right scope,
  does the UI react correctly to success/failure/cancellation.

- **`google-calendar-integration.spec.ts`** — tests the *real* Calendar
  API behavior (does claiming a shift actually create a correctly-timed
  invite, does releasing it actually cancel that invite), by seeding a
  **pre-obtained** refresh token directly into Firestore — bypassing the
  consent screen — then checking the real Google Calendar API directly
  from the test itself. Skipped automatically unless configured.

### One-time setup for the real integration tests

1. Create (or designate) a **dedicated test Google account** — not
   anyone's personal or work account, since these tests create and
   delete real calendar events on it.
2. Run the helper script once, manually:

   ```
   E2E_GOOGLE_OAUTH_CLIENT_ID=<your OAuth client id> \
   E2E_GOOGLE_OAUTH_CLIENT_SECRET=<your OAuth client secret> \
   node e2e/scripts/get-test-refresh-token.mjs
   ```

   This prints a Google consent URL — open it and sign in as the test
   account. The script prints a refresh token; save it.

   (The OAuth client's "Authorized redirect URIs" must include
   `http://localhost:8912/oauth2callback` — add it once alongside the
   app's real redirect URI in Google Cloud Console.)

3. Get a Firebase service account key (Firebase Console → Project
   Settings → Service Accounts → Generate new private key) — this lets
   the test suite write directly to Firestore, bypassing the app's UI,
   the same way the one-time OAuth step bypasses the consent screen.
4. Set these env vars for the test run:

   ```
   E2E_GOOGLE_TEST_REFRESH_TOKEN=<from step 2>
   E2E_GOOGLE_TEST_EMAIL=<the test account's email>
   E2E_GOOGLE_OAUTH_CLIENT_ID=<same as step 2>
   E2E_GOOGLE_OAUTH_CLIENT_SECRET=<same as step 2>
   E2E_FIREBASE_SERVICE_ACCOUNT_PATH=<path to the JSON key from step 3>
   ```

All three `google-calendar-integration.spec.ts` tests are skipped with a
clear reason if any of these aren't set — they never fail silently or
report a false pass.

