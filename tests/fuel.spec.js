import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab } from './helpers.js';

test('can add a fuel entry with Total Cost', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-01-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.click('#fuelForm button[type="submit"]');
  await expect(page.locator('#fuelList')).toContainText('10 gal');
});

test('MPG is computed between two full-tank fills', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  const rows = [
    ['2024-01-01', '10000', '10', '30'],
    ['2024-01-15', '10100', '10', '30'],
  ];
  for (let i = 0; i < rows.length; i++) {
    const [date, odo, gal, cost] = rows[i];
    await page.fill('#fDate', date);
    await page.fill('#fOdometer', odo);
    await page.fill('#fGallons', gal);
    await page.fill('#fCost', cost);
    await page.check('#fFullTank');
    await page.click('#fuelForm button[type="submit"]');
    await expect(page.locator('#fuelList li')).toHaveCount(i + 1);
    // Wait for the async form-reset that happens after db.add to settle
    // before the next iteration's fills race with it.
    await expect(page.locator('#fDate')).toHaveValue('');
  }
  await expect(page.locator('#fuelList')).toContainText('10.0 MPG');
});

test('$/gallon alone computes Total Cost', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2026-04-20');
  await page.fill('#fOdometer', '20000');
  await page.fill('#fGallons', '10');
  await page.fill('#fPrice', '4.25');
  // Leave #fCost blank on purpose
  await page.fill('#fCost', '');
  await page.click('#fuelForm button[type="submit"]');
  // Expect list to show $4.25/gal price
  await expect(page.locator('#fuelList li').first()).toContainText('$4.25/gal');
});

test('missing both cost and price shows a toast', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-01-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  // No #fCost, no #fPrice
  await page.click('#fuelForm button[type="submit"]');
  await expect(page.locator('#toast:not(.hidden)')).toBeVisible();
  await expect(page.locator('#toastMsg')).toContainText(/Total Cost|galón|gallon/i);
});

test('partial fill (no Full Tank) yields "— MPG" placeholder', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-01-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '5');
  await page.fill('#fCost', '15');
  await page.uncheck('#fFullTank');
  await page.click('#fuelForm button[type="submit"]');
  await expect(page.locator('#fuelList li').first()).toContainText('— MPG');
});

test('autofill populates fuel form with date + odometer', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  await expect(page.locator('#fDate')).not.toHaveValue('');
  await expect(page.locator('#fOdometer')).toHaveValue('15200');
});

test('fuel search filters the list', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  const total = await page.locator('#fuelList li').count();
  expect(total).toBeGreaterThan(3);
  await page.fill('#fuelSearch', 'Shell');
  const filtered = await page.locator('#fuelList li').count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThanOrEqual(total);
});

test('can delete a fuel entry and undo', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  page.on('dialog', (d) => d.accept());
  const before = await page.locator('#fuelList li').count();
  await page.locator('#fuelList .del-btn').first().click();
  await expect(page.locator('#fuelList li')).toHaveCount(before - 1);
  await page.click('#toastAction');
  await expect(page.locator('#fuelList li')).toHaveCount(before);
});

test('fuel type + driving condition persist on entry', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-01-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.selectOption('#fFuelType', 'Premium');
  await page.selectOption('#fDriving', 'Offroad');
  await page.click('#fuelForm button[type="submit"]');
  await page.locator('#fuelList .edit-btn').first().click();
  await expect(page.locator('#fFuelType')).toHaveValue('Premium');
  await expect(page.locator('#fDriving')).toHaveValue('Offroad');
});

test('can edit a fuel entry', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  // Odometer-regression warning may fire if the entry's odo is below the bumped
  // vehicle odo; auto-accept any confirm dialog.
  page.on('dialog', (d) => d.accept());
  await page.locator('#fuelList .edit-btn').first().click();
  await expect(page.locator('#fuelForm .edit-banner')).toBeVisible();
  await page.fill('#fStation', 'EDITED_STATION');
  await page.click('#fuelForm button[type="submit"]');
  await expect(page.locator('#fuelList')).toContainText('EDITED_STATION');
});

// --- MPG formula correctness ---

test('MPG accumulates partial fills between two full fills', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  // Full @ 10000 mi, 10 gal → partial @ 10100 mi, 5 gal → full @ 10300 mi, 15 gal.
  // Real miles between full fills: 300. Real gallons consumed: 5 + 15 = 20. MPG = 15.0.
  // Old buggy code used prev-full.gallons=10 and dropped partial → reported 30 MPG.
  const rows = [
    { date: '2024-01-01', odo: '10000', gal: '10',  cost: '30', full: true  },
    { date: '2024-01-08', odo: '10100', gal: '5',   cost: '15', full: false },
    { date: '2024-01-15', odo: '10300', gal: '15',  cost: '45', full: true  },
  ];
  for (const r of rows) {
    await page.fill('#fDate', r.date);
    await page.fill('#fOdometer', r.odo);
    await page.fill('#fGallons', r.gal);
    await page.fill('#fCost', r.cost);
    if (r.full) await page.check('#fFullTank'); else await page.uncheck('#fFullTank');
    await page.click('#fuelForm button[type="submit"]');
    await expect(page.locator('#fDate')).toHaveValue('');
  }
  await expect(page.locator('#fuelList')).toContainText('15.0 MPG');
  await expect(page.locator('#fuelList')).not.toContainText('30.0 MPG');
});

