// ═══════════════════════════════════════════════════════════════════
// GARDE — `{{message}}` ne recoit QUE du texte de catalogue (C-62)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. Le depot affiche ses echecs de mutation par 75 cles
// `mutation.*` qui INTERPOLENT le message de l'exception :
//
//     "mutation.updateTask2": "Impossible de modifier la tache : {{message}}"
//
// C'est sur tant que l'exception est une `ApiError`, dont le `message` vient du
// catalogue. Rien ne le garantissait : `src/modules` portait
// **98 `throw new Error('<litteral>')`**, et n'importe quelle exception interne
// empruntait le meme tuyau. Mesure du 2026-09-03, en executant les vrais
// repositories et le vrai moteur i18n :
//
//   « Impossible de modifier la tache : Task with id id-inexistant-42 not found »
//   « Impossible de creer le lien : localStorage is not defined »
//
// La seconde est la plus parlante : le canal est OUVERT du `throw` jusqu'au
// toast. Un `TypeError` s'y afficherait pareil.
//
// ── CE QUE CETTE GARDE REGARDE ──────────────────────────────────────
//
// Un `throw new Error('<phrase>')` dans `src/modules`. Le remplacant est
// `makeApiError('<code>')` : le code sert de cle, le catalogue rend la phrase,
// et un code non catalogue retombe sur le message generique, jamais sur le code
// brut. C'est le meme contrat qu'un `RAISE EXCEPTION '<identifiant>'` du SQL, et
// la garde accepte donc AUSSI un `throw new Error('<code>')` de forme stricte,
// qui ne peut pas s'afficher comme une phrase.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS. Elle ne regarde que le `throw` : elle ne dit rien
// d'un `err.message` relaye a la main par un appelant, ni d'une exception du
// moteur JS (`localStorage is not defined`) qui n'est pas ecrite ici. Le tuyau
// est ferme du cote qui etait mesurable ; l'autre se regarde a l'oeil. Une garde
// doit dire ce qu'elle mesure.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import frErrors from '@/locales/fr/errors.json';
import enErrors from '@/locales/en/errors.json';

const MODULES = join(process.cwd(), 'src/modules');

/**
 * Ce qui n'est PAS un message d'utilisateur, et pourquoi.
 *
 * ⚠️ Chaque entree doit prouver que la phrase ne peut pas atteindre un toast.
 * « C'est un cas particulier » n'est pas une raison.
 */
const NOT_USER_FACING = [
  {
    // Levee au montage d'un contexte, donc pendant le RENDU : elle part dans
    // l'`AppErrorBoundary`, jamais dans `{{message}}`. Et elle ne peut se
    // produire que si un developpeur oublie un provider, jamais chez un
    // utilisateur, l'arbre etant fixe dans `App.tsx`.
    pattern: /must be used within/,
    why: 'erreur de developpeur, levee au rendu, jamais routee vers un toast',
  },
  {
    // Le mode demo n'a pas de client Supabase : ce `throw` est un garde-fou de
    // programmation, atteint uniquement si un repository de production est
    // instancie hors mode production.
    pattern: /^Supabase not configured$/,
    why: 'garde-fou de programmation, inatteignable par le chemin normal',
  },
];

/**
 * Le CODE seul.
 *
 * 🔴 Ce fichier CITE le motif qu'il interdit, dans ses propres commentaires, et
 * la premiere version se denoncait elle-meme : `org-billing.hooks.ts` etait
 * rapporte comme contrevenant a cause d'une ligne de JSDoc. C'est la troisieme
 * garde de ce depot a tomber dedans. Une garde qui lit les commentaires ne
 * mesure pas le code.
 */
function codeOnly(source: string): string {
  return source
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(String.fromCharCode(10))
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join(String.fromCharCode(10));
}

/** Un identifiant metier : ne peut pas s'afficher comme une phrase. */
const BUSINESS_CODE = /^[a-z][a-z0-9_]{2,49}$/;

