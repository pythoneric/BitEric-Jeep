import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('jeep-journal');
    localStorage.clear();
  });
  await page.reload();
});

test('can add a fuel entry', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="fuel"]');
  await page.fill('#fDate', '2023-01-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.check('#fFullTank');
  await page.click('[data-i18n="addEntry"]');
  await expect(page.locator('#fuelList')).toContainText('10 gal');
});

test('MPG computed correctly', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="fuel"]');
  // First fill-up
  await page.fill('#fDate', '2023-01-01');
  await page.fill('#fOdometer', '10000');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.check('#fFullTank');
  await page.click('[data-i18n="addEntry"]');
  // Second fill-up
  await page.fill('#fDate', '2023-01-02');
  await page.fill('#fOdometer', '10100');
  await page.fill('#fGallons', '10');
  await page.fill('#fCost', '30');
  await page.check('#fFullTank');
  await page.click('[data-i18n="addEntry"]');
  await expect(page.locator('#fuelList')).toContainText('10.0 MPG');
});