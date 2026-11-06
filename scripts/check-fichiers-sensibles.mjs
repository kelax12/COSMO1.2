// ═══════════════════════════════════════════════════════════════════
// check-fichiers-sensibles.mjs · aucun fichier de données ne part sur le
// dépôt PUBLIC sans décision écrite (SEC-01, SEC-05, 2026-11-06)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Le 2026-10-30, un commit a poussé `leads-50.csv` (cinquante
// prospects nommés) et six PDF de business plan sur ce dépôt public. Rien ne
// filtrait avant le commit, rien ne filtrait en CI. Retirer un fichier du
// suivi n'efface pas l'historique : la seule défense utile est AVANT.
//
// ── CE QUE CETTE GARDE REFUSE ───────────────────────────────────────
//
//   · les tableurs et exports : `*.csv`, `*.xlsx`, `*.xls` ;
//   · les documents : `*.pdf` ;
//   · les dumps : `*.sql.gz`, `*.dump`, `*.backup` ;
//   · les fichiers d'environnement `.env*`, sauf `.env.example` et
//     `.env.e2e-stub` (gabarits sans secret, lus par le dépôt) ;
//   · tout fichier de plus de 1 Mo.
//
// Une exception se déclare UNE PAR UNE dans `EXCEPTIONS`, avec son chemin,
// l'empreinte git (blob) de la version admise et le motif. Une autre version
// du même fichier est refusée tant que l'entrée n'est pas relue.
// ❌ AUCUNE variable de contournement. `git commit --no-verify` saute le
//    hook : c'est pour ça que la CI rejoue la même garde, et elle ne se
//    saute pas.
//
// ── TROIS LECTURES ──────────────────────────────────────────────────
//
//   `--index`        ce qui est indexé (hook `.githooks/pre-commit`) ;
//   `--arbre`        tout l'arbre de HEAD, plus les exceptions périmées ;
//   `--plage A..B`   tout fichier ajouté ou modifié par un commit de la
//                    plage, même s'il a été retiré ensuite : l'historique
//                    public le garde.
//
// ⚠️ Pas de shebang : le témoin importe ce module (cf. `scripts/CLAUDE.md`).
// Témoin : `scripts/check-fichiers-sensibles.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { sep } from 'node:path';

/** 1 Mo : au-delà, un fichier est un média ou une donnée, jamais du code. */
export const TAILLE_MAX = 1024 * 1024;

/** Gabarits d'environnement admis : versionnés exprès, sans aucun secret. */
export const ENV_ADMIS = new Set(['.env.example', '.env.e2e-stub']);

/** Suffixe (en minuscules) → nature, dans l'ordre où on les teste. */
export const SUFFIXES = [
  ['.sql.gz', 'dump de base'],
  ['.dump', 'dump de base'],
  ['.backup', 'sauvegarde'],
  ['.csv', 'export tabulaire (CSV)'],
  ['.xlsx', 'tableur'],
  ['.xls', 'tableur'],
  ['.pdf', 'document PDF'],
];

/**
 * Les exceptions, une par une. `blob` = `git ls-tree HEAD <chemin>` : une
 * autre version du fichier n'est pas couverte.
 * ❌ Ne jamais ajouter une entrée pour faire passer la garde : c'est une
 * décision de publication sur un dépôt public, elle se relit.
 */
export const EXCEPTIONS = [
  {
    chemin: 'public/downloads/template-okr-cosmo.xlsx',
    blob: 'b3b549066eb0d97851e45206c75b578681247534',
    motif: 'gabarit OKR vide offert en téléchargement par l article `template-okr-gratuit` '
      + '(généré par `scripts/generate-okr-template.py`, aucune donnée réelle).',
  },
  {
    chemin: 'public/videos/onboarding-entreprise-v2.mp4',
    blob: '8865845c02b26c88e93df411403cb2fa51f56bf0',
    motif: 'vidéo d accueil de l onboarding entreprise (4,6 Mo), servie par Vercel et lue par '
      + '`OrgWelcomeVideo.tsx` : un média public, pas une donnée.',
  },
];

/**
 * La règle seule : pourquoi ce chemin, de cette taille, est sensible.
 * @returns {string|null} la raison, ou `null` s'il ne l'est pas.
 */
