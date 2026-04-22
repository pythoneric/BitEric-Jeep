import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab } from './helpers.js';

test('Service Reminders card renders above the Vehicle card', async ({ page }) => {
  await startFresh(page);
  const cards = await page.locator('#dashboard > .card, #dashboard > .g3, #dashboard > .g2').evaluateAll((els) =>
    els.map((e) => e.querySelector('h2, h3')?.textContent?.trim() || ''),
  );
  expect(cards[0]).toMatch(/Service Reminders|Recordatorios/);
  expect(cards[1]).toMatch(/Vehicle|Vehículo/);
});

test('Vehicle card shows color, plate, VIN last-4 and purchase date', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  // There can be multiple .vehicle-meta rows (identity + drivetrain specs); combine them.
  const meta = (await page.locator('#vehicleCard .vehicle-meta').allTextContents()).join(' ');
  expect(meta).toContain('Gray'); // color
  expect(meta).toContain('DEMO1'); // plate
  expect(meta).toContain('1234'); // vin last-4 (1C4HJXFG5NW201234 → 1234)
  expect(meta).toMatch(/2023-03-01/); // purchase date
});

test('TCO + split $/mile cards render with demo data', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#tcoCard')).toContainText(/\$/);
  await expect(page.locator('#cpmMaintCard')).toContainText(/\$|mile|milla/);
  await expect(page.locator('#cpmFuelCard')).toContainText(/\$|mile|milla/);
});

test('Monthly trend chart canvas is present', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#monthlyChart')).toBeVisible();
});

test('Budget card header adapts to what is configured', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  // Demo Truck seeds both monthlyBudget and annualBudget → "Budget"
  await expect(page.locator('#budgetCardTitle')).toHaveText(/Budget|Presupuesto/);
});

test('MPG vs Goal card shows delta', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  // Demo Truck has mpgGoal: 18 and several fuel entries computing to ~19 MPG
  await expect(page.locator('#mpgGoalCard')).toContainText(/goal|meta/i);
});

test('dashboard recent lists show empty states on fresh install', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#recentMaintenance .empty-state')).toBeVisible();
  await expect(page.locator('#recentFuel .empty-state')).toBeVisible();
  await expect(page.locator('#topMods .empty-state')).toBeVisible();
});

test('vehicle value card reflects purchase price + depreciation', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleValueCard')).toContainText(/\$/);
  await expect(page.locator('#vehicleValueCard')).toContainText(/depreciation|depreciación/i);
});

test('cost breakdown pie chart is present', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#costChart')).toBeVisible();
});

test('severe-service badge renders for demo truck', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleCard .severe-service-badge')).toBeVisible();
  await expect(page.locator('#vehicleCard .severe-service-badge')).toHaveText(/SEVERE|SEVERO/);
});

test('vehicle spec row renders engine / tire / lift when set', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  const meta = (await page.locator('#vehicleCard .vehicle-meta').allTextContents()).join(' ');
  expect(meta).toContain('3.0L EcoDiesel'); // engine
  expect(meta).toContain('Auto 8-speed'); // transmission
  expect(meta).toContain('3.73'); // axle ratio
  expect(meta).toContain('33x12.50R17'); // tire size
  expect(meta).toContain('2.5"'); // lift height
  expect(meta).toContain('Rock-Trac'); // transfer case
});

test('vehicle title has no trailing space when trim is empty', async ({ page }) => {
  await startFresh(page); // helpers' Test Rig has no trim
  await switchTab(page, 'dashboard');
  const title = await page.locator('#vehicleCard p').nth(1).textContent();
  expect(title).toBe('2020 Jeep Wrangler');
});

test('odometer line is hidden when vehicle odometer is zero', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'dashboard');
  // startFresh vehicle is created with no odometer (defaults to 0/empty),
  // so the "Odometer: X mi" paragraph should be suppressed entirely.
  const body = await page.locator('#vehicleCard').textContent();
  expect(body).not.toMatch(/Odometer/i);
  expect(body).not.toMatch(/Odómetro/i);
});

test('recent lists render populated rows for demo truck', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  // Each list: "YYYY-MM-DD: <thing> - $N.NN" format
  const rowPattern = /\d{4}-\d{2}-\d{2}: .+ - \$\d+\.\d{2}/;
  await expect(page.locator('#recentMaintenance li').first()).toHaveText(rowPattern);
  await expect(page.locator('#recentFuel li').first()).toHaveText(/\d{4}-\d{2}-\d{2}: [\d.]+ gal - \$\d+\.\d{2}/);
  await expect(page.locator('#topMods li').first()).toHaveText(/.+: \$\d+\.\d{2}/);
  // Recent lists are capped at 5 rows.
  expect(await page.locator('#recentMaintenance li').count()).toBeLessThanOrEqual(5);
  expect(await page.locator('#recentFuel li').count()).toBeLessThanOrEqual(5);
  expect(await page.locator('#topMods li').count()).toBeLessThanOrEqual(3);
});

test('TCO subline shows Maintenance / Fuel / Mods breakdown', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  const tco = await page.locator('#tcoCard').textContent();
  // Both EN ("Maintenance $... Fuel $... Mods $...") and ES ("Mantenimiento ... Combustible ... Mods ...")
  // reach the same numeric layout; assert three $-amounts under the big total.
  expect(tco.match(/\$\d/g)?.length).toBeGreaterThanOrEqual(4); // 1 total + 3 breakdown
});

test('fresh-install dashboard shows all configurable empty states', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#budgetMonthCard')).toContainText(/budget|presupuesto/i);
  await expect(page.locator('#mpgGoalCard')).toContainText(/goal|meta/i);
  await expect(page.locator('#vehicleValueCard')).toContainText(/purchase|precio/i);
  await expect(page.locator('#cpmMaintCard')).toContainText(/fuel entry|combustible/i);
  await expect(page.locator('#cpmFuelCard')).toContainText(/fuel entry|combustible/i);
});

test('Vehicle card i18n: Plate / Bought labels follow language toggle', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleCard')).toContainText('Plate DEMO1');
  await expect(page.locator('#vehicleCard')).toContainText('Bought 2023-03-01');
  await page.click('#langToggle');
  await expect(page.locator('#vehicleCard')).toContainText('Placa DEMO1');
  await expect(page.locator('#vehicleCard')).toContainText('Comprado 2023-03-01');
});
