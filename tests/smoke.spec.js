import { test, expect } from '@playwright/test';
import { openLoader, startFresh, loadDemoSUV, loadDemoTruck } from './helpers.js';

test('loader overlay shows drop zone + demo + start fresh on first load', async ({ page }) => {
  await openLoader(page);
  await expect(page.locator('#loader')).toBeVisible();
  // Saved-data banner hidden on a pristine device — there's nothing to continue to
  await expect(page.locator('#savedDataBanner')).toBeHidden();
  await expect(page.locator('#loaderDropZone')).toBeVisible();
  await expect(page.locator('#demoSUVBtn')).toBeVisible();
  await expect(page.locator('#demoTruckBtn')).toBeVisible();
  await expect(page.locator('#startFreshBtn')).toBeVisible();
});

test('Continue button + saved-data banner appear after first use', async ({ page }) => {
  await startFresh(page);
  await page.click('#refreshBtn');
  await expect(page.locator('#loader')).toBeVisible();
  await expect(page.locator('#savedDataBanner')).toBeVisible();
  await expect(page.locator('#continueBtn')).toBeVisible();
  await expect(page.locator('#exportLoaderBtn')).toBeVisible();
  await expect(page.locator('#deleteLoaderBtn')).toBeVisible();
});

test('Start Fresh dismisses loader and reveals app', async ({ page }) => {
  await startFresh(page);
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('#vehicleSwitcher')).toBeVisible();
  await expect(page.locator('nav.tabs')).toBeVisible();
});

test('Demo SUV loads the Wrangler sample', async ({ page }) => {
  await loadDemoSUV(page);
  await expect(page.locator('#vehicleSwitcher')).toContainText('Wrangler Demo');
});

test('Demo Truck loads the Gladiator sample', async ({ page }) => {
  await loadDemoTruck(page);
  await expect(page.locator('#vehicleSwitcher')).toContainText('Gladiator Demo');
});

test('refresh button brings the loader back', async ({ page }) => {
  await startFresh(page);
  await expect(page.locator('#loader')).toBeHidden();
  await page.click('#refreshBtn');
  await expect(page.locator('#loader')).toBeVisible();
});

test('language toggle flips UI text', async ({ page }) => {
  await startFresh(page);
  const toggle = page.locator('#langToggle');
  const initial = await toggle.textContent();
  await toggle.click();
  await expect(toggle).not.toHaveText(initial ?? '');
});