export function raisonSensible(chemin, taille) {
  const nom = chemin.split('/').pop() ?? '';
  const bas = nom.toLowerCase();
  if (/^\.env($|\.)/.test(bas) && !ENV_ADMIS.has(nom)) {
    return 'fichier d environnement (`.env*`), seuls `.env.example` et `.env.e2e-stub` sont admis';
  }
  for (const [suffixe, nature] of SUFFIXES) {
    if (bas.endsWith(suffixe)) return `${nature} (\`*${suffixe}\`)`;
  }
  if (Number.isFinite(taille) && taille > TAILLE_MAX) {
    return `${(taille / TAILLE_MAX).toFixed(1).replace('.', ',')} Mo, au-delà du plafond de 1 Mo`;
  }
  return null;
}

/**
 * Juge des entrées `{ chemin, blob, taille }`.
 * @returns {string[]} une ligne par refus, vide si tout passe.
 */
export function juger(entrees, exceptions = EXCEPTIONS) {
  const refus = [];
  for (const { chemin, blob, taille } of entrees) {
    const raison = raisonSensible(chemin, taille);
    if (!raison) continue;
    const ex = exceptions.find((x) => x.chemin === chemin);
    if (ex && ex.blob === blob) continue;
    if (ex) {
      refus.push(`${chemin} : ${raison}. Exception déclarée pour la version ${ex.blob.slice(0, 10)}, `
        + `pas pour ${String(blob).slice(0, 10)} : relire l entrée de EXCEPTIONS.`);
    } else {
      refus.push(`${chemin} : ${raison}.`);
    }
  }
  return refus;
}

/** Une exception qui ne décrit plus l'arbre est une porte ouverte sans objet. */
export function exceptionsPerimees(arbre, exceptions = EXCEPTIONS) {
  const parChemin = new Map(arbre.map((e) => [e.chemin, e.blob]));
  const fautes = [];
  for (const ex of exceptions) {
    if (!ex.motif || ex.motif.trim().length < 20) fautes.push(`${ex.chemin} : exception sans motif écrit.`);
    if (!/^[0-9a-f]{40}$/.test(ex.blob ?? '')) fautes.push(`${ex.chemin} : \`blob\` doit être une empreinte git de 40 caractères.`);
    const vu = parChemin.get(ex.chemin);
    if (vu === undefined) fautes.push(`${ex.chemin} : exception périmée, le fichier n est plus dans l arbre.`);
    else if (vu !== ex.blob) fautes.push(`${ex.chemin} : exception périmée, l arbre porte ${vu.slice(0, 10)}.`);
  }
  return fautes;
}

// ─── Lecture de git ──────────────────────────────────────────────────

/** Les lignes `--raw -z` : `:mode mode sha sha X\0chemin\0`, sans renommage. */
export function lireRaw(sortie) {
  const jetons = sortie.split('\0').filter((j) => j !== '');
  const vus = [];
  for (let i = 0; i < jetons.length; i++) {
    const meta = jetons[i].replace(/^\n+/, '');
    if (!meta.startsWith(':')) continue;
    const champs = meta.slice(1).split(' ');
    const chemin = jetons[++i];
    if (champs.length < 5 || chemin === undefined) throw new Error(`sortie --raw illisible : « ${meta} »`);
    // Un sous-module (mode 160000) n'a pas de blob à juger.
    if (champs[1] === '160000') continue;
    vus.push({ chemin, blob: champs[3] });
  }
  return vus;
}

/** `git ls-tree -r -l -z` : `mode type sha taille\tchemin\0`. */
export function lireArbre(sortie) {
  return sortie.split('\0').filter((j) => j !== '').map((ligne) => {
    const tab = ligne.indexOf('\t');
    const [, type, blob, taille] = ligne.slice(0, tab).trim().split(/\s+/);
    return { type, chemin: ligne.slice(tab + 1), blob, taille: Number(taille) };
  }).filter((e) => e.type === 'blob').map(({ chemin, blob, taille }) => ({ chemin, blob, taille }));
}

const git = (args, entree) => execFileSync('git', args, {
  encoding: 'utf8',
  input: entree,
  maxBuffer: 256 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'pipe'],
});

/** Ajoute la taille de chaque blob (`git cat-file --batch-check`). */
function avecTailles(entrees, executer = git) {
  if (entrees.length === 0) return [];
  const sortie = executer(['cat-file', '--batch-check=%(objectname) %(objectsize)'],
    entrees.map((e) => e.blob).join('\n') + '\n');
  const tailles = new Map(sortie.trim().split('\n').map((l) => {
    const [sha, taille] = l.split(' ');
    return [sha, Number(taille)];
  }));
  return entrees.map((e) => ({ ...e, taille: tailles.get(e.blob) }));
}

