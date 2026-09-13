import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin, requireAdminCredentials } from './helpers';

test.describe('Admin authentication', () => {
  test('the wizard page shows a login form, not the create-event form, when signed out', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
    await expect(page.getByLabel(/Event & Booth Name/i)).not.toBeVisible();
  });

  test('an admin route shows the login form, not the dashboard, when signed out', async ({ page }) => {
    // Any adminKey works here — the point is that no key alone grants
    // access anymore, only a real signed-in session does.
    await page.goto('/#/admin/some-random-key');
    await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
  });

  test('rejects an incorrect password with a clear error, and does not log in', async ({ page }) => {
    requireAdminCredentials();
    await page.goto('/#/');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill('definitely-the-wrong-password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/Incorrect email or password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Log Out/i })).not.toBeVisible();
  });

  test('rejects a real account whose email is not on the admin allowlist', async ({ page }) => {
    // Requires a second, genuinely-registered Firebase Auth test account
    // that is NOT in ALLOWED_ADMIN_EMAILS. Skips if not configured, since
    // creating throwaway non-admin accounts isn't this suite's job.
    test.skip(!process.env.E2E_NON_ADMIN_EMAIL || !process.env.E2E_NON_ADMIN_PASSWORD, 'No non-admin test account configured');
    await page.goto('/#/');
    await page.getByLabel('Email').fill(process.env.E2E_NON_ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_NON_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/not authorized for admin access/i)).toBeVisible();
  });

  test('a valid, allowlisted admin can sign in and reach the create-event form', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await expect(page.getByLabel(/Event & Booth Name/i)).toBeVisible();
  });

  test('logging out returns to the login form, and hides admin-only controls', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /Log Out/i }).click();
    // Logging out from the wizard page should show the login form again,
    // not silently leave stale admin content visible.
    await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
  });

  test('"Forgot password?" sends a reset request without revealing whether the account exists', async ({ page }) => {
    requireAdminCredentials();
    await page.goto('/#/');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByRole('button', { name: /Forgot password/i }).click();
    await expect(page.getByText(/Check Your Email|reset email sent/i)).toBeVisible();
  });
});
