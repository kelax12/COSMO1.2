// ═══════════════════════════════════════════════════════════════════
// C-105 — les variables d'environnement Vercel ne sont comparées à rien
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE CAS A DÉJÀ MORDU, et c'est le plus cher du dépôt sur ce sujet :
// `VITE_SENTRY_DSN` absente au moment du build CHANGE LA FORME DU BUNDLE.
// Vite remplace la variable par `undefined` à la compilation, la branche
// `if (sentryDsn)` devient du code mort, Rollup jette presque tout Sentry, et
// la garde de budget mesurait alors un artefact ~45 ko plus léger que celui
// qui part en production. Une garde qui mesure le mauvais artefact est pire
// qu'une garde absente.
//
// Et l'état réel de Turnstile n'est écrit nulle part de vérifiable :
// `VITE_TURNSTILE_SITE_KEY` absente rend la protection anti-robot INERTE,
// sans une ligne de log, sans un écran qui change.
//
// ── CE QUE CETTE GARDE FAIT, EN DEUX MOITIÉS ────────────────────────
//
// 1. LE CONTRAT, sans aucun secret, donc jouable sur chaque PR :
//    · toute `VITE_*` LUE par le code est déclarée ici, avec son rôle et ce
//      que son absence produit ;
//    · toute variable déclarée « requise au build » figure dans
//      `.env.example` — le seul document qu'un nouveau venu lit ;
//    · réciproquement, `.env.example` ne promet pas une variable que plus
//      personne ne lit.
//
// 2. LA RÉALITÉ VERCEL, avec `VERCEL_TOKEN` : la liste des variables
//    réellement configurées sur le projet, comparée au contrat.
//    🔴 SEULE LA PRÉSENCE EST LUE, jamais la valeur. L'API Vercel rend les
//    valeurs chiffrées par défaut et ce script ne les demande pas.
//
// ⚠️ SANS `VERCEL_TOKEN`, LA MOITIÉ 2 NE S'EXÉCUTE PAS — et le script sort
// alors en ÉCHEC si on la lui a demandée (`--vercel`). Il n'y a pas de
// `::warning::` dans un run vert ici : c'est exactement le motif retiré
// d'`uptime.yml` le 2026-09-03 et de `renewal-notice.yml` le 09-04. Sans
// `--vercel`, seule la moitié 1 tourne, et le script le DIT.
//
// ❌ NE JAMAIS DÉCLARER UNE VARIABLE « optionnelle » pour faire passer la CI.
//    La question est : que se passe-t-il si elle manque ? Si la réponse est
//    « rien de visible », c'est précisément le cas dangereux.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();

/**
 * LE CONTRAT. Une entrée par variable `VITE_*` lue par le produit.
 *
 * `requise`  : true = son absence change le comportement ou la FORME du
 *              bundle en production.
 * `absence`  : ce qui se passe si elle manque. C'est la colonne qui vaut
 *              quelque chose : elle transforme « optionnelle » en fait.
 */
const CONTRAT = {
  VITE_SUPABASE_URL: {
    requise: true,
    absence:
      'MODE DÉMO AUTOMATIQUE : l\'application bascule sur localStorage. En '
      + 'production, cela veut dire un site qui a l\'air de marcher et ne '
      + 'persiste rien.',
  },
  VITE_SUPABASE_ANON_KEY: {
    requise: true,
    absence: 'Mode démo automatique, comme ci-dessus.',
  },
  VITE_SENTRY_DSN: {
    requise: true,
    absence:
      "🔴 CHANGE LA FORME DU BUNDLE. `main.tsx` garde son chargement derrière "
      + '`if (sentryDsn)` ; Vite remplace la variable par `undefined` à la '
      + 'compilation, la branche devient du code mort, et Rollup élimine tout '
      + "le SDK. Le monitoring disparaît ET la garde de budget mesure un "
      + 'artefact qui n\'existe nulle part. Mesuré le 2026-09-02 : 49 ko gzip '
      + "d'écart.",
  },
  VITE_STRIPE_PUBLISHABLE_KEY: {
    requise: false,
    absence:
      "Le paiement n'est pas finalisé et la facturation entreprise est "
      + 'désactivée (décision 2026-08-24). À passer `requise: true` LE JOUR de '
      + 'la bascule live, pas avant : une variable exigée pour rien apprend à '
      + 'ignorer la garde.',
  },
  VITE_TURNSTILE_SITE_KEY: {
    requise: false,
    absence:
      "🔴 LA PROTECTION ANTI-ROBOT EST INERTE, en silence : aucun script tiers "
      + "n'est chargé, aucun widget ne s'affiche, et rien ne le signale à "
      + "l'écran. C'est l'état actuel, et c'est une DÉCISION en attente, pas "
      + 'une panne — le vrai interrupteur est le réglage Supabase '
      + '(Authentication → Attack Protection), qui prend la clé SECRÈTE. Ce '
      + "script IMPRIME donc l'état, ce qui est le minimum pour qu'il cesse "
      + "d'être invérifiable.",
  },
  VITE_STORAGE_KEY: {
    requise: false,
    absence: 'Clé de stockage local ; une valeur par défaut est utilisée.',
  },
  VITE_LINKS_STORAGE_KEY: {
    requise: false,
    absence: 'Clé de stockage local ; une valeur par défaut est utilisée.',
  },
  VITE_HOST_ALL: {
    requise: false,
    absence: "Réglage de développement (`vite.config.ts`), sans effet en production.",
  },
};

