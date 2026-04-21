import { test, expect } from '@playwright/test';
import { openLoader, startFresh, loadDemoTruck, switchTab } from './helpers.js';

test('Start Fresh pops the currency picker before clearing data', async ({ page }) => {
  await openLoader(page);
  await page.click('#startFreshBtn');
  await expect(page.locator('#currencyModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#currencyModalTitle')).toHaveText(/Pick a currency|Elige una moneda/);
  await expect(page.locator('#currencyUsdBtn')).toContainText(/US\$/);
  await expect(page.locator('#currencyDopBtn')).toContainText(/RD\$/);
});

test('Picking US$ keeps dollar prefixes on the dashboard', async ({ page }) => {
  await startFresh(page, { currency: 'USD' });
  await switchTab(page, 'dashboard');
  const value = await page.evaluate(() => localStorage.getItem('currency'));
  expect(value).toBe('USD');
  // Every money amount on a USD fresh install should start with $ (no RD prefix).
  await expect(page.locator('#tcoCard')).toContainText('$');
  await expect(page.locator('#tcoCard')).not.toContainText('RD$');
});

test('Picking RD$ flips every dashboard currency symbol to RD$', async ({ page }) => {
  await startFresh(page, { currency: 'DOP' });
  // Seed a little money so TCO has non-zero rows.
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2026-04-20');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '3500');
  await page.click('#maintenanceForm button[type="submit"]');

  await switchTab(page, 'dashboard');
  const value = await page.evaluate(() => localStorage.getItem('currency'));
  expect(value).toBe('DOP');

  await expect(page.locator('#tcoCard')).toContainText('RD$');
  await expect(page.locator('#recentMaintenance li').first()).toContainText('RD$');
  // The maintenance list on the maintenance tab should also flip.
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList li').first()).toContainText('RD$');
});

test('RD$ choice updates placeholder labels to (RD$)', async ({ page }) => {
  await startFresh(page, { currency: 'DOP' });
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mCost')).toHaveAttribute('placeholder', /\(RD\$\)/);
  await switchTab(page, 'fuel');
  await expect(page.locator('#fCost')).toHaveAttribute('placeholder', /\(RD\$\)/);
  await expect(page.locator('#fPrice')).toHaveAttribute('placeholder', /^RD\$ \/ gallon$/);
  await switchTab(page, 'settings');
  await expect(page.locator('#vPurchasePrice')).toHaveAttribute('placeholder', /\(RD\$\)/);
});

test('Demo Truck does not prompt for currency', async ({ page }) => {
  await loadDemoTruck(page);
  await expect(page.locator('#currencyModal')).not.toHaveClass(/\bopen\b/);
  // Demo Truck is US-priced, so it should land on USD by default.
  const value = await page.evaluate(() => localStorage.getItem('currency'));
  // Default is USD when never set — Demo Truck shouldn't force it either way.
  expect(value === null || value === 'USD').toBeTruthy();
  await switchTab(page, 'dashboard');
  await expect(page.locator('#tcoCard')).toContainText('$');
  await expect(page.locator('#tcoCard')).not.toContainText('RD$');
});

test('Currency choice persists across reload', async ({ page }) => {
  await startFresh(page, { currency: 'DOP' });
  await page.reload();
  // After reload the loader reappears with a Continue button (saved data exists).
  await page.waitForSelector('#continueBtn');
  await page.click('#continueBtn');
  await page.waitForSelector('#loader', { state: 'hidden' });
  const value = await page.evaluate(() => localStorage.getItem('currency'));
  expect(value).toBe('DOP');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mCost')).toHaveAttribute('placeholder', /\(RD\$\)/);
});

test('Currency survives language toggle (RD$ stays RD$ in Spanish)', async ({ page }) => {
  await startFresh(page, { currency: 'DOP' });
  await switchTab(page, 'settings');
  await expect(page.locator('#vPurchasePrice')).toHaveAttribute('placeholder', /Purchase price \(RD\$\)/);
  await page.click('#langToggle');
  await expect(page.locator('#vPurchasePrice')).toHaveAttribute('placeholder', /Precio de compra \(RD\$\)/);
});
