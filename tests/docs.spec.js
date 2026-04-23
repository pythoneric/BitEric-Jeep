import { test, expect } from '@playwright/test';
import { startFresh, switchTab } from './helpers.js';

// Date helpers — expiration severity depends on calendar-day deltas. We emit
// a local-calendar YYYY-MM-DD string so browser-local interpretation matches
// what the user typed into the date input. The app parses date strings as
// UTC-midnight then setHours(0,0,0,0) shifts to local, so the rendered day
// count can be ±1 off in non-UTC timezones — tests therefore match rendered
// text with tolerant patterns (any digit), not exact numbers.
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

async function addDocument(page, {
  type = 'registration',
  name = 'State plate',
  provider = '',
  policyNumber = '',
  issueDate = '',
  expirationDate = offsetDate(365),
  cost = '',
  reminderDays = '30',
  notes = '',
} = {}) {
  await switchTab(page, 'docs');
  await page.selectOption('#docType', type);
  await page.fill('#docName', name);
  if (provider) await page.fill('#docProvider', provider);
  if (policyNumber) await page.fill('#docPolicyNumber', policyNumber);
  if (issueDate) await page.fill('#docIssueDate', issueDate);
  // autofillFormDefaults pre-fills expirationDate on first tab-open; explicit
  // fill overrides. We always set it to keep tests deterministic.
  await page.fill('#docExpirationDate', expirationDate);
  if (cost) await page.fill('#docCost', cost);
  await page.fill('#docReminderDays', reminderDays);
  if (notes) await page.fill('#docNotes', notes);
  await page.click('#docsForm button[type="submit"]');
}

test('Docs tab shows empty state when no documents logged', async ({ page }) => {
  await startFresh(page);
  await switchTab(page, 'docs');
  await expect(page.locator('#docsList .empty-state')).toContainText(/No documents yet|Aún no hay documentos/);
});

test('adding a document surfaces it in the list with the type label', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { type: 'insurance', name: 'State Farm auto policy', provider: 'State Farm', policyNumber: 'SF-12345' });
  await expect(page.locator('#docsList li')).toHaveCount(1);
  const row = page.locator('#docsList li').first();
  await expect(row).toContainText(/Insurance|Seguro/);
  await expect(row).toContainText('State Farm auto policy');
  await expect(row).toContainText('State Farm');
  await expect(row).toContainText('SF-12345');
});

test('expired document renders the "Expired N days ago" badge', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { expirationDate: offsetDate(-10) });
  const row = page.locator('#docsList li').first();
  // Any integer day-count is fine — the "Expired …" variant is the signal.
  await expect(row).toContainText(/Expired \d+ days? ago|Venció hace \d+ días?/);
});

test('today-ish expiration renders an overdue/today variant', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { expirationDate: offsetDate(0) });
  const row = page.locator('#docsList li').first();
  // TZ quirks can flip "today" into overdue-by-1 or due-soon-in-1 — accept
  // any of the three pressing labels so long as the row isn't rendered as
  // "Valid" (which would mean severity logic silently missed the expiration).
  await expect(row).not.toContainText(/Valid|Vigente/);
  await expect(row).toContainText(/Expires today|Vence hoy|Expired \d+ days? ago|Venció hace \d+ días?|Expires in \d+ days?|Vence en \d+ días?/);
});

test('document within reminder window renders the "Expires in N days" badge', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { expirationDate: offsetDate(15), reminderDays: '30' });
  const row = page.locator('#docsList li').first();
  await expect(row).toContainText(/Expires in \d+ days?|Vence en \d+ días?/);
});

test('document past the reminder window renders the "Valid" badge', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { expirationDate: offsetDate(200), reminderDays: '30' });
  const row = page.locator('#docsList li').first();
  await expect(row).toContainText(/Valid|Vigente/);
});

