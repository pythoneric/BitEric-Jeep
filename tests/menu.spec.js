import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

const TAB_NAMES = ['Dashboard', 'Maintenance', 'Fuel', 'Mods', 'Tires', 'Trails', 'Parts', 'Docs', 'Settings'];

test('all nine tabs are rendered on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startFresh(page);
  const tabs = page.locator('nav.tabs .tab');
  await expect(tabs).toHaveCount(9);
  for (const name of TAB_NAMES) {
    await expect(tabs.filter({ hasText: name })).toHaveCount(1);
  }
});

test('all nine tabs remain on-screen at narrow (mobile) widths', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startFresh(page);
  const tabs = await page.locator('.tab').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { right: r.right, visible: e.offsetParent !== null };
    }),
  );
  expect(tabs).toHaveLength(9);
  // Every tab must fit in the viewport so users can see all sections
  // without horizontal scrolling (regression for the min-width: 100px bug).
  for (const t of tabs) {
    expect(t.visible).toBe(true);
    expect(t.right).toBeLessThanOrEqual(375 + 1);
  }
});

test('clicking each tab switches the visible section', async ({ page }) => {
  await startFresh(page);
  for (const tab of ['maintenance', 'fuel', 'mods', 'tires', 'trails', 'parts', 'docs', 'settings', 'dashboard']) {
    await switchTab(page, tab);
    await expect(page.locator(`#${tab}`)).toBeVisible();
    await expect(page.locator(`[data-tab="${tab}"]`)).toHaveClass(/active/);
  }
});

test('keyboard shortcuts 1-9 switch tabs', async ({ page }) => {
  await startFresh(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const expected = ['dashboard', 'maintenance', 'fuel', 'mods', 'tires', 'trails', 'parts', 'docs', 'settings'];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press(String(i + 1));
    await expect(page.locator(`[data-tab="${expected[i]}"]`)).toHaveClass(/active/);
  }
});

test('tabs carry accessible role and are keyboard-activatable', async ({ page }) => {
  await startFresh(page);
  await expect(page.locator('nav.tabs')).toHaveAttribute('role', 'tablist');
  const roles = await page.locator('.tab').evaluateAll((els) => els.map((e) => e.getAttribute('role')));
  expect(roles.every((r) => r === 'tab')).toBe(true);
  // Roving tabindex (WAI-ARIA tab pattern): exactly one active tab carries
  // tabindex=0, the rest are -1 so the group is a single tabstop.
  const indices = await page.locator('.tab').evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
  expect(indices.filter((i) => i === '0')).toHaveLength(1);
  expect(indices.filter((i) => i === '-1')).toHaveLength(indices.length - 1);
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

test('tabs dock to the bottom of the viewport at mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startFresh(page);
  const { navBottom, navTop, viewportHeight, position } = await page.evaluate(() => {
    const nav = document.querySelector('nav.tabs');
    const r = nav.getBoundingClientRect();
    return {
      navBottom: r.bottom,
      navTop: r.top,
      viewportHeight: window.innerHeight,
      position: getComputedStyle(nav).position,
    };
  });
  expect(position).toBe('fixed');
  // Nav should sit at the bottom edge (within 1px for safe-area rounding) and
  // occupy the lower half of the screen, not the top.
  expect(navBottom).toBeGreaterThanOrEqual(viewportHeight - 1);
  expect(navTop).toBeGreaterThan(viewportHeight / 2);
});

test('tabs stay docked to the top on desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startFresh(page);
  const position = await page.evaluate(() => getComputedStyle(document.querySelector('nav.tabs')).position);
  expect(position).not.toBe('fixed');
});

test('theme-color meta tracks the active theme for mobile status bars', async ({ page }) => {
  await startFresh(page);
  const initial = await page.getAttribute('meta#themeColorMeta', 'content');
  expect(initial).toMatch(/^#[0-9a-f]{6}$/i);
  await page.click('#themeToggle');
  const toggled = await page.getAttribute('meta#themeColorMeta', 'content');
  expect(toggled).not.toBe(initial);
  expect(toggled).toMatch(/^#[0-9a-f]{6}$/i);
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
