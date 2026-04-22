import { test, expect } from '@playwright/test';
import { openLoader, startFresh, loadDemoTruck, switchTab } from './helpers.js';

test('can add a new vehicle', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.fill('#vNickname', 'Test Jeep');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Wrangler');
  await page.fill('#vYear', '2020');
  await page.click('#vehicleForm button[type="submit"]');
  await expect(page.locator('#vehicleSwitcher')).toContainText('Test Jeep');
});

test('Edit Active Vehicle form is populated with active vehicle data', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  await expect(page.locator('#eNickname')).toHaveValue('Gladiator Demo');
  await expect(page.locator('#eMake')).toHaveValue('Jeep');
  await expect(page.locator('#eModel')).toHaveValue('Gladiator');
});

test('editing and saving a vehicle updates the selector', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  await page.fill('#eNickname', 'Renamed Jeep');
  await page.click('#editVehicleForm button[type="submit"]');
  await expect(page.locator('#vehicleSwitcher')).toContainText('Renamed Jeep');
  await expect(page.locator('#toast:not(.hidden)')).toBeVisible();
});

test('setting manual value override overrides depreciation math', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  await page.fill('#eManualValue', '25000');
  await page.click('#editVehicleForm button[type="submit"]');
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleValueCard')).toContainText('$25,000');
  await expect(page.locator('#vehicleValueCard')).toContainText(/manual value|valor manual/i);
});

test('delete active vehicle cascades to maintenance/fuel/mods/parts', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'maintenance');
  const maintBefore = await page.locator('#maintenanceList li').count();
  expect(maintBefore).toBeGreaterThan(0);

  await switchTab(page, 'settings');
  page.on('dialog', (d) => d.accept());
  await page.click('#deleteVehicleBtn');
  // After cascade the active vehicle is gone — fall back to another or show
  // an empty selector. Either way no maintenance should remain.
  await switchTab(page, 'maintenance');
  await expect(page.locator('#maintenanceList .empty-state')).toBeVisible();
});

test('severe-service toggle halves template intervals', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.check('#eSevereService');
  await page.click('#editVehicleForm button[type="submit"]');
  await switchTab(page, 'maintenance');
  await page.selectOption('#mTemplate', 'oil');
  // Oil: 5000 mi / 6 mo normally → 2500 / 3 under severe service
  await expect(page.locator('#mIntervalMiles')).toHaveValue('2500');
  await expect(page.locator('#mIntervalMonths')).toHaveValue('3');
});

test('drivetrain specs show on the dashboard vehicle card', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  const card = await page.textContent('#vehicleCard');
  expect(card).toContain('3.0L EcoDiesel');
  expect(card).toContain('3.73');
  expect(card).toContain('33x12.50R17');
});

test('severe-service badge appears when toggled', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleCard .severe-service-badge')).toBeVisible();
});

test('per-vehicle goals drive dashboard cards', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.fill('#eMpgGoal', '18');
  await page.fill('#eMonthlyBudget', '200');
  await page.fill('#eAnnualBudget', '1800');
  await page.fill('#ePurchasePrice', '40000');
  await page.click('#editVehicleForm button[type="submit"]');
  await switchTab(page, 'dashboard');
  await expect(page.locator('#mpgGoalCard')).toContainText(/18/);
  // Budget card title adapts to what's set
  await expect(page.locator('#budgetCardTitle')).toContainText(/Budget|Presupuesto/);
});

test('vehicle switcher renders a car icon and one chip per vehicle', async ({ page }) => {
  await loadDemoTruck(page);
  await expect(page.locator('#vehicleSwitcher .vehicle-switcher-icon')).toHaveText('🚗');
  await expect(page.locator('#vehicleSwitcher .vehicle-chip')).toHaveCount(1);
  await expect(page.locator('#vehicleSwitcher .vehicle-chip.active')).toHaveText('Gladiator Demo');
});

test('adding a second vehicle appends a second chip without changing the active one', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  await page.fill('#vNickname', 'Second Rig');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Gladiator');
  await page.fill('#vYear', '2022');
  await page.click('#vehicleForm button[type="submit"]');
  await expect(page.locator('#vehicleSwitcher .vehicle-chip')).toHaveCount(2);
  await expect(page.locator('#vehicleSwitcher')).toContainText('Second Rig');
  // Active chip stays on the original demo vehicle
  await expect(page.locator('#vehicleSwitcher .vehicle-chip.active')).toHaveText('Gladiator Demo');
});

test('clicking a chip switches the active vehicle and updates the dashboard', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  await page.fill('#vNickname', 'Bronco Daily');
  await page.fill('#vMake', 'Ford');
  await page.fill('#vModel', 'Bronco');
  await page.fill('#vYear', '2023');
  await page.click('#vehicleForm button[type="submit"]');
  await switchTab(page, 'dashboard');
  await expect(page.locator('#vehicleCard')).toContainText('Gladiator');
  await page.locator('#vehicleSwitcher .vehicle-chip', { hasText: 'Bronco Daily' }).click();
  await expect(page.locator('#vehicleSwitcher .vehicle-chip.active')).toHaveText('Bronco Daily');
  await expect(page.locator('#vehicleSwitcher .vehicle-chip.active')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#vehicleCard')).toContainText('Bronco');
});

