// ═══════════════════════════════════════════════════════════════════
// RLS — permissions explicites par membre (mig. 115)
//
// Ce que ces tests protègent, et pourquoi aucun ne se voit à l'œil nu :
//
//   1. LE DÉFAUT NE CHANGE RIEN. Sans aucune ligne dans
//      `org_member_permissions`, une organisation doit se comporter EXACTEMENT
//      comme avant la migration : manager crée un projet, membre simple non,
//      tout le monde crée une tâche et l'assigne à qui il veut. Une régression
//      ici casse toutes les organisations existantes d'un coup, silencieusement.
//   2. UNE SURCHARGE EST APPLIQUÉE PAR LE SERVEUR, pas par l'écran. Un bouton
//      masqué n'est pas une permission : c'est l'appel PostgREST direct qui
//      doit échouer.
//   3. LE PLAFOND DU DÉLÉGANT TIENT. Un manager qui peut régler les droits de
//      son sous-arbre ne doit pas pouvoir s'en servir pour distribuer un droit
//      qu'il n'a pas — sinon la délégation devient une escalade.
//   4. RIEN NE FUIT VERS UNE ORGANISATION ÉTRANGÈRE (leçon de la mig. 100).
//
// Pyramide de test :
//   patron (admin)
//     └── chef (manager : a un subordonné)
//           └── stagiaire (membre simple)
//   etranger : membre d'aucune de ces organisations
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