const THROW_LITERAL = /throw new Error\((['"`])([^]*?)\1\)/g;

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

/** Les phrases lancees telles quelles, hors dispenses justifiees. */
function rawThrownPhrases(source: string): string[] {
  const out: string[] = [];
  THROW_LITERAL.lastIndex = 0;
  for (let m = THROW_LITERAL.exec(source); m; m = THROW_LITERAL.exec(source)) {
    const msg = m[2];
    if (BUSINESS_CODE.test(msg)) continue;
    if (NOT_USER_FACING.some((e) => e.pattern.test(msg))) continue;
    out.push(msg);
  }
  return out;
}

describe('garde — aucune phrase en dur ne peut atteindre `{{message}}` (C-62)', () => {
  it('TEMOIN : le detecteur voit une phrase et epargne un code', () => {
    // Sans cette sonde, une regex cassee rendrait la garde verte pour toujours,
    // la classe de defaut trouvee QUATRE fois en cinq jours.
    expect(rawThrownPhrases(String.raw`throw new Error('Task not found');`)).toEqual([
      'Task not found',
    ]);
    expect(rawThrownPhrases(String.raw`throw new Error('Entreprise introuvable');`)).toEqual([
      'Entreprise introuvable',
    ]);
    // Un identifiant metier ne s'affiche pas : `makeApiError` le remplace par le
    // texte du catalogue, ou par le message generique.
    expect(rawThrownPhrases(String.raw`throw new Error('seat_limit_reached');`)).toEqual([]);
    expect(rawThrownPhrases(String.raw`throw makeApiError('not_found');`)).toEqual([]);
    // Et les deux dispenses sont bien des dispenses, pas un trou.
    expect(rawThrownPhrases(String.raw`throw new Error('Supabase not configured');`)).toEqual([]);
    expect(
      rawThrownPhrases(String.raw`throw new Error('useAuth must be used within an AuthProvider');`),
    ).toEqual([]);
  });

  it('TEMOIN : le corpus balaye est bien `src/modules`', () => {
    // Une garde qui parcourt le mauvais repertoire rend une liste vide, donc le
    // VERT, exactement comme si tout allait bien.
    const files = walk(MODULES);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.includes('tasks/'))).toBe(true);
    expect(files.some((f) => f.includes('organizations/'))).toBe(true);
  });

  it('aucun module ne lance une phrase en dur', () => {
    const offenders = walk(MODULES)
      .map((rel) => rel.split(String.fromCharCode(92)).join('/'))
      .map((rel) => [rel, rawThrownPhrases(codeOnly(readFileSync(join(MODULES, rel), 'utf-8')))] as const)
      .filter(([, phrases]) => phrases.length > 0)
      .map(([rel, phrases]) => `${rel} → ${phrases.join(' | ')}`);

    expect(
      offenders,
      [
        'Cette phrase traverse le tuyau entier et est affichee telle quelle par',
        'les cles `mutation.*` : « Impossible de modifier la tache : <phrase> ».',
        'Ecrite en francais elle est identique en anglais ; ecrite en anglais',
        'elle est affichee telle quelle en francais ; et si elle interpole un',
        'identifiant, la personne lit un UUID interne.',
        'Remplacer par makeApiError(<code>) et cataloguer le code dans',
        'src/locales/{fr,en}/errors.json, section `api`.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('chaque code employe par les modules est CATALOGUE dans les deux langues', () => {
    // Un code absent du catalogue ne casse rien (il retombe sur le message
    // generique) mais il rend un ecran MUET sur ce qui vient de se passer. Le
    // silence est le mode de panne de cette conception, donc il se garde.
    const used = new Set<string>();
    for (const rel of walk(MODULES)) {
      const source = codeOnly(readFileSync(join(MODULES, rel), 'utf-8'));
      for (const m of source.matchAll(/makeApiError\(\s*'([a-z][a-z0-9_]*)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(10);

    const fr = (frErrors as { api: Record<string, string> }).api;
    const en = (enErrors as { api: Record<string, string> }).api;
    const missing = [...used].sort().filter((c) => !fr[c] || !en[c]);
    expect(missing, 'codes employes par un module et absents du catalogue').toEqual([]);
  });
});
