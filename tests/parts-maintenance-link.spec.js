import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

async function addPart(page, { name, quantity = '5', location = 'Garage' } = {}) {
  await switchTab(page, 'parts');
  await page.fill('#partName', name);
  await page.fill('#partQuantity', quantity);
  await page.fill('#partLocation', location);
  await page.click('#partsForm button[type="submit"]');
}

async function addMaintenanceWithParts(page, { type = 'Oil change', odometer = '10000', date = '2024-06-01', cost = '50', picks = [] } = {}) {
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', date);
  await page.fill('#mOdometer', odometer);
  await page.selectOption('#mType', type);
  await page.fill('#mCost', cost);
  // Expand the details + add one row per pick.
  const details = page.locator('.parts-used-details');
  await details.evaluate(el => el.open = true);
  for (const pick of picks) {
    await page.click('#addPartUsedBtn');
    const row = page.locator('#partsUsedRows .part-used-row').last();
    // The row's select is populated asynchronously (awaits db.getAll('parts'));
    // wait for the target option to appear before selecting it.
    await expect(row.locator('.part-used-select option').filter({ hasText: pick.name })).toHaveCount(1);
    const value = await row.locator('.part-used-select option').evaluateAll((opts, name) => {
      const match = opts.find(o => o.textContent && o.textContent.startsWith(name + ' '));
      return match ? match.value : '';
    }, pick.name);
    expect(value, `dropdown option for ${pick.name}`).toBeTruthy();
    await row.locator('.part-used-select').selectOption(value);
    await row.locator('.part-used-qty').fill(String(pick.quantity));
  }
  await page.click('#maintenanceForm button[type="submit"]');
  // Wait for reset — submit re-fires the mType change event which re-clears form.
  await expect(page.locator('#mDate')).toHaveValue('');
}

async function partStock(page, name) {
  return page.locator(`#partsList li:has-text("${name}")`).first().textContent();
}

test('submitting maintenance with picked parts decrements inventory', async ({ page }) => {
  await startFresh(page);
  await addPart(page, { name: 'Mobil 1 5W-30', quantity: '5' });
  await addPart(page, { name: 'Oil filter', quantity: '3' });
  await addMaintenanceWithParts(page, {
    picks: [
      { name: 'Mobil 1 5W-30', quantity: 5 },
      { name: 'Oil filter', quantity: 1 },
    ],
  });
  await switchTab(page, 'parts');
  const mobilRow = await partStock(page, 'Mobil 1 5W-30');
  const filterRow = await partStock(page, 'Oil filter');
  // 5 − 5 = 0; 3 − 1 = 2
  expect(mobilRow).toMatch(/0x/);
  expect(filterRow).toMatch(/2x/);
});

test('maintenance list shows "Used:" with part names and quantities', async ({ page }) => {
  await startFresh(page);
  await addPart(page, { name: 'Brake fluid', quantity: '2' });
  await addMaintenanceWithParts(page, {
    type: 'Brake fluid',
    picks: [{ name: 'Brake fluid', quantity: 1 }],
  });
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList li').first()).toContainText(/Used|Usadas/);
  await expect(page.locator('#maintenanceList li').first()).toContainText('Brake fluid');
});

test('editing a maintenance entry to use fewer parts returns stock to inventory', async ({ page }) => {
  await startFresh(page);
  await addPart(page, { name: 'Mobil 1 5W-30', quantity: '10' });
  await addMaintenanceWithParts(page, {
    picks: [{ name: 'Mobil 1 5W-30', quantity: 5 }],
  });
  // After: 10 − 5 = 5 available.
  await switchTab(page, 'parts');
  await expect(page.locator('#partsList li').first()).toContainText('5x');
  // Edit the entry and change qty to 3 (returning 2 to stock).
  await switchTab(page, 'maintenance');
  await page.click('#maintenanceList .edit-btn');
  const qtyInput = page.locator('#partsUsedRows .part-used-qty').first();
  await qtyInput.fill('3');
  await page.click('#maintenanceForm button[type="submit"]');
  await switchTab(page, 'parts');
  // 5 (after first submit) + 2 (returned) = 7
  await expect(page.locator('#partsList li').first()).toContainText('7x');
});

test('deleting a maintenance entry returns its parts to inventory', async ({ page }) => {
  await startFresh(page);
  await addPart(page, { name: 'Air filter', quantity: '3' });
  await addMaintenanceWithParts(page, {
    picks: [{ name: 'Air filter', quantity: 2 }],
  });
  await switchTab(page, 'parts');
  await expect(page.locator('#partsList li').first()).toContainText('1x');
  await switchTab(page, 'maintenance');
  page.once('dialog', d => d.accept());
  await page.click('#maintenanceList .del-btn');
  await switchTab(page, 'parts');
  await expect(page.locator('#partsList li').first()).toContainText('3x');
});

test('picker shows "no inventory" guidance when the parts list is empty', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  const details = page.locator('.parts-used-details');
  await details.evaluate(el => el.open = true);
  await page.click('#addPartUsedBtn');
  // The only option is the disabled placeholder; confirm no real parts loaded.
  const options = page.locator('#partsUsedRows .part-used-select option');
  await expect(options).toHaveCount(1);
});

test('inventory clamps at 0 when user over-consumes', async ({ page }) => {
  await startFresh(page);
  await addPart(page, { name: 'Cabin filter', quantity: '1' });
  // User logs 5 used but only has 1 in stock — clamp at 0, don't go negative.
  await addMaintenanceWithParts(page, {
    type: 'Cabin filter',
    picks: [{ name: 'Cabin filter', quantity: 5 }],
  });
  await switchTab(page, 'parts');
  await expect(page.locator('#partsList li').first()).toContainText('0x');
});
