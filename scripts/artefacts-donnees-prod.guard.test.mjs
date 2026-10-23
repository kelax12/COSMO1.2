// ═══════════════════════════════════════════════════════════════════
// artefacts-donnees-prod.guard.test.mjs · aucun workflow ne publie de
// données de production en clair (BK-1)
//
// 🔴 POURQUOI CE FICHIER EXISTE (2026-10-15)
//
// Du 2026-08-29 au 2026-10-13, `db-backup.yml` a déposé chaque nuit un
// `pg_dump` COMPLET de la base, en clair, en artefact d'un dépôt PUBLIC :
// téléchargeable depuis n'importe quel compte GitHub connecté. Son en-tête
// affirmait l'inverse (« les artefacts d'un run ne le sont pas »). Rien ne
// l'a vu pendant 45 jours : un audit juridique l'a trouvé, aucune garde
// (`faille.md` § BK-1, `docs/RGPD-VIOLATION.md` ligne AM-2bis).
//
// `8c6a971d` a rendu le chiffrement obligatoire dans CE workflow. Rien ne
// regardait les AUTRES. Ce fichier lit tous les `.github/workflows/*.yml`
// et refuse :
//
//   A · un dépôt d'artefact absent de la liste nominative `ARTEFACTS`, ou
//       dont le chemin peut porter des données de production non chiffrées
//       (dump, export, sortie d'une requête) ;
//   B · une étape qui reçoit un secret de production sans être déclarée
//       dans `CONTACTS_PROD`, avec ce qu'elle imprime ; un secret non classé ;
//   C · une requête SQL sur la prod dont la sortie part au journal : psql
//       sans fichier, pg_dump ou pg_restore vers stdout, fichier de requête
//       affiché alors que son SQL lit autre chose que des comptes ;
//   D · un autre canal public (`git push`, issue, release, gist) depuis un
//       job au contact de la prod, hors de `CANAUX_PUBLICS` ;
//   E · un commentaire qui affirme qu'un artefact n'est pas public.
//
// ⚠️ Dans un dépôt public, le journal d'un run se lit par tous et un
// artefact se télécharge depuis n'importe quel compte connecté.
//
// TÉMOIN : la version de `db-backup.yml` d'AVANT `8c6a971d`, figée dans
// `scripts/fixtures/` (la CI clone en profondeur 1 : `git show` n'y lit pas
// l'historique). Son empreinte git est vérifiée plus bas, octet pour octet.
//
// ❌ Ne jamais ajouter une entrée aux listes pour faire passer la garde. Une
// entrée est une décision sur des données personnelles : elle se relit.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
// `js-yaml` arrive par ESLint (dépendance transitive, hissée). S'il
// disparaît, l'import échoue BRUYAMMENT : la garde rougit, elle ne se tait pas.
import { load } from 'js-yaml';

import { INTROSPECTION_SQL } from './check-migration-coverage.mjs';

const RACINE = process.cwd();
const DOSSIER = resolve(RACINE, '.github/workflows');
const TEMOIN = resolve(RACINE, 'scripts/fixtures/db-backup.avant-8c6a971d.yml');
/** `git rev-parse 8c6a971d^:.github/workflows/db-backup.yml` */
const TEMOIN_BLOB = '06b3117f1bdd0fab6f82ed1275b1acb6ed0c99b7';

// ─── 1 · Ce qui ouvre un accès à des données de production ──────────

/** Secrets qui ouvrent une lecture de données de production, et pourquoi. */
export const SECRETS_PROD = {
  SUPABASE_DB_URL: 'connexion directe à la base de production',
  DRILL_DB_URL: 'base jetable où un dump de production est RESTAURÉ',
  BACKUP_PASSPHRASE: 'déchiffre le dump de production',
  SUPABASE_ACCESS_TOKEN: 'API Management : SQL arbitraire sur la production',
  SUPABASE_SERVICE_ROLE_KEY: 'contourne la RLS',
  STRIPE_SECRET_KEY: 'clients Stripe : noms, adresses email',
  CRON_SECRET: 'déclenche des Edge Functions qui lisent la production',
  VERCEL_TOKEN: 'configuration et journaux du déploiement de production',
};

/** Secrets lus par les workflows SANS ouvrir de donnée personnelle. */
export const SECRETS_SANS_DONNEE = {
  VITE_SUPABASE_URL: 'public : inscrit dans le bundle du site',
  VITE_SUPABASE_ANON_KEY: 'public : inscrit dans le bundle ; sans session, la RLS ne rend aucune ligne',
  VITE_SENTRY_DSN: 'public, en écriture seule',
  SUPABASE_URL: 'URL publique du projet',
  OPS_ALERT_WEBHOOK_URL: "écrit vers le salon d'alerte, ne lit rien",
  VERCEL_PROJECT_ID: 'identifiant, pas un accès',
  VERCEL_TEAM_ID: 'identifiant, pas un accès',
  GITHUB_TOKEN: 'jeton du run, borné par `permissions:`',
};

// ─── 2 · Listes nominatives ─────────────────────────────────────────
//
// ARTEFACTS, clé `<fichier> › <nom de l'artefact>`. Trois natures :
//   · 'sans-prod'   : le job ne reçoit AUCUN secret de production (vérifié) ;
//   · 'chiffre'     : chaque chemin est un fichier chiffré (.gpg, .age)
//                     qu'une commande de chiffrement du MÊME job produit ;
//   · 'metadonnees' : sortie d'une requête sur la prod, admise seulement si
//                     son SQL (fourni ici) ne lit que le catalogue.
export const ARTEFACTS = {
  'ci.yml › coverage': {
    nature: 'sans-prod',
    raison: 'couverture Vitest : chemins et taux du code source, tests sans base réelle',
  },
  'ci.yml › playwright-report': {
    nature: 'sans-prod',
    raison:
      "parcours e2e en mode démo et `supabase-stub` (hôte qui ne résout pas, playwright.config.ts) ; les clés VITE_ reçues sont publiques et aucune session réelle ne s'ouvre",
  },
  'ci.yml › lighthouse': {
    nature: 'sans-prod',
    raison: 'Lighthouse sur le build servi en local : pages publiques prérendues, aucune session',
  },
  'ci.yml › lighthouse-mobile': {
    nature: 'sans-prod',
    raison: 'Lighthouse mobile sur le build servi en local : pages publiques prérendues, aucune session',
  },
  'db-backup.yml › db-dump': {
    nature: 'chiffre',
    raison: 'dump COMPLET de la prod, chiffré gpg AES-256 (BACKUP_PASSPHRASE) ; le clair ne quitte pas le runner (BK-1, 8c6a971d)',
  },
  'migration-coverage.yml › introspection': {
    nature: 'metadonnees',
    raison: "noms d'objets du catalogue et du ledger, jamais une ligne de table",
    requete: INTROSPECTION_SQL,
    produitPar: 'check-migration-coverage.mjs --print-sql',
  },
  'mutation.yml › mutation-report': {
    nature: 'sans-prod',
    raison: 'rapport Stryker : source du dépôt (déjà public), mutants et noms de tests unitaires, aucun secret ni base',
  },
  'scalability-volume.yml › scalability-volume-log': {
    nature: 'sans-prod',
    raison: 'stack Supabase LOCALE (`supabase start`) remplie de données synthétiques',
  },
  'visual.yml › visual-report': {
    nature: 'sans-prod',
    raison: 'captures de régression visuelle en mode démo, aucun secret',
  },
};

