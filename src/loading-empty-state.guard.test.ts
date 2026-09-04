// ═══════════════════════════════════════════════════════════════════
// GARDE — un ecran n'AFFIRME pas une absence qu'il ne connait pas encore
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-40, revue du 2026-09-03).
//
// Le motif fautif tient en deux lignes eloignees l'une de l'autre :
//
//     const { data: friends = [] } = useFriends();   // isLoading jamais lu
//     ...
//     {friends.length === 0 ? <p>Ajoute d'abord un ami…</p> : …}
//
// Le premier rendu arrive AVANT la reponse. La valeur par defaut `[]` est
// alors indistinguable d'un compte reellement vide, et l'ecran affirme une
// absence : « Ajoute d'abord un ami pour partager une liste » a quelqu'un qui
// en a, « aucune equipe » sur l'apercu entreprise. Ce n'est pas un scintillement
// esthetique — c'est une phrase fausse, affirmee, sur laquelle la personne agit.
//
// ── CE QUE CETTE GARDE REGARDE, ET CE QU'ELLE NE REGARDE PAS ────────
//
// Elle ne voit QUE le cas mecanique : un `data: X = []` dont on ignore l'etat
// de chargement, ET un `X.length === 0` dans le meme fichier. C'est
// volontairement etroit : un etat vide calcule sur une variable derivee
// (`selectableFriends`, `invitable`) lui echappe, et il faut donc continuer a
// le regarder a l'oeil. Une garde doit dire ce qu'elle mesure.
//
// 🔴 ET ELLE VERIFIE LA DESTRUCTURATION, PAS L'USAGE. Mesure par mutation le
// 2026-09-04 : retirer le `loadingFriends ? null :` de `ShareListSheet` sans
// toucher a la destructuration laisse cette garde au VERT. Ce qui rattrape ce
// cas n'est pas elle, c'est `noUnusedLocals` du tsconfig — la variable devient
// inutilisee et `npm run typecheck` echoue (verifie).
//
// La PAIRE tient donc, pas la garde seule. Le noter ici plutot que de laisser
// croire que ce fichier suffit : c'est exactement la difference entre « une
// garde repond » et « une garde mesure ».
//
// Cinq occurrences de la mesure d'origine ont ete RELUES puis ecartees, pour
// ne pas gonfler le chiffre avec des cas qui ne mentent pas. Elles sont nommees
// une par une dans `NOT_AN_ASSERTION`, jamais couvertes par un motif de chemin.
//   - `useTaskModal` teste `Object.keys(newErrors).length === 0`, une
//     validation de formulaire : le detecteur ne le voit meme pas.
//
// ── LE TEMOIN ────────────────────────────────────────────────────────
//
// Le detecteur est soumis a des echantillons qu'il DOIT voir et a d'autres
// qu'il ne doit PAS voir. Sans ca, une regex cassee rendrait la garde verte
// pour toujours — la classe de defaut que `CLAUDE.md` documente sous « une
// garde se verifie sur ce qu'elle REGARDE ».

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🔴 LE CORPUS A ETE ELARGI A TOUT `src` LE 2026-09-04.
 *
 * La mesure d origine ne regardait que `src/components`, parce que c est la
 * que les douze occurrences avaient ete comptees. Une garde bornee au lieu ou
 * l on a trouve le defaut ne protege que ce lieu : `src/pages` et
 * `src/modules` rendent aussi des etats vides.
 *
 * Le balayage etendu rend ZERO nouvelle occurrence — les quatre seuls
 * fichiers detectes sont ceux deja dispenses ci-dessous. L elargissement ne
 * masque donc rien ; il ferme le reste de la surface.
 *
 * ⚠️ Deux autres formes de lecture aveugle ont ete cherchees et sont ABSENTES
 * du depot : `const { data = [] } = useX()` (sans renommage) et
 * `useX().data ?? []`. Elles ne sont pas couvertes par le detecteur ; le noter
 * vaut mieux que de laisser croire a une couverture qu il n a pas.
 */
const SRC = join(process.cwd(), 'src');

/**
 * Fichiers ou le detecteur voit le motif mais ou il n'y a PAS d'affirmation.
 * Chacun porte sa raison. Un fichier ajoute ici doit prouver qu'il ne rend
 * aucune phrase d'absence — ne rien dire n'est pas affirmer une absence.
 */
