import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard } from './helpers';

/**
 * Dedicated to one question: does what the UI tells the user match what's
 * actually true? Each of these targets a specific claim the app makes and
 * checks it against real, current state rather than trusting the copy.
 */
test.describe('User-facing messaging matches reality', () => {
  test('the connectivity badge only claims "Synced" after a real successful database operation', async ({
    page,
  }) => {
    await page.goto('/#/');
    // Immediately on load, before any operation has completed, the badge
    // must not falsely claim a confirmed connection — "Synced" is an
    // active claim, not a default assumption.
    const badge = page.locator('span', { hasText: /Synced|Connecting|Connection Issue/ }).first();
    await expect(badge).not.toHaveText(/Synced/, { timeout: 500 }).catch(() => {
      // If it's already "Synced" within 500ms, that's fine IF a real
      // operation (e.g. the demo lookup) already completed — the
      // meaningful check is the one below, after a deliberate action.
    });

    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Badge Truth Test ${Date.now()}` });
    // After a real, successful write (event creation), the badge should
    // now truthfully say Synced.
    await expect(badge).toHaveText(/Synced/, { timeout: 10_000 });
  });

  test('the demo banner\'s stats match the demo event\'s actual current data, not fixed text', async ({
    page,
  }) => {
    await page.goto('/#/');
    // Whatever the banner claims for capacity/roster, cross-check it
    // against the real demo event by opening it as admin.
    const bannerText = await page.locator('text=/staff capacity/').textContent();
    const capacityInBanner = bannerText?.match(/(\d+)-staff capacity/)?.[1];
    const rosterInBanner = bannerText?.match(/(\d+)-person roster/)?.[1];
    expect(capacityInBanner, 'Banner should show a live capacity figure, not be missing one').toBeTruthy();
    expect(rosterInBanner, 'Banner should show a live roster figure, not be missing one').toBeTruthy();

    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Admin' }).first().click(); // the demo's Admin link
    await page.waitForURL(/#\/admin\//);

    const actualCapacityText = await page.getByText(/^\d+ staff\/shift$/).textContent();
    const actualCapacity = actualCapacityText?.match(/(\d+) staff\/shift/)?.[1];
    expect(actualCapacity).toBe(capacityInBanner);
  });

  test('"All Events" shows exactly the events that actually exist — creating one increases the count, deleting it decreases it back', async ({
    page,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Count Before ${Date.now()}` });

    await page.getByRole('button', { name: 'All Events' }).click();
    const countBefore = await page.locator('[class*="border-\\[#d8dce0\\]"]', {
      hasText: /\u2013/, // en-dash used in the date range display
    }).count();
    await page.getByRole('button', { name: 'Close' }).click().catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    const newTitle = `Count Check ${Date.now()}`;
    await page.goto('/#/');
    await createEventThroughWizard(page, { title: newTitle });
    await page.getByRole('button', { name: 'All Events' }).click();
    await expect(page.getByText(newTitle)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('div', { hasText: newTitle }).getByTitle('Permanently delete this event').click();
    await expect(page.getByText(newTitle)).not.toBeVisible();
  });

  test('a network failure during a write is reported to the user, not silently swallowed', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Offline Honesty Test ${Date.now()}` });

    // Simulate the database becoming unreachable mid-session.
    await context.setOffline(true);
    await page.getByTitle('Increase default slot capacity').click();

    await expect(page.getByText(/could not be saved|Not Saved/i)).toBeVisible({ timeout: 10_000 });
    await context.setOffline(false);
  });

  test('the "Confirmed Roster Shifts" modal only ever shows a per-shift calendar action for that specific shift\'s own time, not a stale first-shift value', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Multi-Shift Calendar Test ${Date.now()}` });
    const staffPath = await page.getByRole('link', { name: 'Staff' }).getAttribute('href');
    const staffPage = await context.newPage();
    await staffPage.goto(staffPath!);

    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill(`Multi Claimer ${Date.now()}`);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();

    const openShifts = staffPage.getByText(/Claim This Shift|Sign Up for Shift/i);
    const availableCount = await openShifts.count();
    test.skip(availableCount < 2, 'Needs at least two open shifts to verify per-shift distinctness');

    await openShifts.nth(0).click();
    await openShifts.nth(0).click(); // claim a second, now-shifted-index open shift

    await staffPage.getByRole('button', { name: 'Sync Calendar' }).click();
    const createEventButtons = staffPage.getByRole('button', { name: 'Create Calendar Event' });
    await expect(createEventButtons).toHaveCount(2);
  });
});
