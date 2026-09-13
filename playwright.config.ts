import { defineConfig, devices } from '@playwright/test';

/**
 * These tests exercise the real app against a real (or emulated) Firebase
 * backend — there's no mocking layer, since the whole point of this suite
 * is to catch the class of bug this app has actually had (data silently
 * not syncing, timezone-wrong calendar invites, auth gaps).
 *
 * Requires:
 *   - The dev server running (see webServer below), pointed at either
 *     the Firebase Emulator Suite or a real test project — see
 *     e2e/README.md for setup.
 *   - Two admin test accounts already created in Firebase Auth matching
 *     ALLOWED_ADMIN_EMAILS, with known passwords supplied via
 *     E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share one Firestore project; avoid cross-test data races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
