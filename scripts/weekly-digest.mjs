// Résumé hebdomadaire envoyé sur le canal d'alerte (Discord), chaque lundi.
// Workflow : .github/workflows/weekly-digest.yml.
//
// Lecture SEULE, dans une transaction READ ONLY : ce script ne peut rien
// écrire, même par erreur. Totaux uniquement, aucune donnée personnelle dans
// le message. Les comptes exclus des statistiques admin
// (`admin_stats_excluded_uids()`, mig. 149) le sont ici aussi.
//
// Variables : DB_URL (secret SUPABASE_DB_URL), WEBHOOK (secret OPS_ALERT_WEBHOOK_URL).
// `--dry-run` affiche le message sans l'envoyer.
import pg from 'pg';
import { deliver } from './ops-alert.mjs';

const fmt = new Intl.NumberFormat('fr-FR');

/** Variation en %, ou null quand la semaine précédente est vide. */
export function delta(cur, prev) {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

function withDelta(cur, prev) {
  const d = delta(cur, prev);
  return d == null ? fmt.format(cur) : `${fmt.format(cur)} (${d >= 0 ? '+' : ''}${d} %)`;
}

/** Message lisible dans Discord comme dans Slack (texte simple). */
export function buildDigest(m) {
  const lines = [
    `📊 [cosmo] Semaine du ${m.from} au ${m.to}`,
    `• Inscriptions : ${withDelta(m.signups, m.signupsPrev)}`,
    `• Utilisateurs actifs sur 7 jours : ${fmt.format(m.active7d)} sur ${fmt.format(m.users)} comptes`,
  ];
  if (m.traffic) {
    const conv = m.traffic.visitors > 0 ? Math.round((m.signups / m.traffic.visitors) * 1000) / 10 : null;
    lines.push(`• Visiteurs (pages publiques) : ${withDelta(m.traffic.visitors, m.traffic.visitorsPrev)}`);
    lines.push(`• Pages vues : ${fmt.format(m.traffic.pageviews)}`);
    if (conv != null) lines.push(`• Conversion visiteurs → inscriptions : ${fmt.format(conv)} %`);
  } else {
    lines.push('• Trafic : mesure maison pas encore en place (mig. 222)');
  }
  lines.push(`• Organisations créées : ${fmt.format(m.orgs)}`);
  lines.push(`• Abonnements payants actifs : ${fmt.format(m.paidSubs)}`);
  return lines.join('\n');
}

export async function collect(client) {
  const one = async (sql) => (await client.query(sql)).rows[0];
  const base = await one(`
    WITH ex AS (SELECT unnest(public.admin_stats_excluded_uids()) AS id),
         u AS (SELECT u.id, u.created_at FROM auth.users u WHERE u.id NOT IN (SELECT id FROM ex))
    SELECT
      to_char(current_date - 7, 'DD/MM') AS "from",
      to_char(current_date - 1, 'DD/MM') AS "to",
      (SELECT count(*) FROM u WHERE created_at >= current_date - 7 AND created_at < current_date)::int AS signups,
      (SELECT count(*) FROM u WHERE created_at >= current_date - 14 AND created_at < current_date - 7)::int AS "signupsPrev",
      (SELECT count(*) FROM u)::int AS users,
      (SELECT count(*) FROM public.profiles p WHERE p.id IN (SELECT id FROM u)
         AND p.last_seen_at >= now() - interval '7 days')::int AS "active7d",
      (SELECT count(*) FROM public.organizations WHERE created_at >= current_date - 7)::int AS orgs,
      ((SELECT count(*) FROM public.subscriptions
         WHERE plan = 'premium' AND status = 'active' AND stripe_subscription_id IS NOT NULL
           AND user_id NOT IN (SELECT id FROM ex))
       + (SELECT count(*) FROM public.org_subscriptions
         WHERE status = 'active' AND stripe_subscription_id IS NOT NULL))::int AS "paidSubs"
  `);

  // Trafic : seulement si la mesure maison existe (mig. 222).
  const hasTraffic = (await one(`SELECT to_regclass('public.traffic_hits') IS NOT NULL AS ok`)).ok;
  let traffic = null;
  if (hasTraffic) {
    // Le sel change chaque jour : un « visiteur » est unique PAR JOUR. On somme donc les uniques quotidiens.
    traffic = await one(`
      SELECT
        (SELECT coalesce(sum(n), 0) FROM (SELECT count(DISTINCT visitor) n FROM public.traffic_hits
           WHERE kind = 'view' AND occurred_at >= current_date - 7 AND occurred_at < current_date
           GROUP BY occurred_at::date) d)::int AS visitors,
        (SELECT coalesce(sum(n), 0) FROM (SELECT count(DISTINCT visitor) n FROM public.traffic_hits
           WHERE kind = 'view' AND occurred_at >= current_date - 14 AND occurred_at < current_date - 7
           GROUP BY occurred_at::date) d)::int AS "visitorsPrev",
        (SELECT count(*) FROM public.traffic_hits
           WHERE kind = 'view' AND occurred_at >= current_date - 7 AND occurred_at < current_date)::int AS pageviews
    `);
  }
  return { ...base, traffic };
}

export async function main(env = process.env, argv = process.argv) {
  const dryRun = argv.includes('--dry-run');
  if (!env.DB_URL) {
    console.log('::warning::SUPABASE_DB_URL absent : aucun résumé produit.');
    return 0;
  }
  if (!dryRun && !env.WEBHOOK) {
    console.log('::warning::OPS_ALERT_WEBHOOK_URL absent : résumé non envoyé.');
    return 0;
  }
  const client = new pg.Client({ connectionString: env.DB_URL });
  await client.connect();
  let message;
  try {
    await client.query('BEGIN READ ONLY');
    message = buildDigest(await collect(client));
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
  // Le dépôt est PUBLIC : le journal de la CI aussi. Le message (chiffres de
  // prod) ne s'affiche donc qu'en local, avec --dry-run ; en CI, seul l'état
  // de l'envoi part au journal.
  if (dryRun) {
    console.log(message);
    return 0;
  }
  const status = await deliver(env.WEBHOOK, message);
  if (status < 200 || status >= 300) {
    console.log(`::error::Envoi du résumé refusé (HTTP ${status}).`);
    return 1;
  }
  console.log('Résumé hebdomadaire envoyé.');
  return 0;
}

// Pas de shebang : un module qui en porte un casse son import par Vitest
// (incident du 2026-09-09). Lancer par `node scripts/weekly-digest.mjs`.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/weekly-digest.mjs')) {
  main().then((code) => process.exit(code), (err) => {
    console.log(`::error::Résumé hebdomadaire : ${err.message}`);
    process.exit(1);
  });
}
