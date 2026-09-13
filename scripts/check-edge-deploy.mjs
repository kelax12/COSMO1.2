#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// check-edge-deploy.mjs · le code DEPLOYE des Edge Functions contre le depot
//
// 🔴 POURQUOI CE FICHIER EXISTE (finding C-35, audit A-1)
//
// Le 2026-09-03, les trois sources deployees lisibles ont ete relues via
// l'API et comparees a `main` : LES TROIS divergeaient, de trois facons
// differentes.
//
//   delete-account   v13 · une variante ABSENTE du depot (correctifs R-03 et
//                          R-06, mais pas la purge symetrique de `friends`).
//                          Elle echouerait a `src/rgpd-erasure.guard.test.ts`,
//                          qui est vert.
//   renewal-notice   v9  · le defaut S-4 que `faille.md` declare corrige.
//   report-bug       v8  · le meme defaut S-4, jamais repere a l'epoque.
//
// Remesure du 2026-09-04 : `stripe-org-refund` n'existe pas en prod,
// `report-bug` tourne toujours en v8 du 08-29, `stripe-webhook` en v26 du
// 08-26. Il a fallu interroger le projet A LA MAIN pour l'apprendre.
//
// Consequence, et c'est la seule qui compte : TOUTE conclusion tiree en
// lisant `supabase/functions/` est fausse d'avance, y compris celles de
// `faille.md`. Un « ✅ corrige » sur une Edge Function ne veut rien dire
// sans sa date de deploiement. Aucune garde du depot ne regardait la prod.
//
// ── CE QUE CE SCRIPT REGARDE (cf. CLAUDE.md, § « une garde se verifie sur
//    ce qu'elle REGARDE ») ─────────────────────────────────────────────
//
// Pour chaque fonction REELLEMENT deployee : le bundle est telecharge, ses
// fichiers sont compares OCTET POUR OCTET a ceux du depot, dans les DEUX
// sens (un fichier present d'un seul cote est une divergence). Les modules
// `_shared/` importes par l'entrypoint sont dans le perimetre : c'est par la
// qu'un `alert.ts` fige depuis six semaines resterait invisible.
//
// ── CE QUE CE SCRIPT NE REGARDE PAS, ET POURQUOI ────────────────────────
//
// L'EXISTENCE d'une fonction est declaree dans `.github/edge-deploy.json`.
// Une fonction du depot jamais deployee (`stripe-org-refund` aujourd'hui) y
// est nommee avec sa raison et sa date. Sans ca la gate serait rouge en
// permanence en attendant un geste manuel d'Axel, et une gate rouge en
// permanence finit ignoree : c'est la regle du dossier, mesuree sur
// `rls-integration`.
//
// 🔴 CETTE DECLARATION NE COUVRE QUE L'EXISTENCE, JAMAIS LE CONTENU. Une
// fonction deployee est comparee, sans exception et sans reglage. Il n'y a
// aucun moyen de faire taire une divergence de code depuis ce fichier, et
// c'est deliberé : ce serait la porte de sortie qui viderait la garde.
// Un `notDeployed` qui se revele faux (la fonction EST en ligne) est lui
// aussi un echec, sinon la note perime en silence.
//
// ── SECRET ABSENT = ECHEC ───────────────────────────────────────────────
//
// Sans `SUPABASE_ACCESS_TOKEN`, ce script SORT EN 1. Jamais un
// `::warning::` dans un run vert. La regle est ecrite dans CLAUDE.md et a
// deja ete violee deux fois (`renewal-notice` le 2026-08-26, `uptime.yml`
// qui sautait sa moitie backend). Une garde qui ne se protege que quand
// elle est deja protegee ne protege rien.
//
// ── TEMOIN ──────────────────────────────────────────────────────────────
//
// `scripts/check-edge-deploy.guard.test.mjs` soumet a `compareFunction()` et
// au script lui-meme des cas qu'ils DOIVENT voir. Relire un comparateur ne
// prouve rien ; lui soumettre une divergence, si.
//
// Usage :
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/check-edge-deploy.mjs
//   node scripts/check-edge-deploy.mjs --list    (que la liste deployee)
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const FUNCTIONS_DIR = resolve(ROOT, 'supabase/functions');
const DECLARATION = resolve(ROOT, '.github/edge-deploy.json');
const API = 'https://api.supabase.com';

