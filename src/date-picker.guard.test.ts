// ═══════════════════════════════════════════════════════════════════
// GARDE — le calendrier COSMO, sauf les deux pickers natifs assumes
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-11).
//
// Le 2026-08-30, SIX surfaces sont passees du picker natif du navigateur au
// calendrier COSMO (`DatePicker` / `DateCalendarPanel`). Le picker natif est
// hors theme, hors locale de l application, et sans les presets. La bascule a
// ete verifiee A LA MAIN dans le navigateur, et rien n empechait un
// `input type="date"` de revenir.
//
// ── LES DEUX EXCEPTIONS, ET POURQUOI ────────────────────────────────
//
// `EventModalFormDesktop` et `EventModalFormMobile` gardent le picker natif,
// et c est un ARBITRAGE, pas un oubli : sur mobile la roue systeme vaut mieux
// que n importe quel calendrier maison. Elles sont nommees une par une, jamais
// couvertes par un motif de chemin — une surface ajoutee doit echouer, pas
// heriter d une dispense.
//
// ── LE TEMOIN ────────────────────────────────────────────────────────
//
// Le detecteur est soumis a un echantillon qu il DOIT voir, et les deux
// dispenses sont verifiees encore vivantes : une liste d exceptions qui ne
// couvre plus rien finit par en couvrir une vraie.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Un champ de saisie de date NATIF. */
const NATIVE_DATE_INPUT = /type="date"|type={'date'}|type={"date"}/;

/** Arbitrage assume : la roue systeme du telephone bat le calendrier maison. */
const NATIVE_ON_PURPOSE = new Set([
  'components/event-modal/EventModalFormDesktop.tsx',
  'components/event-modal/EventModalFormMobile.tsx',
]);

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? base + '/' + entry : entry;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (/[.]tsx$/.test(entry) && !/[.]test[.]/.test(entry)) out.push(rel);
  }
  return out;
}

describe('garde — saisie de date : le calendrier COSMO (C-11)', () => {
  it('TEMOIN : le detecteur voit un champ de date natif', () => {
    expect(NATIVE_DATE_INPUT.test('<input type="date" value={d} />')).toBe(true);
    expect(NATIVE_DATE_INPUT.test('<input type="text" />')).toBe(false);
    expect(NATIVE_DATE_INPUT.test('<DatePicker value={d} onChange={set} />')).toBe(false);
  });

  it('aucune surface ne revient au picker natif hors des deux assumees', () => {
    const offenders = walk(SRC)
      .map((rel) => rel.split(String.fromCharCode(92)).join('/'))
      .filter((rel) => !NATIVE_ON_PURPOSE.has(rel))
      .filter((rel) => NATIVE_DATE_INPUT.test(readFileSync(join(SRC, rel), 'utf-8')));

    expect(
      offenders,
      [
        'Le picker natif est hors theme, hors locale et sans presets.',
        'Passer par `DatePicker` (champ) ou `DateCalendarPanel` (entree de menu).',
        'Si la roue systeme est un choix delibere, ajouter le fichier a',
        'NATIVE_ON_PURPOSE avec sa raison.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('TEMOIN : les deux dispenses portent encore un picker natif', () => {
    for (const rel of NATIVE_ON_PURPOSE) {
      expect(
        NATIVE_DATE_INPUT.test(readFileSync(join(SRC, rel), 'utf-8')),
        rel + ' ne porte plus de picker natif : la dispense est perimee',
      ).toBe(true);
    }
  });
});
