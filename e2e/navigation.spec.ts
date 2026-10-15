import { test, expect } from '@playwright/test';
import { createEventThroughWizard, getStaffLinkPath, loginAsAdmin, requireAdminCredentials } from './helpers';

// Not run where it was written (no browser). Run with: npm run test:e2e

test.describe('Menu, pages and the open staff page', () => {
  test('every menu page asks for a sign-in, and shows nothing else', async ({ page }) => {
    for (const hash of ['#/', '#/events', '#/new', '#/users']) {
      await page.goto(`/${hash}`);
      await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Menu' })).not.toBeVisible();
    }
  });

  test('the staff link opens for someone who is not signed in, and shows only Staff in the header', async ({ page, browser }) => {
    requireAdminCredentials();
    await page.goto('/#/new');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Open staff page ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    const staff = await (await browser.newContext()).newPage();
    await staff.goto(`/${staffPath}`);
    await expect(staff.getByRole('heading', { name: 'Admin Sign In' })).not.toBeVisible();
    await expect(staff.getByRole('link', { name: 'Staff' })).toBeVisible();
    await expect(staff.getByRole('link', { name: 'Admin' })).not.toBeVisible();
    await expect(staff.getByRole('link', { name: 'Menu' })).not.toBeVisible();
  });

  test('Admin and Staff appear in the header only on the expo floor', async ({ page }) => {
    requireAdminCredentials();
    await page.goto('/#/new');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Header rules ${Date.now()}` });
    // On the expo floor (the admin shift matrix) both are there.
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Staff' })).toBeVisible();
    // On the menu they are not, and a burger links to it.
    await page.getByRole('link', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: 'Admin' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Staff' })).not.toBeVisible();
    await expect(page.getByText('Menu', { exact: true })).not.toBeVisible();
  });

  test('an area opens as its own page, and the back arrow returns to the menu', async ({ page }) => {
    requireAdminCredentials();
    await page.goto('/#/new');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Area pages ${Date.now()}` });
    await page.getByRole('link', { name: 'Menu' }).click();
    await page.getByRole('link', { name: /^Budget/ }).click();
    await expect(page).toHaveURL(/#\/hub\/[^/]+\/budget$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Back to menu' }).first().click();
    await expect(page).toHaveURL(/#\/hub\/[^/]+$/);
  });
});
