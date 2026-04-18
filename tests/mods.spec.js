import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('jeep-journal');
    localStorage.clear();
  });
  await page.reload();
});

test('can add a mod', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="mods"]');
  await page.fill('#modDate', '2023-01-01');
  await page.selectOption('#modCategory', 'Suspension');
  await page.fill('#modPart', 'Lift Kit');
  await page.fill('#modBrand', 'Brand');
  await page.fill('#modCost', '1000');
  await page.click('[data-i18n="addMod"]');
  await expect(page.locator('#modsList')).toContainText('Lift Kit');
});