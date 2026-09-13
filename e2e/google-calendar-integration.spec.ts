import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard, getStaffLinkPath } from './helpers';
import {
  hasGoogleCalendarTestConfig,
  seedGoogleCalendarToken,
  removeGoogleCalendarToken,
  findCalendarEventBySummary,
  waitForCalendarEventGone,
} from './google-calendar-helpers';

/**
 * Verifies the actual, real Google Calendar API behavior — that claiming
 * a shift really creates a calendar event at the correct time, and
 * releasing it really cancels that invite. This deliberately never
 * automates Google's consent screen (see google-calendar-helpers.ts for
 * why); it seeds a pre-obtained refresh token directly into Firestore
 * and then checks the *real* Calendar API from the test itself.
 *
 * Requires (see e2e/README.md):
 *   E2E_GOOGLE_TEST_REFRESH_TOKEN, E2E_GOOGLE_TEST_EMAIL,
 *   E2E_GOOGLE_OAUTH_CLIENT_ID, E2E_GOOGLE_OAUTH_CLIENT_SECRET,
 *   E2E_FIREBASE_SERVICE_ACCOUNT_PATH
 * All tests in this file are skipped if these aren't set, rather than
 * failing — this is the one part of the suite that needs meaningfully
 * more setup than everything else.
 */
test.describe('Google Calendar real integration', () => {
  test.skip(!hasGoogleCalendarTestConfig(), 'Google Calendar integration test credentials not configured — see e2e/README.md');

  test('claiming a shift creates a real calendar event at the correct time, with the staff member invited', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `GCal Real Test ${Date.now()}`;
    const adminKey = await createEventThroughWizard(page, { title });

    await seedGoogleCalendarToken(adminKey);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Connected' })).toBeVisible({ timeout: 10_000 });

    const staffPath = await getStaffLinkPath(page);
    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);
    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill('E2E Calendar Tester');
    await staffPage.getByPlaceholder(/jordan@company.com/i).fill(process.env.E2E_GOOGLE_TEST_EMAIL!);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();

    const expectedSummary = `Expo Staffing: ${title}`;
    const calendarEvent = await findCalendarEventBySummary(expectedSummary);

    expect(calendarEvent, 'Expected a real Google Calendar event to be created after claiming a shift').toBeTruthy();
    expect(calendarEvent!.attendees?.some((a) => a.email === process.env.E2E_GOOGLE_TEST_EMAIL)).toBe(true);

    await removeGoogleCalendarToken(adminKey);
  });

  test('releasing a shift cancels its real calendar invite', async ({ page, context }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `GCal Release Test ${Date.now()}`;
    const adminKey = await createEventThroughWizard(page, { title });
    await seedGoogleCalendarToken(adminKey);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Connected' })).toBeVisible({ timeout: 10_000 });

    const staffPath = await getStaffLinkPath(page);
    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);
    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill('E2E Release Tester');
    await staffPage.getByPlaceholder(/jordan@company.com/i).fill(process.env.E2E_GOOGLE_TEST_EMAIL!);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();

    const expectedSummary = `Expo Staffing: ${title}`;
    const created = await findCalendarEventBySummary(expectedSummary);
    expect(created, 'Precondition: the invite must exist before we can test it being cancelled').toBeTruthy();

    await staffPage.getByText(/Claimed/i).first().click();
    await staffPage.getByRole('button', { name: 'Release' }).click();

    const stillGone = await waitForCalendarEventGone(expectedSummary);
    expect(stillGone, 'Expected the calendar event to be cancelled after releasing the shift').toBe(true);

    await removeGoogleCalendarToken(adminKey);
  });

  test('a staff member with no email produces no calendar invite attempt (and no error)', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `GCal No Email Test ${Date.now()}`;
    const adminKey = await createEventThroughWizard(page, { title });
    await seedGoogleCalendarToken(adminKey);
    await page.reload();

    const staffPath = await getStaffLinkPath(page);
    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);
    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill('No Email Tester');
    // Deliberately leave the email field blank.
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();
    await expect(staffPage.getByText(/Claimed/i).first()).toBeVisible();

    // No error should surface to the staff member even though no invite
    // is possible for them.
    await expect(staffPage.getByText(/error|failed/i)).not.toBeVisible();

    const found = await findCalendarEventBySummary(`Expo Staffing: ${title}`, { timeoutMs: 5_000 });
    expect(found).toBeNull();

    await removeGoogleCalendarToken(adminKey);
  });
});