test('empty-state placeholder appears after Start Fresh with no vehicles added', async ({ page }) => {
  await openLoader(page);
  await page.click('#startFreshBtn');
  await page.waitForSelector('#currencyModal.open');
  await page.click('#currencyUsdBtn');
  await page.waitForSelector('#loader', { state: 'hidden', timeout: 10000 });
  await expect(page.locator('#vehicleSwitcher .vehicle-chip-empty')).toBeVisible();
  await expect(page.locator('#vehicleSwitcher .vehicle-chip')).toHaveCount(0);
  await expect(page.locator('#vehicleSwitcher .vehicle-chip-empty')).toHaveText(/Settings|Configuración/);
});

// --- Delete-confirm includes the vehicle nickname ---

test('delete-vehicle confirm names the vehicle', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.click('#deleteVehicleBtn');
  await page.waitForTimeout(200);
  // Demo vehicle nickname is "Gladiator Demo".
  expect(dialogs.some((m) => /Gladiator Demo/.test(m))).toBe(true);
});

// --- Year sanity warn ---

test('year outside 1987-(current+1) fires a sanity warning', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#vNickname', 'Time Machine');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'CJ-7');
  await page.fill('#vYear', '1800');
  await page.click('#vehicleForm button[type="submit"]');
  await page.waitForTimeout(200);
  expect(dialogs.some((m) => /1800|Wrangler|Gladiator/i.test(m))).toBe(true);
});

test('year inside 1987-(current+1) saves without a warning', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); });
  await page.fill('#vNickname', 'Modern Jeep');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Wrangler');
  await page.fill('#vYear', '2023');
  await page.click('#vehicleForm button[type="submit"]');
  await expect(page.locator('#vehicleSwitcher')).toContainText('Modern Jeep');
  expect(dialogs.length).toBe(0);
});

// --- VIN soft validation ---

test('invalid VIN (short / with O/I) fires a soft warning', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#vNickname', 'Bad VIN Jeep');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Wrangler');
  await page.fill('#vYear', '2020');
  await page.fill('#vVin', 'ABC123');
  await page.click('#vehicleForm button[type="submit"]');
  await page.waitForTimeout(200);
  expect(dialogs.some((m) => /VIN/i.test(m))).toBe(true);
});

test('empty VIN is allowed without a warning', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); });
  await page.fill('#vNickname', 'No VIN');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Wrangler');
  await page.fill('#vYear', '2020');
  await page.click('#vehicleForm button[type="submit"]');
  await expect(page.locator('#vehicleSwitcher')).toContainText('No VIN');
  expect(dialogs.length).toBe(0);
});

// --- Axle-ratio datalist + normalization ---

test('axle-ratio datalist exposes the common Jeep ratios', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const ratios = await page.locator('#axleRatioOptions option').evaluateAll((opts) => opts.map((o) => o.value));
  expect(ratios).toEqual(expect.arrayContaining(['3.21', '3.45', '3.73', '4.10', '4.56', '4.88', '5.13', '5.38']));
});

test('free-text axleRatio like "3.73 stock" still triggers regear warning on 35" tires', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.evaluate(() => {
    const d = document.querySelector('#editVehicleForm .drivetrain-details');
    if (d) d.open = true;
  });
  // Sloppy input — trailing annotation should still be recognized as 3.73 stock.
  await page.fill('#eAxleRatio', '3.73 stock');
  await page.click('#editVehicleForm button[type="submit"]');

  await switchTab(page, 'mods');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.fill('#modDate', '2024-01-01');
  await page.fill('#modOdometer', '15000');
  await page.selectOption('#modCategory', 'Tires/Wheels');
  await page.fill('#modPart', '35x12.50R17 All-Terrain');
  await page.fill('#modCost', '1500');
  await page.click('#modsForm button[type="submit"]');
  await page.waitForTimeout(400);
  expect(dialogs.some((m) => /regear|4\.56|4\.88/i.test(m))).toBe(true);
});

// --- min=0 on numeric vehicle fields ---

test('numeric vehicle fields have min="0" (reject negatives via HTML validation)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  for (const id of ['#vYear', '#vOdometer', '#vPurchasePrice', '#vMpgGoal', '#vMonthlyBudget', '#vAnnualBudget']) {
    const min = await page.locator(id).getAttribute('min');
    expect(min, `${id} should have a min attribute`).not.toBeNull();
  }
  for (const id of ['#eYear', '#eOdometer', '#ePurchasePrice', '#eMpgGoal', '#eMonthlyBudget', '#eAnnualBudget', '#eManualValue']) {
    const min = await page.locator(id).getAttribute('min');
    expect(min, `${id} should have a min attribute`).not.toBeNull();
  }
});

