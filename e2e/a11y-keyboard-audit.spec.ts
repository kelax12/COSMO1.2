// ═══════════════════════════════════════════════════════════════════
// Audit A-3 (2026-09-03) — clavier, modales, calendrier COSMO.
//
// Mesure ce qu'axe-core NE PEUT PAS voir : le déplacement du focus.
// Un tiers seulement des critères WCAG est automatisable, et le défaut du
// 2026-08-30 (flèches mortes dans le calendrier) l'avait déjà montré.
//
// 🔴 TÉMOIN OBLIGATOIRE. Le premier test joue les trois détecteurs (entrée
// du focus, piège, Échap) sur une modale Radix, dont le comportement est
// fourni par la bibliothèque. S'il échoue, aucune mesure suivante n'a de
// valeur : c'est la garde contre un harnais qui ne détecte plus rien.
//
// Deux régimes assumés :
//   · le DatePicker est ASSERTIONNÉ (findings C-29/C-30, corrigés ici) ;
//   · les modales maison et /agenda sont seulement IMPRIMÉS — leurs défauts
//     sont ouverts (C-31, C-32) et les figer en `expect(...).toBe(false)`
//     ferait échouer la CI le jour où quelqu'un les corrige.
// ═══════════════════════════════════════════════════════════════════

import { test, expect, navTo } from './fixtures';
import type { Page, Locator } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });

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

/** Marque l'élément focalisé pour pouvoir vérifier le RETOUR du focus. */
async function markTrigger(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('[data-a11y-trigger]').forEach((n) => n.removeAttribute('data-a11y-trigger'));
    (document.activeElement as HTMLElement | null)?.setAttribute('data-a11y-trigger', '1');
  });
}

async function measureFocus(
  page: Page,
  container: Locator,
  checkReturn = false,
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
  if (escClosed && checkReturn) {
    // Radix restitue le focus APRÈS le démontage : mesurer trop tôt rendrait
    // « false » sur une modale conforme, donc un finding faux.
    await page.waitForTimeout(600);
    focusReturned = await page.evaluate(
      () => document.activeElement?.hasAttribute('data-a11y-trigger') ?? false,
    );
  }

  return { focusMovedIn, focusedOnOpen, trapped: firstEscapee === null, firstEscapee, escClosed, role, ariaModal, focusReturned };
}

// ── TÉMOIN ────────────────────────────────────────────────────────
test('TÉMOIN — modale Radix « Créer une tâche »', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  const trigger = page.getByRole('button', { name: /^créer une (nouvelle )?tâche$/i }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /créer une nouvelle tâche/i });
  await expect(dialog).toBeVisible({ timeout: 20_000 });

  const report = await measureFocus(page, dialog, true);
  console.log('[a11y-kbd] TEMOIN Radix', JSON.stringify(report));
  expect(report.focusMovedIn, `témoin: focus resté sur ${report.focusedOnOpen}`).toBe(true);
  expect(report.trapped, `témoin: focus sorti sur ${report.firstEscapee}`).toBe(true);
  expect(report.escClosed, 'témoin: Échap ne ferme pas').toBe(true);
});

