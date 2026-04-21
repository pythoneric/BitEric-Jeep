import { test, expect } from '@playwright/test';
import { startFresh, loadDemoSUV, switchTab } from './helpers.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function tmpWrite(filename, content) {
  const p = path.join(os.tmpdir(), filename);
  fs.writeFileSync(p, content);
  return p;
}

test('JSON export uses vehicle nickname + date in filename', async ({ page }) => {
  await loadDemoSUV(page);
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const name = download.suggestedFilename();
  expect(name).toMatch(/^biteric-jeep-wrangler-demo-\d{4}-\d{2}-\d{2}\.json$/);
});

test('invalid JSON import shows toast and does not wipe data', async ({ page }) => {
  await loadDemoSUV(page);
  const before = await page.locator('#vehicleSwitcher .vehicle-chip').count();
  const bad = tmpWrite('invalid.json', JSON.stringify({ vehicles: 'not-an-array' }));
  await switchTab(page, 'settings');
  await page.setInputFiles('#importFile', bad);
  await page.click('#importBtn');
  await expect(page.locator('#toast:not(.hidden)')).toBeVisible();
  await expect(page.locator('#toastMsg')).toContainText(/Import failed|inválido/i);
  await expect(page.locator('#vehicleSwitcher .vehicle-chip')).toHaveCount(before);
  fs.unlinkSync(bad);
});

test('valid JSON import replaces data after confirmation', async ({ page }) => {
  await startFresh(page);
  const payload = {
    vehicles: [{ id: 'v-imp', nickname: 'Imported', make: 'Toyota', model: 'Hilux', year: 2019, odometer: 50000 }],
    maintenance: [{ id: 'm-imp', vehicleId: 'v-imp', date: '2025-01-01', type: 'Oil change', odometer: 49000, cost: 80 }],
    fuel: [],
    mods: [],
    parts: [],
  };
  const good = tmpWrite('valid.json', JSON.stringify(payload));
  await switchTab(page, 'settings');
  page.on('dialog', (d) => d.accept());
  await page.setInputFiles('#importFile', good);
  await page.click('#importBtn');
  await page.waitForTimeout(500);
  await expect(page.locator('#vehicleSwitcher')).toContainText('Imported');
  fs.unlinkSync(good);
});

test('drag-and-drop JSON shows the drop overlay', async ({ page }) => {
  await startFresh(page);
  // Simulate dragenter with files to trigger the drop-over overlay
  await page.evaluate(() => {
    const dt = new DataTransfer();
    const blob = new Blob(['{}'], { type: 'application/json' });
    dt.items.add(new File([blob], 'data.json', { type: 'application/json' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
  });
  await expect(page.locator('body')).toHaveClass(/drag-over/);
  await page.evaluate(() => {
    window.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
  });
});

test('Header refresh clears cache, shows toast, reloads into loader', async ({ page }) => {
  await startFresh(page);
  await page.click('#refreshBtn');
  await expect(page.locator('#toast:not(.hidden)')).toBeVisible();
  await expect(page.locator('#toastMsg')).toContainText(/Clearing|Limpiando/);
  // After a moment the page reloads and the loader should appear again
  await page.waitForSelector('#continueBtn', { timeout: 10000 });
});
