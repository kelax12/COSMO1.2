#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// scalability-volume.mjs — mesurer le mode entreprise À VOLUME
//
// ── POURQUOI CE SCRIPT EXISTE ──────────────────────────────────────
//
// `docs/SCALABILITY.md` §9bis dit précisément ce qui manque, et pourquoi il
// manquait : le coût PAR LIGNE des prédicats RLS d'entreprise est mesuré et
// confirmé deux fois (rapport de 54× contre `tasks`), mais **le comportement du
// PLANIFICATEUR à volume ne l'est pas**. Un basculement de plan — Index Scan qui
// devient Seq Scan, Hash Join qui devient Nested Loop — ne se déduit d'aucun
// ratio : il se constate, et il exige un vrai jeu de données.
//
// La production compte une dizaine de `team_tasks`. Écrire les 2 000 lignes
// nécessaires en production est interdit par ce dépôt, et à raison. Docker
// n'est pas disponible sur le poste de dev, donc pas de stack locale non plus.
//
// Reste le runner de CI, qui monte DÉJÀ une stack Supabase complète pour le job
// `rls-integration`. C'est là que cette mesure appartient : base jetable,
// volume libre, aucun euro, aucune ligne écrite en production.
//
// ── CE QU'IL FAIT ──────────────────────────────────────────────────
//
//   1. sème une organisation réaliste : 50 membres, une pyramide managériale
//      sur trois niveaux, 5 équipes, 20 projets RATTACHÉS à des équipes ;
//   2. remplit `team_tasks` par paliers (200 puis 2 000 par défaut) ;
//   3. à chaque palier, mesure les DEUX chemins sous le rôle `authenticated`
//      réel, plan chauffé, dans une transaction annulée :
//        • `select * from team_tasks`        → le chemin direct, celui que la
//          mig. 113 interdit, gardé ici comme TÉMOIN ;
//        • `get_my_team_tasks(org)`          → le chemin imposé ;
//   4. rend, pour chacun : buffers, lignes réellement BALAYÉES
//      (`rows` + `Rows Removed by Filter`), le ratio buffers/ligne, et les
//      TYPES DE NŒUD du plan.
//
// ── COMMENT LIRE LE RÉSULTAT ───────────────────────────────────────
//
// 🔴 Le ratio buffers/ligne, jamais le chronomètre. Le §9bis démontre qu'à
// petit volume le temps donne la réponse INVERSE de la bonne : la RPC lit moins
// de buffers ET met 8× plus longtemps, parce que le coût fixe d'un appel de
// fonction domine tant que tout tient en cache. Le temps est affiché pour
// mémoire, il ne décide de rien.
//
// Ce qu'on cherche vraiment ici est ailleurs : **les types de nœud changent-ils
// entre les deux paliers ?** Un ratio qui reste stable pendant que le plan
// bascule est le scénario que personne n'avait encore éliminé.
//
// ── USAGE ──────────────────────────────────────────────────────────
//
//   DATABASE_URL=postgres://... node scripts/scalability-volume.mjs
//   ... --steps=200,2000        # paliers de volume
//   ... --members=50            # taille de l'organisation
//
// ⚠️ Refuse de tourner sur autre chose qu'une base LOCALE, sauf
// `--i-know-this-is-not-production`. Ce script ÉCRIT, et beaucoup : le laisser
// pointer une base réelle par accident est le seul dégât qu'il puisse causer.
// ═══════════════════════════════════════════════════════════════════
import pg from 'pg';
import { assertDisposable, fillTo, seedOrg, walkPlan } from './scalability-seed.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const STEPS = arg('steps', '200,2000').split(',').map((n) => Number(n.trim())).filter(Boolean);
const MEMBERS = Number(arg('members', '50'));
const FORCE = process.argv.includes('--i-know-this-is-not-production');
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL manquante. Ce script attend une base Postgres jetable.');
  process.exit(2);
}

assertDisposable(DB_URL, FORCE);

const client = new pg.Client({ connectionString: DB_URL });

/**
 * Mesure UN chemin de lecture, sous le rôle `authenticated`, plan chauffé.
 *
 * La transaction est annulée : la mesure ne laisse rien derrière elle, même sur
 * une base jetable — c'est la discipline du §10, et elle rend le script
 * rejouable sans remise à zéro.
 */