test('MPG uses the current fills gallons (not the previous fills)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  // Full @ 10000 mi, 10 gal → full @ 10300 mi, 15 gal.
  // 300 mi / 15 gal = 20 MPG. Old code did 300/10 = 30 MPG.
  const rows = [
    ['2024-01-01', '10000', '10', '30'],
    ['2024-01-15', '10300', '15', '45'],
  ];
  for (const r of rows) {
    await page.fill('#fDate', r[0]);
    await page.fill('#fOdometer', r[1]);
    await page.fill('#fGallons', r[2]);
    await page.fill('#fCost', r[3]);
    await page.check('#fFullTank');
    await page.click('#fuelForm button[type="submit"]');
    await expect(page.locator('#fDate')).toHaveValue('');
  }
  await expect(page.locator('#fuelList')).toContainText('20.0 MPG');
  await expect(page.locator('#fuelList')).not.toContainText('30.0 MPG');
});

// --- Engine-aware fuel-type warnings ---

async function setEngine(page, value) {
  await switchTab(page, 'settings');
  await page.evaluate(() => {
    const d = document.querySelector('#editVehicleForm .drivetrain-details');
    if (d) d.open = true;
  });
  await page.selectOption('#eEngine', value);
  await page.click('#editVehicleForm button[type="submit"]');
}

async function fillFuel(page, { date = '2024-05-01', odometer = '10000', gallons = '10', cost = '30', fuelType = '' } = {}) {
  await switchTab(page, 'fuel');
  await page.fill('#fDate', date);
  await page.fill('#fOdometer', odometer);
  await page.fill('#fGallons', gallons);
  await page.fill('#fCost', cost);
  if (fuelType) await page.selectOption('#fFuelType', fuelType);
}

test('warns when gasoline is logged on an EcoDiesel', async ({ page }) => {
  await startFresh(page);
  await setEngine(page, '3.0L EcoDiesel');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fillFuel(page, { fuelType: 'Regular' });
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /diesel/i.test(m) && /destroy|destruir/i.test(m))).toBe(true);
  // Dismissing the warn cancels the save — list stays empty.
  await expect(page.locator('#fuelList li')).toHaveCount(1);
  await expect(page.locator('#fuelList .empty-state')).toBeVisible();
});

test('warns when Diesel is logged on a gasoline engine', async ({ page }) => {
  await startFresh(page);
  await setEngine(page, '3.6L Pentastar');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fillFuel(page, { fuelType: 'Diesel' });
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /gasoline|gasolina/i.test(m))).toBe(true);
});

test('warns when Regular 87 is logged on a premium-required 2.0L Turbo', async ({ page }) => {
  await startFresh(page);
  await setEngine(page, '2.0L Turbo');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fillFuel(page, { fuelType: 'Regular' });
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /premium|91/i.test(m))).toBe(true);
});

test('4xe PHEV is treated as premium-required (Regular 87 warns)', async ({ page }) => {
  await startFresh(page);
  await setEngine(page, '4xe PHEV');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fillFuel(page, { fuelType: 'Regular' });
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /premium|91/i.test(m))).toBe(true);
});

test('Premium on a 2.0T does NOT trigger a warning', async ({ page }) => {
  await startFresh(page);
  await setEngine(page, '2.0L Turbo');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fillFuel(page, { fuelType: 'Premium' });
  await page.click('#fuelForm button[type="submit"]');
  await expect(page.locator('#fuelList li').first()).toContainText('Premium');
  expect(dialogs.length).toBe(0);
});

test('E85 always warns (Wrangler/Gladiator are not flex-fuel)', async ({ page }) => {
  await startFresh(page);
  await setEngine(page, '3.6L Pentastar');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fillFuel(page, { fuelType: 'E85' });
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /E85|flex-fuel|flex/i.test(m))).toBe(true);
});

// --- Sanity checks ---

test('duplicate fuel entry on same date/odometer warns', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-05-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.click('#fuelForm button[type="submit"]');
  // Wait for the form-reset that happens after a successful save.
  await expect(page.locator('#fDate')).toHaveValue('');
  await expect(page.locator('#fuelList li').first()).toContainText('10 gal');

  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#fDate', '2024-05-01');
  await page.fill('#fOdometer', '10020');
  await page.fill('#fGallons', '9');
  await page.fill('#fCost', '27');
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /already exists|ya hay una entrada/i.test(m))).toBe(true);
});

test('tank-size sanity warning fires above ~25 gallons', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#fDate', '2024-05-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '30'); // bigger than any Wrangler/Gladiator tank
  await page.fill('#fCost', '90');
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /Wrangler|Gladiator|tanque|tank/i.test(m))).toBe(true);
});

test('odometer regression in fuel fires a confirm dialog', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#fDate', '2026-04-20');
  await page.fill('#fOdometer', '1'); // below demo max
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '35');
  await page.click('#fuelForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /lower than a previous entry|menor que una entrada/i.test(m))).toBe(true);
});

// --- UI surfacing ---

test('fuel row displays fuel type and driving condition', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-05-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.selectOption('#fFuelType', 'Premium');
  await page.selectOption('#fDriving', 'Offroad');
  await page.click('#fuelForm button[type="submit"]');
  const row = page.locator('#fuelList li').first();
  await expect(row).toContainText('Premium');
  await expect(row).toContainText('Offroad');
});

test('fuel stats panel shows localized labels', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  const stats = await page.locator('#fuelStats').textContent();
  expect(stats).toMatch(/Lifetime Avg MPG/);
  expect(stats).toMatch(/Last 5 Avg MPG/);
  expect(stats).toMatch(/Total Gallons/);
  expect(stats).toMatch(/Total Cost/);
});
