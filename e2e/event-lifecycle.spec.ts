import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard } from './helpers';

test.describe('Event lifecycle', () => {
  test('an admin can create a new event, and it immediately appears with the entered name', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);

    const title = `E2E Test Event ${Date.now()}`;
    await createEventThroughWizard(page, { title, rosterNames: ['Alex Rep', 'Sam Staffer'] });

    await expect(page.getByText(title)).toBeVisible();
  });

  test('an admin can increase and decrease the default slot capacity, and it takes effect immediately', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `Capacity Test ${Date.now()}`;
    await createEventThroughWizard(page, { title });

    const capacityReadout = page.getByText(/^\d+ staff\/shift$/);
    const before = await capacityReadout.textContent();
    const beforeCount = parseInt(before || '0', 10);

    await page.getByTitle('Increase default slot capacity').click();
    await expect(capacityReadout).toHaveText(`${beforeCount + 1} staff/shift`);

    await page.getByTitle('Decrease default slot capacity').click();
    await expect(capacityReadout).toHaveText(`${beforeCount} staff/shift`);
  });

  test('an admin can add a roster member, and they appear in the Staffing tab', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Roster Test ${Date.now()}` });

    await page.getByRole('button', { name: 'Staffing' }).click();
    const newName = `Test Staffer ${Date.now()}`;
    await page.getByPlaceholder(/name/i).first().fill(newName);
    await page.getByRole('button', { name: /Add/i }).first().click();

    await expect(page.getByText(newName)).toBeVisible();
  });

  test('deleting an event requires confirmation and removes it from All Events', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `Delete Me ${Date.now()}`;
    await createEventThroughWizard(page, { title });

    await page.getByRole('button', { name: 'All Events' }).click();
    await expect(page.getByText(title)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page
      .locator('div', { hasText: title })
      .getByTitle('Permanently delete this event')
      .click();

    await expect(page.getByText(title)).not.toBeVisible();
  });

  test('cancelling the delete confirmation leaves the event untouched', async ({ page }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `Do Not Delete ${Date.now()}`;
    await createEventThroughWizard(page, { title });

    await page.getByRole('button', { name: 'All Events' }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .locator('div', { hasText: title })
      .getByTitle('Permanently delete this event')
      .click();

    // Still there after declining the confirmation.
    await expect(page.getByText(title)).toBeVisible();
  });
});
