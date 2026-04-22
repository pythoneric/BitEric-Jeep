import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab } from './helpers.js';

test('Trails tab shows empty state when no trail runs logged', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await expect(page.locator('#trailsList .empty-state')).toBeVisible();
});

test('can log a trail run', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Moab Slickrock');
  await page.fill('#trailOdometer', '12000');
  await page.fill('#trailDuration', '4');
  await page.check('#trailRock');
  await page.fill('#trailNotes', 'Great traction, no damage');
  await page.click('#trailsForm button[type="submit"]');
  await expect(page.locator('#trailsList')).toContainText('Moab Slickrock');
  await expect(page.locator('#trailsList')).toContainText('4h');
  await expect(page.locator('#trailsList')).toContainText('rock');
  await expect(page.locator('#trailsList')).toContainText('12000 mi');
});

test('deep water crossing auto-spawns diff + transfer case reminders', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'River Run');
  await page.fill('#trailOdometer', '20000');
  await page.check('#trailWater');
  await page.selectOption('#trailWaterDepth', 'deep');
  await page.click('#trailsForm button[type="submit"]');

  await switchTab(page, 'maintenance');
  const list = page.locator('#maintenanceList');
  await expect(list).toContainText('Differential fluid front');
  await expect(list).toContainText('Differential fluid rear');
  await expect(list).toContainText('Transfer case fluid');
  // Water follow-up is now "inspect" (sealed hubs on JK/JL/JT), not "service".
  await expect(list).toContainText('Wheel bearing inspect');
  await expect(list).not.toContainText('Wheel bearing service');
});

test('SHALLOW water crossing does NOT spawn diff/T-case follow-ups', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Ankle-deep creek');
  await page.fill('#trailOdometer', '20000');
  await page.check('#trailWater');
  // Leave depth at default "shallow"
  await page.click('#trailsForm button[type="submit"]');

  await switchTab(page, 'maintenance');
  const list = page.locator('#maintenanceList');
  await expect(list).not.toContainText('Differential fluid front');
  await expect(list).not.toContainText('Transfer case fluid');
});

test('trail search filters the list', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  const names = ['Hell\'s Revenge', 'Poison Spider', 'Top of the World'];
  for (let i = 0; i < names.length; i++) {
    // trailDate is required; form.reset() wipes it so we must re-fill every iteration.
    await page.fill('#trailDate', '2024-01-0' + (i + 1));
    await page.fill('#trailName', names[i]);
    await page.fill('#trailOdometer', String(15000 + i * 100));
    await page.check('#trailRock');
    await page.click('#trailsForm button[type="submit"]');
    await expect(page.locator('#trailsList li')).toHaveCount(i + 1);
    await expect(page.locator('#trailName')).toHaveValue('');
  }
  await page.fill('#trailsSearch', 'spider');
  await expect(page.locator('#trailsList li')).toHaveCount(1);
  await page.fill('#trailsSearch', 'nope');
  await expect(page.locator('#trailsList .empty-state')).toBeVisible();
});

test('can delete a trail with undo', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Test Trail');
  await page.fill('#trailOdometer', '10000');
  await page.click('#trailsForm button[type="submit"]');
  page.on('dialog', (d) => d.accept());
  await page.locator('#trailsList .del-btn').first().click();
  await expect(page.locator('#trailsList .empty-state')).toBeVisible();
  await page.click('#toastAction');
  await expect(page.locator('#trailsList li').filter({ hasText: 'Test Trail' })).toHaveCount(1);
});

// --- Mandatory / validation ---

test('trail form blocks submit when odometer is missing', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'No-odo trail');
  // intentionally skip #trailOdometer
  await page.click('#trailsForm button[type="submit"]');
  await expect(page.locator('#trailsList .empty-state')).toBeVisible();
});

test('trailDate max is today (cannot log future trails)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  const today = await page.evaluate(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  await expect(page.locator('#trailDate')).toHaveAttribute('max', today);
});

test('trailDate auto-fills to today on tab open', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await expect(page.locator('#trailDate')).not.toHaveValue('');
});

// --- Follow-up spawn: date + odometer anchor ---

