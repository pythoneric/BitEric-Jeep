import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

test('"?" opens the keyboard shortcuts modal; Escape closes it', async ({ page }) => {
  await startFresh(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('?');
  await expect(page.locator('#shortcutsModal.open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shortcutsModal.open')).toHaveCount(0);
});

test('Close button dismisses the shortcuts modal', async ({ page }) => {
  await startFresh(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('?');
  await expect(page.locator('#shortcutsModal.open')).toBeVisible();
  await page.click('#shortcutsClose');
  await expect(page.locator('#shortcutsModal.open')).toHaveCount(0);
});

test('photo thumbnail click opens the lightbox; click to dismiss', async ({ page }) => {
  await startFresh(page);
  // Fake a mod with a photo (1x1 PNG data URL) so a .photo-thumb appears
  await page.evaluate(async () => {
    const vehicles = await new Promise((resolve) => {
      const req = indexedDB.open('biteric-jeep');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('vehicles', 'readonly');
        const store = tx.objectStore('vehicles');
        const g = store.getAll();
        g.onsuccess = () => resolve(g.result);
      };
    });
    const v = vehicles[0];
    const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==';
    await new Promise((resolve) => {
      const req = indexedDB.open('biteric-jeep');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('mods', 'readwrite');
        tx.objectStore('mods').add({
          id: 'm-photo-1',
          vehicleId: v.id,
          date: '2024-01-01',
          category: 'Lighting',
          part: 'LED Bar',
          brand: 'Rigid',
          cost: 500,
          installed: true,
          photo: img,
        });
        tx.oncomplete = () => resolve();
      };
    });
  });
  await page.reload();
  await page.click('#continueBtn');
  await page.waitForSelector('#loader', { state: 'hidden' });
  await switchTab(page, 'mods');
  await expect(page.locator('.photo-thumb')).toHaveCount(1);
  await page.locator('.photo-thumb').first().click();
  await expect(page.locator('#lightbox.open')).toBeVisible();
  await page.click('#lightbox');
  await expect(page.locator('#lightbox.open')).toHaveCount(0);
});

test('toast has live-region semantics', async ({ page }) => {
  await startFresh(page);
  await expect(page.locator('#toast')).toHaveAttribute('role', 'status');
  await expect(page.locator('#toast')).toHaveAttribute('aria-live', 'polite');
});

test('.hidden utility always collapses the element (cascade regression)', async ({ page }) => {
  await startFresh(page);
  // `.toast { display: flex }` and `.photo-preview { display: block }` both
  // come after `.hidden { display: none }` — with equal specificity the later
  // rule wins, so the toast was rendering as a floating empty square. `.hidden`
  // must use !important so the utility always collapses the element.
  for (const sel of ['#toast', '#mPhotoPreview', '#modPhotoPreview']) {
    const display = await page.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? { cls: el.className, display: getComputedStyle(el).display } : null;
    }, sel);
    expect(display).not.toBeNull();
    expect(display.cls).toContain('hidden');
    expect(display.display).toBe('none');
  }
});

test('focus-visible outlines are defined for interactive elements', async ({ page }) => {
  await startFresh(page);
  const rules = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes(':focus-visible')) out.push(rule.selectorText);
        }
      } catch {}
    }
    return out;
  });
  expect(rules.length).toBeGreaterThan(0);
});

test('form submit returns focus to first field', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'maintenance');
  await page.fill('#mDate', '2024-01-01');
  await page.fill('#mOdometer', '10000');
  await page.selectOption('#mType', 'Oil change');
  await page.fill('#mCost', '50');
  await page.click('#maintenanceForm button[type="submit"]');
  // Submit handler is async; wait for it to settle + refocus first field.
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('mDate');
});

test('offline indicator shows when offline event fires', async ({ page }) => {
  await startFresh(page);
  await expect(page.locator('.offline-badge')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.locator('.offline-badge')).toBeVisible();
});

test('install status block is rendered in Settings', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await expect(page.locator('#installStatus')).toBeVisible();
  const text = await page.locator('#installStatus').textContent();
  // One of: "Installed as an app", browser instructions, or iOS instructions
  expect((text || '').length).toBeGreaterThan(0);
});

test('cache info reports cached items and size', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  // May be empty if no SW cache yet, but should render (not throw)
  await expect(page.locator('#cacheInfo')).toBeVisible();
});

test('tabs are <button>s with ARIA tab pattern wiring', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'dashboard'); // startFresh lands on Settings; normalize
  const dashboardTab = page.locator('[data-tab="dashboard"]');
  await expect(dashboardTab).toHaveAttribute('role', 'tab');
  await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
  await expect(dashboardTab).toHaveAttribute('aria-controls', 'dashboard');
  // Roving tabindex: only the active tab is in the tab order
  const activeIdx = await dashboardTab.getAttribute('tabindex');
  expect(activeIdx).toBe('0');
  const inactiveIdx = await page.locator('[data-tab="maintenance"]').getAttribute('tabindex');
  expect(inactiveIdx).toBe('-1');
  // The corresponding panel has role=tabpanel + aria-labelledby
  await expect(page.locator('#dashboard')).toHaveAttribute('role', 'tabpanel');
  await expect(page.locator('#dashboard')).toHaveAttribute('aria-labelledby', 'tab-dashboard');
});

test('ArrowRight / ArrowLeft cycle tabs with WAI-ARIA pattern', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'dashboard');
  await page.locator('[data-tab="dashboard"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-tab="maintenance"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-tab="dashboard"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.locator('[data-tab="settings"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.locator('[data-tab="dashboard"]')).toHaveAttribute('aria-selected', 'true');
});

test('shortcuts modal traps Tab inside itself', async ({ page }) => {
  await startFresh(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('?');
  await expect(page.locator('#shortcutsModal.open')).toBeVisible();
  // First focusable in the modal is the Close button — Tab from it should wrap
  // back to itself (it is the only focusable inside).
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('shortcutsClose');
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('shortcutsClose');
  await page.keyboard.press('Escape');
});
