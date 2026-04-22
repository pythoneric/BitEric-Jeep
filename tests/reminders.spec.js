import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

async function addMaintWithInterval(page, { date, odometer, miles = 100, months = 1 }) {
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', date);
  await page.fill('#mOdometer', String(odometer));
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.evaluate(() => (document.querySelector('.interval-details').open = true));
  await page.fill('#mIntervalMiles', String(miles));
  await page.fill('#mIntervalMonths', String(months));
  await page.click('#maintenanceForm button[type="submit"]');
}

test('reminder shows severity tag when due soon', async ({ page }) => {
  await startFresh(page);
  // New entry with nextDueMiles = odometer + 100 → vehicle.odometer will be
  // bumped to same value, so (next - current) = 100 → "due-soon" (≤500).
  await addMaintWithInterval(page, { date: '2026-04-20', odometer: 20000, miles: 100, months: 1 });
  await switchTab(page, 'dashboard');
  const reminder = page.locator('#serviceReminders li').first();
  await expect(reminder).toHaveClass(/due-soon|overdue/);
  await expect(reminder).toContainText(/Oil change/);
});

test('Snooze shifts reminder + fires toast', async ({ page }) => {
  await startFresh(page);
  await addMaintWithInterval(page, { date: '2026-04-20', odometer: 20000, miles: 100, months: 1 });
  await switchTab(page, 'dashboard');
  const initial = await page.locator('#serviceReminders li').first().textContent();
  await page.locator('.reminder-snooze').first().click();
  await expect(page.locator('#toastMsg')).toContainText(/Snoozed|Pospuesto/);
  const after = await page.locator('#serviceReminders li').first().textContent();
  expect(after).not.toBe(initial);
});

test('Dismiss removes the reminder from the dashboard', async ({ page }) => {
  await startFresh(page);
  await addMaintWithInterval(page, { date: '2026-04-20', odometer: 20000, miles: 100, months: 1 });
  await switchTab(page, 'dashboard');
  await page.locator('.reminder-dismiss').first().click();
  await expect(page.locator('.reminder-dismiss')).toHaveCount(0);
});

test('no active reminders shows placeholder', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#serviceReminders')).toContainText(/No upcoming|sin/i);
});

test('Log button jumps to Maintenance with type + intervals pre-filled', async ({ page }) => {
  await startFresh(page);
  await addMaintWithInterval(page, { date: '2026-04-20', odometer: 20000, miles: 750, months: 3 });
  await switchTab(page, 'dashboard');
  await expect(page.locator('.reminder-log').first()).toBeVisible();
  await page.locator('.reminder-log').first().click();
  // Tab flipped to Maintenance
  await expect(page.locator('#maintenance:not(.hidden)')).toBeVisible();
  // Type carried over from the reminder
  await expect(page.locator('#mType')).toHaveValue('Oil change');
  // Today's date pre-filled
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await expect(page.locator('#mDate')).toHaveValue(iso);
  // Intervals carried over and the accordion opened
  await expect(page.locator('#mIntervalMiles')).toHaveValue('750');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('3');
  await expect(page.locator('.interval-details')).toHaveJSProperty('open', true);
});
