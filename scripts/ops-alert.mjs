// ═══════════════════════════════════════════════════════════════════
// ops-alert.mjs · POUSSER L'ALERTE, ET ECHOUER QUAND ELLE N'EST PAS PARTIE
//
// Appele par `.github/workflows/ci-alert.yml`, sur deux evenements :
//   · `workflow_run`      — une garde est passee au rouge sur `main` ;
//   · `workflow_dispatch` — l'exercice a blanc du canal, sans incident.
//
// 🔴 POURQUOI CE FICHIER EXISTE, ALORS QUE C'ETAIT DIX LIGNES DE SHELL
//
// Les dix lignes de shell sortaient en 0 dans deux cas ou RIEN n'etait
// arrive dans le salon : secret absent (`::warning::` + `exit 0`) et
// webhook qui refuse (`::warning::`). C'est le motif exact retire
// d'`uptime.yml` le 2026-09-03 puis de `renewal-notice.yml` le 09-04, et il
// etait reste dans le seul fichier dont le metier EST d'alerter.
//
// L'ancien commentaire le justifiait ainsi : « on ne peut pas alerter sur
// l'alerting ». C'est faux depuis qu'on s'en sert : un job ROUGE est
// precisement l'alerte sur l'alerting — GitHub notifie l'echec d'un run sur
// son propre depot. Le vert, lui, ne notifie rien.
//
// ❌ Ne jamais rendre une garde conditionnelle a la presence de son propre
//    secret. Secret absent = echec, jamais un avertissement dans un run vert.
// ⚠️ L'ecriture de l'issue `ci-red` est une ETAPE SEPAREE, qui tourne avant
//    celle-ci : echouer ici ne fait perdre aucun filet.
// ⚠️ En shell, ce fichier n'aurait pas eu de temoin jouable — d'ou le
//    module Node. Temoin : `scripts/ops-alert.guard.test.mjs`.
//
// 🔴 PAS DE SHEBANG : le temoin importe ce module, et la chaine Vite/vitest
//    ne retire pas le shebang que Node retire (incident du 2026-09-09, qui a
//    emporte les 2 205 autres tests). Invoquer par `node scripts/ops-alert.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { appendFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Le corps envoye couvre Slack (`text`) et Discord (`content`) sans savoir
 *  lequel est branche — meme format que `opsAlert()` des Edge Functions. */
export function buildMessage({ event, wf, sha, runUrl }) {
  if (event === 'workflow_dispatch') {
    // Un exercice DOIT se lire comme un exercice : sinon un test finit par
    // etre pris pour une panne, ou pire, une vraie panne pour un test.
    return (
      "✅ [cosmo/ci] Test du canal d'alerte, aucun incident. " +
      'Si vous lisez ceci dans Discord, les echecs de CI ' +
      'et de Edge deploy drift arriveront ici.'
    );
  }
  const court = String(sha ?? '').slice(0, 7);
  return `🚨 [cosmo/ci] ${wf} en echec sur main (${court}) : ${runUrl}`;
}

/** Un seul POST. Rend le code HTTP, ou 0 si aucune reponse n'a ete obtenue. */
export async function deliver(url, message, timeoutMs = 10_000) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status;
  } catch {
    // Hote injoignable, DNS mort, delai depasse : aucun code HTTP. On ne
    // confond pas « pas de reponse » avec « refus », mais les deux sont des
    // non-livraisons.
    return 0;
  }
}

/**
 * Decide ET envoie. Rend `{ exit, lines }` plutot que de sortir lui-meme,
 * pour que le temoin puisse l'executer sans tuer le process de test.
 *
 * ⚠️ `lines` ne doit JAMAIS contenir l'URL du webhook : les annotations d'un
 * run sont publiques sur un depot public.
 */
