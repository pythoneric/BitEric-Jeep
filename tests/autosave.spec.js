import { test, expect } from '@playwright/test';
import { startFresh, loadDemoTruck, switchTab } from './helpers.js';

// --- Draft auto-save: values survive a tab switch ---

test('Maintenance form draft survives a tab switch', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '12345');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '87.50');
  await page.fill('#mNotes', 'Mid-typed, about to switch tabs');
  // Playwright's fill fires `input` events synchronously, but the autosave
  // debounces 250ms — let it settle before navigating away.
  await page.waitForTimeout(350);
  await switchTab(page, 'fuel');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mDate')).toHaveValue('2024-05-01');
  await expect(page.locator('#mOdometer')).toHaveValue('12345');
  await expect(page.locator('#mType')).toHaveValue('Oil change');
  await expect(page.locator('#mCost')).toHaveValue('87.50');
  await expect(page.locator('#mNotes')).toHaveValue('Mid-typed, about to switch tabs');
});

test('Fuel form draft survives a tab switch', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-05-01');
  await page.fill('#fOdometer', '20000');
  await page.fill('#fGallons', '13.4');
  await page.fill('#fCost', '52.00');
  await page.fill('#fStation', 'Shell Manhattan Beach');
  await page.selectOption('#fFuelType', 'Premium');
  await page.waitForTimeout(350);
  await switchTab(page, 'dashboard');
  await switchTab(page, 'fuel');
  await expect(page.locator('#fDate')).toHaveValue('2024-05-01');
  await expect(page.locator('#fOdometer')).toHaveValue('20000');
  await expect(page.locator('#fGallons')).toHaveValue('13.4');
  await expect(page.locator('#fCost')).toHaveValue('52.00');
  await expect(page.locator('#fStation')).toHaveValue('Shell Manhattan Beach');
  await expect(page.locator('#fFuelType')).toHaveValue('Premium');
});

test('Mods draft survives a tab switch (and category follow-ups are restored)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-05-01');
  await page.fill('#modOdometer', '14000');
  await page.selectOption('#modCategory', 'Suspension');
  await page.fill('#modPart', 'Rancho 2.5" lift');
  await page.fill('#modCost', '1299');
  await page.waitForTimeout(350);
  await switchTab(page, 'parts');
  await switchTab(page, 'mods');
  await expect(page.locator('#modPart')).toHaveValue('Rancho 2.5" lift');
  await expect(page.locator('#modCategory')).toHaveValue('Suspension');
});

test('Trails draft survives a tab switch (including conditions + depth)', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'trails');
  await page.fill('#trailName', 'Rubicon — East Loop');
  await page.fill('#trailOdometer', '18500');
  await page.check('#trailWater');
  await page.selectOption('#trailWaterDepth', 'deep');
  await page.check('#trailRock');
  await page.waitForTimeout(350);
  await switchTab(page, 'dashboard');
  await switchTab(page, 'trails');
  await expect(page.locator('#trailName')).toHaveValue('Rubicon — East Loop');
  await expect(page.locator('#trailOdometer')).toHaveValue('18500');
  await expect(page.locator('#trailWater')).toBeChecked();
  await expect(page.locator('#trailRock')).toBeChecked();
  await expect(page.locator('#trailWaterDepth')).toHaveValue('deep');
});

test('Parts draft survives a tab switch', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'parts');
  await page.fill('#partName', 'NGK iridium plug set');
  await page.fill('#partNumber', 'NGK ILZKAR7D11HS');
  await page.selectOption('#partCategory', 'Electrical');
  await page.fill('#partQuantity', '6');
  await page.fill('#partCost', '12.25');
  await page.waitForTimeout(350);
  await switchTab(page, 'dashboard');
  await switchTab(page, 'parts');
  await expect(page.locator('#partName')).toHaveValue('NGK iridium plug set');
  await expect(page.locator('#partNumber')).toHaveValue('NGK ILZKAR7D11HS');
  await expect(page.locator('#partCategory')).toHaveValue('Electrical');
  await expect(page.locator('#partQuantity')).toHaveValue('6');
});

// --- Draft cleared on successful submit ---

test('Submitting the maintenance form clears its draft', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '12345');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  // localStorage draft key should be removed after a successful submit.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('draft:maintenanceForm'))).toBeNull();
  // Switch away and back — fields that aren't auto-populated (cost, notes)
  // should stay empty because the draft is gone. Date + odometer get re-
  // filled by autofillFormDefaults from today / vehicle.odometer, so we
  // can't use those to distinguish "draft restored" from "autofilled fresh."
  await switchTab(page, 'fuel');
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mCost')).toHaveValue('');
  await expect(page.locator('#mNotes')).toHaveValue('');
});

// --- Draft survives a full page reload ---

