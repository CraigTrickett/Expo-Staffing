import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard } from './helpers';

/**
 * These tests never touch Google's real OAuth consent screen — that's
 * covered separately in google-calendar-integration.spec.ts using a
 * pre-obtained refresh token, for the reasons explained in
 * e2e/google-calendar-helpers.ts. What's tested here is purely this
 * app's own code: does clicking "Connect" invoke Google Identity
 * Services correctly, and does the UI react correctly to what the
 * Cloud Function reports back — with both GIS itself and the Cloud
 * Function response faked, so these tests are fast and fully
 * deterministic.
 */
test.describe('Google Calendar connect UI (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Block the real Google Identity Services script so it can't race
    // with (and overwrite) the fake window.google this test installs.
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    );
  });

  test('clicking Connect invokes Google Identity Services with the correct scope, and a successful exchange flips the UI to Connected', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__requestedCodeConfig = null;
      (window as any).google = {
        accounts: {
          oauth2: {
            initCodeClient: (config: any) => {
              (window as any).__requestedCodeConfig = config;
              return {
                requestCode: () => {
                  // Simulate Google's popup completing successfully.
                  config.callback({ code: 'fake-test-authorization-code' });
                },
              };
            },
          },
        },
      };
    });

    // Fake a successful response from the real exchangeGoogleAuthCode
    // Cloud Function, so this test never needs a real Google token.
    await page.route('**/exchangeGoogleAuthCode', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { connected: true } }) })
    );

    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `GCal Mock Test ${Date.now()}` });

    await page.getByRole('button', { name: 'Connect Google Calendar' }).click();

    const requestedConfig = await page.evaluate(() => (window as any).__requestedCodeConfig);
    expect(requestedConfig.scope).toBe('https://www.googleapis.com/auth/calendar.events');
    expect(requestedConfig.access_type).toBe('offline');

    await expect(page.getByRole('button', { name: 'Connected' })).toBeVisible({ timeout: 10_000 });
  });

  test('a failed exchange leaves the UI showing Connect, with a clear error toast — not silently "Connected"', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initCodeClient: (config: any) => ({
              requestCode: () => config.callback({ code: 'fake-code' }),
            }),
          },
        },
      };
    });

    await page.route('**/exchangeGoogleAuthCode', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'internal' } }) })
    );

    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `GCal Mock Failure Test ${Date.now()}` });

    await page.getByRole('button', { name: 'Connect Google Calendar' }).click();

    await expect(page.getByText(/Connection Failed|Could not connect/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Connected' })).not.toBeVisible();
  });

  test('cancelling the Google consent popup leaves the UI unchanged, with no false "Connected" state', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initCodeClient: (config: any) => ({
              // Simulates the user closing the popup without granting access.
              requestCode: () => config.callback({ error: 'access_denied' }),
            }),
          },
        },
      };
    });

    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `GCal Mock Cancel Test ${Date.now()}` });

    await page.getByRole('button', { name: 'Connect Google Calendar' }).click();
    await expect(page.getByText(/cancelled or failed/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connected' })).not.toBeVisible();
  });
});