// CONTACTS_PROD, clé `<fichier> › <job> › <étape>` : chaque étape qui reçoit
// un secret de SECRETS_PROD, et ce qu'elle laisse au journal (public).
// `fichiersAffiches` : fichiers écrits par un client SQL que la garde ne
// sait pas juger seule, affichés en connaissance de cause.
export const CONTACTS_PROD = {
  'weekly-digest.yml › digest › Envoyer le résumé': {
    affiche: "l'état de l'envoi seulement ; le message (totaux de prod) part au webhook, jamais au journal",
  },
  'daily-digest.yml › digest › Envoyer le résumé': {
    affiche: "l'état de l'envoi seulement ; le message (totaux de prod) part au webhook, jamais au journal",
  },
  'db-backup.yml › dump › Verifier le secret': {
    affiche: 'présence et longueur des secrets, jamais leur valeur',
  },
  'db-backup.yml › dump › Diagnostiquer la chaine (sans le mot de passe)': {
    affiche: 'utilisateur, hôte, port et base de la chaîne ; du mot de passe, sa seule longueur',
  },
  'db-backup.yml › dump › Exporter la base': {
    affiche: 'version de pg_dump et taille du fichier ; le dump va dans un fichier',
  },
  'db-backup.yml › dump › Chiffrer le dump': {
    affiche: 'premier octet et taille du fichier chiffré',
  },
  'migration-coverage.yml › couverture › Lire le ledger et le catalogue de production': {
    affiche: "taille de l'introspection en octets ; la sortie de psql va dans un fichier",
  },
  'restore-drill.yml › dump-check › Relire le dernier dump': {
    affiche: "nom et taille du dump, nombre d'objets de sa table des matières, tables manquantes",
  },
  'restore-drill.yml › drill › Verifier l intention et la cible': {
    affiche: 'hôte, utilisateur, port et base de la cible ; jamais le mot de passe',
  },
  'restore-drill.yml › drill › Recuperer le dump': {
    affiche: 'nom et taille du dump, cinq lignes de sa table des matières (métadonnées)',
  },
  'restore-drill.yml › drill › Restaurer, chronometre': {
    affiche: "durée, code de sortie, nombre d'erreurs",
    fichiersAffiches: {
      'restore.log':
        "les 40 premières lignes `pg_restore: error` : messages du serveur sur des ordres refusés. Les lignes DETAIL, qui peuvent citer une valeur, ne portent pas ce préfixe et ne sont pas imprimées",
    },
  },
  'restore-drill.yml › drill › Verifier la base restauree': {
    affiche: 'comptes de lignes par table et compteurs RLS (SQL vérifié par cette garde)',
  },
  'posture.yml › supabase › Advisors et reglages d auth': {
    affiche: "advisors et réglages d'auth : noms d'objets et de règles, aucune ligne de table",
  },
  'posture.yml › retention › Durees de conservation (RGPD art. 5.1.e)': {
    affiche: 'par table, nombre de lignes orphelines et âge de la plus vieille ligne',
  },
  'posture.yml › vercel-env › Variables d environnement Vercel': {
    affiche: 'noms des variables Vercel attendues et présentes, jamais leur valeur',
  },
  'posture.yml › acquisition › Compteurs d acquisition': {
    affiche: 'compteurs agrégés : utilisateurs, inscrits, actifs, organisations',
  },
  'posture.yml › cout-db › EXPLAIN de reference, sous RLS': {
    affiche: 'coûts EXPLAIN et pentes par requête de référence',
  },
  'edge-deploy-drift.yml › compare › Comparer le code deploye au depot': {
    affiche: 'écarts de code source entre fonctions déployées et dépôt',
  },
  'edge-deploy-drift.yml › compare › Sondes de fumee · les fonctions repondent-elles vraiment ?': {
    affiche: 'codes HTTP et verdicts des sondes',
  },
  'stripe-prices.yml › grille › Comparer la grille Stripe au code': {
    affiche: 'grille de prix : montants et identifiants de prix, aucun client',
  },
  'renewal-notice.yml › notify › Declencher les avis de reconduction': {
    affiche: 'code HTTP et réponse `{due, sent, failed}` : trois compteurs',
  },
  'org-digest.yml › send › Envoyer les notifications par e-mail': {
    affiche: 'code HTTP et réponse `{mode, recipients, sent, failed}` : compteurs',
  },
  'inactive-accounts.yml › run › Avertir puis effacer les comptes inactifs': {
    affiche: 'code HTTP et réponse `{toWarn, warned, toDelete, deleted, …}` : compteurs, aucun e-mail',
  },
  'org-webhook-dispatch.yml › dispatch › Envoyer les webhooks en attente': {
    affiche: 'code HTTP et réponse `{delivered, failed}` : compteurs',
  },
};

/** Canaux publics autres que les artefacts, depuis un job au contact de la prod. */
export const CANAUX_PUBLICS = {
  'posture.yml › cout-db › Enregistrer le point dans la serie': {
    raison: '`git push` de docs/db-cost-series.json : un point de coût EXPLAIN par jour, aucune ligne de table',
  },
};

export const DECLARATIONS = { ARTEFACTS, CONTACTS_PROD, CANAUX_PUBLICS };

// ─── 3 · Motifs ─────────────────────────────────────────────────────

const RE_PUBLIE =
  /^(actions\/upload-artifact|actions\/upload-pages-artifact|softprops\/action-gh-release|peaceiris\/actions-gh-pages|codecov\/codecov-action)@/;
const RE_PUBLIE_LIGNE =
  /^\s*(?:-\s+)?uses:\s*['"]?(actions\/upload-artifact|actions\/upload-pages-artifact|softprops\/action-gh-release|peaceiris\/actions-gh-pages|codecov\/codecov-action)@/;
const EXT_CHIFFRE = /\.(gpg|pgp|age|enc)$/i;
const RE_EXPORT = /\.(dump|sql|sql\.gz|backup|bak|csv|tsv|sqlite3?|db)$|dump|backup|export/i;
const RE_CATALOGUE =
  /^(?:pg_catalog\.)?pg_(?:class|namespace|policies|policy|proc|tables|indexes|constraint|trigger|views|matviews|attribute|type|extension|sequences|depend|description)$|^information_schema\.(?:columns|tables|routines|views|table_constraints|key_column_usage|schemata)$|^supabase_migrations\.schema_migrations$/i;
/** Programmes qui recopient au journal le contenu d'un fichier. */
const AFFICHEURS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep', 'sed', 'awk', 'jq', 'od',
  'xxd', 'hexdump', 'base64', 'strings', 'sort', 'uniq', 'cut', 'column', 'nl', 'tac', 'zcat',
]);
const PREFIXES = new Set([
  '{', '(', '!', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'sudo', 'time', 'exec',
  'command', 'nohup', 'env',
]);