test('Maintenance draft survives a page reload', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-05-01');
  await page.fill('#mOdometer', '99999');
  await page.fill('#mNotes', 'Draft survives reload');
  await page.waitForTimeout(350);
  await page.reload();
  // Loader shows on reload — Continue past it.
  await page.waitForSelector('#continueBtn');
  await page.click('#continueBtn');
  await page.waitForSelector('#loader', { state: 'hidden' });
  await switchTab(page, 'maintenance');
  await expect(page.locator('#mOdometer')).toHaveValue('99999');
  await expect(page.locator('#mNotes')).toHaveValue('Draft survives reload');
});

// --- Export / import includes full settings ---

test('Export JSON includes the settings block', async ({ page }) => {
  await loadDemoTruck(page);
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs/promises');
  const data = JSON.parse(await fs.readFile(path, 'utf-8'));
  expect(data.settings).toBeDefined();
  expect(data.settings).toEqual(expect.objectContaining({
    lang: expect.any(String),
    theme: expect.any(String),
    currency: expect.any(String),
  }));
});

test('Exported JSON captures every saved change across every tab', async ({ page }) => {
  // Start fresh so we know exactly which records we wrote — no demo noise.
  // Default startFresh helper seeds one minimal vehicle ("Test Rig"), which
  // the export must preserve along with everything we add below.
  await startFresh(page);

  // 1. Settings / vehicle — open Edit Active Vehicle and add full drivetrain
  //    details so several optional fields get exercised.
  await switchTab(page, 'settings');
  await page.evaluate(() => {
    const d = document.querySelector('#editVehicleForm .drivetrain-details');
    if (d) d.open = true;
  });
  await page.fill('#eVin', '1C4HJXFG5NW201234');
  await page.fill('#eOdometer', '42000');
  await page.selectOption('#eEngine', '3.6L Pentastar');
  await page.fill('#eAxleRatio', '3.73');
  await page.fill('#eTireSize', '33x12.50R17');
  await page.fill('#ePurchasePrice', '42000');
  await page.click('#editVehicleForm button[type="submit"]');

  // 2. Maintenance entry.
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-06-01');
  await page.fill('#mOdometer', '42100');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '87.50');
  await page.fill('#mNotes', 'Full synthetic 0W-20, Mopar filter');
  await page.click('#maintenanceForm button[type="submit"]');

  // 3. Fuel fill.
  await switchTab(page, 'fuel');
  await page.fill('#fDate', '2024-06-05');
  await page.fill('#fOdometer', '42420');
  await page.fill('#fGallons', '15.2');
  await page.fill('#fCost', '62.10');
  await page.fill('#fStation', 'Shell');
  await page.selectOption('#fFuelType', 'Regular');
  await page.selectOption('#fDriving', 'Mixed');
  await page.click('#fuelForm button[type="submit"]');

  // 4. Mod — Tires/Wheels would fire the regear warn, so pick something
  //    quieter (Lighting). Stick to a dollar amount and category.
  await switchTab(page, 'mods');
  await page.fill('#modDate', '2024-06-10');
  await page.fill('#modOdometer', '42500');
  await page.selectOption('#modCategory', 'Lighting');
  await page.fill('#modPart', 'Baja Designs S8 50"');
  await page.fill('#modBrand', 'Baja Designs');
  await page.fill('#modCost', '1299');
  await page.click('#modsForm button[type="submit"]');

  // 5. Trail run.
  await switchTab(page, 'trails');
  await page.fill('#trailDate', '2024-06-15');
  await page.fill('#trailName', 'Moab — Fins & Things');
  await page.fill('#trailOdometer', '42600');
  await page.fill('#trailDuration', '4');
  await page.check('#trailRock');
  await page.fill('#trailAiredDownPsi', '18');
  await page.click('#trailsForm button[type="submit"]');

  // 6. Part.
  await switchTab(page, 'parts');
  await page.fill('#partName', 'Oil filter');
  await page.fill('#partNumber', 'Mopar MO-899');
  await page.selectOption('#partCategory', 'Filters');
  await page.fill('#partQuantity', '3');
  await page.fill('#partCost', '12.00');
  await page.fill('#partPurchaseDate', '2024-05-20');
  await page.fill('#partLocation', 'Garage shelf A');
  await page.click('#partsForm button[type="submit"]');

  // 7. Export the JSON file and read it back.
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs/promises');
  const data = JSON.parse(await fs.readFile(path, 'utf-8'));

  // 8. Every save we made must be present in the downloaded JSON.

  // Schema / settings envelope.
  expect(data.schemaVersion).toBe(1);
  expect(data.exportedAt).toBeTruthy();
  expect(data.settings).toEqual(expect.objectContaining({
    lang: expect.any(String),
    theme: expect.any(String),
    currency: 'USD',
    activeVehicleId: expect.any(String),
  }));

  // Vehicle — Test Rig with the edits we made applied.
  expect(data.vehicles).toHaveLength(1);
  expect(data.vehicles[0]).toEqual(expect.objectContaining({
    nickname: 'Test Rig',
    make: 'Jeep',
    model: 'Wrangler',
    year: 2020,
    vin: '1C4HJXFG5NW201234',
    odometer: 42600, // bumped by the later fuel/mod/trail entries
    purchasePrice: 42000,
    engine: '3.6L Pentastar',
    axleRatio: '3.73',
    tireSize: '33x12.50R17',
  }));

  // Maintenance entries — the rock trail we added later spawns two auto-
  // generated follow-ups (post-crawl inspection + universal undercarriage
  // rinse), which count as saved changes and must also be in the backup.
  // So we expect 1 user-authored Oil change + 2 autoGenerated rows.
  const userMaint = data.maintenance.filter(m => !m.autoGenerated);
  const autoMaint = data.maintenance.filter(m => m.autoGenerated);
  expect(userMaint).toHaveLength(1);
  expect(userMaint[0]).toEqual(expect.objectContaining({
    date: '2024-06-01',
    odometer: 42100,
    type: 'Oil change',
    cost: 87.5,
    notes: 'Full synthetic 0W-20, Mopar filter',
  }));
  expect(autoMaint).toHaveLength(2);
  expect(autoMaint.map(m => m.type)).toEqual(
    expect.arrayContaining(['Inspection', 'Undercarriage rinse'])
  );

  // Fuel entry.
  expect(data.fuel).toHaveLength(1);
  expect(data.fuel[0]).toEqual(expect.objectContaining({
    date: '2024-06-05',
    odometer: 42420,
    gallons: 15.2,
    cost: 62.1,
    station: 'Shell',
    fuelType: 'Regular',
    drivingCondition: 'Mixed',
    fullTank: true,
  }));

  // Mod entry.
  expect(data.mods).toHaveLength(1);
  expect(data.mods[0]).toEqual(expect.objectContaining({
    date: '2024-06-10',
    odometer: 42500,
    category: 'Lighting',
    part: 'Baja Designs S8 50"',
    brand: 'Baja Designs',
    cost: 1299,
    installed: true,
  }));

  // Trail entry with conditions + aired-down PSI.
  expect(data.trails).toHaveLength(1);
  expect(data.trails[0]).toEqual(expect.objectContaining({
    date: '2024-06-15',
    name: 'Moab — Fins & Things',
    odometer: 42600,
    durationHours: 4,
    airedDownPsi: 18,
  }));
  expect(data.trails[0].conditions).toEqual(expect.arrayContaining(['rock']));

  // Part entry with full SKU + category + cost + purchaseDate.
  expect(data.parts).toHaveLength(1);
  expect(data.parts[0]).toEqual(expect.objectContaining({
    name: 'Oil filter',
    partNumber: 'Mopar MO-899',
    category: 'Filters',
    quantity: 3,
    cost: 12,
    purchaseDate: '2024-05-20',
    location: 'Garage shelf A',
  }));

  // Every row carries the same vehicleId as the saved vehicle.
  const vehicleId = data.vehicles[0].id;
  for (const store of ['maintenance', 'fuel', 'mods', 'parts', 'trails']) {
    for (const row of data[store]) {
      expect(row.vehicleId, `${store} row should reference the saved vehicle`).toBe(vehicleId);
    }
  }
});

