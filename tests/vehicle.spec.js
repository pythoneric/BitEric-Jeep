import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('jeep-journal');
    localStorage.clear();
  });
  await page.reload();
});

test('can create a vehicle', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="settings"]');
  await page.fill('#vNickname', 'Test Jeep');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Wrangler');
  await page.fill('#vYear', '2020');
  await page.click('[data-i18n="addVehicleBtn"]');
  await page.click('[data-tab="dashboard"]');
  const select = page.locator('#vehicleSelect');
  await expect(select).toContainText('Test Jeep');
});