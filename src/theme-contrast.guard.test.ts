// ═══════════════════════════════════════════════════════════════════
// theme-contrast.guard.test.ts — le contraste du bouton principal, DANS LES
// QUATRE THÈMES
//
// 🔴 POURQUOI CE FICHIER EXISTE (C-25, 2026-09-12)
//
// Le bouton d'action principal était sous le seuil AA dans DEUX thèmes sur
// quatre — `gris` à **3,34:1** et `sombre` à **3,68:1**, blanc sur
// `--color-accent-solid` — et **aucune garde ne le voyait**. Pas parce qu'elle
// mesurait mal : parce qu'elle ne regardait pas là.
//
// `e2e/a11y-audit.spec.ts` fait tourner axe-core sur onze routes, et axe ne
// scanne que **le thème par défaut**. Les trois autres thèmes n'ont jamais été
// dans un seul de ses totaux. Le 3,34 vient d'une mesure MANUELLE de l'audit
// A-8 du 2026-08-24, recopiée dans `docs/ACCESSIBILITY.md`, et il est resté là
// dix-neuf jours sans que rien ne puisse le faire échouer.
//
// C'est le cas symétrique de « une garde se vérifie sur ce qu'elle REGARDE »
// (CLAUDE.md) : ici la garde ne se trompait pas, elle ne couvrait simplement
// pas la zone — et un silence se prend pour un accord.
//
// Ce test lit `src/index.css` et recalcule le contraste réel de chaque thème.
// Il ne remplace pas axe (qui, lui, voit les couleurs EFFECTIVES, dégradés et
// transparences comprises) : il couvre le point précis qu'axe ne peut pas
// atteindre, les tokens des thèmes non actifs.
//
// ❌ Ne JAMAIS baisser `AA_NORMAL`. 4,5:1 est le seuil WCAG pour du texte
// normal, et le libellé d'un bouton en est.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Seuil WCAG 2.1 AA pour du texte normal. */
const AA_NORMAL = 4.5;

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

type Rgb = [number, number, number];

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Les valeurs `--color-accent-solid` / `--color-accent-solid-foreground`
 * déclarées dans l'ordre du fichier.
 *
 * ⚠️ Volontairement une lecture du CSS et non une table recopiée ici : une
 * table serait une SECONDE définition des couleurs, donc un endroit de plus où
 * elles peuvent diverger — exactement ce que `org-tiers.parity.test.ts`
 * verrouille côté tarifs.
 */
function declarations(name: string): Rgb[] {
  const re = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`, 'g');
  const out: Rgb[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  return out;
}

describe('C-25 — le bouton principal tient AA dans les QUATRE thèmes', () => {
  const solids = declarations('color-accent-solid');
  const fgs = declarations('color-accent-solid-foreground');

  // 🔴 TÉMOIN DU TÉMOIN. Sans ce cas, une regex qui cesserait de trouver quoi
  // que ce soit rendrait la suite verte sur un tableau VIDE : zéro thème
  // examiné, zéro échec, et la garde certifierait un état qu'elle n'a pas lu.
  it('trouve bien les quatre thèmes dans src/index.css', () => {
    expect(solids, 'aucun --color-accent-solid lu : la regex ne mesure plus rien').toHaveLength(4);
    expect(fgs, 'aucun --color-accent-solid-foreground lu').toHaveLength(4);
  });

  it('chaque thème rend au moins 4,5:1 entre le fond et son texte', () => {
    const ratios = solids.map((bg, i) => ({
      bg: bg.join(' '),
      fg: fgs[i].join(' '),
      ratio: Number(contrast(fgs[i], bg).toFixed(2)),
    }));
    const failing = ratios.filter((r) => r.ratio < AA_NORMAL);
    expect(
      failing,
      'Un thème passe sous 4,5:1 sur le bouton d action PRINCIPAL. axe-core ne '
        + 'le verra pas : il ne scanne que le theme par defaut. Mesures : '
        + JSON.stringify(ratios),
    ).toEqual([]);
  });

  // Le calcul lui-même doit être éprouvé, sinon les deux cas ci-dessus ne
  // mesurent que la confiance qu'on lui accorde. Valeurs de référence WCAG.
  it('le calcul de contraste est juste', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    // #2f75d5, la teinte retenue pour le thème gris (C-25, option A).
    expect(contrast([255, 255, 255], [47, 117, 213])).toBeCloseTo(4.54, 1);
  });
});
