// ═══════════════════════════════════════════════════════════════════
// RLS — `org_invitations` : lecture restreinte aux concernés (mig. 130)
//
// CE QUE CE FICHIER PROUVE, ET POURQUOI IL N'EXISTAIT PAS
//
// La mig. `130` a été écrite le 2026-08-27 avec, en pied de fichier, une
// « vérification après application » en commentaire : trois requêtes à jouer
// à la main dans trois rôles. Un commentaire n'est pas une vérification. Tant
// que personne ne les joue, la migration repose sur une relecture de son
// propre `USING`, ce qui est exactement la manière dont B-1 (mig. 107) était
// passée : le SQL avait l'air juste.
//
// La règle du dossier est explicite : « une policy réécrite se prouve AVANT
// d'être écrite », et c'est une frontière de sécurité, pas un plan
// d'exécution. Ce fichier joue les trois rôles automatiquement.
//
// AVANT la mig. 130 :  (auth.uid() = invitee_id) OR is_org_member(org_id)
//   → tout collègue lit l'`invitee_id` de TOUTES les invitations de l'org,
//     y compris celles qui ont été REFUSÉES. « Telle personne a refusé de
//     nous rejoindre » devient lisible par toute l'entreprise (RGPD art.
//     5.1.c, minimisation).
//
// APRÈS : le destinataire, l'inviteur, et un admin de l'organisation.
//
// ⚠️ CE TEST EST ROUGE TANT QUE LA MIGRATION N'EST PAS APPLIQUÉE. C'est
// voulu : c'est ce qui distingue « écrite » de « en vigueur ». Le cas
// `membreSimple` échoue avec l'ancienne policy, et lui seul.
//
// PYRAMIDE :
//   patron       admin de l'org, n'invite personne lui-même
//   inviteur     membre simple, émet l'invitation
//   membreSimple membre simple, ni inviteur ni destinataire → ne doit RIEN voir
//   invite       le destinataire (membre d'aucune organisation)
//   etranger     membre d'aucune organisation, témoin d'isolation
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

describe('RLS — org_invitations (mig. 130)', () => {
  let patron: TestUser;
  let inviteur: TestUser;
  let membreSimple: TestUser;
  let invite: TestUser;
  let etranger: TestUser;
  let orgId: string;
  let invitationId: string;
  let refusedId: string;

  beforeAll(async () => {
    patron = await createTestUser();
    inviteur = await createTestUser();
    membreSimple = await createTestUser();
    invite = await createTestUser();
    etranger = await createTestUser();

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: 'Org RLS invites', owner_id: patron.id, join_code: `rls-inv-${Date.now()}` })
      .select('id')
      .single();
    if (orgError) throw orgError;
    orgId = org.id as string;

    const { error: memberError } = await admin.from('organization_members').insert([
      { org_id: orgId, user_id: patron.id, role: 'admin' },
      { org_id: orgId, user_id: inviteur.id, role: 'member', manager_id: patron.id },
      { org_id: orgId, user_id: membreSimple.id, role: 'member', manager_id: patron.id },
    ]);
    if (memberError) throw memberError;

    // Une invitation EN ATTENTE et une REFUSÉE : la seconde est le cas qui
    // motive la migration, une décision individuelle qui n'a aucune raison
    // d'être lisible par les collègues.
    const { data: rows, error: inviteError } = await admin
      .from('org_invitations')
      .insert([
        { org_id: orgId, inviter_id: inviteur.id, invitee_id: invite.id, status: 'pending' },
        { org_id: orgId, inviter_id: inviteur.id, invitee_id: etranger.id, status: 'refused' },
      ])
      .select('id, status');
    if (inviteError) throw inviteError;
    invitationId = rows!.find((r) => r.status === 'pending')!.id as string;
    refusedId = rows!.find((r) => r.status === 'refused')!.id as string;
  });

  afterAll(async () => {
    await admin.from('org_invitations').delete().eq('org_id', orgId);
    await admin.from('organizations').delete().eq('id', orgId);
    await deleteTestUsers(patron, inviteur, membreSimple, invite, etranger);
  });

  // ─── Les trois personnes qui DOIVENT voir ──────────────────────────

  it('le destinataire lit son invitation', async () => {
    const { data, error } = await invite.client
      .from('org_invitations')
      .select('id')
      .eq('id', invitationId);

    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([invitationId]);
  });

  it('l’inviteur lit les invitations qu’il a émises', async () => {
    const { data, error } = await inviteur.client
      .from('org_invitations')
      .select('id')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id).sort()).toEqual([invitationId, refusedId].sort());
  });

  it('un admin de l’organisation les lit toutes', async () => {
    // Il administre la composition de l'organisation : c'est sa fonction, pas
    // une tolérance. Retirer cette branche casserait l'écran des invitations.
    const { data, error } = await patron.client
      .from('org_invitations')
      .select('id')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id).sort()).toEqual([invitationId, refusedId].sort());
  });

  // ─── Celui qui ne doit RIEN voir : le cœur de la migration ─────────

  it('un membre simple ne lit AUCUNE invitation de son organisation', async () => {
    // 🔴 C'est l'assertion qui échoue tant que la mig. 130 n'est pas
    // appliquée : l'ancienne policy rendait ici les deux lignes.
    const { data, error } = await membreSimple.client
      .from('org_invitations')
      .select('id')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it('un membre simple ne lit pas non plus le REFUS d’un tiers', async () => {
    // Formulé à part parce que c'est la donnée personnelle en cause : savoir
    // qu'une personne identifiable a refusé de rejoindre l'entreprise.
    const { data, error } = await membreSimple.client
      .from('org_invitations')
      .select('id, invitee_id')
      .eq('id', refusedId);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  // ─── Isolation, et le rôle anonyme ─────────────────────────────────

  it('un utilisateur d’aucune organisation ne lit rien', async () => {
    // `etranger` est le DESTINATAIRE de l'invitation refusée : il doit voir
    // la sienne, et rien d'autre. C'est le contre-exemple utile, un test qui
    // n'attendrait ici que `[]` masquerait une policy trop restrictive.
    const { data, error } = await etranger.client
      .from('org_invitations')
      .select('id')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).toEqual([refusedId]);
  });

  it('un client anonyme ne lit rien', async () => {
    const { data } = await anonClient.from('org_invitations').select('id').eq('org_id', orgId);

    expect(data ?? []).toEqual([]);
  });

  // ⚠️ L'invariant « une seule policy PERMISSIVE par rôle+action » (mig. 049)
  // n'est PAS retesté ici : `npm run check:rls` le vérifie sur toutes les
  // tables, et une assertion locale qui ne saurait pas lire `pg_policies`
  // depuis un client `authenticated` ne serait qu'une tautologie rassurante.
});