test('custom reminderDays window shifts when a doc enters "due-soon"', async ({ page }) => {
  await startFresh(page);
  // ~45 days out with a tight 30-day window = "Valid".
  await addDocument(page, { name: 'Short window', expirationDate: offsetDate(45), reminderDays: '30' });
  // Same horizon with a looser 60-day window = "due-soon".
  await addDocument(page, { name: 'Long window', expirationDate: offsetDate(45), reminderDays: '60' });
  const shortRow = page.locator('#docsList li', { hasText: 'Short window' });
  const longRow = page.locator('#docsList li', { hasText: 'Long window' });
  await expect(shortRow).toContainText(/Valid|Vigente/);
  await expect(longRow).toContainText(/Expires in \d+ days?|Vence en \d+ días?/);
});

test('editing a document updates it in place without creating a duplicate', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'Original title' });
  await page.click('#docsList .edit-btn');
  // Edit handler is async (awaits db.getAll). Wait for the form to finish
  // re-populating — the submit label flips to "Update" once editState is set.
  await expect(page.locator('#docsForm button[type="submit"]')).toHaveText(/Update|Actualizar/);
  await page.fill('#docName', 'Updated title');
  await page.click('#docsForm button[type="submit"]');
  const items = page.locator('#docsList li');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Updated title');
  await expect(items.first()).not.toContainText('Original title');
});

test('delete removes the document from the list', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'About to be deleted' });
  page.once('dialog', d => d.accept());
  await page.click('#docsList .del-btn');
  await expect(page.locator('#docsList .empty-state')).toBeVisible();
});

test('delete with undo restores the document', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'Undo me' });
  page.once('dialog', d => d.accept());
  await page.click('#docsList .del-btn');
  await page.click('#toastAction');
  await expect(page.locator('#docsList li')).toHaveCount(1);
  await expect(page.locator('#docsList li').first()).toContainText('Undo me');
});

test('search filters by name, provider, and policy number', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'State Farm policy', provider: 'State Farm', policyNumber: 'SF-777' });
  await addDocument(page, { type: 'registration', name: 'Plate ABC-123', policyNumber: '' });
  await addDocument(page, { type: 'inspection', name: 'Annual smog', provider: 'Jiffy' });
  await expect(page.locator('#docsList li')).toHaveCount(3);
  await page.fill('#docsSearch', 'state farm');
  await expect(page.locator('#docsList li')).toHaveCount(1);
  await page.fill('#docsSearch', 'sf-777');
  await expect(page.locator('#docsList li')).toHaveCount(1);
  await page.fill('#docsSearch', 'jiffy');
  await expect(page.locator('#docsList li')).toHaveCount(1);
  await page.fill('#docsSearch', 'nomatch');
  await expect(page.locator('#docsList .empty-state')).toContainText(/No documents match|Ningún documento coincide/);
});

test('dashboard Document Expirations card lists only overdue + due-soon items', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'Lapsed insurance', expirationDate: offsetDate(-5) });
  await addDocument(page, { name: 'Soon renewal', expirationDate: offsetDate(10), reminderDays: '30' });
  await addDocument(page, { name: 'Far future',    expirationDate: offsetDate(300), reminderDays: '30' });
  await switchTab(page, 'dashboard');
  const card = page.locator('#docExpirations');
  await expect(card).toContainText('Lapsed insurance');
  await expect(card).toContainText('Soon renewal');
  await expect(card).not.toContainText('Far future');
});

test('dashboard card shows "no expirations" when everything is safely in the future', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'Fresh policy', expirationDate: offsetDate(300), reminderDays: '30' });
  await switchTab(page, 'dashboard');
  await expect(page.locator('#docExpirations')).toContainText(/No documents expiring soon|Ningún documento próximo a vencer/);
});

test('cost + currency symbol render on the row', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'With cost', cost: '450' });
  await expect(page.locator('#docsList li').first()).toContainText(/\$450\.00/);
});

test('export → clear → import round-trip preserves documents', async ({ page }) => {
  await startFresh(page);
  await addDocument(page, { name: 'Insurance policy A', policyNumber: 'A-1', expirationDate: offsetDate(120) });
  await switchTab(page, 'settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs');
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(Array.isArray(json.documents)).toBe(true);
  expect(json.documents.length).toBe(1);
  expect(json.documents[0].name).toBe('Insurance policy A');
  expect(json.documents[0].policyNumber).toBe('A-1');
});
