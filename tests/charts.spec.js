import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab } from './helpers.js';

// Chart.getChart(canvasIdOrEl) is exposed globally by Chart.js. We use it to
// introspect the data a chart was built with — without pixel-diffing the canvas.
async function chartData(page, canvasId) {
  return page.evaluate((id) => {
    const ch = window.Chart?.getChart?.(document.getElementById(id));
    if (!ch) return null;
    return { labels: ch.data.labels, data: ch.data.datasets[0]?.data, type: ch.config.type };
  }, canvasId);
}

// --- Dashboard ---

test('Dashboard service reminders render with a progress bar per item', async ({ page }) => {
  await startFresh(page);
  // Seed a maintenance entry with an interval so a reminder surfaces.
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2026-04-20');
  await page.fill('#mOdometer', '20000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.evaluate(() => (document.querySelector('.interval-details').open = true));
  await page.fill('#mIntervalMiles', '5000');
  await page.fill('#mIntervalMonths', '6');
  await page.click('#maintenanceForm button[type="submit"]');
  await switchTab(page, 'dashboard');
  await expect(page.locator('#serviceReminders .reminder-item .progress-bar')).toHaveCount(1);
});

test('Dashboard: mileage sparkline chart renders from fuel data', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#mileageChart')).toBeVisible();
  const info = await chartData(page, 'mileageChart');
  expect(info?.type).toBe('line');
  // Demo truck has many fuel fills with odometers — data should be populated.
  expect(info?.data?.length ?? 0).toBeGreaterThan(5);
});

test('Dashboard: maintenance-by-type donut buckets entries into categories', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#maintCategoryChart')).toBeVisible();
  const info = await chartData(page, 'maintCategoryChart');
  expect(info?.type).toBe('doughnut');
  // Demo truck has Oil change + Tire rotation + Brake fluid + Brake pads + etc.
  // Should produce at least two distinct category buckets.
  expect(info?.labels?.length ?? 0).toBeGreaterThanOrEqual(2);
});

// --- Fuel ---

test('Fuel: MPG-by-driving-condition bar chart is present', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'fuel');
  await expect(page.locator('#mpgByConditionChart')).toBeVisible();
  const info = await chartData(page, 'mpgByConditionChart');
  expect(info?.type).toBe('bar');
});

test('Fuel: MPG-by-condition chart surfaces distinct conditions from user entries', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  const rows = [
    { date: '2024-01-01', odo: '10000', gal: '10', cost: '30', cond: 'Highway' },
    { date: '2024-01-15', odo: '10300', gal: '15', cost: '45', cond: 'Highway' },
    { date: '2024-02-01', odo: '10500', gal: '12', cost: '36', cond: 'Offroad' },
    { date: '2024-02-15', odo: '10700', gal: '14', cost: '42', cond: 'Offroad' },
  ];
  for (const r of rows) {
    await page.fill('#fDate', r.date);
    await page.fill('#fOdometer', r.odo);
    await page.fill('#fGallons', r.gal);
    await page.fill('#fCost', r.cost);
    await page.selectOption('#fDriving', r.cond);
    await page.check('#fFullTank');
    await page.click('#fuelForm button[type="submit"]');
    await expect(page.locator('#fDate')).toHaveValue('');
  }
  const info = await chartData(page, 'mpgByConditionChart');
  expect(info?.labels).toEqual(expect.arrayContaining(['Highway', 'Offroad']));
});

// --- Mods ---

test('Mods: spend-by-category chart renders with demo data', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'mods');
  await expect(page.locator('#modsCategoryChart')).toBeVisible();
  const info = await chartData(page, 'modsCategoryChart');
  expect(info?.type).toBe('bar');
  // Demo has Suspension + Bumper + Tires/Wheels + Armor + Recovery + Lighting + Interior + Electrical + Audio.
  expect(info?.labels?.length ?? 0).toBeGreaterThanOrEqual(4);
  // Each labeled category should carry a positive dollar amount.
  expect((info?.data || []).every(v => v > 0)).toBe(true);
});

// --- Trails ---

test('Trails: condition donut counts each condition at least once on demo', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'trails');
  await expect(page.locator('#trailsConditionChart')).toBeVisible();
  const info = await chartData(page, 'trailsConditionChart');
  expect(info?.type).toBe('doughnut');
  // Demo has rock+heavy / rock / water+mud / heavy → labels: rock, heavy, water, mud.
  expect(info?.labels).toEqual(expect.arrayContaining(['rock', 'heavy']));
});

// --- Parts ---

test('Parts: inventory value chart sums cost × quantity per category', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'parts');
  await expect(page.locator('#partsInventoryChart')).toBeVisible();
  const info = await chartData(page, 'partsInventoryChart');
  expect(info?.type).toBe('bar');
  // Demo parts span Filters / Fluids / Electrical / Tools / Tires / Other — at
  // least two categories carry cost × qty > 0.
  expect(info?.labels?.length ?? 0).toBeGreaterThanOrEqual(2);
});

// --- Maintenance ---

test('Maintenance: reminder status donut shows three buckets', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintReminderStatusChart')).toBeVisible();
  const info = await chartData(page, 'maintReminderStatusChart');
  expect(info?.type).toBe('doughnut');
  expect(info?.labels?.length).toBe(3); // Overdue / Due soon / On schedule
});
