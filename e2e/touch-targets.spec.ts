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
// 🔴 CE QUE LA PREMIÈRE VERSION DE CETTE GARDE NE VOYAIT PAS. Elle ne mesurait
// que l'ÉTAT INITIAL de six routes — donc rien dans une modale, un menu ou une
// feuille. Le trou s'est révélé le jour même : le bouton de suppression d'un
// commentaire d'équipe faisait **28 × 28 px**, dans un fil qu'on n'atteint
// qu'en ouvrant une tâche. Une garde qui déclare « 0 sous la cible » en ne
// regardant que le repos dit vrai de sa mesure et faux du produit — la classe
// de défaut que `CLAUDE.md` documente sous « une garde se vérifie sur ce
// qu'elle REGARDE ».
//
// Le dernier cas ouvre donc une surface RÉELLE et mesure dedans. Il ne couvre
// pas les 58 modales du produit, et ne le prétend pas : il couvre celle qui
// portait le défaut, et il ouvre la porte pour les suivantes.
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
  /**
   * Un extrait du HTML.
   *
   * ⚠️ Ajoute le 2026-09-04 : le rapport ne donnait que la taille et le nom
   * accessible, or le premier defaut trouve en etendant la garde a /statistics
   * etait une commande de 16 x 16 px SANS AUCUN NOM. Le message d echec disait
   * donc `16x16 «  »`, ce qui ne permet pas de la retrouver. Une garde qui
   * rapporte un defaut doit dire ou il est.
   */
  html: string;
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

    /**
     * La cible REELLE d'une commande.
     *
     * 🔴 Une case a cocher enveloppee dans un `<label>` n'est pas une cible de
     * 16 px : l'association implicite rend TOUT le label cliquable, donc c'est
     * lui qu'il faut mesurer. Le detecteur mesurait la case, et rapportait donc
     * une taille qui n'est pas celle du geste — en plus de perdre le nom, porte
     * par le texte du label et non par l'input.
     *
     * ⚠️ Ca ne dispense de rien : sur /statistics, le label mesure aussi moins
     * de 44 px de haut. La correction du detecteur n'a pas fait disparaitre le
     * defaut, elle l'a designe correctement. C'est le seul resultat acceptable
     * pour une correction de mesure.
     */
    const effectiveTarget = (el: Element): Element => {
      const label = el.closest('label');
      return label && label.contains(el) ? label : el;
    };

    const out: UnderTarget[] = [];
    const seen = new Set<Element>();
    for (const control of document.querySelectorAll(
      'button, [role="button"], input[type="checkbox"]',
    )) {
      const el = effectiveTarget(control);
      if (seen.has(el)) continue;
      seen.add(el);
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
          html: el.outerHTML.slice(0, 160),
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

  for (const route of [
    '/dashboard',
    '/entreprise',
    '/okr',
    '/tasks',
    '/habits',
    '/settings',
    // Ajoutees le 2026-09-04 : le critere de l item dit « les routes
    // protegees », et il y en a huit. En couvrir six et parler des routes
    // protegees, c est le meme ecart de langage que les enonces que cette
    // passe a trouves faux.
    '/agenda',
    '/statistics',
  ]) {
    test(`${route} : aucune commande sous 44 x 44 px`, async ({ demoPage }) => {
      // `goto` direct et pas `navTo` : on mesure une PAGE, pas un parcours de
      // navigation, et la barre d onglets mobile n expose pas les six routes.
      await demoPage.goto(route);
      await demoPage.waitForLoadState('networkidle');
      await demoPage.waitForTimeout(1500);

      const under = await commandsUnderTarget(demoPage, TARGET);
      expect(
        under.map((u) => `${u.w}x${u.h} « ${u.name} » ${u.html}`),
        'La zone tactile doit faire 44 px dans les DEUX dimensions. L ICONE, '
          + 'elle, reste petite : c est le contrat de `TouchTarget` '
          + '(src/components/mobile/). Marges negatives pour que la rangee ne '
          + 'grandisse pas avec la cible.',
      ).toEqual([]);
    });
  }

  // ── Une surface OUVERTE, pas seulement l'état de repos ─────────────
  // 🔴 DEUX RÉGIMES, comme `a11y-keyboard-audit.spec.ts` : ce qui est corrigé
  // est ASSERTIONNÉ, ce qui reste ouvert est seulement IMPRIMÉ. Figer en
  // `expect(...).toEqual([])` les 23 commandes que cette modale porte encore
  // sous la cible ferait rouge une CI qui l'est déjà pour une autre raison, et
  // surtout forcerait 23 décisions de design qu'aucun arbitrage n'a rendues.
  //
  // Ce qui EST assertionné : le bouton que C-57 a fait passer de 28 à 44 px.
  // Ce qui est imprimé part dans l item C-70 avec son chiffre.
  test("modale de tache d equipe : la commande corrigee tient, le reste est mesure", async ({ demoPage }) => {
    await demoPage.goto('/entreprise');
    await demoPage.waitForLoadState('networkidle');
    await demoPage.waitForTimeout(2000);

    const taskButton = demoPage.locator('button[aria-label^="Marquer"]').first();
    await expect(taskButton).toBeVisible({ timeout: 15_000 });
    // Le bouton VOISIN de la case ouvre la tâche (la case, elle, la coche).
    await demoPage.locator('li:has(button[aria-label^="Marquer"]) button').nth(1).click();

    const dialog = demoPage.getByRole('dialog');
    await expect(dialog.first()).toBeVisible({ timeout: 10_000 });
    await demoPage.waitForTimeout(1200);

    const under = await commandsUnderTarget(demoPage, TARGET);

    // ── ASSERTIONNÉ : la suppression d'un commentaire d'équipe ─────────
    // Elle faisait 28 × 28 px, trouvée en vérifiant la conformité de C-57
    // parce que la garde ne regardait alors que l'état de repos de six routes.
    expect(
      under.filter((u) => /commentaire/i.test(u.name)).map((u) => `${u.w}x${u.h} « ${u.name} »`),
      'La suppression d un commentaire d equipe doit rester a 44 px.',
    ).toEqual([]);

    // ── IMPRIMÉ : le reste, qui appartient à C-70 ──────────────────────
    console.log(`[C-70] TeamTaskModal : ${under.length} commande(s) sous 44 x 44 px`);
    for (const u of under) console.log(`  ${u.w}x${u.h}  « ${u.name} »`);
  });
});
