// ═══════════════════════════════════════════════════════════════════
// check-edge-deploy.core.mjs · le NOYAU de la garde C-35, sans shebang
//
// 🔴 POURQUOI CE FICHIER EXISTE SEPAREMENT DU CLI
//
// Ce noyau vivait dans `scripts/check-edge-deploy.mjs`, et son temoin
// l'importait de la. Ce module-la commence par `#!/usr/bin/env node` :
// Node retire ce shebang, la chaine Vite/vitest ne le retire PAS. Resultat
// mesure le 2026-09-09 sur Windows : `npm test` echouait a collecter
// `check-edge-deploy.guard.test.mjs` (`SyntaxError: Invalid or unexpected
// token`, sans localisation) et ABANDONNAIT le run entier — 210 autres
// fichiers et 2 205 tests jamais joues, jamais rapportes.
//
// La consequence est la seule qui compte, et elle est la parente de la
// regle « une garde se verifie sur ce qu'elle REGARDE » de CLAUDE.md :
// un temoin qui ne peut pas etre joue EN LOCAL n'est joue que par la CI,
// donc jamais pendant qu'on ecrit le code qu'il garde.
//
// ❌ NE JAMAIS remettre un shebang en tete de ce fichier : il n'est pas un
// point d'entree, il est importe. Le shebang reste sur le CLI, qui lui se
// lance.
// ❌ NE JAMAIS faire importer le CLI par le temoin : c'est ce qui a casse.
// Le CLI est SPAWNE (cf. le temoin « secret absent »), jamais importe.
//
// Ce que ce noyau contient : uniquement ce qui est PUR ou ne lit que le
// depot. Le reseau, la declaration `.github/edge-deploy.json` et le rapport
// restent dans le CLI.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';

const ROOT = process.cwd();
export const FUNCTIONS_DIR = resolve(ROOT, 'supabase/functions');

/**
 * Normalise le CONTENU avant comparaison.
 *
 * Deux normalisations, deux seules, et chacune se justifie :
 * - le BOM, que certains editeurs posent et que le bundle ne porte pas ;
 * - les fins de ligne, parce que ce depot se clone sur Windows et qu'une
 *   garde rouge a chaque checkout CRLF serait desarmee dans la semaine.
 *
 * ❌ Rien d'autre. Surtout pas un `trim()` ni un ecrasement des espaces :
 * une ligne qui a perdu son indentation est un fichier DIFFERENT, et c'est
 * exactement le genre d'ecart qu'un comparateur trop poli avale.
 */
export function normalizeContent(text) {
  return String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

/**
 * Compare deux arborescences de fichiers (Map<chemin relatif, contenu>).
 *
 * Rend la liste des divergences. Un tableau vide veut dire « identique »,
 * et ne peut vouloir dire ca QUE si les deux cotes ont ete lus : le cas
 * « rien lu » est traite par l'appelant, pas ici (cf. `assertReadSomething`).
 */
export function compareFunction({ slug, repoFiles, deployedFiles }) {
  const divergences = [];
  const chemins = new Set([...repoFiles.keys(), ...deployedFiles.keys()]);

  for (const chemin of [...chemins].sort()) {
    const dansDepot = repoFiles.has(chemin);
    const dansProd = deployedFiles.has(chemin);

    // Les deux sens comptent. Un comparateur qui ne verifie que « chaque
    // fichier du depot est en prod » ne voit jamais un fichier que le depot
    // a supprime et que la prod execute toujours.
    if (dansDepot && !dansProd) {
      divergences.push({ slug, chemin, genre: 'absent-de-la-prod' });
      continue;
    }
    if (!dansDepot && dansProd) {
      divergences.push({ slug, chemin, genre: 'absent-du-depot' });
      continue;
    }

    const attendu = normalizeContent(repoFiles.get(chemin));
    const servi = normalizeContent(deployedFiles.get(chemin));
    if (attendu === servi) continue;

    divergences.push({
      slug,
      chemin,
      genre: 'contenu-different',
      premiereLigne: premiereLigneDifferente(attendu, servi),
    });
  }

  return divergences;
}

/** Numero de la premiere ligne qui differe · pour rendre l'echec lisible. */
function premiereLigneDifferente(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i += 1) {
    if (la[i] !== lb[i]) return i + 1;
  }
  return 0;
}

/**
 * Perimetre d'une fonction dans le depot : son entrypoint + les modules
 * locaux qu'il importe, transitivement.
 *
 * 🔴 POURQUOI RESOUDRE LES IMPORTS plutot que se contenter du dossier de la
 * fonction : `_shared/alert.ts`, `_shared/org-tiers.ts` et les autres sont
 * EMBARQUES dans le bundle deploye. Une fonction redeployee il y a six
 * semaines execute la version d'alors de ses modules partages ; comparer le
 * seul `index.ts` laisserait cet ecart-la totalement invisible, alors que
 * c'est precisement la forme qu'a prise le defaut S-4.
 *
 * Les imports distants (`npm:`, `https:`, `jsr:`, `node:`) sont hors sujet :
 * ils ne sont pas dans le depot.
 */
