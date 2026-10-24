// ═══════════════════════════════════════════════════════════════════
// AM-5 · le contraste, dans les QUATRE thèmes (2026-10-22)
//
// 🔴 POURQUOI CE FICHIER EXISTE. `e2e/a11y-audit.spec.ts` ne scanne que le
// thème par défaut, et il DISPENSE `color-contrast` (C-23). Les trois autres
// thèmes (`dark`, `gris`, `noir`) n'entraient dans aucun total axe. C'est la
// classe de bug du 2026-07-23 : `.dark` est posée pour sombre, gris ET noir,
// donc une couleur codée en dur ou un jeton mal réglé dans l'un d'eux ne se
// voit dans aucun autre. `src/theme-contrast.guard.test.ts` lit les jetons,
// mais seulement ceux du bouton principal ; `Visual` dit « ça a changé », pas
// « c'est illisible ».
//
// Ici, axe joue la SEULE règle `color-contrast`, BLOQUANTE, sur sept routes
// de démo, dans chacun des quatre thèmes. Un contraste qui régresse dans
// n'importe lequel casse le cas de son thème.
//
// ── POURQUOI ÇA N'EST PAS INSTABLE, alors que `a11y-audit` l'était ──
//
// L'instabilité mesurée le 2026-09-13 (21, 41, 55 puis 18 nœuds sur le même
// commit) venait des fondus d'entrée de route : axe photographiait une
// opacité en cours. Ici, deux gestes la retirent :
//   · `reducedMotion: 'reduce'`, que le produit honore (`MotionConfig
//     reducedMotion="user"`, variantes `motion-safe:`) ;
//   · avant chaque scan, toute animation finie est TERMINÉE (`finish()`),
//     transitions CSS comprises, puis on attend une frame.
//
// ── LA SEULE DISPENSE ───────────────────────────────────────────────
//
// C-23 : le lien « Créez un compte » du bandeau démo, en thème CLAIR
// seulement, marqué `data-c23-dispense` à sa source. Décision et périmètre :
// `docs/ACCESSIBILITY.md` § C-23 ; cliquet du ratio :
// `src/theme-contrast.guard.test.ts`. Dans les trois autres thèmes, ce même
// lien est mesuré comme tout le reste.
// ❌ Ne JAMAIS élargir ce sélecteur ni ajouter un attribut ailleurs pour
// faire passer ce cas. Un contraste trop bas se corrige dans les JETONS
// (`src/index.css`), pas dans la liste des exclusions.
//
// ⚠️ CE QUE ÇA NE MESURE PAS : l'état initial de chaque route seulement (ni
// modale, ni menu, ni survol), et le seul moteur Chromium à 1 280 px. Le
// contraste ne dépend pas du moteur ; il dépend du thème, et c'est ce qui
// manquait.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

const THEMES = ['light', 'dark', 'gris', 'noir'] as const;
type Theme = (typeof THEMES)[number];

const ROUTES = ['/dashboard', '/tasks', '/agenda', '/habits', '/okr', '/settings', '/entreprise'] as const;

/** Classes que `applyTheme` (src/lib/theme.ts) pose sur `<html>` pour chaque thème. */
const CLASSES: Record<Theme, string[]> = {
  light: [],
  dark: ['dark'],
  gris: ['dark', 'gris'],
  noir: ['dark', 'noir'],
};

// 🔴 Un texte dont le milieu sort du document fait LEVER axe (« Element
// midpoint exceeds the grid bounds », vu en CI le 2026-10-22 sur `/tasks`) :
// la règle entière part en `incomplete`, zéro texte mesuré. Or `<main>` est un
// conteneur qui DÉFILE (Layout), donc tout ce qui est sous la ligne de
// flottaison est hors du document. `ouvrir` agrandit donc la fenêtre à la
// hauteur réelle du contenu : axe voit TOUTE la page, pas son premier écran.
// 1 600 px de large : à 1 280, le tableau de `/tasks` déborde aussi à droite.
const LARGEUR = 1600;
const HAUTEUR = 900;
test.use({ reducedMotion: 'reduce', viewport: { width: LARGEUR, height: HAUTEUR } });
// 7 routes rechargées par cas, plus la fixture démo.
test.describe.configure({ timeout: 300_000 });

/** Termine toute animation finie (Framer en WAAPI, transitions CSS). */
async function figerAnimations(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        const timing = a.effect?.getComputedTiming();
        if (timing && timing.endTime !== Infinity) {
          try { a.finish(); } catch { /* animation déjà annulée */ }
        }
      }
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  }
}