async function measure(label, sql, uid, params = []) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('role', 'authenticated', true)");
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ]);

    // Deux appels avant la mesure : le premier compile le plan, le second
    // réchauffe le cache. Mesurer le premier, c'est mesurer la compilation.
    await client.query(sql, params);
    await client.query(sql, params);

    const { rows } = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
      params,
    );
    const plan = rows[0]['QUERY PLAN'][0];

    let buffers = 0;
    let scanned = 0;
    const nodes = [];
    walkPlan(plan.Plan, (n) => {
      buffers += (n['Shared Hit Blocks'] ?? 0) + (n['Shared Read Blocks'] ?? 0);
      scanned += (n['Actual Rows'] ?? 0) + (n['Rows Removed by Filter'] ?? 0);
      nodes.push(n['Node Type']);
    });

    return {
      label,
      buffers,
      scanned,
      ratio: scanned > 0 ? buffers / scanned : null,
      ms: plan['Execution Time'],
      returned: plan.Plan['Actual Rows'] ?? 0,
      nodes: [...new Set(nodes)].join(' > '),
    };
  } finally {
    await client.query('ROLLBACK');
  }
}

const fmt = (n, d = 2) => (n === null ? 'n/a' : Number(n).toFixed(d));

async function main() {
  await client.connect();
  const ctx = await seedOrg(client, MEMBERS);
  console.log(
    `Organisation ${ctx.org_id} — ${ctx.membres} membres, ${ctx.projets} projets.`,
  );

  const lines = [];
  let previousNodes = null;
  let flip = false;

  for (const step of STEPS) {
    await fillTo(client, ctx.org_id, step);
    const { rows } = await client.query(
      'SELECT count(*)::int AS n FROM public.team_tasks WHERE org_id = $1',
      [ctx.org_id],
    );
    console.log(`\n── ${rows[0].n} team_tasks ──────────────────────────────`);

    // Le membre simple : le cas le plus fréquent, et celui dont le sous-arbre
    // est vide, donc le moins favorable au chemin direct.
    const direct = await measure(
      `direct ${step}`,
      'SELECT * FROM public.team_tasks',
      ctx.member_id,
    );
    const rpc = await measure(
      `rpc ${step}`,
      'SELECT * FROM public.get_my_team_tasks($1)',
      ctx.member_id,
      [ctx.org_id],
    );
    // Le manager : `get_subtree` a un vrai sous-arbre a parcourir.
    const rpcManager = await measure(
      `rpc manager ${step}`,
      'SELECT * FROM public.get_my_team_tasks($1)',
      ctx.manager_id,
      [ctx.org_id],
    );

    for (const r of [direct, rpc, rpcManager]) {
      console.log(
        `${r.label.padEnd(20)} buffers=${String(r.buffers).padStart(7)} ` +
          `balayees=${String(r.scanned).padStart(7)} ratio=${fmt(r.ratio).padStart(8)} ` +
          `rendues=${String(r.returned).padStart(6)} ${fmt(r.ms)} ms`,
      );
      console.log(`${''.padEnd(20)} plan: ${r.nodes}`);
      lines.push(
        `| ${step} | ${r.label.replace(/ \d+$/, '')} | ${r.buffers} | ${r.scanned} | ` +
          `${fmt(r.ratio)} | ${r.returned} | ${fmt(r.ms)} | \`${r.nodes}\` |`,
      );
    }

    const signature = `${direct.nodes} || ${rpc.nodes}`;
    if (previousNodes !== null && previousNodes !== signature) {
      flip = true;
      console.log('\n⚠️  BASCULEMENT DE PLAN entre deux paliers :');
      console.log(`    avant : ${previousNodes}`);
      console.log(`    apres : ${signature}`);
    }
    previousNodes = signature;
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Scalabilite du mode entreprise — mesure a volume (T-41)',
        '',
        `Organisation de ${MEMBERS} membres, 5 equipes, ${ctx.projets} projets.`,
        '',
        '| Volume | Chemin | Buffers | Lignes balayees | Buffers/ligne | Rendues | ms | Plan |',
        '|---|---|---|---|---|---|---|---|',
        ...lines,
        '',
        flip
          ? '⚠️ **Le plan a change entre deux paliers** — voir les logs.'
          : '✅ **Aucun basculement de plan** entre les paliers mesures.',
        '',
        'Se fier au ratio buffers/ligne, jamais au temps : cf. `docs/SCALABILITY.md` §9bis.',
      ].join('\n') + '\n',
    );
  }

  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await client.end();
  } catch {
    /* la connexion est deja tombee */
  }
  process.exit(1);
});