test('trail follow-up spawns at the trail date + odometer (not today / current vehicle)', async ({ page }) => {
  await loadDemoTruck(page); // Demo vehicle odometer 15200
  await switchTab(page, 'trails');
  await page.fill('#trailDate', '2023-06-01');
  await page.fill('#trailName', 'Historical Water Run');
  await page.fill('#trailOdometer', '9000'); // intentionally BELOW vehicle.odometer
  await page.check('#trailWater');
  await page.selectOption('#trailWaterDepth', 'deep');
  await page.click('#trailsForm button[type="submit"]');

  await switchTab(page, 'maintenance');
  const child = page.locator('#maintenanceList li', { hasText: 'Differential fluid front' }).first();
  await expect(child).toContainText('2023-06-01');
  await expect(child).toContainText('9000 mi');
});

// --- Snow / Sand / universal rinse ---

test('snow condition spawns undercarriage rinse', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Snowy Road');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailSnow');
  await page.click('#trailsForm button[type="submit"]');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList')).toContainText('Undercarriage rinse');
});

test('sand condition spawns an air filter check', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Glamis Dunes');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailSand');
  await page.click('#trailsForm button[type="submit"]');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList')).toContainText('Air filter');
});

test('rock condition spawns a post-crawl inspection', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Pritchett Canyon');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailRock');
  await page.click('#trailsForm button[type="submit"]');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList li').filter({ hasText: 'Inspection' })).toHaveCount(1);
});

test('any trail run spawns a universal undercarriage rinse', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Generic crawl');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailHeavy');
  await page.click('#trailsForm button[type="submit"]');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList')).toContainText('Undercarriage rinse');
});

// --- Duplicate detection ---

test('duplicate trail on same date + name warns', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailDate', '2024-06-01');
  await page.fill('#trailName', 'Rubicon Trail');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailRock');
  await page.click('#trailsForm button[type="submit"]');
  await expect(page.locator('#trailsList')).toContainText('Rubicon Trail');

  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#trailDate', '2024-06-01');
  await page.fill('#trailName', 'rubicon trail'); // different case → still a dupe
  await page.fill('#trailOdometer', '14010');
  await page.click('#trailsForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /already logged|ya hay una ruta/i.test(m))).toBe(true);
});

// --- Damage round-trip ---

test('damage checkbox + notes persist through edit', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Broke-Stuff Ridge');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailRock');
  await page.check('#trailDamage');
  await page.fill('#trailDamageNotes', 'Sheared front driver u-joint');
  await page.click('#trailsForm button[type="submit"]');
  await expect(page.locator('#trailsList')).toContainText('Sheared front driver u-joint');

  await page.locator('#trailsList .edit-btn').first().click();
  await expect(page.locator('#trailDamage')).toBeChecked();
  await expect(page.locator('#trailDamageNotes')).toHaveValue('Sheared front driver u-joint');
});

// --- Edit path does not re-spawn follow-ups ---

test('editing a trail does not duplicate follow-ups', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Edit-test trail');
  await page.fill('#trailOdometer', '14000');
  await page.check('#trailRock');
  await page.click('#trailsForm button[type="submit"]');

  await switchTab(page, 'maintenance');
  const inspectionsBefore = await page.locator('#maintenanceList li').filter({ hasText: 'Inspection' }).count();
  expect(inspectionsBefore).toBe(1);

  await switchTab(page, 'trails');
  await page.locator('#trailsList .edit-btn').first().click();
  await page.fill('#trailNotes', 'added notes on edit');
  await page.click('#trailsForm button[type="submit"]');

  await switchTab(page, 'maintenance');
  const inspectionsAfter = await page.locator('#maintenanceList li').filter({ hasText: 'Inspection' }).count();
  expect(inspectionsAfter).toBe(1); // no new spawn on edit
});

// --- Odometer bump ---

test('logging a trail higher than vehicle odometer bumps the vehicle', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailDate', '2026-01-01');
  await page.fill('#trailName', 'Odometer-bump trail');
  await page.fill('#trailOdometer', '88888');
  await page.check('#trailRock');
  await page.click('#trailsForm button[type="submit"]');
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleCard')).toContainText('88888 mi');
});