describe('RLS — org_member_permissions (mig. 115)', () => {
  let patron: TestUser;
  let chef: TestUser;
  let stagiaire: TestUser;
  let etranger: TestUser;
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    patron = await createTestUser();
    chef = await createTestUser();
    stagiaire = await createTestUser();
    etranger = await createTestUser();

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: 'Org RLS perms', owner_id: patron.id, join_code: `rls-perm-${Date.now()}` })
      .select('id')
      .single();
    if (orgError) throw orgError;
    orgId = org.id as string;

    const { error: memberError } = await admin.from('organization_members').insert([
      { org_id: orgId, user_id: patron.id, role: 'admin' },
      { org_id: orgId, user_id: chef.id, role: 'member', manager_id: patron.id },
      { org_id: orgId, user_id: stagiaire.id, role: 'member', manager_id: chef.id },
    ]);
    if (memberError) throw memberError;

    // Un projet existant : support des tests d'assignation de tâche.
    const { data: project, error: projectError } = await admin
      .from('team_projects')
      .insert({ org_id: orgId, name: 'Projet RLS perms', created_by: patron.id })
      .select('id')
      .single();
    if (projectError) throw projectError;
    projectId = project.id as string;

    // ── Le décor est-il vraiment celui qu'on croit ? ──────────────────
    //
    // ⚠️ Ces quatre vérifications ne testent RIEN du produit : elles décrivent
    // l'état sur lequel tout le fichier repose. Elles existent parce que ce
    // job a échoué pendant des semaines avec « new row violates row-level
    // security policy », un message qui dit qu'une policy a refusé et jamais
    // POURQUOI. Sans elles, un décor faux (rôle non enregistré, `manager_id`
    // perdu, `auth.uid()` absent des fonctions SECURITY DEFINER) se déguise en
    // régression de sécurité, et on cherche le défaut là où il n'est pas.
    //
    // Les deux dernières interrogent le SERVEUR sous le JWT de l'utilisateur :
    // c'est la seule façon de distinguer « la base ne me reconnaît pas comme
    // admin » de « la policy m'a refusé pour une autre raison ».
    const { data: rows } = await admin
      .from('organization_members')
      .select('user_id, role, manager_id')
      .eq('org_id', orgId);
    const decor = Object.fromEntries(
      (rows ?? []).map((r) => [
        r.user_id === patron.id ? 'patron' : r.user_id === chef.id ? 'chef' : 'stagiaire',
        { role: r.role, manager: r.manager_id === chef.id ? 'chef' : r.manager_id === patron.id ? 'patron' : r.manager_id },
      ]),
    );
    expect(decor, 'les trois adhésions doivent être enregistrées telles quelles').toEqual({
      patron: { role: 'admin', manager: null },
      chef: { role: 'member', manager: 'patron' },
      stagiaire: { role: 'member', manager: 'chef' },
    });

    const { data: patronAdmin, error: patronAdminError } = await patron.client.rpc('is_org_admin', { p_org: orgId });
    expect(patronAdminError).toBeNull();
    expect(patronAdmin, 'la base doit reconnaître `patron` comme admin de son organisation').toBe(true);

    const { data: chefManager, error: chefManagerError } = await chef.client.rpc('is_org_manager', { p_org: orgId });
    expect(chefManagerError).toBeNull();
    expect(chefManager, 'la base doit dériver `chef` comme manager, il a un subordonné').toBe(true);
  });

  afterAll(async () => {
    await admin.from('organizations').delete().eq('id', orgId);
    await deleteTestUsers(patron, chef, stagiaire, etranger);
  });

  // ─── 1. Les défauts reproduisent l'avant-migration ─────────────────

  describe('sans aucune surcharge', () => {
    it('un manager crée un projet', async () => {
      // ── Les deux moitiés du WITH CHECK, isolées ───────────────────────
      //
      // La policy d'insertion vaut
      // `my_org_perm(org_id, 'project.create') AND created_by = auth.uid()`.
      // Un refus renvoie « new row violates row-level security policy » sans
      // jamais dire LAQUELLE des deux moitiés a dit non — et les deux mènent à
      // des diagnostics opposés : un droit mal dérivé côté base, ou une
      // identité de session qui n'est pas celle qu'on croit. On les sépare donc
      // ici, une fois, dans le premier test qui insère.
      const { data: perm } = await chef.client.rpc('my_org_perm', {
        p_org: orgId,
        p_key: 'project.create',
      });
      expect(perm, '`chef` a un subordonné : la base doit lui accorder project.create').toBe(true);

      const { data: session } = await chef.client.auth.getUser();
      expect(session.user?.id, "l'identité du JWT doit être celle qu'on écrit dans created_by").toBe(chef.id);

      const { data, error } = await chef.client
        .from('team_projects')
        .insert({ org_id: orgId, name: 'Projet du chef', created_by: chef.id })
        .select('id')
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      await admin.from('team_projects').delete().eq('id', data!.id as string);
    });

    it('un membre simple ne crée PAS de projet', async () => {
      const { error } = await stagiaire.client
        .from('team_projects')
        .insert({ org_id: orgId, name: 'Projet interdit', created_by: stagiaire.id })
        .select('id');

      expect(error).not.toBeNull();
    });

    it('un membre simple crée une tâche et l’assigne à n’importe qui', async () => {
      const { data, error } = await stagiaire.client
        .from('team_tasks')
        .insert({
          org_id: orgId,
          project_id: projectId,
          name: 'Tâche du stagiaire',
          created_by: stagiaire.id,
          assignee_ids: [patron.id],
        })
        .select('id')
        .single();

      expect(error).toBeNull();
      await admin.from('team_tasks').delete().eq('id', data!.id as string);
    });
  });

  // ─── 2. Une surcharge est appliquée par le serveur ─────────────────

  describe('surcharges', () => {
    afterAll(async () => {
      await admin.from('org_member_permissions').delete().eq('org_id', orgId);
    });

    it('accorder `project.create` à un membre simple le laisse créer', async () => {
      const { error: grantError } = await patron.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: stagiaire.id, can_create_project: true });
      expect(grantError).toBeNull();

      const { data, error } = await stagiaire.client
        .from('team_projects')
        .insert({ org_id: orgId, name: 'Projet accordé', created_by: stagiaire.id })
        .select('id')
        .single();

      expect(error).toBeNull();
      await admin.from('team_projects').delete().eq('id', data!.id as string);
    });

    it('retirer `task.create` à un membre bloque la création de tâche', async () => {
      await patron.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: stagiaire.id, can_create_task: false });

      const { error } = await stagiaire.client
        .from('team_tasks')
        .insert({
          org_id: orgId,
          project_id: projectId,
          name: 'Tâche refusée',
          created_by: stagiaire.id,
        })
        .select('id');

      expect(error).not.toBeNull();
    });

    it('une portée `{self}` autorise soi-même et refuse un collègue', async () => {
      await patron.client.from('org_member_permissions').upsert({
        org_id: orgId,
        user_id: stagiaire.id,
        can_create_task: true,
        assign_targets: ['self'],
      });

      const { data: mine, error: mineError } = await stagiaire.client
        .from('team_tasks')
        .insert({
          org_id: orgId,
          project_id: projectId,
          name: 'Pour moi',
          created_by: stagiaire.id,
          assignee_ids: [stagiaire.id],
        })
        .select('id')
        .single();
      expect(mineError).toBeNull();

      const { error: othersError } = await stagiaire.client
        .from('team_tasks')
        .insert({
          org_id: orgId,
          project_id: projectId,
          name: 'Pour le patron',
          created_by: stagiaire.id,
          assignee_ids: [patron.id],
        })
        .select('id');
      expect(othersError).not.toBeNull();

      // Retirer un assigné reste toujours permis : le serveur ne contrôle que
      // les AJOUTS, sinon une tâche héritée deviendrait ingérable.
      const { error: clearError } = await stagiaire.client
        .from('team_tasks')
        .update({ assignee_ids: [] })
        .eq('id', mine!.id as string)
        .select('id');
      expect(clearError).toBeNull();

      await admin.from('team_tasks').delete().eq('id', mine!.id as string);
    });

    it('une portée vide ne laisse assigner à personne, pas même à soi', async () => {
      await patron.client.from('org_member_permissions').upsert({
        org_id: orgId,
        user_id: stagiaire.id,
        can_create_task: true,
        assign_targets: [],
      });

      const { error } = await stagiaire.client
        .from('team_tasks')
        .insert({
          org_id: orgId,
          project_id: projectId,
          name: 'Sans personne',
          created_by: stagiaire.id,
          assignee_ids: [stagiaire.id],
        })
        .select('id');

      expect(error).not.toBeNull();
    });

    it('un admin garde tous ses droits même surchargé à false', async () => {
      // La garde refuse la ligne : un admin détient tout par construction, et
      // une ligne le visant serait un réglage affiché sans effet réel.
      const { error: guardError } = await patron.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: patron.id, can_create_project: false });
      expect(guardError).not.toBeNull();

      const { data, error } = await patron.client
        .from('team_projects')
        .insert({ org_id: orgId, name: 'Projet du patron', created_by: patron.id })
        .select('id')
        .single();
      expect(error).toBeNull();
      await admin.from('team_projects').delete().eq('id', data!.id as string);
    });
  });

  // ─── 3. Le plafond du délégant ─────────────────────────────────────

  describe('plafond du délégant', () => {
    afterAll(async () => {
      await admin.from('org_member_permissions').delete().eq('org_id', orgId);
    });

    it('un manager règle les permissions de son sous-arbre', async () => {
      const { error } = await chef.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: stagiaire.id, can_create_task: false })
        .select('user_id');

      expect(error).toBeNull();
    });

    it('un manager ne règle PAS les permissions hors de son sous-arbre', async () => {
      // `chef` n'est pas au-dessus de lui-même : il ne peut pas s'auto-servir.
      const { data } = await chef.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: chef.id, can_create_project: true })
        .select('user_id');

      expect(data ?? []).toEqual([]);
    });

    it('un manager n’accorde pas un droit qu’il n’a pas lui-même', async () => {
      // On retire d'abord `project.create` au chef, puis il tente de le donner.
      await patron.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: chef.id, can_create_project: false });

      const { error } = await chef.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: stagiaire.id, can_create_project: true })
        .select('user_id');

      expect(error).not.toBeNull();
    });

    it('un membre simple ne règle les permissions de personne', async () => {
      const { data } = await stagiaire.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: chef.id, can_create_project: true })
        .select('user_id');

      expect(data ?? []).toEqual([]);
    });
  });

  // ─── 4. Aucune fuite hors de l'organisation ────────────────────────

  describe('isolation', () => {
    it('un utilisateur extérieur ne lit aucune permission', async () => {
      await patron.client
        .from('org_member_permissions')
        .upsert({ org_id: orgId, user_id: stagiaire.id, can_create_task: false });

      const { data, error } = await etranger.client
        .from('org_member_permissions')
        .select('user_id')
        .eq('org_id', orgId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
      await admin.from('org_member_permissions').delete().eq('org_id', orgId);
    });

    it('un client anonyme ne lit rien', async () => {
      const { data } = await anonClient
        .from('org_member_permissions')
        .select('user_id')
        .eq('org_id', orgId);

      expect(data ?? []).toEqual([]);
    });

    it('`my_org_perm` sur une organisation étrangère renvoie toujours false', async () => {
      const { data, error } = await etranger.client.rpc('my_org_perm', {
        p_org: orgId,
        p_key: 'task.create',
      });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('`can_assign_to` sur une organisation étrangère renvoie false', async () => {
      const { data, error } = await etranger.client.rpc('can_assign_to', {
        p_org: orgId,
        p_target: patron.id,
      });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });
});
