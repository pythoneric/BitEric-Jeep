import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('jeep-journal');
    localStorage.clear();
  });
  await page.reload();
});

test('app loads with loader overlay', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loader')).toBeVisible();
  await expect(page.locator('#continueBtn')).toBeVisible();
  await expect(page.locator('#demoBtn')).toBeVisible();
});

test('continue button loads app and hides loader', async ({ page }) => {
  await page.goto('/');
  await page.click('#continueBtn');
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('#vehicleSelect')).toBeVisible();
});

test('demo button loads sample data and hides loader', async ({ page }) => {
  await page.goto('/');
  await page.click('#demoBtn');
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('#vehicleSelect')).toContainText('Wrangler Demo');
});

test('refresh button shows loader overlay and reloads', async ({ page }) => {
  await page.goto('/');
  await page.click('#continueBtn');
  await expect(page.locator('#loader')).toBeHidden();
  await page.click('#refreshBtn');
  await expect(page.locator('#loader')).toBeVisible();
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('#vehicleSelect')).toBeVisible();
});