// ═══════════════════════════════════════════════════════════════════
// NOYAU PUR · aucun reseau, aucun disque. C'est ce que le temoin exerce.
// ═══════════════════════════════════════════════════════════════════

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

    const ecart = premiereLigneDifferente(attendu, servi);
    divergences.push({
      slug,
      chemin,
      genre: 'contenu-different',
      premiereLigne: ecart.numero,
      ligneDepot: ecart.depot,
      ligneProd: ecart.prod,
      // Les tailles NORMALISEES des deux cotes : un ecart franc denonce une
      // troncature ou un encodage, qu'un numero de ligne seul ne montre pas.
      octetsDepot: attendu.length,
      octetsProd: servi.length,
    });
  }

  return divergences;
}

/** Numero de la premiere ligne qui differe · pour rendre l'echec lisible. */
export function premiereLigneDifferente(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i += 1) {
    if (la[i] !== lb[i]) {
      return { numero: i + 1, depot: extrait(la[i]), prod: extrait(lb[i]) };
    }
  }
  return { numero: 0, depot: '', prod: '' };
}

/**
 * Une ligne rendue lisible dans un log : bornee, et les caracteres invisibles
 * rendus visibles. Un ecart d'espaces ou de fin de ligne ne se voit pas
 * autrement, et c'est exactement la classe d'ecart qu'on n'a pas su nommer
 * pendant une heure le 2026-09-13.
 */