test('Import round-trip restores currency + language from the backup', async ({ page }) => {
  // 1. Start fresh in DOP, set Spanish, export.
  await startFresh(page, { currency: 'DOP' });
  await page.click('#langToggle'); // flip to ES
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const filePath = await download.path();
  const fs = await import('fs/promises');
  const buffer = await fs.readFile(filePath);

  // Sanity: the backup carries the restored settings we expect.
  const payload = JSON.parse(buffer.toString('utf-8'));
  expect(payload.settings.currency).toBe('DOP');
  expect(payload.settings.lang).toBe('es');

  // 2. Nuke into a default-language, default-currency state.
  await page.evaluate(() => { localStorage.removeItem('lang'); localStorage.removeItem('currency'); });
  await page.reload();
  // Dismiss loader; use Demo Truck to put us in USD/EN before the import.
  await page.waitForSelector('#demoTruckBtn');
  await page.click('#demoTruckBtn');
  await page.waitForSelector('#loader', { state: 'hidden' });

  // 3. Import the earlier backup and confirm the replace prompts.
  await switchTab(page, 'settings');
  await page.setInputFiles('#importFile', {
    name: 'round-trip.json',
    mimeType: 'application/json',
    buffer,
  });
  page.on('dialog', (d) => d.accept());
  await page.click('#importBtn');
  // Wait for the success toast — signals the settings restore has completed.
  await expect(page.locator('#toastMsg')).toContainText(/Imported|Importado/i);

  // 4. After import, currency + lang should be back to DOP / ES.
  const after = await page.evaluate(() => ({
    currency: localStorage.getItem('currency'),
    lang: localStorage.getItem('lang'),
  }));
  expect(after.currency).toBe('DOP');
  expect(after.lang).toBe('es');
});
