import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab } from './helpers.js';

test('can add a mod entry', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '12000');
  await page.selectOption('#modCategory', 'Suspension');
  await page.fill('#modPart', 'Lift Kit');
  await page.fill('#modBrand', 'Rubicon Express');
  await page.fill('#modCost', '1000');
  await page.click('#modsForm button[type="submit"]');
  await expect(page.locator('#modsList')).toContainText('Lift Kit');
  await expect(page.locator('#modsList')).toContainText('12000 mi');
});

test('Shop toggle replaces the old Installed By text field', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  // modShop checkbox exists, legacy #modInstalledBy does not
  await expect(page.locator('#modShop')).toHaveCount(1);
  await expect(page.locator('#modInstalledBy')).toHaveCount(0);
});

test('Removed-on date appears only when "Still Installed" is unchecked', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await expect(page.locator('#modRemovedDate')).toBeHidden();
  await page.uncheck('#modInstalled');
  await expect(page.locator('#modRemovedDate')).toBeVisible();
  // Auto-populated to today when first shown
  await expect(page.locator('#modRemovedDate')).not.toHaveValue('');
  await page.check('#modInstalled');
  await expect(page.locator('#modRemovedDate')).toBeHidden();
});

test('mods list groups by category and shows totals', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'mods');
  // Demo has Suspension, Tires/Wheels, Armor, Lighting, Recovery, Interior, Electrical
  await expect(page.locator('#modsList h3').first()).toBeVisible();
  await expect(page.locator('#modsList')).toContainText(/Total: \$/);
});

test('mods search filters and shows empty state on no match', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'mods');
  await page.fill('#modsSearch', 'lift');
  await expect(page.locator('#modsList')).toContainText(/lift/i);
  await page.fill('#modsSearch', 'xyzNOMATCH');
  await expect(page.locator('#modsList .empty-state')).toBeVisible();
});

test('can edit a mod entry', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'mods');
  await page.locator('#modsList .edit-btn').first().click();
  await expect(page.locator('#modsForm .edit-banner')).toBeVisible();
  await page.fill('#modNotes', 'EDITED_NOTES');
  await page.click('#modsForm button[type="submit"]');
  await expect(page.locator('#modsList')).toContainText(/Lift Kit|Tires|LED|Winch/); // still there
});

test('can delete a mod (with undo)', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'mods');
  page.on('dialog', (d) => d.accept());
  const before = await page.locator('#modsList .del-btn').count();
  await page.locator('#modsList .del-btn').first().click();
  await expect(page.locator('#modsList .del-btn')).toHaveCount(before - 1);
  await page.click('#toastAction');
  await expect(page.locator('#modsList .del-btn')).toHaveCount(before);
});

// --- Odometer + date validation ---

test('mod form blocks submit when odometer is missing', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-01-01');
  await page.selectOption('#modCategory', 'Suspension');
  await page.fill('#modPart', 'Lift Kit');
  await page.fill('#modCost', '1000');
  // Intentionally skip #modOdometer — required HTML validation should block.
  await page.click('#modsForm button[type="submit"]');
  // List still empty-state.
  await expect(page.locator('#modsList .empty-state')).toBeVisible();
});

test('modDate and modRemovedDate max is today (no future dates)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  // The form caps date pickers at the browser's LOCAL today — use the same
  // basis to avoid a UTC/local mismatch at test time.
  const today = await page.evaluate(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  await expect(page.locator('#modDate')).toHaveAttribute('max', today);
  await page.uncheck('#modInstalled');
  await expect(page.locator('#modRemovedDate')).toHaveAttribute('max', today);
});

// --- Category-aware follow-ups ---

test('Suspension shows lift/alignment/death-wobble follow-ups only', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.selectOption('#modCategory', 'Suspension');
  await page.evaluate(() => (document.getElementById('modFollowUpDetails').open = true));
  await expect(page.locator('label:has(#modFollowUpAlignment)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpLift)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpDeathWobble)')).toBeVisible();
  // Tires/Wheels-only options stay hidden on Suspension.
  await expect(page.locator('label:has(#modFollowUpWheelRetorque)')).toBeHidden();
  await expect(page.locator('label:has(#modFollowUpTpms)')).toBeHidden();
  await expect(page.locator('label:has(#modFollowUpGearBreakIn)')).toBeHidden();
});

test('Tires/Wheels shows wheel re-torque + TPMS + alignment (but not lift)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.selectOption('#modCategory', 'Tires/Wheels');
  await page.evaluate(() => (document.getElementById('modFollowUpDetails').open = true));
  await expect(page.locator('label:has(#modFollowUpWheelRetorque)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpTpms)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpAlignment)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpLift)')).toBeHidden();
});

test('Bumper hides the whole follow-up section (nothing applicable)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.selectOption('#modCategory', 'Bumper');
  await expect(page.locator('#modFollowUpDetails')).toBeHidden();
});

test('Gearing / Lockers shows gear break-in + diff fluid + death-wobble', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.selectOption('#modCategory', 'Gearing / Lockers');
  await page.evaluate(() => (document.getElementById('modFollowUpDetails').open = true));
  await expect(page.locator('label:has(#modFollowUpGearBreakIn)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpDiffFluid)')).toBeVisible();
  await expect(page.locator('label:has(#modFollowUpDeathWobble)')).toBeVisible();
});

// --- Follow-up spawning uses mod date + install odometer ---