function extrait(ligne) {
  // Vide et absente sont deux diagnostics : un ecart de contenu d'un cote,
  // une troncature de l'autre. Affiches pareil, ils se confondent.
  if (ligne === undefined) return '<ligne absente>';
  if (ligne === '') return '<ligne vide>';
  const visible = String(ligne).split('\t').join('\\t').split('\r').join('\\r');
  return visible.length > 140 ? visible.slice(0, 140) + '...' : visible;
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
/**
 * Marqueurs que la TRANSPILATION efface. Ils ne servent pas a juger du code :
 * ils servent a savoir dans quel LANGAGE on vient de lire.
 */
const MARQUEURS_TS = [
  /:\s*(?:string|number|boolean|void|unknown|Request|Response)/,
  /interface\s+\w+\s*\{/,
  /as\s+const/,
  /Promise<[^>\s]/,
];

/** Combien de marqueurs TypeScript ce texte porte-t-il ? */
export function compteMarqueursTs(source) {
  const texte = String(source);
  return MARQUEURS_TS.filter((motif) => motif.test(texte)).length;
}

/**
 * 🔴 LE SECOND GARDE-FOU CENTRAL · refuse une comparaison entre deux LANGAGES.
 *
 * Mesure du 2026-09-13, premier jour ou la CI a pu lire la prod : elle
 * annoncait 24 divergences sur 8 fonctions, dont `_shared/alert.ts` que DEUX
 * lecteurs locaux independants — la CLI Supabase 2.117.0 et l'API Management —
 * rendaient identique au depot. La CLI installee par `version: latest` rendait
 * le bundle TRANSPILE :
 *
 *   depot | export async function opsAlert(source: string, summary: string)
 *   prod  | export async function opsAlert(source, summary) {
 *
 * La garde comparait du TypeScript a du JavaScript. Elle « trouvait » donc une
 * derive sur presque chaque fichier, ce qui est la pire forme d'echec possible
 * ici : elle noyait les 4 vraies derives dans 20 fausses, et aucun operateur
 * ne distingue les unes des autres dans une liste de 24.
 *
 * La version de la CLI est desormais epinglee dans le workflow. Ce detecteur
 * est ce qui rend le pin VERIFIABLE : le jour ou une CLI se remet a transpiler,
 * le job dit « lecture transpilee », il n'invente pas vingt derives.
 *
 * ❌ Ne jamais assouplir ca en normalisant le TypeScript avant comparaison.
 * Retirer les types des deux cotes rendrait la garde AVEUGLE a toute derive
 * portant sur un type — et un type est du code : c'est lui qui dit qu'un
 * montant est un nombre.
 */
export function assertMemeLangage(slug, repoFiles, deployedFiles) {
  for (const [chemin, attendu] of repoFiles) {
    const servi = deployedFiles.get(chemin);
    // Un fichier present d'un seul cote est une DIVERGENCE, pas un probleme de
    // lecture : c'est le travail du comparateur, pas le notre.
    if (servi === undefined) continue;
    if (compteMarqueursTs(attendu) > 0 && compteMarqueursTs(servi) === 0) {
      throw new Error(
        `Lecture TRANSPILEE pour « ${slug} » (${chemin}) : le depot porte du TypeScript, ` +
          `le cote prod n'en porte AUCUNE trace. Ce n'est pas une derive, c'est un lecteur ` +
          `qui rend autre chose que la source — verifier la version de la CLI epinglee dans ` +
          `.github/workflows/edge-deploy-drift.yml. Comparer deux langages « trouve » une ` +
          `derive sur presque chaque fichier et noie les vraies.`,
      );
    }
  }
}

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

// ═══════════════════════════════════════════════════════════════════
// LECTURE DE LA PROD
// ═══════════════════════════════════════════════════════════════════

function lireDeclaration() {
  if (!existsSync(DECLARATION)) {
    throw new Error(`Declaration absente : .github/edge-deploy.json`);
  }
  const d = JSON.parse(readFileSync(DECLARATION, 'utf8'));
  if (!d.projectRef) throw new Error('.github/edge-deploy.json : `projectRef` manquant');
  return d;
}

async function listerDeployees(projectRef, token) {
  const r = await fetch(`${API}/v1/projects/${projectRef}/functions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    throw new Error(
      `API Management : liste des fonctions refusee (HTTP ${r.status}). ` +
        `Verifier que SUPABASE_ACCESS_TOKEN est un jeton personnel valide et que le ` +
        `projet ${projectRef} lui est accessible.`,
    );
  }
  return await r.json();
}

/**
 * Telecharge le bundle d'une fonction et rend ses fichiers.
 *
 * Le corps servi par `/functions/{slug}/body` est une archive eszip, un
 * format binaire de Deno. ❌ On ne le decode PAS a la main ici : un parseur
 * maison d'un format qu'on ne controle pas est exactement le genre de piece
 * qui se met a rendre zero fichier sans le dire, et ce script existe pour
 * refermer cette classe de defaut, pas pour l'ouvrir ailleurs. On delegue au
 * decodeur officiel, la CLI Supabase, deja epinglee par SHA dans `ci.yml`.
 *
 * `supabase functions download` ecrit dans `<cwd>/supabase/functions/<slug>`,
 * d'ou le repertoire temporaire : on ne touche jamais l'arbre de travail.
 */
/**
 * Ce fichier vient-il du BUNDLE, ou la CLI l'a-t-elle depose elle-meme ?
 *
 * 🔴 POURQUOI · le premier run qui a compare pour de bon (2026-09-13) a
 * signale `supabase/.temp/linked-project.json` comme « absent-du-depot »
 * pour TROIS fonctions. Or ce fichier n'est pas du code deploye : c'est la
 * CLI qui l'ecrit dans le bac a sable en s'y liant, avec `.temp/cli-latest`.
 *
 * Ce n'etait pas un faux positif anodin : « absent du depot » est le verdict
 * que ce script documente comme le plus grave — du code qui s'execute en
 * production sans source versionnee. Une garde qui crie au loup sur ses
 * propres dechets finit par etre lue en diagonale, puis plus du tout.
 *
 * Le critere est POSITIF, jamais une liste de choses a ignorer : seul ce que
 * la CLI ecrit sous `supabase/functions/` fait partie du bundle. Une liste
 * noire aurait demande de deviner les prochains fichiers de service ; ici,
 * un nouveau dechet est hors perimetre d'office. Et si la CLI se mettait un
 * jour a ecrire ailleurs, la lecture deviendrait VIDE, donc une erreur franche
 * (`assertReadSomething`) — jamais un « identique au depot ».
 */
export function estFichierDuBundle(cheminRelatif) {
  const parts = String(cheminRelatif).split(/[\\/]/).filter((p) => p && p !== '.');
  if (parts.length < 3) return false;
  if (parts[0] !== 'supabase' || parts[1] !== 'functions') return false;
  return /\.(ts|tsx|js|mjs|json)$/.test(parts[parts.length - 1]);
}

function telechargerBundle(slug, projectRef, token) {
  const bac = mkdtempSync(join(tmpdir(), `edge-deploy-${slug}-`));
  try {
    mkdirSync(join(bac, 'supabase', 'functions'), { recursive: true });
    // Un `config.toml` minimal : la CLI exige un projet initialise.
    writeFileSync(
      join(bac, 'supabase', 'config.toml'),
      `project_id = "${projectRef}"\n`,
      'utf8',
    );

    const r = spawnSync(
      'supabase',
      ['functions', 'download', slug, '--project-ref', projectRef],
      {
        cwd: bac,
        encoding: 'utf8',
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
        shell: process.platform === 'win32',
      },
    );

    if (r.error || r.status !== 0) {
      throw new Error(
        `Telechargement de « ${slug} » en echec : ${r.error?.message ?? `code ${r.status}`}\n` +
          `${(r.stderr || r.stdout || '').trim().slice(0, 800)}`,
      );
    }

    const fichiers = new Map();
    for (const chemin of parcourir(join(bac, 'supabase'))) {
      if (!estFichierDuBundle(relative(bac, chemin))) continue;
      fichiers.set(cleDeployee(relative(bac, chemin), slug), readFileSync(chemin, 'utf8'));
    }
    return fichiers;
  } finally {
    nettoyerBac(bac);
  }
}

/**
 * Efface le bac a sable, et ne peut JAMAIS faire echouer la comparaison.
 *
 * 🔴 POURQUOI CE CODE EXISTE · le premier run qui a REELLEMENT lu la prod
 * (2026-09-13, apres la pose de `SUPABASE_ACCESS_TOKEN`) a perdu ses HUIT
 * fonctions sur la meme erreur, et aucune ne portait sur la lecture :
 *
 *   EACCES: permission denied, unlink
 *   '/tmp/edge-deploy-delete-account-VJgasB/supabase/functions/_shared/alert.ts'
 *
 * `supabase functions download` ecrit ses repertoires en lecture seule, et
 * sous Linux un `unlink` demande le droit d'ecriture sur le REPERTOIRE
 * parent, jamais sur le fichier. Le menage echouait donc, et comme il vivait
 * dans un `finally`, il detruisait un resultat DEJA CALCULE : les fichiers
 * etaient lus, compares... et jetes. Le job annoncait « 8 problemes de
 * garde » pour une comparaison qui avait marche.
 *
 * D'ou les deux regles portees ici :
 *   1. on RELACHE les permissions avant d'effacer, sinon l'effacement ne
 *      peut pas aboutir ;
 *   2. un menage rate ne remonte JAMAIS. Un repertoire temporaire oublie sur
 *      un runner jetable ne coute rien ; confondre « je n'ai pas su ranger »
 *      avec « je n'ai pas su mesurer » coute une garde entiere.
 *
 * ❌ Ne jamais elargir cette indulgence a la LECTURE : une lecture vide reste
 * une erreur (`assertReadSomething`). Ce qui est avale ici, c'est le menage,
 * et rien d'autre.
 *
 * Les dependances sont injectables pour que le temoin puisse provoquer les
 * deux echecs sans dependre des permissions POSIX, absentes sous Windows.
 */
export function nettoyerBac(bac, io = {}) {
  const relacher = io.relacher ?? rendreEffacable;
  const rm = io.rm ?? ((c) => rmSync(c, { recursive: true, force: true }));
  const journal = io.journal ?? ((m) => annoter('notice', m));

  // Best effort : un chmod refuse ne doit pas empecher d'ESSAYER d'effacer.
  try {
    relacher(bac);
  } catch {
    /* voir plus bas : seul le resultat de `rm` merite d'etre dit */
  }

  try {
    rm(bac);
  } catch (e) {
    journal(
      `Bac a sable non efface (${e?.message ?? e}). Sans effet sur la comparaison : ` +
        `les fichiers ont deja ete lus, et ce repertoire est temporaire.`,
    );
  }
}

/**
 * Rend un arbre effacable : `chmod 0700` sur chaque entree, du haut vers le
 * bas. C'est le repertoire `_shared/` imbrique qui bloquait, pas la racine —
 * un chmod sur le seul bac aurait laisse exactement l'erreur mesuree.
 *
 * Sous Windows `chmod` est un quasi no-op ; ce code n'y sert a rien et n'y
 * nuit pas. Le bac est temporaire et nous appartient : il n'y a aucune
 * permission d'autrui a pietiner.
 */
export function rendreEffacable(racine, io = {}) {
  const existe = io.existe ?? ((c) => existsSync(c));
  const lister = io.lister ?? ((c) => readdirSync(c));
  const estDossier = io.estDossier ?? ((c) => statSync(c).isDirectory());
  const chmod = io.chmod ?? ((c, mode) => chmodSync(c, mode));

  if (!existe(racine)) return;

  const pile = [racine];
  while (pile.length > 0) {
    const chemin = pile.pop();
    try {
      chmod(chemin, 0o700);
    } catch {
      /* on continue : les autres entrees restent a relacher */
    }
    try {
      if (estDossier(chemin)) for (const e of lister(chemin)) pile.push(join(chemin, e));
    } catch {
      /* un repertoire illisible ne bloque pas le reste de l'arbre */
    }
  }
}

function* parcourir(racine) {
  if (!existsSync(racine)) return;
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) yield* parcourir(chemin);
    else yield chemin;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROGRAMME
// ═══════════════════════════════════════════════════════════════════

function annoter(niveau, message) {
  // Une seule ligne par annotation : GitHub plafonne leur NOMBRE a dix par
  // etape, jamais leur longueur.
  console.log(`::${niveau}::${String(message).replace(/\r?\n/g, '%0A')}`);
}

function resume(lignes) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (!f) return;
  try {
    writeFileSync(f, `${lignes.join('\n')}\n`, { flag: 'a' });
  } catch {
    /* le resume est un confort, jamais une condition du verdict */
  }
}

async function main() {
  const args = process.argv.slice(2);
  const declaration = lireDeclaration();
  const { projectRef } = declaration;

  // 🔴 SECRET ABSENT = ECHEC, jamais un avertissement dans un run vert.
  // Regle ecrite de CLAUDE.md, violee deux fois (`renewal-notice` le
  // 2026-08-26, `uptime.yml` qui sautait toute sa moitie backend sur un
  // secret inexistant en restant VERT). Une garde conditionnelle a la
  // presence de son propre secret ne protege que quand on est deja protege.
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    annoter(
      'error',
      'SUPABASE_ACCESS_TOKEN absent : le code deploye des Edge Functions N A PAS ete compare au depot. ' +
        'Ce n est pas un avertissement, c est l echec de la garde. Poser le secret dans ' +
        'Settings -> Secrets and variables -> Actions (jeton personnel Supabase, portee lecture du projet).',
    );
    resume([
      '### ✖ Derive Edge Functions : garde non executee',
      '',
      'Le secret `SUPABASE_ACCESS_TOKEN` est absent du depot.',
      '',
      "Sans lui, rien ne compare le code qui tourne en production a celui de `main` :",
      "c'est exactement l'etat qui a laisse trois fonctions diverger sans que personne",
      'le voie (finding C-35). La garde echoue plutot que de se taire.',
    ]);
    process.exitCode = 1;
    return;
  }

  const enLigne = await listerDeployees(projectRef, token);
  const parSlug = new Map(enLigne.map((f) => [f.slug, f]));

  if (args.includes('--list')) {
    for (const f of enLigne) {
      console.log(
        `${f.slug.padEnd(24)} v${String(f.version).padEnd(4)} ${new Date(f.updated_at).toISOString().slice(0, 10)}  ${f.status}`,
      );
    }
    return;
  }

  const slugsDepot = readdirSync(FUNCTIONS_DIR)
    .filter((n) => n !== '_shared' && statSync(join(FUNCTIONS_DIR, n)).isDirectory())
    .sort();

  const nonDeployees = new Map(
    (declaration.notDeployed ?? []).map((e) => [e.slug, e]),
  );

  const divergences = [];
  const problemes = [];
  const lignesResume = [];

  for (const slug of slugsDepot) {
    const deployee = parSlug.get(slug);

    if (!deployee) {
      const note = nonDeployees.get(slug);
      if (!note) {
        problemes.push(
          `« ${slug} » existe dans le depot et n'est PAS deployee, sans declaration. ` +
            `Soit la deployer, soit la nommer dans .github/edge-deploy.json avec sa raison ` +
            `et sa date. Une fonction absente de prod sans motif ecrit est une capacite que ` +
            `le depot annonce et que le produit n'a pas.`,
        );
      } else {
        lignesResume.push(`| \`${slug}\` | non deployee | ${note.reason} (${note.since}) |`);
      }
      continue;
    }

    // Une note « non deployee » qui se revele fausse est un echec : sinon
    // elle perime en silence, et on croit ne pas comparer ce qui tourne.
    if (nonDeployees.has(slug)) {
      problemes.push(
        `« ${slug} » est declaree non deployee dans .github/edge-deploy.json, ` +
          `mais elle EST en ligne (v${deployee.version}). Retirer la note : tant qu'elle ` +
          `y est, personne ne compare ce que cette fonction execute.`,
      );
      continue;
    }

    const version = `v${deployee.version} du ${new Date(deployee.updated_at).toISOString().slice(0, 10)}`;

    let repoFiles;
    let deployedFiles;
    try {
      repoFiles = repoFilesFor(slug);
      deployedFiles = telechargerBundle(slug, projectRef, token);
      assertReadSomething(slug, deployedFiles);
      assertMemeLangage(slug, repoFiles, deployedFiles);
    } catch (e) {
      problemes.push(`« ${slug} » (${version}) : ${e.message}`);
      continue;
    }

    const ecarts = compareFunction({ slug, repoFiles, deployedFiles });
    if (ecarts.length === 0) {
      lignesResume.push(`| \`${slug}\` | ${version} | identique au depot |`);
      continue;
    }

    divergences.push(...ecarts);
    lignesResume.push(
      `| \`${slug}\` | ${version} | **${ecarts.length} divergence(s)** |`,
    );
  }

  // Une fonction deployee que le depot ne porte pas : du code s'execute en
  // prod sans source versionnee. C'est le sens le plus grave de la derive.
  for (const f of enLigne) {
    if (!slugsDepot.includes(f.slug)) {
      problemes.push(
        `« ${f.slug} » (v${f.version}) est deployee et n'existe PAS dans le depot. ` +
          `Du code s'execute en production sans source versionnee.`,
      );
    }
  }

  resume([
    '### Code deploye des Edge Functions',
    '',
    `Projet \`${projectRef}\` · releve du ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '| Fonction | Deploiement | Verdict |',
    '|---|---|---|',
    ...lignesResume,
  ]);

  for (const p of problemes.slice(0, 6)) annoter('error', p);

  for (const d of divergences.slice(0, 8)) {
    const ou = d.genre === 'contenu-different' ? ` (1re ligne differente : ${d.premiereLigne})` : '';
    annoter('error', `Derive ${d.slug} · ${d.chemin} · ${d.genre}${ou}`);
  }

  // ⚠️ Les annotations sont PLAFONNEES — GitHub n'en rend qu'une dizaine par
  // etape, et ce script s'arrete a huit pour laisser la place aux problemes de
  // garde. Le 2026-09-13, un run a rendu 24 divergences : seize etaient donc
  // invisibles a qui lit le job, et le resume d'etape n'est pas consultable en
  // ligne de commande. Une garde qui cache les deux tiers de ce qu'elle a
  // trouve fait agir sur une image partielle.
  //
  // La sortie standard, elle, n'est pas plafonnee. On y ecrit la liste
  // ENTIERE, avec la taille de chaque cote : un ecart de taille saute aux yeux
  // quand un fichier est tronque ou lu dans un autre encodage, deux causes qui
  // ne se lisent pas dans un numero de ligne.
  if (divergences.length > 0) {
    console.error('');
    console.error('Liste complete des divergences :');
    for (const d of divergences) {
      const ou = d.genre === 'contenu-different' ? ` · 1re ligne ${d.premiereLigne}` : '';
      const tailles =
        d.genre === 'contenu-different' ? ` · depot ${d.octetsDepot} o / prod ${d.octetsProd} o` : '';
      console.error(`  ${d.slug} · ${d.chemin} · ${d.genre}${ou}${tailles}`);
      if (d.genre === 'contenu-different') {
        console.error(`      depot | ${d.ligneDepot}`);
        console.error(`      prod  | ${d.ligneProd}`);
      }
    }
  }

  if (divergences.length > 0) {
    resume([
      '',
      '#### ✖ Le code deploye differe du depot',
      '',
      ...divergences.map(
        (d) =>
          `- \`${d.slug}\` · \`${d.chemin}\` · ${d.genre}` +
          (d.genre === 'contenu-different' ? ` (1re ligne : ${d.premiereLigne})` : ''),
      ),
      '',
      '🔴 Tant que cet ecart existe, **toute** conclusion tiree en lisant',
      '`supabase/functions/` est fausse, y compris les statuts de `faille.md`.',
      'Le redeploiement est un geste manuel : `a-faire-manuel.md`.',
    ]);
  }

  if (problemes.length > 0) {
    resume(['', '#### ✖ Garde en defaut', '', ...problemes.map((p) => `- ${p}`)]);
  }

  const total = divergences.length + problemes.length;
  if (total > 0) {
    console.error(`\n✖ ${divergences.length} divergence(s), ${problemes.length} probleme(s) de garde.`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ ${lignesResume.length} fonction(s) verifiee(s) : le code deploye est celui du depot.`,
  );
}

// Le module est importable par son temoin sans rien executer.
const estPointDEntree =
  process.argv[1] && resolve(process.argv[1]).endsWith(`check-edge-deploy.mjs`);

if (estPointDEntree) {
  main().catch((e) => {
    annoter('error', `check:edge en erreur : ${e.message}`);
    console.error(e);
    process.exitCode = 1;
  });
}