/** Les arbres où une `VITE_*` peut être lue par le produit. */
const ARBRES = ['src', 'prerender.mjs', 'vite.config.ts'];

/** Toutes les `VITE_*` citées par le code du produit. */
export function variablesLues(racine = RACINE) {
  const vues = new Set();
  const lire = (chemin) => {
    for (const m of readFileSync(chemin, 'utf8').matchAll(/VITE_[A-Z0-9_]+/g)) vues.add(m[0]);
  };
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (entree === 'node_modules') continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (/\.(ts|tsx|mjs|js)$/.test(entree)) lire(chemin);
    }
  };
  for (const a of ARBRES) {
    const chemin = join(racine, a);
    if (!existsSync(chemin)) continue;
    if (statSync(chemin).isDirectory()) marcher(chemin);
    else lire(chemin);
  }
  return vues;
}

/** Les clés promises par `.env.example`. */
export function variablesDeLExemple(racine = RACINE) {
  const chemin = join(racine, '.env.example');
  if (!existsSync(chemin)) return null;
  return new Set(
    readFileSync(chemin, 'utf8')
      .split('\n')
      .map((l) => /^\s*(VITE_[A-Z0-9_]+)\s*=/.exec(l)?.[1])
      .filter(Boolean),
  );
}

/**
 * Les variables configurées sur Vercel, par leur NOM seul.
 *
 * 🔴 Aucune valeur n'est demandée ni lue. L'API rend `key` et `target` ;
 * `value` est chiffrée pour les variables sensibles, et ce script ne la
 * décode pas — il n'a aucune raison de connaître un secret pour vérifier
 * qu'il existe.
 */
