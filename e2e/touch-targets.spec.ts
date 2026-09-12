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
      // 🔴 Corrige C-73. La version d'origine exigeait un NOEUD DE TEXTE nu,
      // enfant direct du parent. Elle a tenu tant que la phrase du bandeau de
      // demo etait ecrite en clair dans son `<p>` ; la maquette 02 l'a
      // reorganisee en `<span>Mode demo</span> · <button>Creez un compte</button>`
      // — la meme phrase, la meme cible en ligne, plus un seul noeud de texte
      // nu. Le bouton s'est mis a compter comme un defaut du jour au lendemain,
      // sur les HUIT routes protegees, alors que rien du geste n'avait change.
      //
      // Ce qui compte n'est pas la forme du DOM, c'est qu'il y ait de la PROSE
      // autour de la cible. On mesure donc le texte du parent MOINS celui des
      // commandes qu'il contient : un `<p>` qui ne contient que des boutons
      // n'est pas une phrase, et reste mesure (temoin « inline sans prose »).
      const controls = [...parent.querySelectorAll('button, [role="button"], a')];
      const controlText = controls.reduce((n, c) => n + (c.textContent ?? '').trim().length, 0);
      return (parent.textContent ?? '').trim().length > controlText;
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

    /**
     * La cible telle qu'un DOIGT la rencontre, pseudo-elements compris.
     *
     * 🔴 Deuxieme moitie de C-73, et deuxieme fois que ce detecteur mesure la
     * mauvaise boite (la premiere, le 2026-09-04, etait la case a cocher
     * enveloppee dans son `<label>`). La croix du bandeau de demo dessine une
     * icone de 14 px et porte sa zone tactile dans un `::before` absolu de
     * 44 x 44 centre dessus — le motif classique d'agrandissement de cible,
     * recommande justement par WCAG 2.5.5. `getBoundingClientRect()` ne voit
     * pas les pseudo-elements : la garde rapportait « 14 x 14 » d'une cible qui
     * en fait bien 44, et exigeait donc de casser le dessin pour rien.
     *
     * ⚠️ Elle ne fait PAS confiance a n'importe quel `::before`. Seul un
     * pseudo-element POSITIONNE avec une taille EXPLICITE agrandit la cible :
     * un pseudo decoratif, statique ou sans dimensions, est ignore. C'est ce
     * que verifie le temoin « un ::before decoratif n'agrandit rien ».
     *
     * ⚠️ Ce que cette mesure ne dit pas : la croix est en haut de l'ecran, donc
     * ~9 px de sa cible depassent au-dessus du viewport a la position de
     * defilement 0. La cible RENDUE fait bien 44 x 44 — c'est ce que demande le
     * critere —, la portion atteignable au doigt en fait 35 de haut. Mesure, et
     * laisse tel quel : rabattre la cible vers le bas la ferait mordre de 24 px
     * sur l'en-tete, donc voler des appuis au lieu d'en gagner.
     */
    const effectiveRect = (el: Element): { width: number; height: number } => {
      const base = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
      const borderTop = parseFloat(cs.borderTopWidth) || 0;
      let x0 = base.left;
      let y0 = base.top;
      let x1 = base.right;
      let y1 = base.bottom;

      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content === 'none' || ps.content === 'normal') continue;
        if (ps.position !== 'absolute' && ps.position !== 'fixed') continue;
        const w = parseFloat(ps.width);
        const h = parseFloat(ps.height);
        const left = parseFloat(ps.left);
        const top = parseFloat(ps.top);
        if (!isFinite(w) || !isFinite(h) || !isFinite(left) || !isFinite(top)) continue;
        // `transform` arrive resolu en matrice : les deux dernieres valeurs
        // portent la translation, c'est la que vit le `-translate-x-1/2`.
        const m = /matrix\(([^)]+)\)/.exec(ps.transform);
        const parts = m ? m[1].split(',').map((v) => parseFloat(v)) : [];
        const tx = parts.length === 6 ? parts[4] : 0;
        const ty = parts.length === 6 ? parts[5] : 0;
        const px = base.left + borderLeft + left + tx;
        const py = base.top + borderTop + top + ty;
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px + w);
        y1 = Math.max(y1, py + h);
      }
      return { width: x1 - x0, height: y1 - y0 };
    };

    const out: UnderTarget[] = [];
    const seen = new Set<Element>();
    for (const control of document.querySelectorAll(
      'button, [role="button"], input[type="checkbox"]',
    )) {
      const el = effectiveTarget(control);
      if (seen.has(el)) continue;
      seen.add(el);
      const box = el.getBoundingClientRect();
      // Élément non rendu : ni un défaut, ni une cible.
      if (box.width === 0 || box.height === 0) continue;
      if (isInline(el)) continue;
      const r = effectiveRect(el);
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
        + '<button style="width:44px;height:44px" aria-label="temoin conforme"></button>'
        // ── Les quatre temoins ajoutes par C-73 ────────────────────
        //
        // 🔴 Deux assouplissements sont entres dans le detecteur ce jour-la :
        // l'exception « inline » ne demande plus un noeud de texte nu, et un
        // `::before` positionne agrandit la cible. Un assouplissement sans
        // temoin, c'est un trou qu'on ouvre en croyant corriger une mesure.
        // Chacun a donc ici sa paire : le cas qu'il doit laisser passer, et le
        // cas voisin qu'il doit CONTINUER a voir.
        + '<p>Une phrase autour de '
        + '<button style="width:90px;height:11px" aria-label="temoin inline avec prose"></button>'
        + '</p>'
        + '<p><button style="width:16px;height:16px" aria-label="temoin inline sans prose"></button>'
        + '<button style="width:16px;height:16px" aria-label="temoin voisin"></button></p>'
        + '<style>'
        + '#t-agrandi::before{content:"";position:absolute;left:50%;top:50%;'
        + 'width:44px;height:44px;transform:translate(-50%,-50%)}'
        + '#t-decor::before{content:"";width:44px;height:44px;background:red}'
        + '</style>'
        + '<button id="t-agrandi" style="width:14px;height:14px;position:relative"'
        + ' aria-label="temoin cible agrandie"></button>'
        + '<button id="t-decor" style="width:14px;height:14px"'
        + ' aria-label="temoin before decoratif"></button>';
      document.body.appendChild(host);
    });

    const seen = await commandsUnderTarget(demoPage, TARGET);
    const names = seen.map((s) => s.name);
    expect(names).toContain('temoin trop petit');
    expect(names).not.toContain('temoin conforme');

    // Exception « inline » : la prose peut vivre dans un `<span>` voisin…
    expect(names).not.toContain('temoin inline avec prose');
    // …mais un `<p>` qui ne contient QUE des commandes n'est pas une phrase.
    expect(names).toContain('temoin inline sans prose');

    // Un `::before` absolu et dimensionne EST la cible…
    expect(names).not.toContain('temoin cible agrandie');
    // …un `::before` decoratif, non positionne, n'agrandit RIEN.
    expect(names).toContain('temoin before decoratif');

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
