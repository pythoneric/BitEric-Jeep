import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('jeep-journal');
    localStorage.clear();
  });
  await page.reload();
});

test('can add a maintenance entry', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="maintenance"]');
  await page.fill('#mDate', '2023-01-01');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('[data-i18n="addEntry"]');
  await expect(page.locator('#maintenanceList')).toContainText('Oil change');
});