export async function run(env, { retries = 3, delayMs = 2000 } = {}) {
  const lines = [];
  const webhook = (env.WEBHOOK ?? '').trim();
  const event = env.GITHUB_EVENT_NAME ?? 'workflow_run';

  if (!webhook) {
    lines.push(
      '::error::Secret OPS_ALERT_WEBHOOK_URL absent : AUCUNE alerte poussee. ' +
        "Ce n'est pas un avertissement, c'est l'echec du canal d'alerte. " +
        "Seule l'issue ci-red est ecrite, et c'est precisement le canal qui n'a pas " +
        'ete lu pendant 4 jours (2026-08-29 au 09-01). ' +
        'Le poser : Settings → Secrets and variables → Actions.',
    );
    return { exit: 1, lines };
  }

  const message = buildMessage({ event, wf: env.WF, sha: env.SHA, runUrl: env.RUN_URL });

  let code = 0;
  for (let essai = 1; essai <= retries; essai += 1) {
    code = await deliver(webhook, message);
    if (code >= 200 && code < 300) {
      lines.push(`Alerte poussee (HTTP ${code})`);
      return { exit: 0, lines };
    }
    lines.push(`Tentative ${essai}/${retries} refusee (HTTP ${code || 'aucune reponse'})`);
    if (essai < retries && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  lines.push(
    `::error::Le webhook ops n'a pas accepte l'alerte apres ${retries} tentatives ` +
      `(derniere reponse : HTTP ${code || 'aucune'}). Le canal est MORT : un webhook Discord ` +
      "supprime rend 404, et l'alerte disparait en silence. " +
      (event === 'workflow_dispatch'
        ? "L'exercice a blanc ECHOUE : rien n'est arrive dans le salon."
        : "L'issue ci-red reste le seul filet, celui qu'on sait non lu."),
  );
  return { exit: 1, lines };
}

// ─── Plomberie partagee par les gardes de `scripts/` (MAI-02) ───────────
// Rien ici ne juge : chaque garde garde son verdict. Importee par une quinzaine de scripts.

/** Vrai quand le module `metaUrl` est le script lancé en ligne de commande (pas importé par un témoin). */
export const estLance = (metaUrl) =>
  Boolean(process.argv[1]) && metaUrl === pathToFileURL(resolve(process.argv[1])).href;

/** Échappe un message pour une commande de workflow : les sauts de ligne la coupent. */
export const echapperAnnotation = (message) =>
  String(message).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** Écrit une annotation GitHub (`::error`, `::warning`, `::notice`) sur UNE ligne. */
export function annoter(niveau, message, proprietes = '') {
  console.log(`::${niveau}${proprietes ? ` ${proprietes}` : ''}::${echapperAnnotation(message)}`);
}

/** Ajoute au résumé d'étape (`GITHUB_STEP_SUMMARY`) ; un résumé est un confort, jamais une condition du verdict. */
export function ecrireResume(texte, env = process.env) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  try {
    appendFileSync(env.GITHUB_STEP_SUMMARY, texte);
  } catch {
    /* le résumé ne décide de rien */
  }
}

/** Appel JSON sur l'API REST de GitHub (`repos/<repo><chemin>`). `204` rend `null`. */
export async function apiGitHub(chemin, { token, repo, methode = 'GET', corpsJson, fetchImpl = fetch }) {
  const rep = await fetchImpl(`https://api.github.com/repos/${repo}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      ...(corpsJson ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpsJson ? JSON.stringify(corpsJson) : undefined,
  });
  if (!rep.ok) throw new Error(`HTTP ${rep.status} sur ${methode} ${chemin.split('?')[0]}`);
  return rep.status === 204 ? null : rep.json();
}

/** Exécute du SQL via l'API Management de Supabase. Aucune écriture : à l'appelant de ne passer que des lectures. */
export async function interrogerSupabase(sql, { token, projet, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${projet}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`API Management : HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Tous les fichiers sous `racine` (chemins absolus, ordre du système de fichiers).
 * `ignorerDossier(nom)` écarte un sous-arbre, `garder(nom)` filtre les fichiers.
 * Le type vient de la même lecture que le nom (pas de `statSync` entre les deux, CodeQL M-60).
 */
export function parcourirFichiers(racine, { ignorerDossier = () => false, garder = () => true } = {}) {
  const sortie = [];
  const marcher = (rep) => {
    for (const e of readdirSync(rep, { withFileTypes: true })) {
      const chemin = join(rep, e.name);
      if (e.isDirectory()) {
        if (!ignorerDossier(e.name)) marcher(chemin);
      } else if (garder(e.name)) {
        sortie.push(chemin);
      }
    }
  };
  marcher(racine);
  return sortie;
}

// Entree CLI. `import.meta.main` n'existe pas en Node 20 : on compare argv.
if (process.argv[1] && process.argv[1].endsWith('ops-alert.mjs')) {
  const { exit, lines } = await run({
    WEBHOOK: process.env.WEBHOOK,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    WF: process.env.WF,
    SHA: process.env.SHA,
    RUN_URL: process.env.RUN_URL,
  });
  for (const l of lines) console.log(l);
  process.exit(exit);
}
