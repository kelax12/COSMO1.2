// ═══════════════════════════════════════════════════════════════════
// Audit a11y WCAG AA — 2026-05-29
//
// Lance axe-core sur les routes publiques + protégées (mode démo) et
// dump les violations dans le rapport HTML Playwright.
//
// Guard CI : `critical` est bloquant depuis l'audit architecture TOP-8, et
// `serious` l'est devenu le 2026-09-04 (C-23), sauf pour les règles nommées
// dans `SERIOUS_NOT_BLOCKING` — aujourd'hui une seule, le contraste, qui reste
// un arbitrage de marque (C-25).
//
// ⚠️ CE QUE CE FICHIER NE MESURE PAS, et il faut le savoir avant de lire ses
// chiffres : axe ne scanne que l'ÉTAT INITIAL de chaque route. Aucune modale,
// aucun menu, aucun calendrier ouvert n'entre dans ces totaux.
// ═══════════════════════════════════════════════════════════════════

import { test, expect, navTo } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Les règles `serious` qui restent NON bloquantes, et pourquoi.
 *
 * 🔴 CETTE LISTE EST NOMINATIVE EXPRÈS. Un seuil global (« bloquer critical,
 * dumper serious ») ne dit pas ce qu'on laisse passer : il laisse passer TOUT
 * ce qui n'a pas encore été regardé. Mesuré le 2026-09-04 : la landing portait
 * un `aria-prohibited-attr` — un `aria-label` sur un `div` sans rôle, dont les
 * enfants étaient `aria-hidden`, donc un bloc entièrement MUET pour un lecteur
 * d'écran — depuis assez longtemps pour qu'aucun run ne s'en émeuve. C'était
 * `serious`, donc dumpé, donc invisible.
 *
 * Depuis, tout `serious` casse la CI SAUF ce qui est nommé ici.
 */
const SERIOUS_NOT_BLOCKING: Record<string, string> = {
  // C-25 et C-23. Les 41 nœuds `serious` restants sont TOUS du contraste, et
  // ils se répartissent en familles qui demandent un arbitrage de marque, pas
  // un correctif : le bleu `#2563eb` sur son fond teinté `#e3ebfa` (4,31:1,
  // présent sur neuf routes), le blanc sur le DÉGRADÉ du bouton principal
  // (3,49 à 4,48 selon l'endroit où axe échantillonne le dégradé), et des
  // paires transitoires qu'axe mesure en plein fondu d'entrée (1,02:1), sur
  // lesquelles durcir rendrait la CI instable sans rendre rien plus lisible.
  //
  // ⚠️ Cette dispense est la DERNIÈRE : quand C-25 est tranché, elle tombe et
  // le durcissement est complet. Elle ne doit jamais servir à couvrir autre
  // chose que du contraste.
  'color-contrast': 'C-25 — arbitrage de marque, la teinte se choisit à l oeil sur la landing',
};

/**
 * Échoue le test sur toute violation `critical`, et sur toute violation
 * `serious` dont la règle n'est pas nommément dispensée ci-dessus.
 */
function assertNoCritical(violations: Result[], route: string) {
  const criticals = violations.filter(v => v.impact === 'critical');
  expect(
    criticals,
    `[a11y] ${route} — violation(s) critical: ${criticals.map(v => v.id).join(', ')}`,
  ).toHaveLength(0);

  const serious = violations.filter(
    v => v.impact === 'serious' && !(v.id in SERIOUS_NOT_BLOCKING),
  );
  expect(
    serious,
    [
      `[a11y] ${route} — violation(s) serious non dispensée(s) : ` +
        serious.map(v => `${v.id} (${v.nodes.length} noeud(s))`).join(', '),
      'Corriger, ou ajouter la règle à SERIOUS_NOT_BLOCKING AVEC sa raison et',
      "l'item qui la porte. Une dispense sans item est une regression qu'on",
      'a decide de ne plus voir.',
    ].join(String.fromCharCode(10)),
  ).toHaveLength(0);
}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const OUT_DIR = 'test-results/a11y';

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* ignore */ }
  // Compact summary for the audit report.
  const summary = results.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    tags: v.tags,
    help: v.help,
    nodes: v.nodes.length,
    // 🔴 TOUS les noeuds, plus les trois premiers. Le `slice(0, 3)` d'origine
    // est ce qui a produit un enonce FAUX dans le backlog : « trois violations
    // distinctes, deux tokens, bon marche », alors que la mesure complete rend
    // onze paires de couleurs sur 74 noeuds. Un echantillon rapporte comme un
    // total est pire qu'une absence de mesure — on agit dessus.
    samples: v.nodes.map(n => ({
      target: n.target,
      failureSummary: n.failureSummary,
      html: n.html.slice(0, 200),
    })),
  }));
  writeFileSync(join(OUT_DIR, `${label}.json`), JSON.stringify(summary, null, 2));
  return results.violations;
}

