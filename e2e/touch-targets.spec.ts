// ═══════════════════════════════════════════════════════════════════
// C-57 — cibles tactiles sous 44 x 44 px (WCAG 2.5.5)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE.
//
// `docs/MOBILE.md` porte « ❌ Touch target < 44 x 44 px » dans sa liste
// « Ne jamais faire », et rien ne le mesurait. L'audit A-4 a trouvé le geste
// PRINCIPAL du produit, sur son écran d'accueil, à **16 x 16 px** : la case
// « Marquer … comme terminée » de `TodayUnified`, dont la zone tactile
// épousait l'icône. Le doigt tombe à côté et ouvre la tâche au lieu de la
// cocher ; sur une liste dense, deux cases voisines sont à quelques pixels
// l'une de l'autre.
//
// Mesure du correctif, viewport 375 x 812, mode démo, six routes :
// **18 commandes sous la cible → 0**.
//
// ── CE QUI EST COMPTÉ, ET CE QUI NE L'EST PAS ───────────────────────
//
// Uniquement les VRAIES commandes : `button`, `[role="button"]`,
// `input[type=checkbox]`. Jamais un lien de texte, et jamais une cible EN
// LIGNE — WCAG 2.5.5 exempte explicitement une cible prise dans une phrase,
// dont la taille est contrainte par l'interligne du texte autour. Le bouton
// « Créez un compte » de `DemoConversionBanner` vit au milieu d'un `<p>` : le
// compter gonflerait le chiffre sans décrire un défaut, et la règle
// deviendrait « mettre des boutons de 44 px au milieu des phrases », ce qui
// casserait la lecture.
//
// ⚠️ Mesure en viewport ÉMULÉ, pas sur un appareil : la taille en pixels CSS
// est la même, mais le taux de ratage réel ne se mesure qu'avec un doigt
// (`a-faire-manuel.md` §7, M-25).
//
// ⚠️ Ce que l'énoncé d'origine annonçait et qui NE s'est PAS reproduit :
// « 43 commandes sous la cible sur /okr, dont 42 à 40 x 40 px ». Remesuré ici,
// `/okr` rend **0 sur 57**. Le chiffre est laissé tel quel dans l'historique
// plutôt que recopié : une mesure se refait, elle ne se reprend pas.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });

/** Cible minimale WCAG 2.5.5 (AA), en pixels CSS. */
const TARGET = 44;

interface UnderTarget {
  w: number;
  h: number;
  name: string;
}

async function commandsUnderTarget(page: Page, target: number): Promise<UnderTarget[]> {
  return page.evaluate((min) => {
    /**
     * Exception « inline » de WCAG 2.5.5 : une cible prise DANS une phrase,
     * dont la taille est contrainte par l'interligne du texte autour.
     */
    const isInline = (el: Element): boolean => {
      const parent = el.parentElement;
      if (!parent) return false;
      if (!['P', 'SPAN', 'LABEL', 'LI', 'TD'].includes(parent.tagName)) return false;
      return [...parent.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      );
    };

    const out: UnderTarget[] = [];
    for (const el of document.querySelectorAll(
      'button, [role="button"], input[type="checkbox"]',
    )) {
      const r = el.getBoundingClientRect();
      // Élément non rendu : ni un défaut, ni une cible.
      if (r.width === 0 || r.height === 0) continue;
      if (isInline(el)) continue;
      if (r.width < min || r.height < min) {
        out.push({
          w: Math.round(r.width),
          h: Math.round(r.height),
          name:
            el.getAttribute('aria-label')
            ?? (el.textContent ?? '').trim().slice(0, 40),
        });
      }
    }
    return out;
  }, target);
}

test.describe('C-57 — cibles tactiles (WCAG 2.5.5)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('TEMOIN : le detecteur sait voir une cible trop petite', async ({ demoPage }) => {
    // 🔴 Sans cette sonde, un détecteur cassé rendrait toute la suite verte.
    // On injecte un bouton de 16 x 16 px, hors de toute phrase, et il DOIT
    // être vu ; puis un de 44 x 44, qui ne doit PAS l'être.
    await demoPage.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'c57-temoin';
      host.innerHTML =
        '<button style="width:16px;height:16px" aria-label="temoin trop petit"></button>'
        + '<button style="width:44px;height:44px" aria-label="temoin conforme"></button>';
      document.body.appendChild(host);
    });

    const seen = await commandsUnderTarget(demoPage, TARGET);
    const names = seen.map((s) => s.name);
    expect(names).toContain('temoin trop petit');
    expect(names).not.toContain('temoin conforme');

    await demoPage.evaluate(() => document.getElementById('c57-temoin')?.remove());
  });

  for (const route of ['/dashboard', '/entreprise', '/okr', '/tasks', '/habits', '/settings']) {
    test(`${route} : aucune commande sous 44 x 44 px`, async ({ demoPage }) => {
      // `goto` direct et pas `navTo` : on mesure une PAGE, pas un parcours de
      // navigation, et la barre d onglets mobile n expose pas les six routes.
      await demoPage.goto(route);
      await demoPage.waitForLoadState('networkidle');
      await demoPage.waitForTimeout(1500);

      const under = await commandsUnderTarget(demoPage, TARGET);
      expect(
        under.map((u) => `${u.w}x${u.h} « ${u.name} »`),
        'La zone tactile doit faire 44 px dans les DEUX dimensions. L ICONE, '
          + 'elle, reste petite : c est le contrat de `TouchTarget` '
          + '(src/components/mobile/). Marges negatives pour que la rangee ne '
          + 'grandisse pas avec la cible.',
      ).toEqual([]);
    });
  }
});
