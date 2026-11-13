// ═══════════════════════════════════════════════════════════════════
// check-cron-runs.mjs · LES TRAITEMENTS PLANIFIÉS ONT-ILS TOURNÉ ? (ARC-06, vague 10.2)
//
// Lit `public.cron_runs_verdict()` (mig. 245) en production, dans une
// transaction READ ONLY, et sort en 1 dès qu'un job est `absent` (aucune
// exécution commencée dans sa fenêtre) ou en `echec` (aucune réussie). Le
// rouge du workflow `cron-journal.yml` part sur le canal d'alerte par
// `ci-alert.yml`, comme les autres sondes de production.
//
// 🔴 POURQUOI SUR GITHUB, alors que les traitements ont quitté GitHub :
// une surveillance qui tourne dans pg_cron se tait le jour où pg_cron
// s'arrête, c'est-à-dire le seul jour où on en a besoin. Le retard du cron
// de GitHub ne fausse rien ici : la fenêtre se juge sur les dates écrites
// dans le journal, pas sur l'heure du passage de la sonde.
//
// ❌ Ne jamais rendre cette sonde conditionnelle à son propre secret :
//    `DB_URL` absent = ÉCHEC, jamais un avertissement dans un run vert.
// ❌ Une sélection vide est un ÉCHEC : la fonction rend toujours neuf lignes (six jobs, trois sondes),
//    zéro ligne veut dire qu'on n'a rien mesuré.
// ⚠️ Rien n'est imprimé qui ne soit dans le journal : nom du job, dates,
//    statut, code HTTP. Le journal ne porte ni secret ni donnée utilisateur.
//
// PAS DE SHEBANG (témoin importé par vitest, cf. `scripts/ops-alert.mjs`).
// Témoin : `scripts/check-cron-runs.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

export const VERDICT_SQL = `SELECT job, fenetre::text AS fenetre, dernier_debut, dernier_statut, dernier_code, dernier_ok, verdict
  FROM public.cron_runs_verdict()`;

/** Nombre de jobs d Edge Functions surveillés par `cron_runs_verdict()` (mig. 245). */
export const JOBS_ATTENDUS = 6;

/**
 * Sondes de disponibilité (mig. 252, OBS-02), jugées par le même verdict, fenêtre 20 min.
 * Elles ne sont tenues par aucun `schedule:` GitHub : `absent` y rougit toujours.
 * `absent` = la sonde n a pas tourné ; `echec` = la cible ne répond pas comme attendu.
 */
export const SONDES = ['sonde-auth', 'sonde-guide', 'sonde-site'];

/**
 * Jobs que GitHub ne planifie PLUS (`MISES-EN-SERVICE.md` § 2sexies, étape 8), SOURCE
 * UNIQUE : `src/edge-cron-lease.guard.test.ts` en déduit quels `schedule:` doivent
 * avoir disparu. Bascule en deux temps : un job y entre le jour où son `schedule:`
 * sort, après un premier `ok` dans `cron_runs`.
 * Un job absent de cette liste est encore tenu par GitHub : `absent` n'y est qu'un
 * avertissement (pg_cron n'a pas encore eu sa fenêtre). `echec` rougit pour tous.
 * ❌ Jamais retirer un job de cette liste sans rendre son `schedule:` à GitHub.
 */
export const JOBS_BASCULES = ['org-webhook-dispatch', 'org-digest-hourly'];

const date = (d) => (d ? new Date(d).toISOString().replace('.000Z', 'Z') : 'jamais');

/**
 * Juge les lignes du verdict. Rend `{ exit, lines }` sans sortir lui-même,
 * pour que le témoin l'exécute.
 */
