import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard, getStaffLinkPath } from './helpers';

test.describe('Staff shift claiming (no login required)', () => {
  test('the staff view never shows a login form or admin-only controls', async ({ page, context }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Staff Access Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    // Fresh, unauthenticated context — simulates a staff member who has
    // never logged in and never will.
    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);

    await expect(staffPage.getByRole('heading', { name: 'Admin Sign In' })).not.toBeVisible();
    await expect(staffPage.getByRole('button', { name: 'All Events' })).not.toBeVisible();
    await expect(staffPage.getByRole('button', { name: /Log Out/i })).not.toBeVisible();
  });

  test('a new staff member can add themselves and claim an open shift', async ({ page, context }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Claim Flow Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);

    await staffPage.getByText(/Add My Name/i).first().click();
    const staffName = `E2E Staffer ${Date.now()}`;
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill(staffName);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();

    // Claim the first open shift found.
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();

    await expect(staffPage.getByText(/Claimed/i).first()).toBeVisible();
  });

  test('a claimed shift can be released, freeing it back up', async ({ page, context }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Release Flow Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);
    await staffPage.getByText(/Add My Name/i).first().click();
    await staffPage.getByPlaceholder(/Jordan Miller/i).fill(`Release Tester ${Date.now()}`);
    await staffPage.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();
    await expect(staffPage.getByText(/Claimed/i).first()).toBeVisible();

    await staffPage.getByText(/Claimed/i).first().click();
    // Releasing goes through a confirmation modal in this app.
    await staffPage.getByRole('button', { name: 'Release' }).click();

    await expect(staffPage.getByText(/Claim This Shift|Sign Up for Shift/i).first()).toBeVisible();
  });

  test('a fully booked shift cannot be claimed by a second staff member', async ({ page, context }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    // Capacity 1 makes this deterministic: one claim fills the slot.
    await createEventThroughWizard(page, { title: `Capacity One Test ${Date.now()}` });
    // Repeatedly decrease until capacity is 1 (the button disables itself
    // at the floor, so this is safe regardless of the starting default).
    for (let i = 0; i < 10; i++) {
      const stepper = page.getByTitle('Decrease default slot capacity');
      if (await stepper.isDisabled()) break;
      await stepper.click();
    }
    const staffPath = await getStaffLinkPath(page);

    const staffPageA = await context.newPage();
    await staffPageA.goto(staffPath);
    await staffPageA.getByText(/Add My Name/i).first().click();
    await staffPageA.getByPlaceholder(/Jordan Miller/i).fill(`Staffer A ${Date.now()}`);
    await staffPageA.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await staffPageA.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();

    const staffPageB = await context.newPage();
    await staffPageB.goto(staffPath);
    await staffPageB.reload(); // pick up Staffer A's claim via live sync
    await expect(staffPageB.getByText('Full').first()).toBeVisible({ timeout: 10_000 });
  });
});