export function repoFilesFor(slug, { readFile, exists } = {}) {
  const lire = readFile ?? ((p) => readFileSync(p, 'utf8'));
  const existe = exists ?? ((p) => existsSync(p));

  const entree = join(FUNCTIONS_DIR, slug, 'index.ts');
  if (!existe(entree)) {
    throw new Error(`Entrypoint introuvable dans le depot : supabase/functions/${slug}/index.ts`);
  }

  const fichiers = new Map();
  const aVoir = [entree];

  while (aVoir.length > 0) {
    const chemin = aVoir.pop();
    const cle = cleRelative(chemin);
    if (fichiers.has(cle)) continue;

    const contenu = lire(chemin);
    fichiers.set(cle, contenu);

    for (const spec of importsLocaux(contenu)) {
      const cible = resolve(dirname(chemin), spec);
      if (!existe(cible)) {
        // Un import local qui ne resout pas est un bug du depot, pas une
        // divergence de deploiement. On le dit, on ne l'avale pas.
        throw new Error(`Import local non resolu depuis ${cleRelative(chemin)} : ${spec}`);
      }
      aVoir.push(cible);
    }
  }

  return fichiers;
}

/** Chemin relatif a `supabase/functions/`, en separateurs POSIX. */
export function cleRelative(chemin) {
  return relative(FUNCTIONS_DIR, chemin).split(sep).join('/');
}

/** Specificateurs d'import RELATIFS d'un module Deno (`./x.ts`, `../y/z.ts`). */
export function importsLocaux(source) {
  const specs = [];
  const motifs = [
    /\bimport\s+(?:[\s\S]*?\sfrom\s+)?['"](\.[^'"]+)['"]/g,
    /\bexport\s+(?:[\s\S]*?\sfrom\s+)?['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];
  for (const motif of motifs) {
    let m;
    while ((m = motif.exec(source)) !== null) specs.push(m[1]);
  }
  return [...new Set(specs)];
}

/**
 * Ramene les chemins d'un bundle telecharge sur la meme convention que le
 * depot : relatifs a `supabase/functions/`.
 *
 * Le prefixe VARIE selon l'endroit d'ou la fonction a ete deployee. Mesure
 * le 2026-09-04 sur les sept fonctions en ligne : `delete-account` porte
 * `source/delete-account/index.ts` (deploye depuis `supabase/functions/`)
 * la ou `stripe-webhook` porte `source/supabase/functions/stripe-webhook/
 * index.ts` (deploye depuis la racine). Comparer sans normaliser aurait
 * rendu « tout diverge » pour tout le monde, ce qui est une autre facon de
 * ne rien mesurer.
 */
export function cleDeployee(nom, slug) {
  const parts = String(nom).split(/[\\/]/).filter((p) => p && p !== '.');
  // On garde tout ce qui suit le dernier segment `functions`, quand il y en
  // a un ; sinon tout ce qui suit le segment portant le nom de la fonction.
  const iFunctions = parts.lastIndexOf('functions');
  if (iFunctions !== -1 && iFunctions < parts.length - 1) {
    return parts.slice(iFunctions + 1).join('/');
  }
  const iSlug = parts.lastIndexOf(slug);
  if (iSlug !== -1) return parts.slice(iSlug).join('/');
  const iShared = parts.lastIndexOf('_shared');
  if (iShared !== -1) return parts.slice(iShared).join('/');
  return parts.join('/');
}

/**
 * 🔴 LE GARDE-FOU CENTRAL · refuse un verdict rendu sans avoir rien lu.
 *
 * C'est la classe de defaut de `restore-drill.yml`, dont le `tail -1`
 * capturait le mot ROLLBACK au lieu du compte : le controle ne POUVAIT pas
 * echouer. Ici, un bundle vide, un telechargement muet ou un decodeur qui
 * rend zero fichier donneraient « aucune divergence » avec la meme serenite.
 * Une lecture vide est donc une ERREUR, jamais un succes.
 */
export function assertReadSomething(slug, deployedFiles) {
  if (!(deployedFiles instanceof Map) || deployedFiles.size === 0) {
    throw new Error(
      `Lecture vide pour « ${slug} » : le bundle deploye n'a rendu aucun fichier. ` +
        `Ce n'est PAS « identique au depot », c'est une garde qui n'a rien mesure.`,
    );
  }
  const aUnePoint = [...deployedFiles.keys()].some((c) => c.endsWith(`${slug}/index.ts`));
  if (!aUnePoint) {
    throw new Error(
      `Lecture douteuse pour « ${slug} » : aucun fichier lu ne ressemble a son entrypoint ` +
        `(vu : ${[...deployedFiles.keys()].join(', ') || 'rien'}). La normalisation des chemins ` +
        `a probablement change cote fournisseur, et un comparateur qui compare des chemins ` +
        `desalignes dit « tout diverge » ou « rien n'existe », jamais la verite.`,
    );
  }
}
