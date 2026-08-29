#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// diagnose-rls-state.mjs — décrit l'état RLS RÉEL d'une base fraîche.
//
// POURQUOI CE SCRIPT EXISTE. Le job `rls-integration` échoue depuis des
// semaines sur trois insertions dans `team_projects`, toutes avec le même
// message : « new row violates row-level security policy ». Ce message dit
// qu'une policy a refusé, jamais LAQUELLE ni POURQUOI.
//
// Ce qui a déjà été éliminé, par la mesure et non par raisonnement :
//   • les définitions SQL du dépôt et de la production sont IDENTIQUES
//     (comparées une à une : is_org_admin, is_org_member, is_org_manager,
//     has_subordinates, my_org_perm, la garde de plafond, la policy) ;
//   • le décor est bon sur base vierge (le test l'affirme dans son beforeAll) ;
//   • les DEUX moitiés du WITH CHECK sont vraies quand on les évalue
//     séparément — `my_org_perm(org, 'project.create')` renvoie `true` sous le
//     JWT de l'utilisateur, et l'identité du JWT est bien celle écrite dans
//     `created_by`.
//
// Autrement dit : `A AND B` est refusé alors que A et B sont vrais. Une seule
// famille d'explications survit, et elle porte sur ce que la base contient
// VRAIMENT — une policy qui n'est pas celle du dépôt, une seconde policy, un
// privilège de table manquant. C'est exactement ce que ce script imprime.
//
// ⚠️ Il n'affirme rien et ne teste rien : il DÉCRIT. Un diagnostic qui conclut
// à la place de celui qui lit est un diagnostic qu'on croit sur parole.
//
// Usage : DATABASE_URL=postgres://... node scripts/diagnose-rls-state.mjs
// ═══════════════════════════════════════════════════════════════════
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL manquante');
  process.exit(2);
}

// ⚠️ UNE SEULE annotation, et tout dedans.
//
// GitHub plafonne les annotations à **10 par étape**, silencieusement : au-delà,
// elles disparaissent sans le moindre avertissement. La première version de ce
// script en émettait seize, une par ligne. Les six dernières ont été coupées,
// dont les privilèges de table, les DEFAULT de colonnes et les triggers, et
// c'étaient précisément celles qu'on venait chercher. Un outil de diagnostic
// tronqué est pire qu'un outil absent : il donne l'impression d'avoir regardé.
//
// Les lignes sont donc accumulées puis émises en UNE annotation, les sauts de
// ligne échappés en `%0A`. Le plafond porte sur le NOMBRE d'annotations, pas sur
// la longueur de chacune.
const lignes = [];

function annotate(message) {
  lignes.push(String(message));
}