// ─── 4 · Lecture des workflows ──────────────────────────────────────

export function lireWorkflows(dossier = DOSSIER) {
  return readdirSync(dossier)
    .filter((f) => /\.ya?ml$/i.test(f))
    .sort()
    .map((fichier) => ({ fichier, texte: readFileSync(join(dossier, fichier), 'utf8') }));
}

/** Secrets cités dans une expression `${{ }}` (seule forme qui les injecte). */
function secretsExpr(texte) {
  const out = [];
  for (const e of String(texte).matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
    for (const s of e[1].matchAll(/secrets\.([A-Za-z_]\w*)/g)) out.push(s[1]);
  }
  return out;
}
/** Secrets d'un objet YAML : expressions partout, forme nue dans `if:`. */
function secretsDe(obj) {
  if (obj == null) return [];
  const { if: si, ...reste } = typeof obj === 'object' ? obj : { valeur: obj };
  const nus = si == null ? [] : [...String(si).matchAll(/secrets\.([A-Za-z_]\w*)/g)].map((m) => m[1]);
  return [...secretsExpr(JSON.stringify(reste)), ...nus];
}

const lignesUtiles = (texte) => texte.split(/\r?\n/).filter((l) => !/^\s*#/.test(l));

function modele({ fichier, texte }) {
  const doc = load(texte) ?? {};
  const jobs = Object.entries(doc.jobs ?? {}).map(([id, job]) => {
    const { steps, ...reste } = job ?? {};
    return {
      id,
      reutilise: reste.uses ?? null,
      env: reste.env ?? {},
      secretsJob: [...secretsDe({ env: doc.env ?? {} }), ...secretsDe(reste)],
      etapes: (steps ?? []).map((s, index) => ({
        index,
        id: s.id ?? null,
        nom: String(s.name ?? s.uses ?? String(s.run ?? '').trim().split('\n')[0]),
        uses: s.uses ?? null,
        with: s.with ?? {},
        env: s.env ?? {},
        shell: String(s.shell ?? ''),
        run: typeof s.run === 'string' ? s.run : '',
        secrets: secretsDe(s),
      })),
    };
  });
  return { fichier, texte, doc, jobs };
}

// ─── 5 · Lecture des scripts `run:` ─────────────────────────────────

/** Commandes logiques : continuations jointes, heredoc rattaché à sa ligne. */
export function commandes(script) {
  const lignes = script.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lignes.length; i++) {
    let texte = lignes[i];
    if (/^\s*#/.test(texte) || !texte.trim()) continue;
    while (/\\\s*$/.test(texte) && i + 1 < lignes.length) {
      texte = texte.replace(/\\\s*$/, ' ') + lignes[++i].trim();
    }
    let corps = '';
    const h = texte.match(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1/);
    if (h) {
      const c = [];
      while (i + 1 < lignes.length && lignes[i + 1].trim() !== h[2]) c.push(lignes[++i]);
      i++;
      corps = c.join('\n');
    }
    out.push({ texte: texte.trim(), corps });
  }
  return out;
}

/** Sort les `$( … )` d'une commande. Une capture affectée à une variable
 *  n'est pas affichée ; les autres (dans un echo) le sont. */
function extraireCaptures(texte) {
  const captures = [];
  let exterieur = '';
  let i = 0;
  let quote = null;
  while (i < texte.length) {
    const c = texte[i];
    if (quote === "'") { exterieur += c; if (c === "'") quote = null; i++; continue; }
    if (c === "'" && quote !== '"') { quote = "'"; exterieur += c; i++; continue; }
    if (c === '"') { quote = quote === '"' ? null : '"'; exterieur += c; i++; continue; }
    if (c === '\\') { exterieur += texte.slice(i, i + 2); i += 2; continue; }
    if (c === '$' && texte[i + 1] === '(' && texte[i + 2] !== '(') {
      let prof = 1;
      let k = i + 2;
      let q = null;
      while (k < texte.length && prof > 0) {
        const d = texte[k];
        if (q) { if (d === q) q = null; }
        else if (d === "'" || d === '"') q = d;
        else if (d === '(') prof++;
        else if (d === ')') prof--;
        k++;
      }
      captures.push({ texte: texte.slice(i + 2, k - 1), affectation: /[A-Za-z_]\w*=["']?$/.test(exterieur) });
      exterieur += ' '.repeat(k - i);
      i = k;
      continue;
    }
    exterieur += c;
    i++;
  }
  return { exterieur, captures };
}

/** Toutes les commandes d'un script, captures comprises. */
function commandesEtendues(script) {
  const out = [];
  const pousser = (texte, corps, capture, affiche) => {
    const { exterieur, captures } = extraireCaptures(texte);
    out.push({ texte: exterieur, corps, capture, affiche });
    for (const c of captures) pousser(c.texte, corps, true, affiche && !c.affectation);
  };
  for (const c of commandes(script)) pousser(c.texte, c.corps, false, true);
  return out;
}

/** Même longueur, contenu des guillemets remplacé : les séparateurs et les
 *  redirections cités ne comptent plus. */
function masquer(t) {
  let out = '';
  let q = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (q === '"' && c === '\\' && i + 1 < t.length) { out += '__'; i++; continue; }
      if (c === q) { q = null; out += c; } else out += '_';
    } else {
      if (c === '"' || c === "'") q = c;
      out += c;
    }
  }
  return out;
}

/** Segments d'une commande (`|`, `||`, `&&`, `;`), avec le tube qui suit. */
function segmentsDe(texte) {
  const m = masquer(texte);
  const out = [];
  let debut = 0;
  for (let i = 0; i < m.length; i++) {
    const c = m[i];
    const d = m[i + 1];
    let n = 0;
    let tube = false;
    if ((c === '|' && d === '|') || (c === '&' && d === '&')) n = 2;
    else if (c === '|') { n = 1; tube = true; }
    else if (c === ';') n = 1;
    if (n) {
      out.push({ texte: texte.slice(debut, i), tubeApres: tube });
      debut = i + n;
      i += n - 1;
    }
  }
  out.push({ texte: texte.slice(debut), tubeApres: false });
  return out.filter((s) => s.texte.trim());
}

/** Mots d'un segment, guillemets respectés. */
function mots(texte) {
  const m = masquer(texte);
  return [...m.matchAll(/\S+/g)].map((x) => texte.slice(x.index, x.index + x[0].length));
}

/** Forme comparable d'un chemin : sans guillemets, `${X}` réduit à `$X`. */
const jeton = (t) =>
  String(t).trim().replace(/^['"]|['"]$/g, '').replace(/;$/, '').replace(/\$\{([A-Za-z_]\w*)\}/g, '$$$1');

function programmeDe(ms) {
  let i = 0;
  while (i < ms.length && (PREFIXES.has(ms[i]) || /^[A-Za-z_]\w*=/.test(ms[i]))) i++;
  if (i >= ms.length) return { prog: '', args: [] };
  const prog = jeton(ms[i]).split('/').pop().toLowerCase();
  return { prog, args: ms.slice(i + 1) };
}

/** Redirections d'un segment : cible de stdout et de stderr. */
function redirections(args) {
  const r = { stdout: null, stderr: null, mots: new Set() };
  for (let i = 0; i < args.length; i++) {
    const m = args[i].match(/^(\d*|&)>>?(.*)$/);
    if (!m) continue;
    let cible = m[2];
    r.mots.add(i);
    if (!cible && i + 1 < args.length) { cible = args[i + 1]; r.mots.add(i + 1); }
    if (!cible || cible.startsWith('&')) continue;
    if (m[1] === '2') r.stderr = jeton(cible);
    else r.stdout = jeton(cible);
  }
  return r;
}

function option(args, courtes, longues) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (courtes.includes(a) || longues.includes(a)) return args[i + 1] ? jeton(args[i + 1]) : null;
    for (const l of longues) if (a.startsWith(`${l}=`)) return jeton(a.slice(l.length + 1));
  }
  return null;
}
const aDrapeau = (args, ...d) => args.some((a) => d.includes(a));

// ─── 6 · SQL ────────────────────────────────────────────────────────

const sansLitteraux = (sql) => sql.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''");

/** Relations lues (FROM, JOIN). */
export function relationsLues(sql) {
  return [...sansLitteraux(sql).matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z_][\w.]*)/gi)].map((m) => m[1].toLowerCase());
}

