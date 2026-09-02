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

// Garde-fou : localhost/127.0.0.1 uniquement. Une base Supabase hébergée porte
// toujours un hôte `*.supabase.co` ou `*.pooler.supabase.com`.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB_URL);
if (!isLocal && !FORCE) {
  console.error(
    'DATABASE_URL ne pointe pas une base locale. Ce script ECRIT des milliers de lignes.\n' +
      'Relancer avec --i-know-this-is-not-production seulement si la base est jetable.',
  );
  process.exit(2);
}

const client = new pg.Client({ connectionString: DB_URL });

/** Somme récursive d'un compteur sur tous les nœuds d'un plan EXPLAIN JSON. */
function walkPlan(node, visit) {
  visit(node);
  for (const child of node.Plans ?? []) walkPlan(child, visit);
}

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

/**
 * Sème une organisation réaliste.
 *
 * 🔴 En instructions SÉQUENTIELLES, jamais en une seule CTE modifiante. Les
 * triggers de validation de ces tables (`validate_org_manager`,
 * `validate_team_membership`, `validate_project_team`) LISENT les tables qu'on
 * vient de remplir ; or les lignes écrites par une CTE modifiante ne sont pas
 * visibles d'une lecture de table dans la même instruction, toutes les branches
 * partageant un instantané. Le semis « élégant » en un seul WITH échouerait
 * donc sur ses propres gardes, et le message ne dirait pas pourquoi.
 */
async function seed() {
  console.log(`Semis : 1 organisation, ${MEMBERS} membres, 5 equipes, 20 projets.`);

  const { rows: people } = await client.query(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                             created_at, updated_at, raw_user_meta_data)
     SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'volume' || lpad(i::text, 4, '0') || '@exemple.test',
            '', now(), now(), '{}'::jsonb
     FROM generate_series(1, $1) AS i
     RETURNING id`,
    [MEMBERS],
  );
  const ids = people.map((r) => r.id);

  const { rows: orgRows } = await client.query(
    `INSERT INTO public.organizations (name, join_code, owner_id)
     VALUES ('Organisation de volume', 'VOL' || substr(md5(random()::text), 1, 5), $1)
     RETURNING id`,
    [ids[0]],
  );
  const orgId = orgRows[0].id;

  // L'admin d'abord : la pyramide se valide contre des membres déjà présents.
  await client.query(
    `INSERT INTO public.organization_members (org_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [orgId, ids[0]],
  );

  // Puis les managers de niveau 2, puis les feuilles. Trois niveaux : sans
  // profondeur, get_subtree() rendrait un arbre dégénéré et la mesure porterait
  // sur un cas qui n'existe pas chez un vrai client.
  const managers = ids.slice(1, 8);
  for (const m of managers) {
    await client.query(
      `INSERT INTO public.organization_members (org_id, user_id, role, manager_id)
       VALUES ($1, $2, 'member', $3)`,
      [orgId, m, ids[0]],
    );
  }
  const leaves = ids.slice(8);
  for (const [i, leaf] of leaves.entries()) {
    await client.query(
      `INSERT INTO public.organization_members (org_id, user_id, role, manager_id)
       VALUES ($1, $2, 'member', $3)`,
      [orgId, leaf, managers[i % managers.length]],
    );
  }

  const { rows: teams } = await client.query(
    `INSERT INTO public.org_teams (org_id, name)
     SELECT $1, 'Equipe ' || i FROM generate_series(1, 5) AS i
     RETURNING id`,
    [orgId],
  );

  for (const [i, uid] of ids.entries()) {
    await client.query(
      `INSERT INTO public.org_team_members (org_id, team_id, user_id) VALUES ($1, $2, $3)`,
      [orgId, teams[i % teams.length].id, uid],
    );
  }

  // Projets RATTACHÉS à une équipe : c'est la branche coûteuse du prédicat. Un
  // projet `team_id IS NULL` est visible de tout membre sans le moindre calcul,
  // il ne mesurerait rien.
  const { rows: projects } = await client.query(
    `INSERT INTO public.team_projects (org_id, name, team_id)
     SELECT $1, 'Projet ' || i, ($2::uuid[])[1 + (i % 5)]
     FROM generate_series(1, 20) AS i
     RETURNING id`,
    [orgId, teams.map((t) => t.id)],
  );

  return {
    org_id: orgId,
    admin_id: ids[0],
    manager_id: managers[0],
    member_id: ids[ids.length - 1],
    projets: projects.length,
    membres: ids.length,
  };
}

async function fillTo(orgId, target) {
  const { rows } = await client.query(
    'SELECT count(*)::int AS n FROM public.team_tasks WHERE org_id = $1',
    [orgId],
  );
  const missing = target - rows[0].n;
  if (missing <= 0) return;
  await client.query(
    `
    INSERT INTO public.team_tasks (org_id, project_id, name, priority, status)
    SELECT $1,
           p.id,
           'Tache de volume ' || i,
           1 + (i % 4),
           (ARRAY['todo','in_progress','done'])[1 + (i % 3)]
    FROM generate_series(1, $2) AS i
    CROSS JOIN LATERAL (
      SELECT id FROM public.team_projects
       WHERE org_id = $1 ORDER BY id OFFSET (i % 20) LIMIT 1
    ) AS p
    `,
    [orgId, missing],
  );
  await client.query('ANALYZE public.team_tasks');
}

const fmt = (n, d = 2) => (n === null ? 'n/a' : Number(n).toFixed(d));

async function main() {
  await client.connect();
  const ctx = await seed();
  console.log(
    `Organisation ${ctx.org_id} — ${ctx.membres} membres, ${ctx.projets} projets.`,
  );

  const lines = [];
  let previousNodes = null;
  let flip = false;

  for (const step of STEPS) {
    await fillTo(ctx.org_id, step);
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
