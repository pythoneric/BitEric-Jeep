import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab, useOilTemplate } from './helpers.js';

test('can add a maintenance entry and see it in the history', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await expect(page.locator('#maintenanceList')).toContainText('Oil change');
  await expect(page.locator('#maintenanceList')).toContainText('10000 mi');
});

test('Quick Templates prefill type and intervals', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await useOilTemplate(page);
  await expect(page.locator('#mType')).toHaveValue('Oil change');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('5000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('6');
});

test('"Specify if Other" field is hidden unless Other selected', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mOtherType')).toBeHidden();
  await page.selectOption('#mType', 'Other');
  await expect(page.locator('#mOtherType')).toBeVisible();
  await page.selectOption('#mType', 'Oil change');
  await expect(page.locator('#mOtherType')).toBeHidden();
});

test('date + odometer auto-fill when tab opens', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mDate')).not.toHaveValue('');
  // Demo Gladiator odometer is 15200
  await expect(page.locator('#mOdometer')).toHaveValue('15200');
});

test('can edit a maintenance entry inline', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  await page.locator('#maintenanceList .edit-btn').first().click();
  await expect(page.locator('#maintenanceForm .edit-banner')).toBeVisible();
  await page.fill('#mNotes', 'EDITED BY TEST');
  await page.click('#maintenanceForm button[type="submit"]');
  await expect(page.locator('#maintenanceList')).toContainText('EDITED BY TEST');
  await expect(page.locator('#maintenanceForm .edit-banner')).toHaveCount(0);
});

test('Escape cancels maintenance edit mode', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  await page.locator('#maintenanceList .edit-btn').first().click();
  await expect(page.locator('#maintenanceForm .edit-banner')).toBeVisible();
  await page.locator('#maintenanceList').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('Escape');
  await expect(page.locator('#maintenanceForm .edit-banner')).toHaveCount(0);
});

test('can delete a maintenance entry and undo via toast', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  page.on('dialog', (d) => d.accept());
  const before = await page.locator('#maintenanceList li').count();
  await page.locator('#maintenanceList .del-btn').first().click();
  await expect(page.locator('#maintenanceList li')).toHaveCount(before - 1);
  await expect(page.locator('#toast:not(.hidden)')).toHaveCount(1);
  await page.click('#toastAction');
  await expect(page.locator('#maintenanceList li')).toHaveCount(before);
});

test('search filters the maintenance history', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  // Demo seeds 10 maintenance entries — wait for the list to finish populating
  // (loadMaintenance now also renders a reminder-status chart on the side)
  // before we start measuring filter effects.
  const allRows = page.locator('#maintenanceList li');
  await expect(allRows).toHaveCount(10);
  await page.fill('#maintenanceSearch', 'oil');
  // Three demo entries contain "Oil change" — two Oil change + one Oil-filter
  // row if we had it; here the demo has exactly two "Oil change" rows.
  const filtered = page.locator('#maintenanceList li');
  await expect(filtered).toHaveCount(2);
  await page.fill('#maintenanceSearch', 'xyzNOMATCH');
  await expect(page.locator('#maintenanceList .empty-state')).toBeVisible();
});

test('odometer regression warns with confirm dialog', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  await page.fill('#mOdometer', '1'); // way below demo max of 16200
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await page.waitForTimeout(500); // let confirm() dialog propagate
  expect(dialogs.some((d) => /lower than a previous entry/i.test(d))).toBe(true);
});

test('saving a higher odometer bumps the vehicle odometer', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2026-01-01');
  await page.fill('#mOdometer', '99999');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleCard')).toContainText('99999 mi');
});

test('duplicate entry warns before saving', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await expect(page.locator('#maintenanceList')).toContainText('Oil change');

  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '10020');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await page.waitForTimeout(500);
  expect(dialogs.some((d) => /similar entry/i.test(d))).toBe(true);
});

test('print service report opens a new window with totals', async ({ page, context }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  const [report] = await Promise.all([context.waitForEvent('page'), page.click('#reportBtn')]);
  await expect(report.locator('h1')).toContainText(/Service History|Historial/);
  await expect(report.locator('h2').first()).toBeVisible();
  await report.close();
});

// --- Engine-aware template intervals (3.6L Pentastar, 3.8L V6 JK, EcoDiesel, 2.0L Turbo) ---

async function setActiveEngine(page, value) {
  await switchTab(page, 'settings');
  // The engine select lives inside a collapsed <details class="drivetrain-details">;
  // Playwright treats hidden options as not-visible, so open the disclosure first.
  await page.evaluate(() => {
    const d = document.querySelector('#editVehicleForm .drivetrain-details');
    if (d) d.open = true;
  });
  await page.selectOption('#eEngine', value);
  await page.click('#editVehicleForm button[type="submit"]');
}

test('spark plug template is 100k for 3.6L Pentastar (JL/JT)', async ({ page }) => {
  await startFresh(page);
  await setActiveEngine(page, '3.6L Pentastar');
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'sparkPlugs');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('100000');
});

test('spark plug template is 30k for 3.8L V6 (JK)', async ({ page }) => {
  await startFresh(page);
  await setActiveEngine(page, '3.8L V6 (JK)');
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'sparkPlugs');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('30000');
});

test('spark plug template yields empty intervals for 3.0L EcoDiesel (no plugs)', async ({ page }) => {
  await loadDemoTruck(page); // Demo truck is EcoDiesel
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'sparkPlugs');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('');
});