export async function variablesVercel({ token, projet, equipe }) {
  const url = new URL(`https://api.vercel.com/v9/projects/${projet}/env`);
  if (equipe) url.searchParams.set('teamId', equipe);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`API Vercel : HTTP ${res.status} ${await res.text()}`);
  }
  const j = await res.json();
  const out = new Map();
  for (const e of j.envs ?? []) {
    if (!out.has(e.key)) out.set(e.key, new Set());
    for (const t of e.target ?? []) out.get(e.key).add(t);
  }
  return out;
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const erreurs = [];
  const lues = variablesLues();
  const exemple = variablesDeLExemple();

  // 🔴 Anti-« garde qui répond sans mesurer ».
  if (lues.size < 5) {
    erreurs.push(`Seulement ${lues.size} variable(s) \`VITE_*\` trouvée(s) dans le code : le parcours est cassé.`);
  }
  if (exemple === null) {
    erreurs.push('.env.example absent : le contrat n a plus de document de référence.');
  }

  // ── Moitié 1 · le contrat ────────────────────────────────────────
  for (const v of [...lues].sort()) {
    if (!(v in CONTRAT)) {
      erreurs.push(
        `\`${v}\` est lue par le code et n'est PAS au contrat.\n`
          + '    Que se passe-t-il si elle manque en production ? Répondre dans CONTRAT.\n'
          + "    Si la réponse est « rien de visible », c'est le cas dangereux.",
      );
    }
  }
  for (const [v, d] of Object.entries(CONTRAT)) {
    if (!lues.has(v)) {
      erreurs.push(`\`${v}\` est au contrat mais plus lue par aucun fichier : retirer l'entrée.`);
    }
    if (!d.absence || d.absence.length < 20) {
      erreurs.push(`\`${v}\` n'a pas d'effet d'absence écrit.`);
    }
    if (d.requise && exemple && !exemple.has(v)) {
      erreurs.push(
        `\`${v}\` est REQUISE et absente de \`.env.example\` : un nouveau venu monterait\n`
          + '    un environnement incomplet sans le savoir.',
      );
    }
  }
  if (exemple) {
    for (const v of exemple) {
      if (!(v in CONTRAT)) {
        erreurs.push(`\`.env.example\` promet \`${v}\`, que plus aucun code ne lit.`);
      }
    }
  }

  const requises = Object.entries(CONTRAT).filter(([, d]) => d.requise).map(([v]) => v);
  console.log('Contrat des variables d environnement');
  console.log(`  lues par le code   : ${lues.size}`);
  console.log(`  au contrat         : ${Object.keys(CONTRAT).length}`);
  console.log(`  requises au build  : ${requises.length} — ${requises.join(', ')}`);
  console.log(`  dans .env.example  : ${exemple ? exemple.size : '—'}`);

  // ── Moitié 2 · la réalité Vercel ─────────────────────────────────
  const veutVercel = process.argv.includes('--vercel');
  if (!veutVercel) {
    console.log(
      '\n⚠️ MOITIÉ 2 NON JOUÉE : la configuration réelle de Vercel n a PAS été lue.\n'
        + '   Ce run vérifie le CONTRAT, pas la production. Pour la lire :\n'
        + '     VERCEL_TOKEN=… VERCEL_PROJECT_ID=… node scripts/check-env-contract.mjs --vercel',
    );
  } else {
    const token = process.env.VERCEL_TOKEN;
    const projet = process.env.VERCEL_PROJECT_ID;
    const equipe = process.env.VERCEL_TEAM_ID;
    // 🔴 Pas de repli silencieux : on a demandé la moitié 2, elle doit se
    // jouer ou échouer. Un secret absent se solde par un échec, jamais par un
    // avertissement dans un run vert (règle de `scripts/CLAUDE.md`).
    if (!token || !projet) {
      console.error(
        '\n✖ `--vercel` demandé sans `VERCEL_TOKEN` ou `VERCEL_PROJECT_ID`.\n'
          + '  Une garde ne se rend pas conditionnelle à la présence de son propre secret.',
      );
      process.exit(1);
    }
    try {
      const reelles = await variablesVercel({ token, projet, equipe });
      console.log(`\nVercel · ${reelles.size} variable(s) configurée(s) (noms seuls, aucune valeur lue)`);
      for (const [v, d] of Object.entries(CONTRAT)) {
        const cibles = reelles.get(v);
        const etat = cibles ? [...cibles].sort().join(',') : 'ABSENTE';
        console.log(`  ${v.padEnd(30)} ${etat}`);
        if (d.requise && !cibles?.has('production')) {
          erreurs.push(
            `\`${v}\` est REQUISE et n'est pas configurée sur Vercel pour \`production\`.\n`
              + `    Conséquence : ${d.absence}`,
          );
        }
      }
      // L'état de Turnstile, IMPRIMÉ, parce qu'il n'était écrit nulle part de
      // vérifiable. Ce n'est pas une erreur : c'est une décision en attente.
      const turnstile = reelles.get('VITE_TURNSTILE_SITE_KEY');
      console.log(
        `\n🔎 Turnstile : ${
          turnstile?.has('production')
            ? 'clé de site CONFIGURÉE en production. ⚠️ Le widget peut donc '
              + 'apparaître ; la vérification côté serveur, elle, dépend du réglage '
              + 'Supabase (Attack Protection), qui n est PAS lisible ici.'
            : 'clé de site ABSENTE en production → protection anti-robot INERTE, '
              + 'en silence. Décision en attente, pas une panne.'
        }`,
      );
    } catch (e) {
      console.error(`\n✖ Lecture Vercel impossible : ${e.message}`);
      process.exit(1);
    }
  }

  if (erreurs.length > 0) {
    console.error('\n✖ Contrat d environnement :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Contrat tenu.');
}
