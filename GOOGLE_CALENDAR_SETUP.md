# Google Calendar auto-invite — setup

This feature lets an event admin connect their Google Calendar once; after
that, every claimed shift automatically creates a calendar event with the
staff member invited (and emailed by Google), and every released shift
cancels that invite. It's entirely optional — the app works the same as
before if you skip this.

Requires the Firebase project already set up (see the Firebase setup notes
from the backend swap) upgraded to the **Blaze (pay-as-you-go) plan** —
Cloud Functions can't make outbound network calls (to Google's OAuth/Calendar
APIs) on the free Spark plan. Blaze still has a generous free tier; a
booth-staffing app's volume of shift claims is very unlikely to cost
anything meaningful.

## 1. Enable the Calendar API

In the [Google Cloud Console](https://console.cloud.google.com) (same
project as your Firebase project — a Firebase project *is* a Google Cloud
project): APIs & Services → Library → search "Google Calendar API" → Enable.

## 2. Configure the OAuth consent screen

APIs & Services → OAuth consent screen:
- User type: **External** (unless everyone using this is in one Google
  Workspace organization, in which case Internal is simpler).
- Scopes: add `.../auth/calendar.events`.
- While the app is in "Testing" mode, only test users you explicitly add
  can complete the OAuth flow — add your own Google account (and any other
  admin's) as a test user, or publish the app if you want any organizer to
  be able to connect their own calendar.

## 3. Create an OAuth 2.0 Client ID

APIs & Services → Credentials → Create Credentials → OAuth client ID:
- Application type: **Web application**
- Authorized JavaScript origins: your app's deployed URL (and
  `http://localhost:5173` for local dev, if using Vite's default port)
- Authorized redirect URIs: not used by the popup code-flow this app uses,
  but Google may still require at least one — your deployed URL is fine

You'll get a **Client ID** and **Client secret**.

## 4. Set the frontend env var

```
VITE_GOOGLE_OAUTH_CLIENT_ID=<the Client ID from step 3>
```

This is not secret — it's fine to ship in frontend code. The "Connect
Google Calendar" button in the admin dashboard only renders when this is
set, so the feature stays invisible for any deployment that hasn't
configured it.

## 5. Set the three Cloud Functions secrets

These back the actual OAuth token exchange and must never reach the
browser — they're stored in Secret Manager via the Firebase CLI:

```
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
firebase functions:secrets:set GOOGLE_OAUTH_REDIRECT_URI
```

(`GOOGLE_OAUTH_CLIENT_ID` here is the same value as `VITE_GOOGLE_OAUTH_CLIENT_ID`
above — it's needed server-side too for the token exchange call.
`GOOGLE_OAUTH_REDIRECT_URI` should match one of the redirect URIs from
step 3, e.g. your deployed URL.)

## 6. Deploy

```
firebase deploy --only firestore:rules,functions
```

## 7. Smoke test

1. Open the admin dashboard for a real event, click "Connect Google
   Calendar", complete the Google OAuth popup.
2. From a different browser/incognito window, open the event's public
   staff link and claim a shift using an email address you can check.
3. Confirm a Google Calendar invite arrives for that email, at the correct
   local time for the event's configured timezone.
4. Release the shift from the staff view; confirm the calendar event gets
   cancelled.

## What this doesn't do

- No re-invite if a claimed shift's *time* changes after the fact (e.g. the
  event's capacity settings change) — only claim and release are handled.
- No UI to see which specific bookings have a calendar invite; the
  `googleCalendarEventId` field is tracked internally, not surfaced.
- Disconnecting Google Calendar stops *new* invites but doesn't cancel ones
  already sent.
