// Shared setup helpers for Playwright tests.
// The app persists state in IndexedDB + localStorage, so each test clears both
// before interacting. We go straight to /jeep.html to avoid the index.html
// meta-refresh race that caused the original smoke tests to fail.

async function clearStorage(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('biteric-jeep');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
}

export async function openLoader(page) {
  await page.goto('/jeep.html');
  await page.waitForSelector('#loader');
  await clearStorage(page);
  await page.reload();
  await page.waitForSelector('#startFreshBtn');
}

export async function startFresh(page) {
  await openLoader(page);
  await page.click('#startFreshBtn');
  await page.waitForSelector('#loader', { state: 'hidden', timeout: 10000 });
  // Start Fresh now lands on Settings with an empty DB, prompting the user to
  // add their first vehicle. Add a minimal one so tests that expect an active
  // vehicle can proceed.
  await page.waitForSelector('#vehicleForm');
  await page.fill('#vNickname', 'Test Rig');
  await page.fill('#vMake', 'Jeep');
  await page.fill('#vModel', 'Wrangler');
  await page.fill('#vYear', '2020');
  await page.click('#vehicleForm button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('#vehicleSelect option').length > 0);
}

export async function loadDemoSUV(page) {
  await openLoader(page);
  await page.click('#demoSUVBtn');
  await page.waitForSelector('#loader', { state: 'hidden', timeout: 10000 });
}

export async function loadDemoTruck(page) {
  await openLoader(page);
  await page.click('#demoTruckBtn');
  await page.waitForSelector('#loader', { state: 'hidden', timeout: 10000 });
}

export async function switchTab(page, tab) {
  await page.click(`[data-tab="${tab}"]`);
  await page.waitForSelector(`#${tab}:not(.hidden)`);
}

// Template for "oil" also auto-opens the reminder <details>, so fields inside
// it become visible for subsequent interaction.
export async function useOilTemplate(page) {
  await page.selectOption('#mTemplate', 'oil');
}
