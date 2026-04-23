import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

// Headless Chromium reports Notification.permission === 'denied' even after
// context.grantPermissions — so we stub Notification at page-init time to
// simulate the three states (default / granted / denied) deterministically.
async function stubNotification(page, permission) {
  await page.addInitScript((perm) => {
    const Orig = window.Notification;
    function Stub(title, opts) { Stub.__fires = (Stub.__fires || 0) + 1; return Object.create(Orig?.prototype || Object.prototype); }
    Object.defineProperty(Stub, 'permission', { get: () => perm });
    Stub.requestPermission = () => Promise.resolve(perm);
    Stub.__fires = 0;
    window.Notification = Stub;
  }, permission);
}

test('Notifications section is present in Settings', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'settings');
  await expect(page.getByRole('heading', { name: /Notifications|Notificaciones/ })).toBeVisible();
});

test('default permission shows Enable button and hides Test button', async ({ page }) => {
  await stubNotification(page, 'default');
  await startFresh(page);
  await switchTab(page, 'settings');
  await expect(page.locator('#notifEnableBtn')).toBeVisible();
  await expect(page.locator('#notifTestBtn')).toBeHidden();
  await expect(page.locator('#notifStatus')).toHaveText('');
});

test('granted permission hides Enable, shows Test, and shows Enabled status', async ({ page }) => {
  await stubNotification(page, 'granted');
  await startFresh(page);
  await switchTab(page, 'settings');
  await expect(page.locator('#notifEnableBtn')).toBeHidden();
  await expect(page.locator('#notifTestBtn')).toBeVisible();
  await expect(page.locator('#notifStatus')).toHaveText(/Enabled|Activadas/);
});

test('denied permission hides both buttons and shows Blocked status', async ({ page }) => {
  await stubNotification(page, 'denied');
  await startFresh(page);
  await switchTab(page, 'settings');
  await expect(page.locator('#notifEnableBtn')).toBeHidden();
  await expect(page.locator('#notifTestBtn')).toBeHidden();
  await expect(page.locator('#notifStatus')).toHaveText(/Blocked|Bloqueadas/);
});

test('Test button fires a notification via the service worker when granted', async ({ page }) => {
  await stubNotification(page, 'granted');
  await startFresh(page);
  await switchTab(page, 'settings');
  await page.evaluate(async () => {
    window.__swFires = 0;
    const reg = await navigator.serviceWorker.ready;
    const orig = reg.showNotification.bind(reg);
    reg.showNotification = (title, opts) => { window.__swFires++; return orig(title, opts); };
  });
  await page.click('#notifTestBtn');
  await expect.poll(() => page.evaluate(() => window.__swFires)).toBeGreaterThanOrEqual(1);
});
