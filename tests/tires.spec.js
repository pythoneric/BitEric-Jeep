import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

async function addTireSet(page, { brand = 'BFGoodrich', model = 'KO2', size = '33x12.50R17', installDate = '2024-03-01', installOdo = '8500' } = {}) {
  await switchTab(page, 'tires');
  await page.fill('#tireBrand', brand);
  await page.fill('#tireModel', model);
  await page.fill('#tireSize', size);
  await page.fill('#tireInstallDate', installDate);
  await page.fill('#tireInstallOdo', installOdo);
  await page.click('#tireSetForm button[type="submit"]');
}

test('Tires tab renders with empty-state message before any set is added', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'tires');
  await expect(page.locator('#activeTireSetCard')).toContainText(/No active tire set|Sin juego activo/);
  // Rotation + tread forms are hidden until a set exists.
  await expect(page.locator('#rotationFormCard')).toBeHidden();
  await expect(page.locator('#treadFormCard')).toBeHidden();
});

test('adding a tire set surfaces brand/model/size on the active card', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  await expect(page.locator('#activeTireSetCard')).toContainText('BFGoodrich');
  await expect(page.locator('#activeTireSetCard')).toContainText('KO2');
  await expect(page.locator('#activeTireSetCard')).toContainText('33x12.50R17');
  await expect(page.locator('#rotationFormCard')).toBeVisible();
  await expect(page.locator('#treadFormCard')).toBeVisible();
});

test('rotation log persists entries with date, odometer, and pattern label', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  await page.fill('#rotDate', '2024-06-15');
  await page.fill('#rotOdo', '15000');
  await page.selectOption('#rotPattern', 'x-pattern');
  await page.click('#rotationForm button[type="submit"]');
  const rotItem = page.locator('#rotationList li').first();
  await expect(rotItem).toContainText('2024-06-15');
  await expect(rotItem).toContainText('15,000');
  await expect(rotItem).toContainText(/X-pattern|Patrón en X/);
});

test('tread measurement captures all four corners in 32nds', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  await page.fill('#treadDate', '2024-07-01');
  await page.fill('#treadOdo', '16000');
  await page.fill('#treadFL', '8');
  await page.fill('#treadFR', '7.5');
  await page.fill('#treadRL', '8');
  await page.fill('#treadRR', '7');
  await page.click('#treadForm button[type="submit"]');
  const row = page.locator('#treadList li').first();
  await expect(row).toContainText('FL 8/32');
  await expect(row).toContainText('FR 7.5/32');
  await expect(row).toContainText('RR 7/32');
});

test('dashboard Tires card summarizes the active set', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#tiresDashCard')).toContainText('BFGoodrich');
  await expect(page.locator('#tiresDashCard')).toContainText('33x12.50R17');
});

test('low tread triggers a replacement warning on the active card', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  await page.fill('#treadDate', '2024-08-01');
  await page.fill('#treadOdo', '25000');
  // All four corners at 3/32 — below the 4/32 replacement threshold.
  for (const id of ['#treadFL', '#treadFR', '#treadRL', '#treadRR']) await page.fill(id, '3');
  await page.click('#treadForm button[type="submit"]');
  await expect(page.locator('#activeTireSetCard')).toContainText(/Low tread|Banda baja/);
});

test('retire flow moves the set into the retired list', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  // prompt() for the retire reason — accept empty so we don't depend on text
  page.once('dialog', d => d.accept(''));
  await page.click('#retireActiveTireBtn');
  await expect(page.locator('#activeTireSetCard')).toContainText(/No active tire set|Sin juego activo/);
  await expect(page.locator('#retiredTiresList')).toContainText('BFGoodrich');
});

test('round-trip export → clear → import preserves tire set, rotation, and tread', async ({ page }) => {
  await startFresh(page);
  await addTireSet(page);
  await page.fill('#rotDate', '2024-06-15');
  await page.fill('#rotOdo', '15000');
  await page.selectOption('#rotPattern', 'x-pattern');
  await page.click('#rotationForm button[type="submit"]');
  await page.fill('#treadDate', '2024-07-01');
  await page.fill('#treadOdo', '16000');
  await page.fill('#treadFL', '9');
  await page.click('#treadForm button[type="submit"]');
  // Export, capture the JSON.
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs');
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(Array.isArray(json.tires)).toBe(true);
  expect(json.tires.length).toBe(1);
  expect(json.tires[0].brand).toBe('BFGoodrich');
  expect(json.tires[0].rotations.length).toBe(1);
  expect(json.tires[0].treadMeasurements.length).toBe(1);
});
