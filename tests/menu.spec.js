import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

const TAB_NAMES = ['Dashboard', 'Maintenance', 'Fuel', 'Mods', 'Parts', 'Settings'];

test('all six tabs are rendered on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startFresh(page);
  const tabs = page.locator('nav.tabs .tab');
  await expect(tabs).toHaveCount(6);
  for (const name of TAB_NAMES) {
    await expect(tabs.filter({ hasText: name })).toHaveCount(1);
  }
});

test('all six tabs remain on-screen at narrow (mobile) widths', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startFresh(page);
  const tabs = await page.locator('.tab').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { right: r.right, visible: e.offsetParent !== null };
    }),
  );
  expect(tabs).toHaveLength(6);
  // Every tab must fit in the viewport so users can see all sections
  // without horizontal scrolling (regression for the min-width: 100px bug).
  for (const t of tabs) {
    expect(t.visible).toBe(true);
    expect(t.right).toBeLessThanOrEqual(375 + 1);
  }
});

test('clicking each tab switches the visible section', async ({ page }) => {
  await startFresh(page);
  for (const tab of ['maintenance', 'fuel', 'mods', 'parts', 'settings', 'dashboard']) {
    await switchTab(page, tab);
    await expect(page.locator(`#${tab}`)).toBeVisible();
    await expect(page.locator(`[data-tab="${tab}"]`)).toHaveClass(/active/);
  }
});

test('keyboard shortcuts 1-6 switch tabs', async ({ page }) => {
  await startFresh(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const expected = ['dashboard', 'maintenance', 'fuel', 'mods', 'parts', 'settings'];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(String(i + 1));
    await expect(page.locator(`[data-tab="${expected[i]}"]`)).toHaveClass(/active/);
  }
});

test('tabs carry accessible role and are keyboard-activatable', async ({ page }) => {
  await startFresh(page);
  await expect(page.locator('nav.tabs')).toHaveAttribute('role', 'tablist');
  const roles = await page.locator('.tab').evaluateAll((els) => els.map((e) => e.getAttribute('role')));
  expect(roles.every((r) => r === 'tab')).toBe(true);
  const indices = await page.locator('.tab').evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
  expect(indices.every((i) => i === '0')).toBe(true);
  // Enter on a focused tab activates it
  await page.locator('[data-tab="fuel"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tab="fuel"]')).toHaveClass(/active/);
});

test('Jeep Wrangler icon is rendered in the header', async ({ page }) => {
  await startFresh(page);
  const icon = page.locator('header .app-icon');
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box.width).toBeGreaterThan(16);
  expect(box.height).toBeGreaterThan(12);
});

test('light theme keeps header + tabs readable (regression)', async ({ page }) => {
  await startFresh(page);
  await page.click('#themeToggle');
  const colors = await page.evaluate(() => {
    const toRgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
    const luma = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    const contrast = (a, b) => {
      const [L1, L2] = [luma(a), luma(b)].sort((x, y) => y - x);
      return (L1 + 12.75) / (L2 + 12.75); // rough luminance ratio (0-255 scale)
    };
    const headerBg = toRgb(getComputedStyle(document.querySelector('header')).backgroundColor);
    const titleCol = toRgb(getComputedStyle(document.querySelector('.app-title')).color);
    const tabsBg = toRgb(getComputedStyle(document.querySelector('nav.tabs')).backgroundColor);
    const tabCol = toRgb(getComputedStyle(document.querySelector('.tab')).color);
    return {
      headerBgLuma: luma(headerBg),
      titleVsHeader: contrast(headerBg, titleCol),
      tabVsTabs: contrast(tabsBg, tabCol),
    };
  });
  // Light theme header must be bright (regression guard for the dark header bug)
  expect(colors.headerBgLuma).toBeGreaterThan(180);
  // Title and tab text must contrast meaningfully against their backgrounds
  expect(colors.titleVsHeader).toBeGreaterThan(1.8);
  expect(colors.tabVsTabs).toBeGreaterThan(1.8);
});

test('active tab persists across reload', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'fuel');
  await page.reload();
  // After reload the loader appears; continuing should remember the tab.
  await page.waitForSelector('#continueBtn');
  await page.click('#continueBtn');
  await page.waitForSelector('#loader', { state: 'hidden' });
  await expect(page.locator('[data-tab="fuel"]')).toHaveClass(/active/);
});
