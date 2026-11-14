// ═══════════════════════════════════════════════════════════════════
// check-fichiers-sensibles.mjs · aucun fichier de données ne part sur le
// dépôt PUBLIC sans décision écrite (SEC-01, SEC-05, 2026-11-06)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Retirer un fichier du suivi n'efface pas l'historique : la seule défense utile est AVANT.
//
// ── CE QUE CETTE GARDE REFUSE (la liste UNIQUE, SEC-01 et SEC-07) ───
//
//   · des chemins, quel que soit le suffixe (`CHEMINS_INTERDITS`) :
//     `prive/**`, `docs/business-plan/**`, `leads-*`, `supabase/.temp/**`, `.claude/settings.local.json`,
//     les documents internes hors de `prive/` (`faille*`, `a-faire-manuel*`, `RGPD-VIOLATION.md`) ;
//   · les tableurs et exports : `*.csv`, `*.xlsx`, `*.xls` ;
//   · les documents : `*.pdf`, `*.docx`, `*.pptx` ;
//   · les dumps : `*.sql.gz`, `*.dump`, `*.backup` ;
//   · les fichiers d'environnement `.env*`, sauf `.env.example` et
//     `.env.e2e-stub` (gabarits sans secret, lus par le dépôt) ;
//   · tout fichier de plus de 1 Mo.
//
// Lu par le hook `pre-commit`, le job CI `fichiers-sensibles` et `fichiers-suivis.guard.test.mjs`.
//
// Une exception se déclare UNE PAR UNE dans `EXCEPTIONS`, avec son chemin,
// l'empreinte git (blob) de la version admise et le motif. Une autre version
// du même fichier est refusée tant que l'entrée n'est pas relue.
// ❌ AUCUNE variable de contournement : `--no-verify` saute le hook, la CI rejoue la même garde.
//
// ── TROIS LECTURES ──────────────────────────────────────────────────
//
//   `--index`        ce qui est indexé (hook `.githooks/pre-commit`) ;
//   `--arbre`        tout l'arbre de HEAD, plus les exceptions périmées ;
//   `--plage A..B`   tout fichier ajouté ou modifié par un commit de la
//                    plage, même s'il a été retiré ensuite : l'historique
//                    public le garde.
//   `lireSuivis()`   tout ce que l'index suit (`git ls-files`), lu par la
//                    garde Vitest : un `--no-verify` tombe à `npm test`.
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
  ['.docx', 'document Word'],
  ['.pptx', 'présentation'],
];

/**
 * Chemins refusés quel que soit leur suffixe, testés AVANT les suffixes (le
 * motif le plus précis donne la raison). Forme glob, comparée au chemin en
 * minuscules : `**` traverse les dossiers, `*` reste dans un nom.
 * Le dépôt est PUBLIC : `prive/` est le dossier local des documents internes
 * (`faille.md`, procédures, prospection), décision d'Axel du 2026-11-06.
 */
export const CHEMINS_INTERDITS = [
  ['prive/**', 'dossier local `prive/` (documents internes, jamais publiés)'],
  ['docs/business-plan/**', 'business plan (`docs/business-plan/`)'],
  ['**/leads-*', 'fichier de prospection (`leads-*`)'],
  ['supabase/.temp/**', 'état local du CLI Supabase (`supabase/.temp/`)'],
  ['.claude/settings.local.json', 'réglages locaux d agent (`.claude/settings.local.json`)'],
  ['**/faille*.md', 'document interne de sécurité (`faille*.md`, vit dans `prive/`)'],
  ['**/a-faire-manuel*', 'gestes manuels d Axel (`a-faire-manuel*`, vit dans `prive/`)'],
  ['**/rgpd-violation.md', 'procédure de violation (`RGPD-VIOLATION.md`, vit dans `prive/`)'],
  ['**/prompt-*failles*', 'prompt d audit de failles (document interne)'],
];

/** Un glob de `CHEMINS_INTERDITS` en expression régulière ancrée. */
export function globVersRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const CHEMINS_RE = CHEMINS_INTERDITS.map(([glob, nature]) => [globVersRegex(glob.toLowerCase()), nature]);

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
  const cheminBas = chemin.toLowerCase();
  for (const [re, nature] of CHEMINS_RE) {
    if (re.test(cheminBas)) return nature;
  }
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

/** `git ls-files -s -z` : `mode sha étape\tchemin\0`, c'est-à-dire ce qui est SUIVI. */
export function lireLsFiles(sortie) {
  return sortie.split('\0').filter((j) => j !== '').map((ligne) => {
    const tab = ligne.indexOf('\t');
    const [mode, blob] = ligne.slice(0, tab).split(' ');
    if (tab < 0 || !/^[0-9a-f]{40}$/.test(blob ?? '')) throw new Error(`sortie ls-files illisible : « ${ligne} »`);
    return { mode, chemin: ligne.slice(tab + 1), blob };
  }).filter((e) => e.mode !== '160000').map(({ chemin, blob }) => ({ chemin, blob }));
}

/** Un exécuteur git, dans `cwd` (le dossier courant par défaut). */
export const executerGit = (cwd) => (args, entree) => execFileSync('git', args, {
  cwd,
  encoding: 'utf8',
  input: entree,
  maxBuffer: 256 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const git = executerGit(undefined);

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

/** Tout ce que l'index suit (`git ls-files`), lu depuis la racine du dépôt. */
export function lireSuivis(executer = git) {
  return avecTailles(lireLsFiles(executer(['ls-files', '-s', '-z', '--full-name', ':/'])), executer);
}

// ─── Point d'entrée ──────────────────────────────────────────────────

const AIDE = [
  'Le dépôt COSMO est PUBLIC : ce fichier n a rien à y faire. Le retirer de l index',
  '(`git rm --cached <chemin>`) et le ranger hors du dépôt (`prive/` du checkout principal).',
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
  erreur(modes.includes('index')
    ? `pre-commit : commit REFUSÉ, ${fautes.length} fichier(s) interdit(s) sur ce dépôt public`
    : `fichiers sensibles : ${fautes.length} refus`);
  for (const f of fautes) signaler(f);
  for (const l of AIDE) erreur(`  ${l}`);
  return 1;
}

const estPrincipal = process.argv[1]
  && import.meta.url.endsWith(process.argv[1].split(sep).join('/'));
if (estPrincipal) process.exit(run());
