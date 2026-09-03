// ═══════════════════════════════════════════════════════════════════
// GARDE — un « Annuler » ne recree JAMAIS l'objet sous un nouvel identifiant
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-37, revue du 2026-09-03).
//
// Le correctif R-08 du 2026-09-02 a cree `splitRestore` et les cinq
// `useRestoreX`, puis s'est arrete a `src/pages`. SIX chemins d'annulation de
// `src/components` ecrivaient encore le motif que `src/lib/restore-id.ts`
// documente comme fautif, a sa ligne 9 :
//
//     const { id: _id, createdAt: _ca, ...rest } = snapshot;
//     createMutation.mutate(rest);
//
// L'objet revenait sous un id neuf : rattachements aux listes, `krId`, pauses
// d'habitude — tout ce qui est keye par l'identifiant restait orphelin, sans
// aucune erreur a l'ecran. Le cas de la suppression EN LOT etait le pire :
// annuler dix suppressions rendait dix taches detachees de toutes les listes.
//
// ── LE TEMOIN ────────────────────────────────────────────────────────
//
// Ce fichier embarque une sonde qui refuse un detecteur qui ne detecterait
// plus rien : le motif fautif est soumis au detecteur, qui DOIT le voir. Sans
// ca, une regex cassee rendrait une garde verte pour toujours.
//
// ── LES DEUX EXCEPTIONS, ET POURQUOI ────────────────────────────────
//
// `HabitActionsMenu` et `useAgendaEventActions` ecrivent le meme motif et
// c'est JUSTE : ce sont des DUPLICATIONS, pas des annulations. Une copie doit
// laisser la base choisir son identifiant. Elles sont nommees ici une par une,
// jamais couvertes par un motif de chemin : un fichier ajoute a l'avenir doit
// echouer, pas heriter d'une dispense.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/**
 * Duplications legitimes, nommees une par une. Un « Annuler » ne peut pas
 * entrer dans cette liste : il doit rendre l'objet sous SON identifiant.
 */
const LEGITIMATE_DUPLICATIONS = new Set([
  'components/HabitActionsMenu.tsx',
  'pages/agenda/useAgendaEventActions.ts',
]);

/** Fichiers qui PARLENT du motif (documentation, tests) sans l'executer. */
const DOCUMENTS_THE_PATTERN = new Set([
  'lib/restore-id.ts',
  'lib/restore-id.test.ts',
  'modules/habits/restore.hooks.ts',
  'restore-id.guard.test.ts',
]);

/**
 * Le detecteur : un destructurage qui MET DE COTE l'identifiant sous un nom
 * jete (`_id`, `_ignored`…) tout en gardant un reste.
 */
const DISCARDS_ID = /\{\s*id\s*:\s*_[A-Za-z0-9]*\s*[,}][^\n]*\.\.\./;

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

describe('garde — « Annuler » restaure l\'identifiant (C-37 / R-08)', () => {
  it('TEMOIN : le detecteur voit bien le motif fautif', () => {
    // Sans cette sonde, une regex cassee rendrait la garde verte pour toujours.
    expect(
      DISCARDS_ID.test('const { id: _id, createdAt: _ca, ...rest } = snapshot;'),
    ).toBe(true);
    expect(DISCARDS_ID.test('const { id: _ignored, ...rest } = snapshot;')).toBe(true);
    // ... et qu'il ne crie pas sur un destructurage ordinaire.
    expect(DISCARDS_ID.test('const { id, name } = task;')).toBe(false);
    expect(DISCARDS_ID.test('const { payload, options } = splitRestore(snap);')).toBe(false);
  });

  it('aucun fichier de src/ ne jette un identifiant hors des deux duplications', () => {
    const offenders = walk(SRC)
      .map((rel) => rel.split(String.fromCharCode(92)).join('/'))
      .filter((rel) => !LEGITIMATE_DUPLICATIONS.has(rel) && !DOCUMENTS_THE_PATTERN.has(rel))
      .filter((rel) => DISCARDS_ID.test(readFileSync(join(SRC, rel), 'utf-8')));

    expect(
      offenders,
      [
        'Un « Annuler » doit rendre l\'objet sous SON identifiant :',
        'passer par le useRestoreX du module (second argument de create()).',
        'Contrat : src/lib/restore-id.ts. S\'il s\'agit d\'une DUPLICATION,',
        'ajouter le fichier a LEGITIMATE_DUPLICATIONS avec sa raison.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('TEMOIN : les deux duplications legitimes portent encore le motif', () => {
    // Si elles cessent de le porter, la dispense est perimee et doit tomber :
    // une liste d'exceptions qui ne protege plus rien finit par en couvrir une
    // vraie.
    for (const rel of LEGITIMATE_DUPLICATIONS) {
      expect(DISCARDS_ID.test(readFileSync(join(SRC, rel), 'utf-8')), rel).toBe(true);
    }
  });
});
