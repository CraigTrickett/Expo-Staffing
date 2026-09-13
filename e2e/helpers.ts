import { Page, expect } from '@playwright/test';

/**
 * These tests assume two things are already true in whatever Firebase
 * project/emulator the app under test is pointed at:
 *   1. Firebase Auth has an Email/Password user matching E2E_ADMIN_EMAIL,
 *      with password E2E_ADMIN_PASSWORD, and that email is in
 *      ALLOWED_ADMIN_EMAILS (src/lib/firebase.ts).
 *   2. Firestore rules and Cloud Functions are deployed (or emulated)
 *      matching this repo's firestore.rules / functions/index.js.
 * See e2e/README.md for full setup.
 */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';

export function requireAdminCredentials() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set to run tests that require admin login. See e2e/README.md.'
    );
  }
}

/**
 * Logs in as the admin test account from whichever page currently shows
 * the login form (the wizard page and any #/admin/:key route both do,
 * when not authenticated).
 */
export async function loginAsAdmin(page: Page) {
  requireAdminCredentials();
  await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Successful login replaces the login form with real admin content —
  // wait for something that only renders once authenticated.
  await expect(page.getByRole('button', { name: /Log Out/i })).toBeVisible({ timeout: 10_000 });
}

/**
 * Creates a brand-new event through the wizard (must already be on the
 * wizard page and logged in) and returns the admin key it navigates to.
 */
export async function createEventThroughWizard(
  page: Page,
  opts: { title: string; rosterNames?: string[] }
): Promise<string> {
  await page.getByLabel(/Event & Booth Name/i).fill(opts.title);
  if (opts.rosterNames?.length) {
    await page.getByPlaceholder(/Paste staff names/i).fill(opts.rosterNames.join('\n'));
  }
  await page.getByRole('button', { name: 'Generate Event Schedule' }).click();

  await page.waitForURL(/#\/admin\//, { timeout: 15_000 });
  const url = page.url();
  const adminKey = url.split('#/admin/')[1];
  if (!adminKey) {
    throw new Error(`Expected to navigate to an admin URL after creating an event, got: ${url}`);
  }
  return adminKey;
}

/**
 * Reads the staff (public) link out of the admin header's own "Staff"
 * button, while viewing that event as admin. Returns the full #/event/...
 * hash path, ready to visit in any browser context — including a fresh,
 * unauthenticated one, since staff access never requires login.
 */
export async function getStaffLinkPath(page: Page): Promise<string> {
  const href = await page.getByRole('link', { name: 'Staff' }).getAttribute('href');
  if (!href) {
    throw new Error('Could not find the Staff link in the admin header.');
  }
  return href;
}
