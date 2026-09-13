import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard, getStaffLinkPath } from './helpers';

// Locks the browser to a known, non-UTC timezone so these tests actually
// exercise the timezone-conversion path (a UTC test browser would never
// reveal a conversion bug, since "no conversion" and "correct conversion"
// look identical when the offset is zero).
test.use({ timezoneId: 'America/Los_Angeles' });

test.describe('Calendar export correctness', () => {
  test('the downloaded ICS file is not simply the local wall-clock time with a "Z" appended', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `ICS Timezone Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);
    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill(`ICS Tester ${Date.now()}`);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();

    // Read the claimed slot's displayed local start time (e.g. "9:00 AM")
    // directly from the UI, so this test doesn't need to hardcode
    // whatever default start time the wizard happens to generate.
    const claimedTileText = await staffPage.getByText(/Claimed/i).first().locator('..').textContent();
    const localTimeMatch = claimedTileText?.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
    expect(localTimeMatch, 'Expected to find a displayed local start time on the claimed slot').toBeTruthy();

    await staffPage.getByRole('button', { name: 'Sync Calendar' }).click();
    const downloadPromise = staffPage.waitForEvent('download');
    await staffPage.getByRole('button', { name: 'Add to Calendar (.ICS)' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const icsContent = Buffer.concat(chunks).toString('utf-8');

    const dtStartMatch = icsContent.match(/DTSTART:(\d{8}T\d{6}Z)/);
    expect(dtStartMatch, 'Expected a DTSTART line in the downloaded ICS').toBeTruthy();

    // The old bug pattern: naive_local_time + "Z" with no real conversion.
    // In America/Los_Angeles (UTC-7 or -8), a correct conversion must add
    // 7-8 hours, so the UTC hour in DTSTART should differ from the local
    // hour shown in the UI.
    const [, localHourStr] = localTimeMatch!;
    const utcHourInIcs = dtStartMatch![1].slice(9, 11);
    expect(utcHourInIcs).not.toBe(localHourStr.padStart(2, '0'));
  });

  test('"Create Calendar Event" opens a Google Calendar link whose dates param is not the raw local time with a "Z" appended', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Google Calendar Link Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);
    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill(`Link Tester ${Date.now()}`);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();

    await staffPage.getByRole('button', { name: 'Sync Calendar' }).click();
    const popupPromise = staffPage.waitForEvent('popup');
    await staffPage.getByRole('button', { name: 'Create Calendar Event' }).first().click();
    const popup = await popupPromise;

    const popupUrl = popup.url();
    expect(popupUrl).toContain('calendar.google.com');
    const datesParam = new URL(popupUrl).searchParams.get('dates');
    expect(datesParam, 'Expected a dates= query param in the Google Calendar link').toBeTruthy();
    expect(datesParam).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
  });
});