export function juger(rows, bascules = JOBS_BASCULES) {
  const lines = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    lines.push('::error::cron_runs_verdict() ne rend aucune ligne : rien n a ete mesure (mig. 245 absente ?).');
    return { exit: 1, lines };
  }
  let ko = 0;
  for (const r of rows) {
    const resume =
      `${r.job} : ${r.verdict} (fenetre ${r.fenetre}, dernier passage ${date(r.dernier_debut)} ` +
      `${r.dernier_statut ?? '-'}${r.dernier_code != null ? ` HTTP ${r.dernier_code}` : ''}, ` +
      `derniere reussite ${date(r.dernier_ok)})`;
    if (r.verdict === 'ok') {
      lines.push(`ok ${resume}`);
    } else if (SONDES.includes(r.job) && r.verdict === 'absent') {
      ko += 1;
      lines.push(`::error title=sonde ${r.job} n a pas tourne::${resume}. La SONDE est arretee (pg_cron, job cosmo-uptime retire, ou base injoignable) : on ne sait rien du site.`);
    } else if (SONDES.includes(r.job) && r.verdict === 'echec') {
      ko += 1;
      lines.push(`::error title=prod injoignable ${r.job}::${resume}. La sonde tourne et la CIBLE ne repond pas comme attendu (detail dans cron_runs.detail), ou le releve cosmo-cron-runs-close est arrete.`);
    } else if (r.verdict === 'absent' && !bascules.includes(r.job)) {
      lines.push(`::warning title=cron ${r.job} pas encore vu::${resume}. Encore planifie par GitHub : rien n est perdu, pas encore bascule.`);
    } else if (r.verdict === 'absent') {
      ko += 1;
      lines.push(`::error title=cron ${r.job} absent::${resume}. Aucune execution dans la fenetre : pg_cron arrete, job retire ou jamais planifie (mig. 246).`);
    } else if (r.verdict === 'echec') {
      ko += 1;
      lines.push(`::error title=cron ${r.job} en echec::${resume}. Des executions, aucune reussie : secret Vault, fonction en erreur, ou releve cosmo-cron-runs-close arrete.`);
    } else {
      ko += 1;
      lines.push(`::error title=cron ${r.job}::verdict inconnu « ${r.verdict} » : la sonde ne sait pas le lire.`);
    }
  }
  for (const j of bascules) {
    if (!rows.some((r) => r.job === j)) {
      ko += 1;
      lines.push(`::error::${j} est bascule (plus de schedule GitHub) mais cron_runs_verdict() ne le surveille pas.`);
    }
  }
  const total = JOBS_ATTENDUS + SONDES.length;
  if (rows.length !== total) {
    ko += 1;
    lines.push(`::error::${rows.length} job(s) surveille(s) au lieu de ${total} : la sonde et les mig. 245 / 252 ont diverge.`);
  }
  lines.push(`${rows.length - Math.min(ko, rows.length)} job(s) sur ${rows.length} dans leur fenetre.`);
  return { exit: ko > 0 ? 1 : 0, lines };
}

/** Lit le verdict en production. `client` : un `pg.Client` déjà connecté. */
export async function lireVerdict(client) {
  await client.query('BEGIN READ ONLY');
  try {
    const { rows } = await client.query(VERDICT_SQL);
    return rows;
  } finally {
    await client.query('ROLLBACK');
  }
}

export async function run(env, connect) {
  const url = (env.DB_URL ?? '').trim();
  if (!url) {
    return {
      exit: 1,
      lines: ['::error::Secret SUPABASE_DB_URL absent : le journal des crons n est pas lu, aucune absence ne peut etre vue.'],
    };
  }
  let client;
  try {
    client = await connect(url);
    return juger(await lireVerdict(client));
  } catch (err) {
    // Jamais l'URL : elle porte le mot de passe.
    const msg = String(err?.message ?? err).replace(/:\/\/[^@]*@/g, '://***@');
    return { exit: 1, lines: [`::error::Lecture du journal des crons impossible : ${msg}`] };
  } finally {
    await client?.end().catch(() => {});
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-cron-runs.mjs')) {
  const { default: pg } = await import('pg');
  const { exit, lines } = await run(process.env, async (connectionString) => {
    const c = new pg.Client({ connectionString, connectionTimeoutMillis: 30_000 });
    await c.connect();
    return c;
  });
  for (const l of lines) console.log(l);
  process.exit(exit);
}