test('mod follow-up spawns a child entry at mod date + install odo (not today)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2023-06-01');
  await page.fill('#modOdometer', '8000');
  await page.selectOption('#modCategory', 'Tires/Wheels');
  await page.fill('#modPart', 'All-Terrain 33" Tires');
  await page.fill('#modCost', '1200');
  await page.evaluate(() => (document.getElementById('modFollowUpDetails').open = true));
  await page.check('#modFollowUpWheelRetorque');
  await page.click('#modsForm button[type="submit"]');

  // Spawned child should be visible on the Maintenance tab at the mod's date
  // with the mod's install odometer as its anchor and nextDueMiles = 8050.
  await switchTab(page, 'maintenance');
  const child = page.locator('#maintenanceList li', { hasText: 'Wheel re-torque' });
  await expect(child).toHaveCount(1);
  await expect(child).toContainText('2023-06-01');
  await expect(child).toContainText('8000 mi');
  // Uses i18n'd auto-schedule note, not hardcoded English.
  await expect(child).toContainText(/Auto-scheduled after service|Agendado automáticamente/);
});

// --- Tire/regear soft warning ---

test('35" tires on stock-ish gears (3.45) triggers the regear warning', async ({ page }) => {
  await startFresh(page);
  // Set axleRatio to 3.45 via Edit Active Vehicle form (drivetrain-details is collapsed).
  await switchTab(page, 'settings');
  await page.evaluate(() => {
    const d = document.querySelector('#editVehicleForm .drivetrain-details');
    if (d) d.open = true;
  });
  await page.fill('#eAxleRatio', '3.45');
  await page.click('#editVehicleForm button[type="submit"]');
  // Now log 35" tires.
  await switchTab(page, 'mods');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '15000');
  await page.selectOption('#modCategory', 'Tires/Wheels');
  await page.fill('#modPart', 'Nitto Ridge Grappler 35x12.50R17');
  await page.fill('#modCost', '1800');
  await page.click('#modsForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /regear|4\.56|4\.88/i.test(m))).toBe(true);
});

test('35" tires with no axleRatio set fires the no-ratio regear warning', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '15000');
  await page.selectOption('#modCategory', 'Tires/Wheels');
  await page.fill('#modPart', 'BFG KO2 35x12.50R17');
  await page.fill('#modCost', '1500');
  await page.click('#modsForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /regear|axleRatio|4\.56/i.test(m))).toBe(true);
});

test('35" tires on 4.88 gears does NOT trigger a regear warning', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.evaluate(() => {
    const d = document.querySelector('#editVehicleForm .drivetrain-details');
    if (d) d.open = true;
  });
  await page.fill('#eAxleRatio', '4.88');
  await page.click('#editVehicleForm button[type="submit"]');
  await switchTab(page, 'mods');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '15000');
  await page.selectOption('#modCategory', 'Tires/Wheels');
  await page.fill('#modPart', '35" All-Terrain');
  await page.fill('#modCost', '1500');
  await page.click('#modsForm button[type="submit"]');
  await expect(page.locator('#modsList')).toContainText(/35/);
  expect(dialogs.length).toBe(0);
});

// --- Duplicate mod detection ---

test('duplicate mod on same date + category + part warns', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-03-15');
  await page.fill('#modOdometer', '14000');
  await page.selectOption('#modCategory', 'Lighting');
  await page.fill('#modPart', 'Roof Light Bar');
  await page.fill('#modCost', '400');
  await page.click('#modsForm button[type="submit"]');
  await expect(page.locator('#modDate')).toHaveValue('');
  await expect(page.locator('#modsList')).toContainText('Roof Light Bar');

  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#modDate', '2024-03-15');
  await page.fill('#modOdometer', '14001');
  await page.selectOption('#modCategory', 'Lighting');
  await page.fill('#modPart', 'roof light bar'); // different case — still a dupe
  await page.fill('#modCost', '400');
  await page.click('#modsForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /similar mod|mod similar|already exists|ya existe/i.test(m))).toBe(true);
});

// --- Removal reason round-trip ---

test('removal reason persists through edit', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '12000');
  await page.selectOption('#modCategory', 'Lighting');
  await page.fill('#modPart', 'Temp lightbar');
  await page.fill('#modCost', '200');
  await page.uncheck('#modInstalled');
  await expect(page.locator('#modRemovalReason')).toBeVisible();
  await page.fill('#modRemovalReason', 'Upgraded to Baja Designs');
  await page.click('#modsForm button[type="submit"]');
  await expect(page.locator('#modDate')).toHaveValue('');
  await expect(page.locator('#modsList')).toContainText('Upgraded to Baja Designs');

  await page.locator('#modsList .edit-btn').first().click();
  await expect(page.locator('#modRemovalReason')).toHaveValue('Upgraded to Baja Designs');
});

// --- i18n sanity ---

test('removed mod without a removed-on date uses the i18n (Removed) label', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '12000');
  await page.selectOption('#modCategory', 'Interior');
  await page.fill('#modPart', 'Cheap Floor Mat');
  await page.fill('#modCost', '40');
  // Uncheck to uninstall, but clear the auto-populated removed date.
  await page.uncheck('#modInstalled');
  await page.fill('#modRemovedDate', '');
  await page.click('#modsForm button[type="submit"]');
  await expect(page.locator('#modsList')).toContainText(/\(Removed\)/);
  await page.click('#langToggle');
  await expect(page.locator('#modsList')).toContainText(/\(Removido\)/);
});

test('mods Total: label translates on language toggle', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'mods');
  await expect(page.locator('#modsList p').first()).toContainText(/^Total:/);
  await page.click('#langToggle');
  await expect(page.locator('#modsList p').first()).toContainText(/^Total:/); // EN+ES both 'Total'
});

test('new Jeep-specific categories are available', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  const values = await page.locator('#modCategory option').evaluateAll((opts) => opts.map((o) => o.value));
  expect(values).toContain('Fender flares');
  expect(values).toContain('Top / doors');
  expect(values).toContain('Sway bar disconnect');
  expect(values).toContain('Fuel tank skid');
});
