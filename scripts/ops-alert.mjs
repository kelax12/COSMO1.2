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

/** Le corps envoye couvre Slack (`text`) et Discord (`content`) sans savoir
 *  lequel est branche — meme format que `opsAlert()` des Edge Functions. */
export function buildMessage({ event, wf, sha, runUrl }) {
  if (event === 'workflow_dispatch') {
    // Un exercice DOIT se lire comme un exercice : sinon un test finit par
    // etre pris pour une panne, ou pire, une vraie panne pour un test.
    return (
      "✅ [cosmo/ci] Test du canal d'alerte, aucun incident. " +
      'Si vous lisez ceci dans Discord, les echecs de CI, de Vendor script watch ' +
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
