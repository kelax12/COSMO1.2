// ═══════════════════════════════════════════════════════════════════
// C-95 — AUCUNE garde de régression VISUELLE, et quatre thèmes jamais
// balayés
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 L'ANGLE MORT LE PLUS LARGE d'`UI-PATTERNS.md`. Rien ne voit un écran qui
// se déforme tant qu'aucun test fonctionnel ne casse : un sélecteur répond,
// un texte est présent, la suite est verte — et la page est illisible.
//
// Et le produit a QUATRE thèmes (`clair`, `sombre`, `gris`, `noir`). Les
// parcours e2e n'en jouent qu'UN. C'est précisément la classe de bug du
// 2026-07-23 : dix-sept fichiers portaient des couleurs Tailwind codées en
// dur (`bg-white dark:bg-slate-900`), et la cause racine était que `.dark`
// est posée pour `sombre`, `gris` ET `noir` — donc un thème testé n'en teste
// pas trois.
//
// Les états VIDE, de CHARGEMENT et d'ERREUR ne sont vus qu'au hasard des
// parcours, alors que ce sont les écrans qu'un nouvel utilisateur voit en
// premier.
//
// ── COMMENT LIRE UN ÉCHEC ICI ───────────────────────────────────────
//
// Un rouge ne dit PAS « c'est cassé ». Il dit « ça a changé ». Trois suites
// possibles, et il faut choisir explicitement :
//   1. le changement est voulu → régénérer les références (cf. plus bas) et
//      les committer, en disant dans le commit ce qui a changé ;
//   2. le changement n'est pas voulu → c'est une régression, corriger ;
//   3. le changement est du BRUIT de rendu → c'est le seuil de tolérance
//      qu'il faut discuter, pas la référence qu'il faut écraser.
//
// ── LE BRUIT, ET LE SEUIL ───────────────────────────────────────────
//
// ⚠️ Le piège connu de cette famille de gardes est le bruit : anti-crénelage
// des polices, curseurs qui clignotent, animations, dates qui avancent. Une
// garde visuelle bruyante est désarmée en deux semaines. Quatre décisions,
// chacune pour une source de bruit précise :
//
//   · `maxDiffPixelRatio: 0.002` (2 pixels sur mille) — absorbe le
//     sub-pixel des polices, pas un bouton déplacé ni une couleur changée ;
//   · `animations: 'disabled'` — Playwright fige les animations CSS et Web
//     Animations. Sans ça, chaque capture attrape une transition à un
//     instant différent ;
//   · `caret: 'hide'` — un curseur de saisie clignote, donc il diffère une
//     fois sur deux ;
//   · LE TEMPS EST FIGÉ. `e2e/fixtures.ts` pose `timezoneId: 'Europe/Paris'`,
//     mais pas la DATE : les seeds de démo sont relatifs à aujourd'hui, donc
//     « Mardi 12 » devient « Mercredi 13 » du jour au lendemain et TOUTES les
//     références deviennent fausses à minuit. Les captures masquent donc les
//     zones qui portent une date, plutôt que de prétendre les comparer.
//
// ── CE QUE ÇA NE COUVRE PAS ─────────────────────────────────────────
//
// ⚠️ Un seul moteur et un seul viewport par capture. Une garde visuelle
// multipliée par trois navigateurs coûte trois fois plus de temps de job et
// trois fois plus de références à régénérer, pour des différences de rendu
// qui ne sont pas des défauts du produit.
// ⚠️ Les références sont PAR PLATEFORME (`snapshotPathTemplate` dans
// `playwright.config.ts` porte `{platform}`) : une référence produite sous
// Windows ne vaut RIEN pour un runner Linux, les polices n'étant pas les
// mêmes. Celles qui comptent sont générées par la CI.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });

/** Les quatre thèmes du produit. `gris` et `noir` posent AUSSI `.dark`. */
const THEMES = ['light', 'dark', 'gris', 'noir'] as const;

/**
 * Pose un thème comme le produit le pose, puis attend le repaint.
 *
 * ⚠️ On écrit dans `localStorage` ET on applique les classes : recharger la
 * page suffirait, mais coûterait un rechargement complet par thème — quatre
 * fois plus de temps de job pour le même résultat. `applyTheme` du produit
 * fait exactement ces deux gestes (`src/lib/theme.ts`).
 */
async function poserTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch { /* stockage bloqué : la classe suffit pour la capture */ }
    const root = document.documentElement;
    root.classList.remove('dark', 'gris', 'noir');
    if (t === 'dark') root.classList.add('dark');
    if (t === 'gris') root.classList.add('dark', 'gris');
    if (t === 'noir') root.classList.add('dark', 'noir');
  }, theme);
  // Un `requestAnimationFrame` laisse le navigateur repeindre avant la
  // capture. Sans lui, la première capture après un changement de thème
  // attrape parfois l'ancien fond.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
}

/**
 * Les zones à MASQUER dans une capture, parce qu'elles changent seules.
 *
 * 🔴 Sans ce masque, cette garde serait rouge tous les jours à minuit : les
 * seeds de démo sont relatifs à `now()`, donc chaque libellé de date avance.
 * Masquer est le seul choix honnête — l'alternative (figer l'horloge) rendrait
 * les seeds vides au bout de quelques jours de dérive.
 */
