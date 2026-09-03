// ═══════════════════════════════════════════════════════════════════
// Audit A-3 — HARNAIS DE MESURE (clavier, modales, calendrier)
//
// Mesure ce qu'axe-core ne peut pas voir : le déplacement du focus.
// Ce fichier IMPRIME ce qu'il mesure ; il n'assertionne que le TÉMOIN.
// ═══════════════════════════════════════════════════════════════════

import { test, expect, navTo } from './fixtures';
import type { Page, Locator } from '@playwright/test';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

interface FocusReport {
  focusMovedIn: boolean;
  focusedOnOpen: string;
  trapped: boolean;
  firstEscapee: string | null;
  escClosed: boolean;
  role: string | null;
  ariaModal: string | null;
  focusReturned: boolean | null;
}

async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'BODY';
    const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}[${name}]`;
  });
}

async function focusInside(container: Locator): Promise<boolean> {
  return container.evaluate((node) => node.contains(document.activeElement));
}

async function measureFocus(
  page: Page,
  container: Locator,
  triggerName?: string,
): Promise<FocusReport> {
  const focusedOnOpen = await describeFocus(page);
  const focusMovedIn = await focusInside(container);
  const role = await container.getAttribute('role');
  const ariaModal = await container.getAttribute('aria-modal');

  let firstEscapee: string | null = null;
  for (let i = 0; i < 15 && firstEscapee === null; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusInside(container))) firstEscapee = await describeFocus(page);
  }

  await page.keyboard.press('Escape');
  const escClosed = await container
    .waitFor({ state: 'hidden', timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  let focusReturned: boolean | null = null;
  if (escClosed && triggerName) {
    const focused = await describeFocus(page);
    focusReturned = new RegExp(triggerName, 'i').test(focused);
  }

  return { focusMovedIn, focusedOnOpen, trapped: firstEscapee === null, firstEscapee, escClosed, role, ariaModal, focusReturned };
}

// ── TÉMOIN ────────────────────────────────────────────────────────
test('TÉMOIN — modale Radix « Créer une tâche »', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  await page.getByRole('button', { name: /^créer une (nouvelle )?tâche$/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /créer une nouvelle tâche/i });
  await expect(dialog).toBeVisible({ timeout: 20_000 });

  const report = await measureFocus(page, dialog, 'créer une');
  console.log('[a11y-kbd] TEMOIN Radix', JSON.stringify(report));
  expect(report.focusMovedIn, `témoin: focus resté sur ${report.focusedOnOpen}`).toBe(true);
  expect(report.trapped, `témoin: focus sorti sur ${report.firstEscapee}`).toBe(true);
  expect(report.escClosed, 'témoin: Échap ne ferme pas').toBe(true);
});

// ── Modales maison ────────────────────────────────────────────────
test('MESURE — HabitModal', async ({ demoPage: page }) => {
  await navTo(page, /habitudes|habits/i, /\/habits/);
  const trigger = page.getByRole('button', { name: /nouvelle habitude/i }).filter({ visible: true }).first();
  await trigger.click();
  const card = page.locator('form').filter({ visible: true }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  console.log('[a11y-kbd] HabitModal', JSON.stringify(await measureFocus(page, card, 'nouvelle habitude')));
});

test('MESURE — EventModal (/agenda)', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  const trigger = page.getByRole('button', { name: /nouvel? (é|e)v(é|e)nement|ajouter un (é|e)v(é|e)nement/i }).filter({ visible: true }).first();
  await trigger.click({ timeout: 20_000 });
  const card = page.locator('form').filter({ visible: true }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  console.log('[a11y-kbd] EventModal', JSON.stringify(await measureFocus(page, card, 'v(é|e)nement')));
});

// ── Calendrier COSMO ouvert depuis une ENTRÉE DE MENU ─────────────
test('MESURE — calendrier du report en masse (OverdueBanner)', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  const trigger = page.getByRole('button', { name: /tout reporter|reporter tout/i }).filter({ visible: true }).first();
  const present = await trigger.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!present) {
    console.log('[a11y-kbd] OverdueBanner ABSENT — aucune tâche en retard dans le seed');
    test.skip();
    return;
  }
  await trigger.click();
  const menu = page.locator('[role="menu"]').filter({ visible: true }).first();
  await expect(menu).toBeVisible({ timeout: 10_000 });

  const before = await describeFocus(page);
  // « Choisir une date… » : dernier item du menu
  await page.getByRole('menuitem').filter({ visible: true }).last().click();
  await page.waitForTimeout(400);
  const grid = page.locator('[role="grid"]').filter({ visible: true }).first();
  const gridVisible = await grid.isVisible().catch(() => false);
  const afterFocus = await describeFocus(page);
  const focusInMenu = await menu.evaluate((n) => n.contains(document.activeElement)).catch(() => false);
  console.log('[a11y-kbd] OverdueBanner calendrier', JSON.stringify({ before, gridVisible, afterFocus, focusInMenu }));

  if (gridVisible) {
    // Marche clavier : flèche droite doit déplacer le focus d'un jour.
    const f0 = await describeFocus(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const f1 = await describeFocus(page);
    console.log('[a11y-kbd] OverdueBanner flèche', JSON.stringify({ f0, f1, moved: f0 !== f1 }));
  }
});

test('MESURE — /agenda FullCalendar au clavier', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  await page.waitForLoadState('networkidle');
  const stats = await page.evaluate(() => {
    const root = document.querySelector('.fc');
    if (!root) return { found: false } as Record<string, unknown>;
    const focusables = root.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const events = root.querySelectorAll('.fc-event');
    const focusableEvents = root.querySelectorAll(
      '.fc-event[tabindex]:not([tabindex="-1"]), a.fc-event[href], button.fc-event',
    );
    const dayCells = root.querySelectorAll('.fc-daygrid-day, .fc-timegrid-col');
    const focusableDays = root.querySelectorAll(
      '.fc-daygrid-day[tabindex]:not([tabindex="-1"]), .fc-timegrid-col[tabindex]:not([tabindex="-1"])',
    );
    return {
      found: true,
      focusables: focusables.length,
      events: events.length,
      focusableEvents: focusableEvents.length,
      dayCells: dayCells.length,
      focusableDays: focusableDays.length,
      gridRole: root.querySelector('.fc-scrollgrid')?.getAttribute('role') ?? null,
      tableRoles: [...root.querySelectorAll('table')].map((t) => t.getAttribute('role')),
    };
  });
  console.log('[a11y-kbd] Agenda', JSON.stringify(stats));
});