async function ouvrir(page: Page, route: string, theme: Theme): Promise<void> {
  await page.setViewportSize({ width: LARGEUR, height: HAUTEUR });
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
  await page.waitForLoadState('networkidle');
  // Une page pas encore peinte rendrait 0 violation : on attend du contenu.
  await expect(page.locator('main').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => (document.querySelector('main')?.textContent ?? '').trim().length > 40,
    null,
    { timeout: 30_000 },
  );
  if (route === '/agenda') await page.waitForTimeout(1_000); // FullCalendar
  // TÉMOIN : le thème est bien celui du produit, posé au chargement.
  const classes = await page.evaluate(() => [...document.documentElement.classList]);
  for (const c of ['dark', 'gris', 'noir']) {
    expect(classes.includes(c), `${route} · ${theme} : classe .${c} sur <html>`).toBe(CLASSES[theme].includes(c));
  }
  // Ce qui dépasse de `<main>` vers le bas, ajouté à la fenêtre (plafond
  // 8 000 px : au-delà, une liste infinie, pas une page).
  const depasse = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
  });
  if (depasse > 0) {
    await page.setViewportSize({ width: LARGEUR, height: Math.min(8000, HAUTEUR + depasse + 40) });
    if (route === '/agenda') await page.waitForTimeout(500); // FullCalendar se remesure
  }
  await figerAnimations(page);
}

function decrire(v: Result[]): string {
  return v
    .flatMap((r) => r.nodes.map((n) => {
      const ratio = /contrast of ([\d.]+)/.exec(n.failureSummary ?? '')?.[1] ?? '?';
      const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; expectedContrastRatio?: string };
      return `  ${String(n.target)}  ${ratio}:1 (attendu ${data.expectedContrastRatio ?? '4.5:1'}) `
        + `fg ${data.fgColor ?? '?'} sur ${data.bgColor ?? '?'}  ${n.html.slice(0, 120)}`;
    }))
    .join('\n');
}

for (const theme of THEMES) {
  test(`AM-5 · contraste, thème ${theme}`, async ({ demoPage: page }, testInfo) => {
    await page.evaluate((t) => localStorage.setItem('theme', t), theme);
    const bilan: Record<string, { violations: number; passes: number }> = {};

    for (const route of ROUTES) {
      await ouvrir(page, route, theme);
      let axe = new AxeBuilder({ page }).withRules(['color-contrast']);
      if (theme === 'light') axe = axe.exclude('[data-c23-dispense]');
      const res = await axe.analyze();
      const passes = res.passes.find((p) => p.id === 'color-contrast')?.nodes.length ?? 0;
      bilan[route] = { violations: res.violations.reduce((s, v) => s + v.nodes.length, 0), passes };

      // TÉMOIN DU TÉMOIN : une route où axe n'a mesuré AUCUN texte serait verte à vide.
      let diagnostic = '';
      if (passes <= 10) {
        const incomplete = res.incomplete.find((p) => p.id === 'color-contrast');
        const horsPage = await page.evaluate(() => {
          const w = document.documentElement.scrollWidth;
          const h = document.documentElement.scrollHeight;
          return [...document.querySelectorAll('body *')].filter((e) => {
            if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) return false;
            const r = e.getBoundingClientRect();
            const x = r.left + scrollX + r.width / 2;
            const y = r.top + scrollY + r.height / 2;
            return r.width > 0 && (x < 0 || y < 0 || x > w || y > h);
          }).slice(0, 5).map((e) => e.outerHTML.slice(0, 140)).join('\n    ');
        });
        const dessus = await page.evaluate(() =>
          document.elementsFromPoint(innerWidth / 2, innerHeight / 2).slice(0, 4)
            .map((e) => e.outerHTML.slice(0, 160)).join('\n    '));
        // Une règle qui LÈVE rend un seul nœud `incomplete` sans motif : on
        // garde l'objet brut, c'est lui qui porte l'erreur d'axe.
        diagnostic = `\n  incomplete : ${incomplete?.nodes.length ?? 0}, brut : `
          + `${JSON.stringify(incomplete?.error ?? incomplete ?? null).slice(0, 300)}`
          + `\n  textes hors page :\n    ${horsPage || '-'}\n  au centre :\n    ${dessus}`;
      }
      expect.soft(passes, `${route} · ${theme} : axe n'a mesuré aucun texte${diagnostic}`).toBeGreaterThan(10);
      expect.soft(
        res.violations,
        `[AM-5] ${route} · thème ${theme} : contraste sous le seuil WCAG 1.4.3\n${decrire(res.violations)}\n`
          + 'Corriger le JETON (src/index.css) ou remplacer la couleur codée en dur par un jeton.',
      ).toHaveLength(0);
    }

    await testInfo.attach(`bilan-${theme}.json`, {
      body: JSON.stringify(bilan, null, 2),
      contentType: 'application/json',
    });
    console.log(`[AM-5] ${theme} ${JSON.stringify(bilan)}`);
  });
}
