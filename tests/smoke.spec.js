import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('jeep-journal');
    localStorage.clear();
  });
  await page.reload();
});

test('app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Jeep Journal');
});

test('refresh button shows loader and reloads', async ({ page }) => {
  await page.goto('/');
  // Wait for initial load
  await expect(page.locator('#loader')).toBeHidden();
  // Click refresh
  await page.click('#refreshBtn');
  // Loader should appear
  await expect(page.locator('#loader')).toBeVisible();
  // Wait for reload
  await expect(page.locator('#loader')).toBeHidden();
  // Check app still works
  await expect(page.locator('#vehicleSelect')).toBeVisible();
});