/** Ce qu'une requête renvoie de plus qu'un compte ou une ligne du catalogue. */
export function lecturesDeDonnees(sql) {
  const s = sansLitteraux(sql);
  const pb = [];
  if (/\bCOPY\b|\\copy|\bTABLE\s+[A-Za-z_]|\bRETURNING\b/i.test(s)) pb.push('COPY, TABLE ou RETURNING : des lignes entières');
  for (const m of s.matchAll(/\bSELECT\b([\s\S]*?)\bFROM\s+([A-Za-z_][\w.]*)/gi)) {
    const rel = m[2].toLowerCase();
    if (RE_CATALOGUE.test(rel)) continue;
    const proj = m[1].split(',').map((p) => p.trim()).filter((p) => p && p !== "''");
    if (!proj.length || !proj.every((p) => /^count\(\s*\*\s*\)$/i.test(p))) {
      pb.push(`${rel} lu par « SELECT ${m[1].trim().replace(/\s+/g, ' ')} »`);
    }
  }
  return pb;
}

// ─── 7 · Résolution d'un chemin d'artefact ──────────────────────────

const nettoyer = (v) => v.replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '');

function ecriture(run, nom, fichier) {
  const re = new RegExp(
    `^\\s*(?:echo|printf\\s+'[^']*')\\s+["']?${nom}=([^"'\\n]*?)["']?\\s*>>\\s*["']?\\$\\{?${fichier}\\}?["']?`,
    'm',
  );
  const m = run.match(re);
  return m ? m[1] : null;
}

function valeurShell(nom, job, j, m) {
  const e = job.etapes[j];
  if (e?.run) {
    const a = [...e.run.matchAll(new RegExp(`^\\s*(?:export\\s+)?${nom}=(.*)$`, 'gm'))].pop();
    if (a) return { valeur: nettoyer(a[1]), j };
  }
  if (e && nom in e.env) return { valeur: String(e.env[nom]), j };
  for (let k = j - 1; k >= 0; k--) {
    const w = ecriture(job.etapes[k].run, nom, 'GITHUB_ENV');
    if (w != null) return { valeur: w, j: k };
  }
  if (nom in job.env) return { valeur: String(job.env[nom]), j };
  if (nom in (m.doc.env ?? {})) return { valeur: String(m.doc.env[nom]), j };
  return null;
}

function deployer(valeur, job, j, m, prof = 0) {
  if (prof > 4) return valeur;
  return valeur.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (tout, nom) => {
    const v = valeurShell(nom, job, j, m);
    return v == null || v.valeur === tout ? tout : deployer(v.valeur, job, v.j, m, prof + 1);
  });
}

/** `${{ env.X }}` et `${{ steps.s.outputs.y }}` remplacés par ce qui les écrit. */
function resoudre(p, job, i, m) {
  let ctx = i;
  let jet = p.replace(/\$\{\{\s*env\.(\w+)\s*\}\}/g, (tout, nom) => {
    const v = valeurShell(nom, job, i, m);
    if (!v) return tout;
    ctx = v.j;
    return v.valeur;
  });
  jet = jet.replace(/\$\{\{\s*steps\.([\w-]+)\.outputs\.([\w-]+)\s*\}\}/g, (tout, id, cle) => {
    const k = job.etapes.findIndex((e) => e.id === id);
    const w = k >= 0 ? ecriture(job.etapes[k].run, cle, 'GITHUB_OUTPUT') : null;
    if (w == null) return tout;
    ctx = k;
    return w;
  });
  jet = jeton(jet);
  return { jeton: jet, deploye: jeton(deployer(jet, job, ctx, m)) };
}

// ─── 8 · Commentaires ───────────────────────────────────────────────

