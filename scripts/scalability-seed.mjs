// ═══════════════════════════════════════════════════════════════════
// scalability-seed.mjs — le jeu de donnees partage des mesures de scalabilite
//
// ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────
//
// Deux harnais mesurent la meme organisation sous deux angles :
// `scalability-volume.mjs` (le VOLUME, §9ter) et
// `scalability-concurrency.mjs` (la CONCURRENCE, §9quater). Les laisser
// semer chacun de leur cote produirait deux organisations differentes sous le
// meme nom, et deux mesures qu'on croirait comparables sans qu'elles le
// soient. Le semis est donc ici, une fois.
//
// 🔴 En instructions SEQUENTIELLES, jamais en une seule CTE modifiante. Les
// triggers de validation de ces tables (`validate_org_manager`,
// `validate_team_membership`, `validate_project_team`) LISENT les tables qu'on
// vient de remplir ; or les lignes ecrites par une CTE modifiante ne sont pas
// visibles d'une lecture de table dans la meme instruction, toutes les branches
// partageant un instantane. Le semis « elegant » en un seul WITH echouerait
// donc sur ses propres gardes, et le message ne dirait pas pourquoi.
// ═══════════════════════════════════════════════════════════════════

/** Somme recursive d'un compteur sur tous les nœuds d'un plan EXPLAIN JSON. */
export function walkPlan(node, visit) {
  visit(node);
  for (const child of node.Plans ?? []) walkPlan(child, visit);
}

/**
 * Refuse de tourner ailleurs que sur une base LOCALE.
 *
 * Ces scripts ECRIVENT, et beaucoup : les laisser pointer une base reelle par
 * accident est le seul degat qu'ils puissent causer. Une base Supabase hebergee
 * porte toujours un hote `*.supabase.co` ou `*.pooler.supabase.com`.
 */
export function assertDisposable(dbUrl, force) {
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(dbUrl);
  if (isLocal || force) return;
  console.error(
    'DATABASE_URL ne pointe pas une base locale. Ce script ECRIT des milliers de lignes.\n' +
      'Relancer avec --i-know-this-is-not-production seulement si la base est jetable.',
  );
  process.exit(2);
}

/**
 * Seme une organisation realiste : pyramide manageriale sur trois niveaux,
 * 5 equipes, 20 projets RATTACHES a des equipes.
 *
 * Rend, en plus des identifiants d'acteurs, la LISTE COMPLETE des membres :
 * le harnais de concurrence en a besoin pour faire jouer N acteurs DISTINCTS.
 * Faire marteler la meme ligne par N sessions mesurerait la contention sur un
 * seul cache d'autorisation, pas la charge d'une organisation.
 */
export async function seedOrg(client, members, log = console.log) {
  // 🔴 Un NONCE par semis, pas un compteur global. Les deux harnais tournent
  // dans le MEME job, donc sur la meme base : sans lui, le second semis meurt
  // sur `users_email_partial_key` (23505) parce que le premier a deja pose
  // `volume0001@exemple.test`. C'est arrive au premier run, et l'echec ne
  // disait pas « deux semis », il disait « cle dupliquee ».
  const nonce = Math.random().toString(36).slice(2, 8);
  log(`Semis (${nonce}) : 1 organisation, ${members} membres, 5 equipes, 20 projets.`);

  const { rows: people } = await client.query(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                             created_at, updated_at, raw_user_meta_data)
     SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'volume-' || $2 || '-' || lpad(i::text, 4, '0') || '@exemple.test',
            '', now(), now(), '{}'::jsonb
     FROM generate_series(1, $1) AS i
     RETURNING id`,
    [members, nonce],
  );
  const ids = people.map((r) => r.id);

  const { rows: orgRows } = await client.query(
    `INSERT INTO public.organizations (name, join_code, owner_id)
     VALUES ('Organisation de volume ' || $2, 'VOL' || substr(md5(random()::text), 1, 5), $1)
     RETURNING id`,
    [ids[0], nonce],
  );
  const orgId = orgRows[0].id;

  // L'admin d'abord : la pyramide se valide contre des membres deja presents.
  await client.query(
    `INSERT INTO public.organization_members (org_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [orgId, ids[0]],
  );

  // Puis les managers de niveau 2, puis les feuilles. Trois niveaux : sans
  // profondeur, get_subtree() rendrait un arbre degenere et la mesure porterait
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

  // Projets RATTACHES a une equipe : c'est la branche couteuse du predicat. Un
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
    // Les feuilles seulement : un membre simple est le cas le plus frequent, et
    // son sous-arbre est vide, donc le moins favorable au chemin direct.
    member_ids: leaves,
    manager_ids: managers,
    all_ids: ids,
    projets: projects.length,
    membres: ids.length,
  };
}

/** Remplit `team_tasks` jusqu'a `target` lignes pour cette organisation. */
export async function fillTo(client, orgId, target) {
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
