# Expo Staffing — UAT Test Plan

Manual test cases for user acceptance testing, organized by workflow.
Automated coverage exists for many of these (see `e2e/README.md` and
`npm test` for unit tests) — this document exists for the ones that
aren't automated yet, and as a script for a human to sign off against
before a release.

Priority: **P0** = blocks release if broken, **P1** = should fix before
release, **P2** = worth fixing, not blocking.

## 1. Admin Authentication

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| AUTH-01 | Valid admin login | Go to `/#/`, enter one of the two allowed emails + correct password, submit | Login form is replaced by the create-event form (or dashboard, if via `#/admin/:key`) | P0 |
| AUTH-02 | Wrong password | Enter a valid admin email with an incorrect password | Clear "Incorrect email or password" error; no access granted | P0 |
| AUTH-03 | Non-allowlisted account | Sign in with a real Firebase Auth account whose email is not one of the two allowed | "This account is not authorized for admin access"; session is signed out, not left half-authenticated | P0 |
| AUTH-04 | Non-existent email | Enter an email with no matching account | Same generic "Incorrect email or password" (does not reveal whether the account exists) | P1 |
| AUTH-05 | Sign out | While logged in, click "Log Out" | Returns to the login form; admin-only controls (Reset State, All Events) disappear | P0 |
| AUTH-06 | Password reset | Enter an email, click "Forgot password?" | Confirmation toast appears; a reset email is sent for a real account, and a generic-enough message that doesn't confirm/deny account existence for a fake one | P1 |
| AUTH-07 | Session persistence | Log in, reload the page | Still logged in (Firebase Auth's own session persistence) | P1 |
| AUTH-08 | Direct admin URL while signed out | Visit `#/admin/<any-key>` without being logged in | Shows the login form, not the dashboard, regardless of whether the key is valid | P0 |
| AUTH-09 | Staff never sees a login prompt | Open a staff link (`#/event/<publicKey>`) in a fresh browser with no session | No login form appears anywhere in the staff flow | P0 |

## 2. Event Creation

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| CREATE-01 | Create with minimum required fields | Log in, fill only the required event name, submit | Event created; redirected to its admin dashboard | P0 |
| CREATE-02 | Create with full roster paste | Paste 10 names (mixed newline/comma separated) into the roster field | All 10 appear in the Staffing tab, no duplicates or dropped entries | P1 |
| CREATE-03 | Quick presets apply correct schedule shape | Click each of the three presets, check the resulting time/duration/capacity fields | Values match what each preset claims (spot-check against the preset's own description) | P2 |
| CREATE-04 | Quick presets do not touch the title | Type a custom title, then click a preset | Title is unchanged — presets affect only schedule shape, not identity | P1 (regression: this used to silently overwrite the title) |
| CREATE-05 | Blank title is rejected | Leave the title empty, attempt submit | Browser/form validation blocks submission (required field) | P1 |
| CREATE-06 | Blank location is accepted | Leave location empty, submit | Event created; location-dependent UI (e.g. "Location:" rows) gracefully omits itself rather than showing "undefined" | P1 |
| CREATE-07 | End date before start date | Set an end date earlier than the start date | Either blocked by the date input's own constraints, or the app falls back sensibly (does not crash or generate negative-duration slots) | P1 |
| CREATE-08 | Creating an event requires login | Try to reach the create-event form while signed out | Login form shown instead; no way to create an event without authenticating | P0 |

## 3. Capacity & Roster Management (Admin)

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| ADMIN-01 | Increase default slot capacity | Click the capacity stepper's "+" | All existing slots' capacity increases immediately; readout updates | P0 |
| ADMIN-02 | Decrease to minimum | Click "-" repeatedly | Stops at 1, button disables — never reaches 0 | P0 |
| ADMIN-03 | Increase to maximum | Click "+" repeatedly | Stops at 10, button disables | P1 |
| ADMIN-04 | Add roster member | Add a new name (with and without an email) via the Staffing tab | Appears immediately with 0 booked hours | P0 |
| ADMIN-05 | Remove roster member with active bookings | Remove someone who currently has claimed shifts | Their bookings are released from those slots too (no orphaned booking referencing a deleted staff member) | P0 |
| ADMIN-06 | Manually assign staff to a slot | Use the admin "assign" flow on an open slot | Slot shows as booked by that person; their hours update | P0 |
| ADMIN-07 | Manually remove staff from a slot | Remove an assignment via the admin panel | Slot returns to open; person's hours update down | P0 |
| ADMIN-08 | Target hours recalculates as roster changes | Note the displayed "Target: Xh per rep", add/remove roster members | The figure changes to reflect the new roster size — it is computed live, not fixed at event creation | P0 (regression: this used to be a static, organizer-entered number) |
| ADMIN-09 | Zero-hours drawer accuracy | Open "Zero Hours", compare the listed names against who actually has 0 booked hours | Exact match — no one with bookings appears, no one without bookings is missing | P1 |

## 4. Staff Shift Claiming (No Login)

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| STAFF-01 | Add self to roster | Open the staff link, "I'm not on this list", enter name only (no email) | Added successfully; can proceed to claim shifts | P0 |
| STAFF-02 | Claim an open shift | Click an open slot | Slot shows as claimed by this person; hours update | P0 |
| STAFF-03 | Cannot claim a full shift | Attempt to claim a slot already at capacity | Slot shows "Full"; claim action is unavailable | P0 |
| STAFF-04 | Release a claimed shift | Click a claimed shift, confirm release | Slot returns to open; person's hours update down | P0 |
| STAFF-05 | Cancel out of a release confirmation | Start releasing a shift, then decline the confirmation | Shift remains claimed | P1 |
| STAFF-06 | Existing roster member selects their own name | Open the staff link, pick an existing name from the list (not "add new") | Identifies as that person; sees their existing bookings, if any | P0 |
| STAFF-07 | Filter views (All / Needs Staff / My Shifts / Fully Staffed) | Toggle each filter | Slot list updates correctly for each; counts are accurate | P1 |
| STAFF-08 | Confetti / target-met celebration | Claim enough shifts to reach the current dynamic target | Celebration animation triggers once, not repeatedly on every subsequent claim | P2 |
| STAFF-09 | Refresh mid-session | Claim a shift, refresh the browser | Still identified as the same person; claimed shift still shows as claimed (identity persists via local storage, data confirmed from the database) | P0 |

## 5. Calendar Export

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| CAL-01 | ICS download opens correctly | Download the .ics file, open it in a real calendar app (Apple Calendar, Outlook) | Event appears at the correct local time for the event's configured timezone | P0 |
| CAL-02 | ICS timezone correctness across DST | Create events with shifts in both a winter and summer month for a DST-observing timezone (e.g. America/Los_Angeles), compare displayed vs. exported time | Both are correct — no fixed-offset error that only shows up in one season | P0 |
| CAL-03 | "Create Calendar Event" per shift | With 2+ claimed shifts, use the per-shift calendar button next to each | Each opens Google Calendar prefilled with *that specific* shift's time, not always the first one | P0 (regression: this used to only ever use the first booked shift) |
| CAL-04 | Special characters in event title/location survive export | Use a title/location containing a comma, semicolon, or backslash, export ICS | File opens without corruption in a real calendar app; text displays with the original punctuation | P1 |
| CAL-05 | Copy Shift Summary | Use "Copy Shift Summary", paste into a text field | Plaintext summary is accurate and complete for all of that person's shifts | P2 |

## 6. Google Calendar Auto-Invite (opt-in feature)

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| GCAL-01 | Connect flow | As admin, click "Connect Google Calendar", complete the OAuth consent screen | Status changes to "Connected"; `googleCalendarConnected` reflected in the UI | P1 |
| GCAL-02 | Auto-invite on claim | With Calendar connected, have a staff member (with a real email) claim a shift | A calendar event appears on the connected Google account with that staff member invited, at the correct local time | P0 |
| GCAL-03 | Invite cancelled on release | Release a shift that had an auto-invite | The corresponding Google Calendar event is deleted/cancelled | P1 |
| GCAL-04 | No email, no invite | A staff member with no email claims a shift | No error; simply no calendar invite is attempted for that booking | P1 |
| GCAL-05 | Disconnect | Click "Disconnect" | Status reverts to "Not connected"; new claims no longer create invites | P1 |
| GCAL-06 | Not configured on this deployment | On a deployment without `VITE_GOOGLE_OAUTH_CLIENT_ID` set | The "Connect Google Calendar" card doesn't render at all — no broken/dead button | P1 |

## 7. Event Deletion & "All Events"

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| DEL-01 | Delete requires confirmation | Click delete on an event | A confirmation naming the event appears before anything happens | P0 |
| DEL-02 | Cancel confirmation | Decline the confirmation | Event is untouched | P0 |
| DEL-03 | Confirmed delete removes it everywhere | Confirm deletion, then try the old admin/staff links from a different session | Both report "not found" — the event is genuinely gone from the database, not just hidden locally | P0 |
| DEL-04 | "All Events" reflects real database state | Compare the list against events actually known to exist (e.g., created this session) | Matches exactly — no phantom entries, nothing missing | P0 |
| DEL-05 | Delete is admin-only | Confirm there is no path to delete an event from the staff view | No delete control exists anywhere in the staff-facing UI | P0 |

## 8. Cross-Device / Multi-User Consistency

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| SYNC-01 | Claim visible on a second device | Claim a shift on Device A; check Device B (already on the same staff page) without reloading | Updates within a few seconds, no manual refresh needed | P0 |
| SYNC-02 | Admin change visible to staff live | Change capacity as admin; check an already-open staff page | Reflects the new capacity without a reload | P0 |
| SYNC-03 | Two staff claim simultaneously (race) | Two people attempt to claim the last open slot at nearly the same time | Exactly one succeeds; the other sees a clear conflict message and the slot correctly shown as full, not a duplicate booking | P0 |
| SYNC-04 | Fresh browser, no local history | Open a staff or admin link in a browser/profile that has never touched this app before | Loads correctly from the database — proves it's not relying on any local cache | P0 |
| SYNC-05 | Offline write is reported, not silently lost | Disconnect network, attempt any admin change | A visible error appears; the change is not silently discarded as if it succeeded | P0 |

## 9. Messaging Truthfulness

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| MSG-01 | Connectivity badge reflects reality | Watch the header badge through a normal session, then simulate an offline write | Says "Synced" only after a real successful operation; reflects failure after one fails, not just missing config | P0 |
| MSG-02 | Demo banner matches the demo's actual data | Compare the landing page's demo description against the demo event's real, current config | Numbers match exactly, including after the demo has been modified from its original defaults | P1 |
| MSG-03 | No stale wording about login requirements | Read all copy referencing "no login," "no password," "zero signups" | Every such claim is scoped correctly to *staff* — none imply the admin/creation flow also needs no login | P0 |
| MSG-04 | Target hours copy matches its own computation | Compare the "Target: Xh per rep" text against total required hours ÷ roster size, computed independently | Matches | P1 |
| MSG-05 | Error messages are specific enough to act on | Trigger each distinct error state (event not found, database unreachable, wrong password, etc.) | Each produces a message that correctly identifies which of these happened — no generic catch-all that could mislead about the actual cause | P1 |

## 10. Edge Cases & Input Validation

| ID | Test | Steps | Expected Result | Priority |
|----|------|-------|------------------|----------|
| EDGE-01 | Extremely long event title | Attempt to enter a 300+ character title | Input stops accepting characters at 150 (the enforced limit); doesn't break layout anywhere it's displayed | P2 |
| EDGE-02 | Emoji / non-Latin text in names | Add a roster member with emoji or non-Latin-script name (e.g. Arabic, Japanese) | Displays correctly everywhere, including in exported ICS files | P1 |
| EDGE-03 | Very large roster (50+) | Add 50+ names via paste | UI remains usable; no obvious performance cliff; Zero Hours / Staffing lists remain scrollable and correct | P2 |
| EDGE-04 | Slot duration that doesn't evenly divide the daily window | Configure a daily window and duration where the last slot would run past the end time | The partial slot is not generated — the window ends cleanly at the last full slot | P1 |
| EDGE-05 | Same person on roster with duplicate names | Add two roster members with the identical name | Each is tracked independently (by internal ID), no cross-contamination of bookings/hours | P1 |
| EDGE-06 | Multiple rapid clicks on capacity stepper | Click "+" very rapidly several times | Final value is correct (no double-increments or dropped clicks from race conditions) | P2 |
| EDGE-07 | Every modal closes on Escape | Open each modal (release confirmation, sync/calendar, zero-hours drawer, share, admin slot inspector, add-my-name) and press Escape | Each closes without needing to click a button | P1 |
| EDGE-08 | Focus moves into a modal when it opens | Open each modal listed above, note where keyboard focus lands | Focus is inside the modal (on its most useful field if one has its own autofocus, otherwise the modal itself or its first control) — never left on whatever was focused before, behind the overlay | P1 |
