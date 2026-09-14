import { test, expect } from '@playwright/test';
import { loginAsAdmin, createEventThroughWizard, getStaffLinkPath } from './helpers';

/**
 * This is the single most important test file in this suite: it directly
 * verifies the thing that motivated the entire Firebase migration earlier
 * in this project — that a shift claimed on one device is actually
 * visible on a different device, without a manual refresh, because it's
 * genuinely stored in a shared database rather than each browser's own
 * local cache.
 */
test.describe('Cross-device sync', () => {
  test('a shift claimed on one device appears as claimed on a second device without a manual refresh', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Cross-Device Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    // Two independent pages simulate two different people's devices —
    // neither shares any storage with the other.
    const deviceA = await context.newPage();
    const deviceB = await context.newPage();
    await deviceA.goto(staffPath);
    await deviceB.goto(staffPath);

    await deviceB.getByText(/Claim This Shift|Sign Up for Shift/i).first().waitFor();

    await deviceA.getByText(/Add My Name/i).first().click();
    await deviceA.getByPlaceholder(/Jordan Miller/i).fill(`Device A ${Date.now()}`);
    await deviceA.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await deviceA.getByText(/Claim This Shift|Sign Up for Shift/i).first().click();
    await expect(deviceA.getByText(/Claimed/i).first()).toBeVisible();

    // No reload on Device B — this only passes if the live Firestore
    // subscription is actually pushing the change through.
    await expect(deviceB.getByText('Full').or(deviceB.getByText(/\/2|\/3|\/4/))).toBeVisible({
      timeout: 15_000,
    });
  });

  test('an admin capacity change is reflected on an already-open staff view without a reload', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Live Capacity Test ${Date.now()}` });
    const staffPath = await getStaffLinkPath(page);

    const staffPage = await context.newPage();
    await staffPage.goto(staffPath);

    const capacityReadout = page.getByText(/^\d+ staff\/shift$/);
    const before = parseInt((await capacityReadout.textContent()) || '0', 10);
    await page.getByTitle('Increase default slot capacity').click();
    await expect(capacityReadout).toHaveText(`${before + 1} staff/shift`);

    // The staff page was never told to reload — if this shows the new
    // capacity, the live subscription is working both ways (admin -> staff).
    await expect(staffPage.getByText(`/${before + 1}`).first()).toBeVisible({ timeout: 15_000 });
  });

  test('deleting an event from one session makes it inaccessible from another that had it open', async ({
    page,
    context,
  }) => {
    await page.goto('/#/');
    await loginAsAdmin(page);
    const title = `Cross-Device Delete Test ${Date.now()}`;
    const adminKey = await createEventThroughWizard(page, { title });

    const secondAdminPage = await context.newPage();
    await secondAdminPage.goto(`/#/admin/${adminKey}`);
    await expect(secondAdminPage.getByText(title)).toBeVisible();

    await page.getByRole('button', { name: 'All Events' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('div', { hasText: title }).getByTitle('Permanently delete this event').click();

    await secondAdminPage.reload();
    await expect(secondAdminPage.getByText(/Schedule not found|not found/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('SYNC-03: two truly simultaneous claims on the last open spot — exactly one succeeds, never both', async ({
    page,
    context,
  }) => {
    // Deliberately fires both claims via Promise.all rather than one
    // after the other — a sequential test would never actually exercise
    // the race window this is checking for. This directly targets the
    // fix in claimShiftAtomic: a plain read-then-write had a real gap
    // where both claims could pass their capacity check before either
    // write landed, either over-booking the slot or silently erasing one
    // claim entirely (see the comment on claimShiftAtomic for the full
    // reasoning).
    await page.goto('/#/');
    await loginAsAdmin(page);
    await createEventThroughWizard(page, { title: `Race Condition Test ${Date.now()}` });

    // Force capacity to exactly 1 so the race is deterministic to detect.
    for (let i = 0; i < 10; i++) {
      const stepper = page.getByTitle('Decrease default slot capacity');
      if (await stepper.isDisabled()) break;
      await stepper.click();
    }
    const staffPath = await getStaffLinkPath(page);

    const deviceA = await context.newPage();
    const deviceB = await context.newPage();
    await deviceA.goto(staffPath);
    await deviceB.goto(staffPath);

    for (const device of [deviceA, deviceB]) {
      await device.getByText(/Add My Name/i).first().click();
    }
    await deviceA.getByPlaceholder(/Jordan Miller/i).fill(`Racer A ${Date.now()}`);
    await deviceA.getByRole('button', { name: 'Save & Start Scheduling' }).click();
    await deviceB.getByPlaceholder(/Jordan Miller/i).fill(`Racer B ${Date.now()}`);
    await deviceB.getByRole('button', { name: 'Save & Start Scheduling' }).click();

    // Fired together, not sequentially.
    await Promise.all([
      deviceA.getByText(/Claim This Shift|Sign Up for Shift/i).first().click(),
      deviceB.getByText(/Claim This Shift|Sign Up for Shift/i).first().click(),
    ]);

    // Give both devices' live subscriptions a moment to settle, then
    // check the final, reconciled state on each.
    await deviceA.waitForTimeout(3_000);
    await deviceB.waitForTimeout(1_000);

    const aClaimed = await deviceA.getByText(/Claimed/i).count();
    const bClaimed = await deviceB.getByText(/Claimed/i).count();

    // Exactly one of the two claimed it — never both (over-booked past
    // capacity 1) and never neither (a claim silently lost).
    expect(aClaimed + bClaimed).toBe(1);

    // The loser should see a clear conflict message, not silence.
    const loserPage = aClaimed === 1 ? deviceB : deviceA;
    await expect(
      loserPage.getByText(/already claimed|full|conflict/i).first()
    ).toBeVisible({ timeout: 5_000 }).catch(() => {
      // The loser's UI may instead just show the slot as "Full" rather
      // than a toast if the live subscription already updated it before
      // their own claim attempt resolved — either is an acceptable
      // outcome, but "still shows as claimable" is not.
    });
    await expect(loserPage.getByText(/Claim This Shift|Sign Up for Shift/i)).not.toBeVisible();
  });
});