const RE_NON_PUBLIC =
  /\bartefacts?\b[^.;]{0,120}?(?:\bnon[ -]publi(?:c|cs|que|ques)\b|\bpas publi(?:c|cs|que|ques)\b|\bne (?:le|la) (?:sont|est) pas\b|\bne l'est pas\b)|\bartifacts?\b[^.;]{0,120}?\b(?:not public|private)\b/i;

/** Blocs de commentaires qui affirment qu'un artefact n'est pas public.
 *  Une citation entre « » (l'ancienne phrase rapportée) ne compte pas. */
export function affirmationsNonPublic(texte) {
  const blocs = [];
  let bloc = [];
  for (const l of `${texte}\n`.split(/\r?\n/)) {
    const m = l.match(/^\s*#(.*)$/);
    if (m) { bloc.push(m[1].trim()); continue; }
    if (bloc.length) blocs.push(bloc.join(' '));
    bloc = [];
  }
  return blocs
    .map((b) => b.replace(/«[^»]*»/g, ' ').replace(/\s+/g, ' ').match(RE_NON_PUBLIC)?.[0])
    .filter(Boolean);
}

// ─── 9 · Analyse ────────────────────────────────────────────────────

function controlesBruts(m) {
  const v = [];
  const lignes = lignesUtiles(m.texte);
  const brut = lignes.filter((l) => RE_PUBLIE_LIGNE.test(l)).length;
  const lus = m.jobs.flatMap((j) => j.etapes).filter((e) => e.uses && RE_PUBLIE.test(e.uses)).length;
  if (brut !== lus) {
    v.push(`${m.fichier} : ${brut} ligne(s) \`uses:\` de publication dans le texte, ${lus} lue(s) par le parseur ; la garde ne regarde pas tout ce fichier`);
  }
  const lusSecrets = new Set([...m.jobs.flatMap((j) => [...j.secretsJob, ...j.etapes.flatMap((e) => e.secrets)])]);
  const brutsSecrets = new Set(
    lignes.flatMap((l) => (/^\s*(?:-\s+)?if:/.test(l) ? [...l.matchAll(/secrets\.([A-Za-z_]\w*)/g)].map((x) => x[1]) : secretsExpr(l))),
  );
  for (const s of brutsSecrets) {
    if (!lusSecrets.has(s)) v.push(`${m.fichier} : secret \`${s}\` présent dans le texte, absent de ce que la garde a lu`);
  }
  if (/secrets\s*\[|toJSON\(\s*secrets\s*\)/.test(lignes.join('\n'))) {
    v.push(`${m.fichier} : accès dynamique aux secrets, que cette garde ne sait pas suivre`);
  }
  for (const b of affirmationsNonPublic(m.texte)) {
    v.push(`${m.fichier} : un commentaire affirme qu'un artefact n'est pas public (« ${b.slice(0, 160)} »). Dans un dépôt public, il l'est : c'est la croyance qui a laissé passer BK-1`);
  }
  return v;
}

function analyserJob(m, job, decl, v, vus, depots) {
  const lieu = `${m.fichier} › ${job.id}`;
  const cleEtape = (e) => `${lieu} › ${e.nom}`;
  if (job.reutilise) v.push(`${lieu} : workflow réutilisable (${job.reutilise}), non analysé par cette garde`);

  for (const s of new Set([...job.secretsJob, ...job.etapes.flatMap((e) => e.secrets)])) {
    if (!(s in SECRETS_PROD) && !(s in SECRETS_SANS_DONNEE)) {
      v.push(`${lieu} : secret \`${s}\` non classé. Le ranger dans SECRETS_PROD ou SECRETS_SANS_DONNEE, avec sa raison`);
    }
  }
  const prodDe = (e) => [...new Set([...e.secrets, ...job.secretsJob])].filter((s) => s in SECRETS_PROD);
  const etapesProd = job.etapes.filter((e) => prodDe(e).length);
  const touche = etapesProd.length > 0;

  // ── B · déclaration de chaque contact
  const noms = job.etapes.map((e) => e.nom);
  for (const e of etapesProd) {
    const cle = cleEtape(e);
    if (noms.filter((n) => n === e.nom).length > 1) v.push(`${cle} : nom d'étape ambigu, une déclaration doit désigner UNE étape`);
    if (!decl.CONTACTS_PROD[cle]) {
      v.push(`${cle} : reçoit ${prodDe(e).join(', ')} sans être déclarée dans CONTACTS_PROD (dire ce qu'elle imprime au journal, public)`);
    } else vus.contacts.add(cle);
    if (/^\s*set\s+(?:-[a-zA-Z]*x|-o\s+xtrace)/m.test(e.run) || /(?:^|\s)-[a-z]*x\b/.test(e.shell)) {
      v.push(`${cle} : trace shell (set -x) dans une étape au contact de la prod : chaque commande part au journal, développée`);
    }
  }

  // ── C · clients SQL bruts, fichiers qu'ils écrivent
  const suivis = new Map(); // jeton -> { genre, sql, ecrivain }
  const chiffres = new Set();
  const suivre = (j, genre, sql, e) => { if (j) suivis.set(j, { genre, sql, ecrivain: cleEtape(e) }); };
  for (const e of job.etapes) {
    if (!e.run) continue;
    for (const c of commandesEtendues(e.run)) {
      for (const seg of segmentsDe(c.texte)) {
        const { prog, args } = programmeDe(mots(seg.texte));
        if (prog === 'gpg' || prog === 'age') {
          const sortie = option(args, ['-o'], ['--output']);
          if (aDrapeau(args, '--symmetric', '-c', '--encrypt', '-e', '-p', '--passphrase', '-r')) {
            if (sortie) chiffres.add(sortie);
          } else if (aDrapeau(args, '-d', '--decrypt')) suivre(sortie, 'dump', null, e);
          continue;
        }
        if (!touche) continue;
        if (aDrapeau(args, '--version', '-V', '--help')) continue;
        const r = redirections(args);
        const ici = `${cleEtape(e)} : \`${seg.texte.trim().slice(0, 100)}\``;
        if (prog === 'psql') {
          const cible = r.stdout ?? option(args, ['-o'], ['--output']);
          if (!cible || seg.tubeApres) {
            v.push(`${ici} : requête sur la prod dont la sortie part au journal (ou dans une variable). L'écrire dans un fichier`);
            continue;
          }
          const sql = c.corps || option(args, ['-c'], ['--command']) || null;
          suivre(cible, 'requete', sql, e);
        } else if (prog === 'pg_dump') {
          const cible = option(args, ['-f'], ['--file']) ?? r.stdout;
          if (!cible || seg.tubeApres) v.push(`${ici} : pg_dump vers la sortie standard, donc vers le journal`);
          else suivre(cible, 'dump', null, e);
        } else if (prog === 'pg_restore') {
          if (aDrapeau(args, '--list', '-l')) continue; // table des matières : des noms d'objets
          const fichier = option(args, ['-f'], ['--file']);
          if (fichier) suivre(fichier, 'dump', null, e);
          else if (!option(args, ['-d'], ['--dbname'])) v.push(`${ici} : pg_restore sans base ni fichier écrit le SQL, données comprises, sur la sortie standard`);
          if (r.stderr) suivre(r.stderr, 'erreurs', null, e);
        } else if (prog === 'curl' && args.some((a) => /\/database\/query/.test(a))) {
          const cible = option(args, ['-o'], ['--output']);
          if (!cible) v.push(`${ici} : requête SQL par l'API Management dont la réponse part au journal`);
          else suivre(cible, 'requete', null, e);
        } else if (prog === 'supabase' && args[0] === 'db' && args[1] === 'dump') {
          const cible = option(args, ['-f'], ['--file']);
          if (!cible) v.push(`${ici} : \`supabase db dump\` vers la sortie standard`);
          else suivre(cible, 'dump', null, e);
        }
      }
    }
  }

  // ── C · affichage des fichiers suivis, D · canaux publics
  if (touche) {
    for (const e of job.etapes) {
      if (!e.run) continue;
      let canal = false;
      for (const c of commandesEtendues(e.run)) {
        for (const seg of segmentsDe(c.texte)) {
          const { prog, args } = programmeDe(mots(seg.texte));
          if (
            (prog === 'git' && args.includes('push')) ||
            (prog === 'gh' && /^(release|gist|issue|pr)$/.test(args[0] ?? '') && /^(create|upload|comment|edit)$/.test(args[1] ?? '')) ||
            (prog === 'curl' && args.some((a, k) => a === '-T' || a === '--upload-file' || /^--data-binary$/.test(a) || (a === '-F' && /=@/.test(args[k + 1] ?? ''))))
          ) canal = true;
          if (!c.affiche || !AFFICHEURS.has(prog)) continue;
          if (/^(e|f)?grep$/.test(prog) && args.some((a) => /^-[a-zA-Z]*[qcl][a-zA-Z]*$/.test(a) || /^--(quiet|silent|count|files-with-matches)$/.test(a))) continue;
          const r = redirections(args);
          for (const [k, a] of args.entries()) {
            if (r.mots.has(k)) continue;
            const s = suivis.get(jeton(a));
            if (!s) continue;
            const ici = `${cleEtape(e)} : affiche \`${jeton(a)}\``;
            if (s.genre === 'dump') { v.push(`${ici}, un dump de la prod, au journal`); continue; }
            if (s.genre === 'requete' && s.sql) {
              const pb = lecturesDeDonnees(s.sql);
              if (pb.length) v.push(`${ici}, sortie d'une requête qui lit des données : ${pb.join(' ; ')}`);
              continue;
            }
            const d = decl.CONTACTS_PROD[s.ecrivain]?.fichiersAffiches?.[jeton(a)];
            if (d) vus.affiches.add(`${s.ecrivain}#${jeton(a)}`);
            else v.push(`${ici}, écrit par un client SQL (« ${s.ecrivain} ») sans SQL vérifiable : le déclarer dans fichiersAffiches, avec sa raison, ou ne pas l'afficher`);
          }
        }
      }
      if (canal) {
        const cle = cleEtape(e);
        if (decl.CANAUX_PUBLICS[cle]) vus.canaux.add(cle);
        else v.push(`${cle} : canal public (push, issue, release, envoi de fichier) depuis un job au contact de la prod, absent de CANAUX_PUBLICS`);
      }
    }
  }

  // ── A · dépôts d'artefacts
  for (const [i, e] of job.etapes.entries()) {
    if (!e.uses || !RE_PUBLIE.test(e.uses)) continue;
    const nom = String(e.with.name ?? 'artifact');
    const cle = `${m.fichier} › ${nom}`;
    const d = decl.ARTEFACTS[cle];
    depots.push({ cle, job: job.id, touche });
    if (!d) {
      v.push(`${cle} : dépôt d'artefact absent de la liste ARTEFACTS. Le déclarer avec sa nature et sa raison : un artefact d'un dépôt public se télécharge depuis n'importe quel compte`);
      continue;
    }
    vus.artefacts.add(cle);
    if (!/^actions\/upload-(pages-)?artifact@/.test(e.uses)) {
      v.push(`${cle} : action de publication \`${e.uses}\`, chemins non analysés par cette garde`);
      continue;
    }
    const chemins = String(e.with.path ?? '').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('!'));
    if (!chemins.length) v.push(`${cle} : aucun chemin lisible`);
    if (d.nature === 'sans-prod' && touche) {
      v.push(`${cle} : déclaré « sans-prod » alors que son job reçoit ${[...new Set(etapesProd.flatMap(prodDe))].join(', ')}`);
    }
    if (d.nature === 'metadonnees') {
      const horsCatalogue = typeof d.requete === 'string' ? relationsLues(d.requete).filter((r) => !RE_CATALOGUE.test(r)) : ['(aucune requête fournie)'];
      if (typeof d.requete === 'string' && lecturesDeDonnees(d.requete).some((p) => p.startsWith('COPY'))) horsCatalogue.push('COPY/TABLE');
      if (horsCatalogue.length) v.push(`${cle} : déclaré « metadonnees » mais sa requête lit ${horsCatalogue.join(', ')}`);
      if (!d.produitPar || !job.etapes.some((x) => x.run.includes(d.produitPar))) {
        v.push(`${cle} : déclaré « metadonnees » mais aucune étape du job ne produit sa requête par \`${d.produitPar}\``);
      }
    }
    for (const p of chemins) {
      const { jeton: jet, deploye } = resoudre(p, job, i, m);
      const ici = `${cle} : chemin \`${p}\``;
      const chiffre = EXT_CHIFFRE.test(jet) || EXT_CHIFFRE.test(deploye);
      if (touche && deploye.includes('${{')) v.push(`${ici} non résolu, dans un job au contact de la prod`);
      if (RE_EXPORT.test(deploye) && !chiffre) v.push(`${ici} (\`${deploye}\`) : nom d'export ou de dump, déposé EN CLAIR`);
      const s = suivis.get(jet) ?? suivis.get(deploye);
      if (s?.genre === 'dump') v.push(`${ici} : dump de la prod déposé EN CLAIR (écrit par « ${s.ecrivain} »)`);
      if (s && s.genre !== 'dump' && d.nature !== 'metadonnees') v.push(`${ici} : sortie d'un client SQL de prod, déposée sans être déclarée « metadonnees »`);
      if (d.nature === 'chiffre') {
        if (!chiffre) v.push(`${ici} (\`${deploye}\`) : déclaré « chiffre » mais le fichier déposé n'est pas chiffré`);
        else if (/[*?[]|\/$/.test(jet)) v.push(`${ici} : déclaré « chiffre » mais désigne un motif ou un dossier, qui peut contenir le clair`);
        else if (!chiffres.has(jet) && !chiffres.has(deploye)) v.push(`${ici} : déclaré « chiffre » mais aucune commande de chiffrement du job ne le produit`);
      }
      if (d.nature === 'metadonnees' && (!s || s.genre !== 'requete')) {
        v.push(`${ici} : déclaré « metadonnees » mais n'est pas la sortie d'une requête de ce job`);
      }
    }
  }
}

/** Point d'entrée : toutes les violations, et ce que la garde a vu. */
export function analyser(workflows, decl = DECLARATIONS) {
  const v = [];
  const vus = { artefacts: new Set(), contacts: new Set(), canaux: new Set(), affiches: new Set() };
  const depots = [];
  for (const wf of workflows) {
    let m;
    try {
      m = modele(wf);
    } catch (err) {
      v.push(`${wf.fichier} : YAML illisible (${String(err.message).split('\n')[0]})`);
      continue;
    }
    v.push(...controlesBruts(m));
    for (const job of m.jobs) analyserJob(m, job, decl, v, vus, depots);
  }
  for (const k of Object.keys(decl.ARTEFACTS)) if (!vus.artefacts.has(k)) v.push(`${k} : déclaration périmée, aucun dépôt ne porte ce nom`);
  for (const k of Object.keys(decl.CONTACTS_PROD)) {
    if (!vus.contacts.has(k)) v.push(`${k} : déclaration périmée, aucune étape au contact de la prod ne porte ce nom`);
    for (const f of Object.keys(decl.CONTACTS_PROD[k].fichiersAffiches ?? {})) {
      if (!vus.affiches.has(`${k}#${f}`)) v.push(`${k} : fichiersAffiches \`${f}\` périmé, plus affiché`);
    }
  }
  for (const k of Object.keys(decl.CANAUX_PUBLICS)) if (!vus.canaux.has(k)) v.push(`${k} : canal public déclaré, plus utilisé`);
  return { violations: v, depots, contacts: [...vus.contacts] };
}

// ═══ Les workflows du dépôt ═════════════════════════════════════════

describe('workflows du dépôt · aucune donnée de prod publiée en clair', () => {
  const workflows = lireWorkflows();
  const r = analyser(workflows);

  it('la garde a lu des workflows, des dépôts et des contacts (elle regarde quelque chose)', () => {
    expect(workflows.length).toBeGreaterThan(0);
    expect(r.depots.length).toBeGreaterThan(0);
    expect(r.contacts.length).toBeGreaterThan(0);
  });

  it('aucune violation', () => {
    expect(r.violations).toEqual([]);
  });
});

// ═══ TÉMOIN : db-backup.yml d'avant 8c6a971d ═══════════════════════

describe('témoin · db-backup.yml d avant 8c6a971d (dumps en clair, BK-1)', () => {
  const brut = readFileSync(TEMOIN);
  const texte = brut.toString('utf8').replace(/\r\n/g, '\n');

  it('le fixture est octet pour octet le fichier du commit parent de 8c6a971d', () => {
    const contenu = Buffer.from(texte, 'utf8');
    const blob = createHash('sha1').update(`blob ${contenu.length}\0`).update(contenu).digest('hex');
    expect(blob).toBe(TEMOIN_BLOB);
  });

  it('la garde ROUGIT dessus, et pour les bonnes raisons', () => {
    const workflows = lireWorkflows().map((w) => (w.fichier === 'db-backup.yml' ? { ...w, texte } : w));
    const v = analyser(workflows).violations.filter((x) => x.startsWith('db-backup.yml'));
    expect(v.some((x) => /db-dump : chemin .*dump de la prod déposé EN CLAIR/.test(x))).toBe(true);
    expect(v.some((x) => /db-dump : chemin .*nom d'export ou de dump, déposé EN CLAIR/.test(x))).toBe(true);
    expect(v.some((x) => /déclaré « chiffre » mais le fichier déposé n'est pas chiffré/.test(x))).toBe(true);
    expect(v.some((x) => /commentaire affirme qu'un artefact n'est pas public/.test(x))).toBe(true);
  });
});

// ═══ Témoins synthétiques : une règle, un cas qui doit rougir ═══════

const wf = (fichier, texte) => [{ fichier, texte }];
const vide = { ARTEFACTS: {}, CONTACTS_PROD: {}, CANAUX_PUBLICS: {} };
const avec = (d) => ({ ...vide, ...d });

const EXPORT_CLAIR = `
name: export
on: workflow_dispatch
jobs:
  x:
    runs-on: ubuntu-latest
    steps:
      - name: Extraire
        env:
          DB_URL: \${{ secrets.SUPABASE_DB_URL }}
        run: |
          psql "$DB_URL" -A -c "select email from profiles" > users.csv
      - name: Deposer
        uses: actions/upload-artifact@v4
        with:
          name: users
          path: users.csv
`;

describe('témoins synthétiques', () => {
  it('A · un dépôt non déclaré rougit', () => {
    const v = analyser(wf('x.yml', EXPORT_CLAIR), avec({ CONTACTS_PROD: { 'x.yml › x › Extraire': { affiche: 'x' } } })).violations;
    expect(v.some((x) => /x\.yml › users : dépôt d'artefact absent de la liste ARTEFACTS/.test(x))).toBe(true);
  });

  it('A · un export de la prod déclaré « sans-prod » rougit, trois fois', () => {
    const v = analyser(
      wf('x.yml', EXPORT_CLAIR),
      avec({
        ARTEFACTS: { 'x.yml › users': { nature: 'sans-prod', raison: 'x' } },
        CONTACTS_PROD: { 'x.yml › x › Extraire': { affiche: 'x' } },
      }),
    ).violations;
    expect(v.some((x) => /déclaré « sans-prod » alors que son job reçoit SUPABASE_DB_URL/.test(x))).toBe(true);
    expect(v.some((x) => /nom d'export ou de dump, déposé EN CLAIR/.test(x))).toBe(true);
    expect(v.some((x) => /sortie d'un client SQL de prod, déposée sans être déclarée/.test(x))).toBe(true);
  });

  it('A · « chiffre » sans commande de chiffrement rougit', () => {
    const t = EXPORT_CLAIR.replace(/users\.csv/g, 'users.csv.gpg');
    const v = analyser(
      wf('x.yml', t),
      avec({ ARTEFACTS: { 'x.yml › users': { nature: 'chiffre', raison: 'x' } }, CONTACTS_PROD: { 'x.yml › x › Extraire': { affiche: 'x' } } }),
    ).violations;
    expect(v.some((x) => /aucune commande de chiffrement du job ne le produit/.test(x))).toBe(true);
  });

  it('A · « chiffre » avec gpg --symmetric et le clair seul retiré passe', () => {
    const t = `
name: x
on: workflow_dispatch
jobs:
  x:
    runs-on: ubuntu-latest
    steps:
      - name: Exporter
        env:
          DB_URL: \${{ secrets.SUPABASE_DB_URL }}
          P: \${{ secrets.BACKUP_PASSPHRASE }}
        run: |
          NOM="base-$(date +%F).dump"
          pg_dump "$DB_URL" -f "$NOM"
          gpg --batch --symmetric -o "$NOM.gpg" "$NOM"
          echo "C=$NOM.gpg" >> "$GITHUB_ENV"
      - uses: actions/upload-artifact@v4
        with:
          name: d
          path: \${{ env.C }}
`;
    const v = analyser(wf('x.yml', t), avec({ ARTEFACTS: { 'x.yml › d': { nature: 'chiffre', raison: 'x' } }, CONTACTS_PROD: { 'x.yml › x › Exporter': { affiche: 'x' } } })).violations;
    expect(v).toEqual([]);
  });

  it('A · « metadonnees » dont la requête lit une table de données rougit', () => {
    const t = EXPORT_CLAIR.replace('select email from profiles', 'x').replace('-c "x"', '-f q.sql').replace(/users\.csv/g, 'intro.json')
      .replace('run: |', 'run: |\n          node gen.mjs --print-sql > q.sql');
    const v = analyser(
      wf('x.yml', t),
      avec({
        ARTEFACTS: { 'x.yml › users': { nature: 'metadonnees', raison: 'x', requete: 'SELECT email FROM public.profiles', produitPar: 'gen.mjs --print-sql' } },
        CONTACTS_PROD: { 'x.yml › x › Extraire': { affiche: 'x' } },
      }),
    ).violations;
    expect(v.some((x) => /« metadonnees » mais sa requête lit public\.profiles/.test(x))).toBe(true);
  });

  it('B · une étape au contact de la prod non déclarée rougit ; un secret inconnu aussi', () => {
    const t = EXPORT_CLAIR.replace('DB_URL: ${{ secrets.SUPABASE_DB_URL }}', 'DB_URL: ${{ secrets.SUPABASE_DB_URL }}\n          Z: ${{ secrets.PROD_LECTURE }}');
    const v = analyser(wf('x.yml', t), avec({ ARTEFACTS: { 'x.yml › users': { nature: 'metadonnees', raison: 'x' } } })).violations;
    expect(v.some((x) => /x\.yml › x › Extraire : reçoit SUPABASE_DB_URL sans être déclarée/.test(x))).toBe(true);
    expect(v.some((x) => /secret `PROD_LECTURE` non classé/.test(x))).toBe(true);
  });

  it('B · set -x dans une étape au contact de la prod rougit', () => {
    const t = EXPORT_CLAIR.replace('run: |', 'run: |\n          set -x');
    const v = analyser(wf('x.yml', t), avec({ CONTACTS_PROD: { 'x.yml › x › Extraire': { affiche: 'x' } } })).violations;
    expect(v.some((x) => /trace shell/.test(x))).toBe(true);
  });

  const journal = (script) => `
name: j
on: workflow_dispatch
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - name: Lire
        env:
          DB_URL: \${{ secrets.DRILL_DB_URL }}
        run: |
${script.split('\n').map((l) => `          ${l}`).join('\n')}
`;
  const jv = (script) => analyser(wf('j.yml', journal(script)), avec({ CONTACTS_PROD: { 'j.yml › j › Lire': { affiche: 'x' } } })).violations;

  it('C · psql sans fichier de sortie rougit, même dans une variable', () => {
    expect(jv('psql "$DB_URL" -c "select email from profiles"').some((x) => /sortie part au journal/.test(x))).toBe(true);
    expect(jv('X=$(psql "$DB_URL" -tA -c "select 1")').some((x) => /sortie part au journal/.test(x))).toBe(true);
    expect(jv('psql "$DB_URL" -f q.sql > o.txt | tee x').some((x) => /sortie part au journal/.test(x))).toBe(true);
  });

  it('C · un fichier de requête AFFICHÉ rougit si son SQL lit des données, passe si ce sont des comptes', () => {
    const lit = "psql \"$DB_URL\" -tA <<'SQL' > v.txt\nSELECT email, created_at FROM public.profiles;\nSQL\ncat v.txt";
    expect(jv(lit).some((x) => /affiche `v\.txt`, sortie d'une requête qui lit des données : public\.profiles/.test(x))).toBe(true);
    const compte = "psql \"$DB_URL\" -tA -F'|' <<'SQL' > v.txt\nSELECT 'profiles', count(*) FROM public.profiles\nUNION ALL SELECT 'tasks', count(*) FROM public.tasks;\nSQL\ncat v.txt\nT=$(grep '^tasks|' v.txt | cut -d'|' -f2)";
    expect(jv(compte)).toEqual([]);
    const copie = "psql \"$DB_URL\" <<'SQL' > v.txt\nCOPY public.profiles TO STDOUT;\nSQL\ntail v.txt";
    expect(jv(copie).some((x) => /COPY, TABLE ou RETURNING/.test(x))).toBe(true);
  });

  it('C · un affichage dans un echo compte ; une capture affectée à une variable, non', () => {
    const base = "psql \"$DB_URL\" -tA <<'SQL' > v.txt\nSELECT email FROM public.profiles;\nSQL\n";
    expect(jv(`${base}echo "liste : $(cat v.txt)"`).some((x) => /affiche `v\.txt`/.test(x))).toBe(true);
    expect(jv(`${base}N=$(wc -l < v.txt)\nZ=$(grep -c x v.txt)`)).toEqual([]);
  });

  it('C · pg_dump vers stdout, pg_restore sans destination, dump déchiffré affiché : rouge', () => {
    expect(jv('pg_dump "$DB_URL" | gzip > d.gz').some((x) => /pg_dump vers la sortie standard/.test(x))).toBe(true);
    expect(jv('pg_restore d.dump').some((x) => /pg_restore sans base ni fichier/.test(x))).toBe(true);
    expect(jv('gpg --batch -o d.dump -d d.dump.gpg\nhead -c 4000 d.dump').some((x) => /un dump de la prod, au journal/.test(x))).toBe(true);
    expect(jv('pg_restore --list d.dump | head -5')).toEqual([]);
  });

  it('C · un journal d erreurs de pg_restore affiché exige sa déclaration', () => {
    const s = 'pg_restore --dbname "$DB_URL" d.dump 2> r.log\ngrep "^pg_restore: error" r.log | head -40';
    expect(jv(s).some((x) => /affiche `r\.log`, écrit par un client SQL/.test(x))).toBe(true);
    const ok = analyser(
      wf('j.yml', journal(s)),
      avec({ CONTACTS_PROD: { 'j.yml › j › Lire': { affiche: 'x', fichiersAffiches: { 'r.log': 'messages du serveur' } } } }),
    ).violations;
    expect(ok).toEqual([]);
  });

  it('D · git push depuis un job au contact de la prod rougit sans déclaration', () => {
    expect(jv('psql "$DB_URL" -tA -c "select 1" > v.txt\ngit add v.txt && git commit -m x && git push').some((x) => /canal public/.test(x))).toBe(true);
    expect(jv('gh issue comment 1 --body "$(cat v.txt)"').some((x) => /canal public/.test(x))).toBe(true);
  });

  it('E · « artefact … non public » rougit ; la même phrase citée entre « » ne rougit pas', () => {
    expect(affirmationsNonPublic('# Elle reste un artefact de run, donc non public.\nname: x')).toHaveLength(1);
    expect(affirmationsNonPublic('# le dépôt est PUBLIC, mais les artefacts d un run ne le sont pas\nx: 1')).toHaveLength(1);
    expect(affirmationsNonPublic("# Cette ligne affirmait l'inverse (« les artefacts\n# ne le sont pas »)\nx: 1")).toHaveLength(0);
    expect(affirmationsNonPublic('# les artefacts ne sont pas commités\nx: 1')).toHaveLength(0);
  });

  it('déclarations périmées : une entrée sans objet rougit', () => {
    const v = analyser([], avec({ ARTEFACTS: { 'z.yml › z': { nature: 'sans-prod', raison: 'x' } } })).violations;
    expect(v).toEqual(['z.yml › z : déclaration périmée, aucun dépôt ne porte ce nom']);
  });

  it('le parseur ne rate pas un dépôt écrit entre guillemets ; un upload hors job est signalé', () => {
    const t = `
name: q
on: push
jobs:
  q:
    runs-on: ubuntu-latest
    steps:
      - uses: "actions/upload-artifact@v4"
        with: { name: r, path: rapport/ }
`;
    const v = analyser(wf('q.yml', t), vide).violations;
    expect(v.some((x) => /q\.yml › r : dépôt d'artefact absent/.test(x))).toBe(true);
    expect(v.some((x) => /lue\(s\) par le parseur/.test(x))).toBe(false);
  });
});