function flush() {
  if (!lignes.length) return;
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice title=rls-state::${lignes.join('\n').replace(/\r?\n/g, '%0A')}`);
  } else {
    for (const l of lignes) console.log(l);
  }
}

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString });
await client.connect();

try {
  const { rows: policies } = await client.query(`
    SELECT c.relname AS table, p.polname AS name, p.polcmd AS cmd, p.polpermissive AS permissive,
           pg_get_expr(p.polqual, p.polrelid) AS using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname IN ('team_projects', 'team_tasks')
    ORDER BY 1, 2`);
  for (const p of policies) {
    annotate(
      `policy ${p.table}.${p.name} cmd=${p.cmd} permissive=${p.permissive} ` +
        `using=${p.using_expr ?? '-'} check=${p.check_expr ?? '-'}`,
    );
  }

  const { rows: fns } = await client.query(`
    SELECT p.proname AS name, p.prosecdef AS definer,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
           pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('my_org_perm','is_org_admin','is_org_manager','is_org_member','has_subordinates')
    ORDER BY 1`);
  for (const f of fns) {
    annotate(
      `fonction ${f.name} definer=${f.definer} owner=${f.owner} execute_authenticated=${f.authenticated_execute}`,
    );
  }

  // Un privilège de table manquant produit un AUTRE message que la RLS, mais on
  // le relève quand même : c'est deux secondes, et une hypothèse en moins.
  const { rows: grants } = await client.query(`
    SELECT has_table_privilege('authenticated','public.team_projects','INSERT') AS ins,
           has_table_privilege('authenticated','public.team_projects','SELECT') AS sel,
           (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.team_projects'::regclass) AS rls,
           (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.team_projects'::regclass) AS force_rls`);
  const g = grants[0];
  annotate(
    `team_projects: insert_authenticated=${g.ins} select_authenticated=${g.sel} rls=${g.rls} force_rls=${g.force_rls}`,
  );

  // La colonne `created_by` a-t-elle un DEFAULT ou un trigger qui la réécrit ?
  // Si la valeur insérée n'est pas celle relue par le WITH CHECK, la seconde
  // moitié du prédicat devient fausse sans que rien ne le dise.
  const { rows: cols } = await client.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='team_projects'
    ORDER BY ordinal_position`);
  annotate('colonnes team_projects: ' + cols.map((c) => `${c.column_name}${c.column_default ? `=${c.column_default}` : ''}`).join(' · '));

  const { rows: trg } = await client.query(`
    SELECT t.tgname AS name, p.proname AS fn, t.tgtype AS type
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE c.relname = 'team_projects' AND NOT t.tgisinternal ORDER BY 1`);
  annotate('triggers team_projects: ' + (trg.map((t) => `${t.name}->${t.fn}`).join(' · ') || 'aucun'));

  // ── Reproduction, sans l'application, dans une transaction annulée ──────
  //
  // Tout ce qui précède DÉCRIT. Ceci REJOUE : un admin d'organisation qui crée
  // un projet, sous le rôle `authenticated` et avec un `auth.uid()` forgé,
  // exactement comme PostgREST le fait. Les trois valeurs qui décident sont
  // imprimées juste avant l'insertion, puis l'erreur exacte s'il y en a une.
  //
  // C'est le seul moyen de trancher la question ouverte : les deux moitiés du
  // WITH CHECK sont vraies quand on les interroge, et la conjonction refuse.
  // Ou bien ça se reproduit ici, et on tient le fil dans un endroit qu'on
  // contrôle entièrement ; ou bien ça passe, et le défaut n'est pas dans la
  // base mais dans le chemin PostgREST du harnais.
  //
  // ⚠️ ROLLBACK systématique : ce script ne doit jamais laisser une ligne
  // derrière lui, même sur une base jetable. Une transaction annulée est aussi
  // ce qui rend l'insertion dans `auth.users` acceptable — GoTrue n'est pas là
  // pour la faire, et on ne garde rien.
  const uid = '11111111-1111-4111-8111-111111111111';
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
               'diagnose@example.test', now(), now())`,
      [uid],
    );
    const { rows: org } = await client.query(
      `INSERT INTO public.organizations (name, owner_id, join_code)
       VALUES ('diag', $1, 'diag-' || floor(random() * 100000)::text) RETURNING id`,
      [uid],
    );
    const orgId = org[0].id;
    await client.query(
      `INSERT INTO public.organization_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [orgId, uid],
    );

    await client.query(`SET LOCAL ROLE authenticated`);
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ]);

    const { rows: vu } = await client.query(
      `SELECT auth.uid() AS uid,
              public.is_org_admin($1) AS admin,
              public.my_org_perm($1, 'project.create') AS perm`,
      [orgId],
    );
    annotate(`rejeu: auth.uid()=${vu[0].uid} is_org_admin=${vu[0].admin} my_org_perm=${vu[0].perm}`);

    try {
      await client.query(
        `INSERT INTO public.team_projects (org_id, name, created_by) VALUES ($1, 'diag', $2)`,
        [orgId, uid],
      );
      annotate('rejeu: INSERT team_projects ACCEPTE');
    } catch (e) {
      annotate(`rejeu: INSERT team_projects REFUSE ${e.code} ${e.message}`);
    }
  } catch (e) {
    annotate(`rejeu impossible (${e.code ?? '-'}) ${e.message}`);
  } finally {
    await client.query('ROLLBACK');
  }
} finally {
  flush();
  await client.end();
}
