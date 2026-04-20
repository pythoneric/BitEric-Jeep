import { test, expect } from '@playwright/test';

// Playwright Chromium on Windows reports "desktop" and skips the banner by
// design. To exercise the mobile code paths we override the User-Agent +
// touch points BEFORE any script runs using an init script + a custom context.

async function setupMobile(context, platform /* 'ios' | 'android' */) {
  const uaAndroid = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const uaIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
  await context.addInitScript((p) => {
    // matchMedia for standalone must always return false for these tests
    const original = window.matchMedia.bind(window);
    window.matchMedia = (q) => q.includes('standalone') ? ({ matches: false, addEventListener() {}, removeEventListener() {} }) : original(q);
    if (p === 'ios') {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    }
    try { Object.defineProperty(navigator, 'standalone', { get: () => false }); } catch {}
  }, platform);
  return { context, userAgent: platform === 'ios' ? uaIos : uaAndroid };
}

async function freshMobilePage(browser, platform) {
  const ua = platform === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: platform === 'android', // Playwright limits isMobile to Chromium
  });
  await setupMobile(context, platform);
  const page = await context.newPage();
  await page.goto('/jeep.html');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(r => { const req = indexedDB.deleteDatabase('biteric-jeep'); req.onsuccess = req.onerror = req.onblocked = () => r(); });
  });
  await page.reload();
  await page.waitForSelector('#startFreshBtn');
  return { context, page };
}

test('PWA banner does not show on desktop Chromium (default test env)', async ({ page }) => {
  await page.goto('/jeep.html');
  await page.waitForSelector('#startFreshBtn');
  await page.waitForTimeout(2000);
  await expect(page.locator('#pwaBanner')).toHaveClass(/hidden/);
});

test('PWA banner shows on Android with Install button visible', async ({ browser }) => {
  const { context, page } = await freshMobilePage(browser, 'android');
  await expect(page.locator('#pwaBanner')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('#pwaBanner')).toHaveClass(/show/);
  await expect(page.locator('#pwaBanner .pwa-banner-title')).toHaveText(/Install|Instalar/);
  // Android instructions reference home screen
  await expect(page.locator('#pwaBannerInstructions')).toContainText(/home screen|pantalla de inicio/i);
  await context.close();
});

test('PWA banner shows on iOS and hides the Install button (no prompt API)', async ({ browser }) => {
  const { context, page } = await freshMobilePage(browser, 'ios');
  await expect(page.locator('#pwaBanner')).not.toHaveClass(/hidden/, { timeout: 5000 });
  // iOS instructions reference Share button
  await expect(page.locator('#pwaBannerInstructions')).toContainText(/Share|Compartir/i);
  // Programmatic install isn't possible on iOS — button should be hidden
  await expect(page.locator('#pwaInstallBannerBtn')).toHaveClass(/hidden/);
  await context.close();
});

test('Dismissing the banner persists across reloads', async ({ browser }) => {
  const { context, page } = await freshMobilePage(browser, 'android');
  await expect(page.locator('#pwaBanner')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await page.click('#pwaCloseBtn');
  await expect(page.locator('#pwaBanner')).toHaveClass(/hidden/, { timeout: 2000 });
  // Reload — banner should stay hidden
  await page.reload();
  await page.waitForSelector('#startFreshBtn');
  await page.waitForTimeout(2000);
  await expect(page.locator('#pwaBanner')).toHaveClass(/hidden/);
  await context.close();
});

test('Banner instructions re-localize on language toggle', async ({ browser }) => {
  const { context, page } = await freshMobilePage(browser, 'android');
  await expect(page.locator('#pwaBannerInstructions')).toContainText('home screen');
  // Header #langToggle is behind the loader overlay at this moment — use the
  // loader's own language button which is on the loader layer.
  await page.click('#langToggleLoader');
  await expect(page.locator('#pwaBannerInstructions')).toContainText('pantalla de inicio');
  await context.close();
});