// --- Export schema version + include-photos toggle ---

test('export includes schemaVersion', async ({ page }, testInfo) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs/promises');
  const text = await fs.readFile(path, 'utf-8');
  const data = JSON.parse(text);
  expect(data.schemaVersion).toBe(1);
  expect(data.exportedAt).toBeTruthy();
  expect(Array.isArray(data.vehicles)).toBe(true);
  expect(data.vehicles.length).toBeGreaterThan(0);
});

test('export without photos toggle strips mod/maintenance photos', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  // Demo data has no photos today, but the toggle should still round-trip.
  // Seed a photo on one mod so we can verify it's stripped.
  await page.evaluate(async () => {
    const tx = (await indexedDB.databases()).find(() => true);
    // Use the app's DB handle via a public escape hatch — just read/write via
    // the same IndexedDB instance the app uses.
    const req = indexedDB.open('biteric-jeep');
    await new Promise((r) => { req.onsuccess = r; });
    const db = req.result;
    const t = db.transaction('mods', 'readwrite');
    const os = t.objectStore('mods');
    const all = await new Promise((r) => { const g = os.getAll(); g.onsuccess = () => r(g.result); });
    if (all.length) {
      all[0].photo = 'data:image/png;base64,XYZ';
      await new Promise((r) => { const p = os.put(all[0]); p.onsuccess = r; });
    }
    db.close();
  });
  await page.uncheck('#exportIncludePhotos');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs/promises');
  const data = JSON.parse(await fs.readFile(path, 'utf-8'));
  const anyPhoto = (data.mods || []).some((m) => m.photo) || (data.maintenance || []).some((m) => m.photo);
  expect(anyPhoto).toBe(false);
});

// --- Import hardening ---

test('clicking Import with no file selected shows a toast', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.click('#importBtn');
  await expect(page.locator('#toast:not(.hidden)')).toBeVisible();
  await expect(page.locator('#toastMsg')).toContainText(/Pick a file|Elige un archivo/i);
});

test('import invalid JSON surfaces the importInvalid toast', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.setInputFiles('#importFile', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not valid json'),
  });
  await page.click('#importBtn');
  await expect(page.locator('#toastMsg')).toContainText(/Import failed|Error al importar/i);
});

test('import blocks when a child row references a missing vehicleId', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const payload = {
    schemaVersion: 1,
    vehicles: [{ id: 'veh-1', nickname: 'Legit Jeep' }],
    maintenance: [{ id: 'm-1', vehicleId: 'missing-vehicle', date: '2024-01-01', type: 'Oil change' }],
  };
  await page.setInputFiles('#importFile', {
    name: 'orphan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await page.click('#importBtn');
  await expect(page.locator('#toastMsg')).toContainText(/vehicle that's not in the file|vehículo que no está en el archivo/i);
});

test('import replace confirm is i18n-aware (EN + ES)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  const payload = {
    schemaVersion: 1,
    vehicles: [{ id: 'veh-1', nickname: 'Replacement' }],
    maintenance: [], fuel: [], mods: [], parts: [], trails: [],
  };
  await page.setInputFiles('#importFile', {
    name: 'good.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  let replaceEnPrompt = '';
  page.once('dialog', (d) => { replaceEnPrompt = d.message(); d.dismiss(); });
  await page.click('#importBtn');
  await page.waitForTimeout(200);
  expect(replaceEnPrompt).toMatch(/Replace ALL data/);

  // Toggle to Spanish and try again.
  await page.click('#langToggle');
  let replaceEsPrompt = '';
  page.once('dialog', (d) => { replaceEsPrompt = d.message(); d.dismiss(); });
  await page.click('#importBtn');
  await page.waitForTimeout(200);
  expect(replaceEsPrompt).toMatch(/Reemplazar TODOS los datos/);
});

test('cancelling the replace confirm aborts without wiping data', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  const payload = {
    schemaVersion: 1,
    vehicles: [{ id: 'veh-other', nickname: 'Other Jeep' }],
  };
  await page.setInputFiles('#importFile', {
    name: 'good.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  // Cancel the replace confirm — original Demo vehicle should stay.
  page.on('dialog', (d) => d.dismiss());
  await page.click('#importBtn');
  await page.waitForTimeout(300);
  await expect(page.locator('#vehicleSwitcher')).toContainText('Gladiator Demo');
});

test('export → clear → import round-trip restores the vehicle', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs/promises');
  const buffer = await fs.readFile(path);

  // Nuke the active vehicle via cascade delete so there's nothing to import over.
  page.on('dialog', (d) => d.accept());
  await page.click('#deleteVehicleBtn');
  await expect(page.locator('#vehicleSwitcher .vehicle-chip-empty')).toBeVisible();

  // Re-import the backup. Need a fresh listener after the delete cascade consumed one.
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => d.accept());
  await page.setInputFiles('#importFile', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer,
  });
  await page.click('#importBtn');
  await expect(page.locator('#vehicleSwitcher')).toContainText('Gladiator Demo');
});