// ── Modales maison ────────────────────────────────────────────────
test('MESURE — HabitModal', async ({ demoPage: page }) => {
  await navTo(page, /habitudes|habits/i, /\/habits/);
  const trigger = page.locator('[data-tutorial-id="habits-create-button"]').filter({ visible: true }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.dispatchEvent('click');
  const overlay = page.locator('div.fixed.inset-0').filter({ visible: true }).last();
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  console.log('[a11y-kbd] HabitModal', JSON.stringify(await measureFocus(page, overlay, true)));
});

test('MESURE — EventModal (/agenda)', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  const trigger = page.getByRole('button', { name: /^nouveau$/i }).filter({ visible: true }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.dispatchEvent('click');
  const overlay = page.locator('div.fixed.inset-0').filter({ visible: true }).last();
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  console.log('[a11y-kbd] EventModal', JSON.stringify(await measureFocus(page, overlay, true)));
});
test('MESURE — DatePicker ancré à un champ (modale OKR)', async ({ demoPage: page }) => {
  await navTo(page, /okr/i, /\/okr/);
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('button', { name: /créer un nouvel objectif/i }).filter({ visible: true }).first();
  await trigger.click({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const dateBtn = page
    .locator('button')
    .filter({ hasText: /\d{1,2}\s+\p{L}+\s+\d{4}|jj\/mm\/aaaa|\d{2}\/\d{2}\/\d{4}|choisir une date/iu })
    .filter({ visible: true })
    .first();
  const hasField = await dateBtn.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!hasField) {
    const btns = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => (b as HTMLElement).offsetParent !== null)
        .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40))
        .slice(0, 60),
    );
    console.log('[a11y-kbd] DatePicker — aucun champ date. Boutons visibles:', JSON.stringify(btns));
    return;
  }
  await dateBtn.focus();
  // Ouverture au CLAVIER, comme un utilisateur sans souris.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  const grid = page.locator('[role="grid"]').filter({ visible: true }).last();
  const gridVisible = await grid.isVisible().catch(() => false);
  const focusOnOpen = await describeFocus(page);
  let arrowMoved: boolean | null = null;
  let presetsReachable: string | null = null;
  let escClosed: boolean | null = null;
  if (gridVisible) {
    const f0 = await describeFocus(page);
    const ctx = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const root = document.querySelector('.rdp-root, [data-slot="calendar"]');
      return {
        caption: root?.querySelector('.rdp-month_caption, [class*="month_caption"]')?.textContent?.trim() ?? null,
        focusedInGrid: !!(el && root?.contains(el)),
        focusedVisible: !!(el && el.offsetParent !== null),
        fieldLabel: document.querySelector('[data-slot="popover-trigger"], button[aria-expanded="true"]')?.textContent?.trim() ?? null,
      };
    });
    console.log('[a11y-kbd] DatePicker contexte', JSON.stringify(ctx));
    const trace = [f0];
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
      trace.push(key + ' -> ' + (await describeFocus(page)));
    }
    console.log('[a11y-kbd] DatePicker fleches', JSON.stringify(trace));
    arrowMoved = (await describeFocus(page)) !== f0;
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(150);
    presetsReachable = await describeFocus(page);
    await page.keyboard.press('Escape');
    escClosed = await grid.waitFor({ state: 'hidden', timeout: 1_500 }).then(() => true).catch(() => false);
  }
  console.log('[a11y-kbd] DatePicker', JSON.stringify({ gridVisible, focusOnOpen, arrowMoved, presetsReachable, escClosed }));

  // Noms accessibles réellement annoncés par le calendrier.
  await dateBtn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const names = await page.evaluate(() => {
    const root = document.querySelector('.rdp-root, [data-slot="popover-content"]');
    if (!root) return null;
    return [...root.querySelectorAll('[aria-label]')]
      .map((n) => n.getAttribute('aria-label'))
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .slice(0, 12);
  });
  console.log('[a11y-kbd] DatePicker noms accessibles', JSON.stringify(names));

  // ── RÉGRESSION (findings C-29 et C-30) ──────────────────────────
  // 1. Ouvrir le calendrier au clavier doit poser le focus DANS la grille.
  //    `initialFocus` est mort en react-day-picker 9 (seul `autoFocus` est lu),
  //    et le focus tombait sur la rangée de presets, où les flèches ne font
  //    rien. Même classe que le `Button` non-forwardRef du 2026-08-30.
  expect(gridVisible, "le calendrier ne s'ouvre pas au clavier").toBe(true);
  expect(arrowMoved, "ArrowRight ne deplace pas le focus a l'ouverture").toBe(true);

  // 2. Aucun nom accessible en anglais dans un produit francophone.
  //    react-day-picker n'a AUCUNE traduction de ses labels ARIA : `locale`
  //    ne traduit que les DATES, pas les libellés de navigation.
  const english = (names ?? []).filter((n) => /^(Navigation bar|Go to the|Today,)/i.test(n ?? ''));
  expect(english, `noms accessibles anglais: ${JSON.stringify(english)}`).toHaveLength(0);
});

test('MESURE — /agenda FullCalendar au clavier', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  await page.waitForLoadState('networkidle');
  await page.locator('.fc').first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => {
    const root =
      document.querySelector('.fc') ??
      document.querySelector('[data-tutorial-id="agenda-calendar-grid"]');
    if (!root) {
      return {
        found: false,
        mainClasses: [...document.querySelectorAll('main *')]
          .slice(0, 40)
          .map((n) => (n as HTMLElement).className)
          .filter((c) => typeof c === 'string' && c)
          .slice(0, 15),
      } as Record<string, unknown>;
    }
    const q = (sel: string) => root.querySelectorAll(sel).length;
    return {
      found: true,
      rootClass: (root as HTMLElement).className.slice(0, 80),
      focusables: q('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      events: q('.fc-event'),
      focusableEvents: q('.fc-event[tabindex]:not([tabindex="-1"]), a.fc-event[href], button.fc-event'),
      dayCells: q('.fc-daygrid-day, .fc-timegrid-col'),
      focusableDays: q('.fc-daygrid-day[tabindex]:not([tabindex="-1"]), .fc-timegrid-col[tabindex]:not([tabindex="-1"])'),
      tableRoles: [...root.querySelectorAll('table')].map((t) => t.getAttribute('role')),
      gridRoles: [...root.querySelectorAll('[role="grid"], [role="rowgroup"], [role="gridcell"]')].length,
    };
  });
  console.log('[a11y-kbd] Agenda', JSON.stringify(stats));

  // Marche clavier réelle : combien de Tab pour traverser l'agenda, et
  // atteint-on un événement ?
  await page.locator('body').press('Tab');
  const walk: string[] = [];
  let reachedEvent = false;
  for (let i = 0; i < 60; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { label: 'NULL', isEvent: false };
      const isEvent = !!el.closest('.fc-event');
      const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '';
      return { label: `${el.tagName.toLowerCase()}[${name}]`, isEvent };
    });
    if (info.isEvent) { reachedEvent = true; walk.push('EVENT:' + info.label); break; }
    walk.push(info.label);
    await page.keyboard.press('Tab');
  }
  console.log('[a11y-kbd] Agenda marche clavier', JSON.stringify({ reachedEvent, steps: walk.length, walk: walk.slice(0, 30) }));
});
