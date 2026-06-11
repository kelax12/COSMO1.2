// ═══════════════════════════════════════════════════════════════════
// Audit a11y WCAG AA — 2026-05-29
//
// Lance axe-core sur les routes publiques + protégées (mode démo) et
// dump les violations dans le rapport HTML Playwright.
//
// Guard CI (audit architecture TOP-8) : les violations d'impact `critical`
// sont désormais BLOQUANTES (`expect(criticals).toHaveLength(0)`). Les
// niveaux `serious`/`moderate`/`minor` restent dumpés mais non bloquants
// (roadmap A-7/A-8/A-10 de audit-a11y.md, Serious 8 résiduel). Une nouvelle
// régression critical (bouton icon-only sans aria-label, input sans label,
// page sans landmark…) casse la CI au lieu de partir en prod.
// ═══════════════════════════════════════════════════════════════════

import { test, expect, navTo } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Échoue le test si au moins une violation d'impact `critical` est présente,
// en listant les ids pour un diagnostic immédiat dans le rapport CI.
function assertNoCritical(violations: Result[], route: string) {
  const criticals = violations.filter(v => v.impact === 'critical');
  expect(
    criticals,
    `[a11y] ${route} — violation(s) critical: ${criticals.map(v => v.id).join(', ')}`,
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
    samples: v.nodes.slice(0, 3).map(n => ({
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

  // SPA navigation only — `goto()` reloads, which resets the in-memory
  // demo flag and bounces back to Landing (false negatives in audit).
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
});