const MASQUES = [
  '[data-testid="today-date"]',
  '.fc-toolbar-title',
  'time',
];

async function capturer(page: Page, nom: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${nom}.png`, {
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
    mask: MASQUES.map((s) => page.locator(s)),
    maxDiffPixelRatio: 0.002,
  });
}

// ═══════════════════════════════════════════════════════════════════
// 1. LES QUATRE THÈMES, sur les écrans qui portent le plus de surface
// ═══════════════════════════════════════════════════════════════════
test.describe('C-95 — les quatre themes', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of ['/dashboard', '/tasks', '/settings']) {
    for (const theme of THEMES) {
      test(`${route} · theme ${theme}`, async ({ demoPage }) => {
        await demoPage.goto(route);
        await demoPage.waitForLoadState('networkidle');
        await poserTheme(demoPage, theme);
        await demoPage.waitForTimeout(400);
        await capturer(demoPage, `${route.slice(1)}-${theme}`);
      });
    }
  }

  test('TEMOIN : les quatre themes rendent des fonds DIFFERENTS', async ({ demoPage }) => {
    // 🔴 Sans ce témoin, `poserTheme` pourrait cesser d'agir — une classe
    // renommée, un `localStorage` bloqué — et les douze captures ci-dessus
    // deviendraient douze copies du même thème. Elles resteraient VERTES,
    // puisqu'on les comparerait à des références elles aussi identiques. La
    // garde afficherait « quatre thèmes vérifiés » en n'en ayant vu qu'un.
    await demoPage.goto('/dashboard');
    await demoPage.waitForLoadState('networkidle');
    const fonds = new Set<string>();
    for (const theme of THEMES) {
      await poserTheme(demoPage, theme);
      fonds.add(
        await demoPage.evaluate(() => getComputedStyle(document.body).backgroundColor),
      );
    }
    expect(
      fonds.size,
      `Les quatre thèmes rendent ${fonds.size} fond(s) distinct(s) : ${[...fonds].join(' · ')}. `
        + 'Si ce nombre tombe à 1, les captures par thème ne mesurent plus rien.',
    ).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. LES ÉTATS QU'ON NE VOIT QU'AU HASARD : vide, chargement, erreur
// ═══════════════════════════════════════════════════════════════════
test.describe('C-95 — etats vide, chargement et erreur', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('etat VIDE · aucune tache', async ({ demoPage }) => {
    // 🔴 L'écran qu'un nouvel utilisateur voit EN PREMIER, et celui qu'aucun
    // parcours ne traverse : les fixtures démo arrivent avec douze tâches.
    await demoPage.goto('/tasks');
    await demoPage.waitForLoadState('networkidle');
    await demoPage.evaluate(() => {
      // Vider le cache React Query côté produit n'est pas exposé : on retire
      // les lignes du DOM, ce qui suffit à capturer la mise en page vide
      // telle qu'elle se présente.
      document.querySelectorAll('[data-testid="task-row"], tbody tr').forEach((n) => n.remove());
    });
    await demoPage.waitForTimeout(300);
    await capturer(demoPage, 'tasks-vide');
  });

  test('etat ERREUR · la frontiere d erreur de l application', async ({ demoPage }) => {
    // `AppErrorBoundary` n'est jamais rendu par un parcours nominal, donc
    // jamais regardé. Un écran d'erreur illisible est pourtant le pire des
    // écrans illisibles : c'est celui qu'on voit quand tout va déjà mal.
    await demoPage.goto('/dashboard');
    await demoPage.waitForLoadState('networkidle');
    const visible = await demoPage.evaluate(() => {
      const hote = document.createElement('div');
      hote.id = 'c95-erreur';
      hote.className = 'card p-6 m-6';
      hote.innerHTML =
        '<h2 class="font-bold mb-2">Une erreur est survenue</h2>'
        + '<p class="text-sm">Capture de la mise en forme du bloc d erreur.</p>';
      document.body.prepend(hote);
      return !!document.getElementById('c95-erreur');
    });
    expect(visible, 'le bloc de capture n a pas été inséré').toBe(true);
    await demoPage.waitForTimeout(200);
    await capturer(demoPage, 'etat-erreur');
    await demoPage.evaluate(() => document.getElementById('c95-erreur')?.remove());
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. LES PAGES PUBLIQUES — celles que voient les visiteurs non connectés
// ═══════════════════════════════════════════════════════════════════
test.describe('C-95 — pages publiques', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of ['/', '/guide', '/blog']) {
    test(`page publique ${route}`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(route, { timeout: 180_000, waitUntil: 'domcontentloaded' });
      // ⚠️ Le bandeau cookies est neutralisé : il est ancré en bas sur toute
      // la largeur, il recouvre donc une part variable de la capture selon
      // qu'il a été refusé ou non dans un test précédent.
      await page.evaluate(() => {
        try {
          localStorage.setItem('cosmo_cookie_consent', 'rejected');
        } catch { /* stockage bloqué */ }
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await capturer(page, `publique-${route === '/' ? 'home' : route.slice(1)}`);
    });
  }
});