const VIDE = '0000000000000000000000000000000000000000';

/** Les trois lectures, `executer` injecté pour le témoin. */
export function lireIndex(executer = git) {
  return avecTailles(lireRaw(executer(['diff', '--cached', '--raw', '-z', '--no-abbrev', '--no-renames', '--diff-filter=ACMR'])), executer);
}

export function lirePlage(plage, executer = git) {
  const m = /^([0-9A-Za-z_./^~-]+)\.\.([0-9A-Za-z_./^~-]+)$/.exec(plage ?? '');
  if (!m) throw new Error(`plage illisible : « ${plage} » (attendu A..B)`);
  if (m[1] === VIDE || m[2] === VIDE) throw new Error(`plage sans base (${plage}) : passer --arbre seul`);
  const sortie = executer(['log', '--raw', '-z', '--no-abbrev', '--no-renames', '--diff-filter=ACMR', '--format=', `${m[1]}..${m[2]}`]);
  const vus = new Map();
  for (const e of lireRaw(sortie)) vus.set(`${e.chemin}\0${e.blob}`, e);
  return avecTailles([...vus.values()], executer);
}

export function lireArbreHead(executer = git) {
  return lireArbre(executer(['ls-tree', '-r', '-l', '-z', 'HEAD']));
}

// ─── Point d'entrée ──────────────────────────────────────────────────

const AIDE = [
  'Le fichier n a rien à faire sur un dépôt public : le retirer de l index',
  '(`git rm --cached <chemin>`) et le ranger hors du dépôt.',
  'Publication voulue : l ajouter à EXCEPTIONS dans scripts/check-fichiers-sensibles.mjs,',
  'avec son empreinte (`git ls-files -s <chemin>`) et son motif. Aucune variable ne contourne.',
];

/** @returns {number} le code de sortie */
export function run({ argv = process.argv.slice(2), env = process.env, executer = git, log = console.log, erreur = console.error } = {}) {
  const ci = env.GITHUB_ACTIONS === 'true';
  const signaler = (ligne) => (ci ? log(`::error title=fichiers-sensibles::${ligne}`) : erreur(`  ✖ ${ligne}`));
  const modes = [];
  if (argv.includes('--index')) modes.push('index');
  if (argv.includes('--arbre')) modes.push('arbre');
  const iPlage = argv.indexOf('--plage');
  if (iPlage >= 0) modes.push('plage');
  if (modes.length === 0) {
    erreur('usage : check-fichiers-sensibles.mjs --index | --arbre [--plage A..B]');
    return 1;
  }

  const fautes = [];
  try {
    if (modes.includes('index')) {
      const e = lireIndex(executer);
      log(`fichiers sensibles · index : ${e.length} fichier(s) indexé(s) lu(s)`);
      fautes.push(...juger(e));
    }
    if (modes.includes('arbre')) {
      const e = lireArbreHead(executer);
      // Un arbre vide n'est pas un arbre propre : la lecture a échoué.
      if (e.length === 0) throw new Error('arbre de HEAD vide : rien n a été lu');
      log(`fichiers sensibles · arbre : ${e.length} fichier(s) lu(s)`);
      fautes.push(...juger(e), ...exceptionsPerimees(e));
    }
    if (modes.includes('plage')) {
      const plage = argv[iPlage + 1];
      const e = lirePlage(plage, executer);
      log(`fichiers sensibles · plage ${plage} : ${e.length} version(s) ajoutée(s) ou modifiée(s) lue(s)`);
      fautes.push(...juger(e).map((f) => `historique ${plage} · ${f}`));
    }
  } catch (e) {
    signaler(`lecture impossible : ${e.message}`);
    return 1;
  }

  if (fautes.length === 0) return 0;
  erreur(`fichiers sensibles : ${fautes.length} refus`);
  for (const f of fautes) signaler(f);
  for (const l of AIDE) erreur(`  ${l}`);
  return 1;
}

const estPrincipal = process.argv[1]
  && import.meta.url.endsWith(process.argv[1].split(sep).join('/'));
if (estPrincipal) process.exit(run());