const NOT_AN_ASSERTION = new Map<string, string>([
  ['components/HabitTable.tsx', 'le test ne sert qu a choisir une date par defaut, aucun rendu'],
  ['components/organization/OrgNotificationsBell.tsx', 'rend `null` : une cloche morte est du bruit, pas un mensonge'],
  ['components/organization/TeamAssigneeGroups.tsx', 'rend `null` : la section entiere disparait, elle n affirme rien'],
  ['components/organization/TeamProjectsTab.tsx', 'le test choisit un GROUPEMENT, la liste plate reste rendue'],
]);

/** Lecture React Query dont l'etat de chargement n'est PAS destructure. */
const BLIND_READ = /const\s*\{\s*data:\s*([A-Za-z0-9_]+)\s*=\s*\[\]\s*\}\s*=\s*use[A-Za-z0-9_]+\(/g;

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(rel);
  }
  return out;
}

/** Rend les noms lus a l'aveugle ET dont le fichier rend un etat vide. */
function blindEmptyStates(source: string): string[] {
  const names = [...source.matchAll(BLIND_READ)].map((m) => m[1]);
  return names.filter((n) => new RegExp(String.raw`\b${n}\.length\s*===\s*0`).test(source));
}

describe('garde — pas d\'etat vide affirme pendant le chargement (C-40)', () => {
  it('TEMOIN : le detecteur voit le motif fautif et epargne le motif correct', () => {
    const fautif = [
      'const { data: friends = [] } = useFriends();',
      '{friends.length === 0 ? <p>rien</p> : null}',
    ].join('\n');
    expect(blindEmptyStates(fautif)).toEqual(['friends']);

    const correct = [
      'const { data: friends = [], isLoading: loadingFriends } = useFriends();',
      '{loadingFriends ? null : friends.length === 0 ? <p>rien</p> : null}',
    ].join('\n');
    expect(blindEmptyStates(correct)).toEqual([]);

    // Une lecture aveugle SANS etat vide n'est pas un defaut : la valeur par
    // defaut `[]` y est un repli legitime.
    const inoffensif = 'const { data: friends = [] } = useFriends();\nfriends.map(f => f.id);';
    expect(blindEmptyStates(inoffensif)).toEqual([]);
  });

  it('aucun composant ne rend un etat vide sur une lecture a l\'aveugle', () => {
    const offenders = walk(SRC)
      .map((rel) => rel.split(String.fromCharCode(92)).join('/'))
      .map((rel) => [rel, blindEmptyStates(readFileSync(join(SRC, rel), 'utf-8'))] as const)
      .filter(([rel]) => !NOT_AN_ASSERTION.has(rel))
      .filter(([, names]) => names.length > 0)
      .map(([rel, names]) => `${rel} → ${names.join(', ')}`);

    expect(
      offenders,
      [
        'Ces composants affirment une absence avant de savoir :',
        'destructurer `isLoading` du meme hook et ne rendre l\'etat vide',
        'qu\'une fois la reponse arrivee (un squelette, ou rien, en attendant).',
      ].join('\n'),
    ).toEqual([]);
  });

  it('TEMOIN : le corpus balaye est bien tout `src`, et pas un repertoire vide', () => {
    // 🔴 Une garde qui parcourt le mauvais repertoire rend une liste vide, donc
    // le VERT, exactement comme si tout allait bien. C est le defaut trouve par
    // mutation dans `architecture.guard` le 2026-09-04 : aucun temoin de taille
    // de corpus, donc aucune facon de distinguer « rien a signaler » de « rien
    // regarde ». Le seuil est volontairement bas et inegalable par accident.
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(400);
    // Et il couvre les trois zones, pas seulement celle ou le defaut a ete vu.
    for (const zone of ['components/', 'pages/', 'modules/']) {
      expect(
        files.some((f) => f.split(String.fromCharCode(92)).join('/').startsWith(zone)),
        `le balayage ne couvre pas ${zone}`,
      ).toBe(true);
    }
  });

  it('TEMOIN : chaque dispense est encore justifiee par une detection reelle', () => {
    // Une liste d'exceptions qui ne couvre plus rien finit par en couvrir une
    // vraie : si un de ces fichiers cesse de porter le motif, la dispense est
    // perimee et doit tomber.
    for (const [rel] of NOT_AN_ASSERTION) {
      const source = readFileSync(join(SRC, rel), 'utf-8');
      expect(blindEmptyStates(source), `${rel} ne porte plus le motif`).not.toEqual([]);
    }
  });
});