test.describe('a11y audit', () => {
  // The first navigation triggers vite's on-demand compile of heavy pages
  // (LandingPage + showcases). Give the cold-start headroom so the suite
  // doesn't flake on the very first goto under CI/loaded machines.
  test.describe.configure({ timeout: 120_000 });

  test('Landing (public)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const violations = await scan(page, 'landing');
    console.log(`[a11y] Landing: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Landing');
  });

  test('Login (public)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const violations = await scan(page, 'login');
    console.log(`[a11y] Login: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Login');
  });

  test('Dashboard (demo)', async ({ demoPage }) => {
    const violations = await scan(demoPage, 'dashboard');
    console.log(`[a11y] Dashboard: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Dashboard');
  });

  // Navigation SPA par défaut : elle vérifie au passage que le lien de nav
  // existe et pointe au bon endroit.
  //
  // NB : le commentaire historique « goto() casse le mode démo » est PÉRIMÉ.
  // Le mode démo est persisté dans localStorage (`cosmo_demo_active`, cf.
  // src/lib/app-mode.store.ts → wasDemoPersisted) et AuthContext restaure le
  // compte démo au rechargement. `goto()` est donc sûr après login — on s'en
  // sert pour les routes sans lien de nav (cf. Premium plus bas).
  test('Tasks (demo)', async ({ demoPage }) => {
    await navTo(demoPage, /to ?do|tâches|tasks/i, /\/tasks/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'tasks');
    console.log(`[a11y] Tasks: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Tasks');
  });

  test('Habits (demo)', async ({ demoPage }) => {
    await navTo(demoPage, /habitudes|habits/i, /\/habits/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'habits');
    console.log(`[a11y] Habits: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Habits');
  });

  test('OKR (demo)', async ({ demoPage }) => {
    // Viewport-aware : sur mobile, OKR est dans le sheet « Plus » de la tab bar
    await navTo(demoPage, /okr/i, /\/okr/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'okr');
    console.log(`[a11y] OKR: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'OKR');
  });

  test('Agenda (demo)', async ({ demoPage }) => {
    await navTo(demoPage, /agenda/i, /\/agenda/);
    await demoPage.waitForLoadState('networkidle');
    // FullCalendar est heavy — laisser le temps au rendu initial
    await demoPage.waitForTimeout(1_000);
    const violations = await scan(demoPage, 'agenda');
    console.log(`[a11y] Agenda: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Agenda');
  });

  test('Entreprise (demo)', async ({ demoPage }) => {
    // Membre de « Nova Studio » en démo — lien visible (sidebar ou sheet Plus).
    await navTo(demoPage, /entreprise/i, /\/entreprise/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'entreprise');
    console.log(`[a11y] Entreprise: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Entreprise');
  });

  test('Statistics (demo)', async ({ demoPage }) => {
    await navTo(demoPage, /statistiques?|statistics/i, /\/statistics/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'statistics');
    console.log(`[a11y] Statistics: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Statistics');
  });

  test('Settings (demo)', async ({ demoPage }) => {
    await navTo(demoPage, /param[èe]tres?|settings/i, /\/settings/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'settings');
    console.log(`[a11y] Settings: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Settings');
  });

  test('Premium (demo)', async ({ demoPage }) => {
    // Pas de navTo ici : le lien « Premium » de la sidebar desktop est rendu
    // sous condition `PREMIUM_ENFORCED` (= false depuis 2026-06-21, premium
    // gratuit pour tous — cf. src/modules/billing/premium-config.ts). Sans lien
    // visible, navTo basculait sur la branche mobile et cherchait un bouton
    // « Plus d'options » inexistant sur desktop → timeout de 120 s.
    // La route et la page existent toujours : on y va par URL (le mode démo
    // survit au rechargement, cf. commentaire plus haut) afin que le scan a11y
    // de la page Premium reste actif quel que soit l'état du kill-switch.
    await demoPage.goto('/premium');
    await demoPage.waitForLoadState('networkidle');
    await expect(demoPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    const violations = await scan(demoPage, 'premium');
    console.log(`[a11y] Premium: ${violations.length} violation(s)`);
    assertNoCritical(violations, 'Premium');
  });
});
