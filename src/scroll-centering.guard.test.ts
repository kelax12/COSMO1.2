// ═══════════════════════════════════════════════════════════════════
// GARDE — `items-center` et `overflow-y-auto` sur le MEME element
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-56, audit A-4, remesure du 2026-09-03).
//
// C'est le piege CSS classique : quand l'enfant est plus haut que le
// conteneur, le debordement d'un `align-items: center` se repartit DES DEUX
// COTES, et la partie qui sort par le haut n'entre pas dans `scrollHeight`.
// `scrollTop` etant borne a zero, aucun geste ne la ramene.
//
// MESURE, pas deduction — harnais Playwright a 375 x 350 (la hauteur que prend
// le viewport de mise en page d'un telephone Android quand le clavier est
// ouvert), carte de 457,6 px, CSS reel du projet :
//
//   | conteneur                            | course | haut a scrollTop 0 |
//   |--------------------------------------|--------|--------------------|
//   | items-center + overflow-y-auto       |  72 px | **-55,8 px**       |
//   | ... + `my-auto` sur l ENFANT         | 144 px | +16 px             |
//   | scroll dehors + `min-h-full` dedans  | 144 px | +16 px             |
//
// Le defilement ELOIGNE encore le haut (-127,8 px a course pleine) : ce n est
// pas « il faut remonter », c est inatteignable.
//
// ── CE QUE LA REMESURE A CORRIGE DANS L ENONCE ──────────────────────
//
// L enonce d origine nommait TROIS fichiers, sur la seule foi de leur liste de
// classes. Mesures dans l application reelle a 375 x 350, `BugReportModal` et
// `InviteOrJoinModal` etaient DEJA corrects (+16 px) : leur carte porte
// `my-auto`, et une marge automatique resout a zero du cote sur-contraint, ce
// qui rend tout le debordement defilable. Un seul ecran etait reellement
// casse : `FirstRunSetup`, dont la carte n avait pas cette marge — et c est
// le pire des trois, puisque c est l accueil d un compte neuf.
//
// La regle ci-dessous couvre donc les DEUX sorties, parce que les deux sont
// mesurees comme suffisantes.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Un attribut `className` qui combine centrage vertical et defilement. */
const TRAP = /className="[^"]*\bitems-center\b[^"]*\boverflow-y-auto\b[^"]*"|className="[^"]*\boverflow-y-auto\b[^"]*\bitems-center\b[^"]*"/;

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? base + '/' + entry : entry;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (/\.tsx$/.test(entry) && !/\.test\./.test(entry)) out.push(rel);
  }
  return out;
}

describe('garde — pas de centrage vertical sur un conteneur defilant (C-56)', () => {
  it('TEMOIN : le detecteur voit le piege, dans les deux ordres', () => {
    // Sans cette sonde, une regex cassee rendrait la garde verte pour toujours.
    expect(TRAP.test(String.raw`className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4"`)).toBe(true);
    expect(TRAP.test(String.raw`className="fixed inset-0 overflow-y-auto flex items-center p-4"`)).toBe(true);
    // ... et qu il epargne les deux sorties mesurees comme correctes.
    expect(TRAP.test(String.raw`className="fixed inset-0 overflow-y-auto"`)).toBe(false);
    expect(TRAP.test(String.raw`className="flex min-h-full items-center justify-center p-4"`)).toBe(false);
  });

  it('aucun composant ne combine les deux sur le meme element', () => {
    const offenders = walk(SRC)
      .map((rel) => rel.split(String.fromCharCode(92)).join('/'))
      .filter((rel) => TRAP.test(readFileSync(join(SRC, rel), 'utf-8')));

    expect(
      offenders,
      [
        'Le haut de ce conteneur devient inatteignable des que son enfant le',
        'depasse — mesure a -55,8 px sur un viewport Android clavier ouvert.',
        'Deux sorties, toutes deux mesurees : sortir le defilement (conteneur',
        'en `overflow-y-auto`, centrage dans un enfant `flex min-h-full',
        'items-center`), ou poser `my-auto` sur l enfant centre.',
      ].join('\n'),
    ).toEqual([]);
  });
});
