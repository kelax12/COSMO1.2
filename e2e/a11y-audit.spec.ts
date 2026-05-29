// ═══════════════════════════════════════════════════════════════════
// Audit a11y WCAG AA — 2026-05-29
//
// Lance axe-core sur les routes publiques + protégées (mode démo) et
// dump les violations dans le rapport HTML Playwright. Non bloquant pour
// la CI (`test.fail` n'est PAS appelé) — l'audit produit la matière du
// rapport audit-a11y.md, pas un guard de régression.
//
// Pour transformer en guard plus tard : `expect(results.violations).toEqual([])`
// sur les niveaux wcag2a + wcag2aa + best-practice.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  test('Landing (public)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const violations = await scan(page, 'landing');
    console.log(`[a11y] Landing: ${violations.length} violation(s)`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  test('Login (public)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const violations = await scan(page, 'login');
    console.log(`[a11y] Login: ${violations.length} violation(s)`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  test('Dashboard (demo)', async ({ demoPage }) => {
    const violations = await scan(demoPage, 'dashboard');
    console.log(`[a11y] Dashboard: ${violations.length} violation(s)`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  // SPA navigation only — `goto()` reloads, which resets the in-memory
  // demo flag and bounces back to Landing (false negatives in audit).
  test('Tasks (demo)', async ({ demoPage }) => {
    await demoPage.getByRole('link', { name: /to ?do|tâches|tasks/i }).first().click();
    await demoPage.waitForURL(/\/tasks/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'tasks');
    console.log(`[a11y] Tasks: ${violations.length} violation(s)`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  test('Habits (demo)', async ({ demoPage }) => {
    await demoPage.getByRole('link', { name: /habitudes|habits/i }).first().click();
    await demoPage.waitForURL(/\/habits/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'habits');
    console.log(`[a11y] Habits: ${violations.length} violation(s)`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  test('OKR (demo)', async ({ demoPage }) => {
    await demoPage.getByRole('link', { name: /okr/i }).first().click();
    await demoPage.waitForURL(/\/okr/);
    await demoPage.waitForLoadState('networkidle');
    const violations = await scan(demoPage, 'okr');
    console.log(`[a11y] OKR: ${violations.length} violation(s)`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });
});