test('coolant template is 150k/120mo for 3.6L Pentastar', async ({ page }) => {
  await startFresh(page);
  await setActiveEngine(page, '3.6L Pentastar');
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'coolant');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('150000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('120');
});

test('coolant template is 100k/60mo for 3.8L V6 JK (HOAT)', async ({ page }) => {
  await startFresh(page);
  await setActiveEngine(page, '3.8L V6 (JK)');
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'coolant');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('100000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('60');
});

test('oil template is 10k/12mo for EcoDiesel (not 5k/6mo)', async ({ page }) => {
  await startFresh(page);
  await setActiveEngine(page, '3.0L EcoDiesel');
  // startFresh vehicle has no severeService, so halving doesn't kick in —
  // this isolates the engine-aware part. (Demo truck is EcoDiesel + severe,
  // which lands at 5000/6 by design — covered elsewhere.)
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'oil');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('10000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('12');
});

test('engine hint shows detected engine on demo truck (EcoDiesel)', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  await expect(page.locator('#engineHint')).toContainText(/3\.0L EcoDiesel/);
});

test('engine hint nudges user when engine is not set', async ({ page }) => {
  await startFresh(page); // Test Rig has no engine selected
  await switchTab(page, 'maintenance');
  await expect(page.locator('#engineHint')).toHaveClass(/unknown/);
  await expect(page.locator('#engineHint')).toContainText(/Pentastar|3\.6L/);
});

// --- New Jeep-specific templates ---

test('death-wobble steering inspection template populates correctly', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'steeringInspect');
  await expect(page.locator('#mType')).toHaveValue('Steering inspection');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('10000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('12');
});

test('Pentastar-only oil-cooler template populates 60k/60mo', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'oilCooler');
  await expect(page.locator('#mType')).toHaveValue('Oil cooler / housing inspect');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('60000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('60');
});

test('TPMS battery template is time-only (120 mo, no miles)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'tpmsBattery');
  await expect(page.locator('#mType')).toHaveValue('TPMS sensor');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('120');
});

test('brake caliper slides template populates correctly', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'brakeCaliperSlides');
  await expect(page.locator('#mType')).toHaveValue('Brake caliper slide lube');
  await expect(page.locator('#mIntervalMiles')).toHaveValue('30000');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('24');
});

// --- Follow-up reminder spawning ---

test('Re-torque lug nuts follow-up spawns a child entry dated to the parent service', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Tire rotation');
  await page.fill('#mCost', '0');
  await page.evaluate(() => (document.querySelector('.followup-details').open = true));
  await page.check('#mFollowUpRetorque');
  await page.click('#maintenanceForm button[type="submit"]');
  // The list should show the parent + a child "Wheel re-torque" entry
  // sharing the parent's date (NOT today's date) and nextDueMiles = 10050.
  await expect(page.locator('#maintenanceList li')).toHaveCount(2);
  const childRow = page.locator('#maintenanceList li', { hasText: 'Wheel re-torque' });
  await expect(childRow).toHaveCount(1);
  await expect(childRow).toContainText('2024-05-01');
  await expect(childRow).toContainText('10000 mi');
  // Verify the spawned entry carries the i18n'd auto-schedule note, not raw English.
  await expect(childRow).toContainText(/Auto-scheduled after service|Agendado automáticamente/);
});

// --- Bug fixes ---

test('duplicate detection is case-insensitive on Other-typed entries', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Other');
  await page.fill('#mOtherType', 'Transfer case drop');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await expect(page.locator('#maintenanceList')).toContainText('Transfer case drop');

  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '10020');
  await page.selectOption('#mType', 'Other');
  await page.fill('#mOtherType', 'transfer case DROP'); // different case
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((d) => /similar entry/i.test(d))).toBe(true);
});

test('measurement fields round-trip through edit mode', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-06-01');
  await page.fill('#mOdometer', '15000');
  await page.selectOption('#mType', 'Brake pads');
  await page.fill('#mCost', '180');
  await page.evaluate(() => (document.querySelector('.measurements-details').open = true));
  await page.fill('#mPadFront', '6.5');
  await page.fill('#mPadRear', '7');
  await page.fill('#mTreadFL', '8');
  await page.fill('#mDotDate', '3422');
  await page.click('#maintenanceForm button[type="submit"]');

  await page.locator('#maintenanceList .edit-btn').first().click();
  await expect(page.locator('#mPadFront')).toHaveValue('6.5');
  await expect(page.locator('#mPadRear')).toHaveValue('7');
  await expect(page.locator('#mTreadFL')).toHaveValue('8');
  await expect(page.locator('#mDotDate')).toHaveValue('3422');
});

test('service report surfaces the selected currency symbol', async ({ page, context }) => {
  await startFresh(page, { currency: 'DOP' });
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-06-01');
  await page.fill('#mOdometer', '15000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '3500');
  await page.click('#maintenanceForm button[type="submit"]');
  const [report] = await Promise.all([context.waitForEvent('page'), page.click('#reportBtn')]);
  // Maintenance row in the report should carry the RD$ prefix on its cost cell.
  await expect(report.locator('table').first()).toContainText('RD$3500.00');
  // And the Maintenance total-box should say RD$3500.00, not $3500.00.
  await expect(report.locator('.total-box').first()).toContainText('RD$3500.00');
  await report.close();
});
