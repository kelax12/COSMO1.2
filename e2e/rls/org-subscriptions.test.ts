// ═══════════════════════════════════════════════════════════════════
// RLS — org_subscriptions : lecture réservée aux membres, écriture interdite
// à tout client.
//
// Cette table porte l'état de facturation d'une organisation. Deux propriétés
// doivent tenir, et aucune n'est visible à l'œil nu si elle casse :
//
//   1. Un utilisateur extérieur ne doit rien lire — le palier tarifaire et la
//      date de renouvellement d'une entreprise sont des données commerciales.
//   2. AUCUN client ne doit écrire. La table n'a délibérément pas de policy
//      d'écriture (mig. 101) ; un futur `CREATE POLICY ... FOR UPDATE` posé
//      par inadvertance laisserait n'importe quel membre s'attribuer le palier
//      illimité. C'est un contournement de paiement, pas une fuite.
//
// Note PostgREST : sans policy d'écriture, une UPDATE/DELETE ne lève pas
// toujours une erreur — la clause USING implicite (deny-all) peut simplement
// ne matcher aucune ligne, et PostgREST répond alors avec un tableau vide et
// `error: null`. Un INSERT, lui, doit satisfaire un WITH CHECK qui n'existe
// pas (implicitement `false`), ce qui lève en général une vraie erreur RLS.
// Les trois tests d'écriture ci-dessous ne durcissent donc PAS l'assertion
// sur la forme de l'erreur : ils prouvent l'invariant qui compte — rien n'a
// changé — en relisant l'état via un client UTILISATEUR après coup.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

describe('RLS — org_subscriptions (mig. 101)', () => {
  let membre: TestUser;
  let etranger: TestUser;
  let orgId: string;
  // Deuxième organisation du même membre, SANS ligne org_subscriptions :
  // sert uniquement au test d'INSERT, pour ne pas confondre un refus RLS
  // avec un conflit de clé primaire sur `orgId` (qui a déjà son abonnement).
  let orgSansAboId: string;

  beforeAll(async () => {
    membre = await createTestUser();
    etranger = await createTestUser();

    // Création sous service_role : on teste la LECTURE/ÉCRITURE de la table
    // org_subscriptions, pas le parcours de création d'organisation (couvert
    // ailleurs). `join_code` est NOT NULL UNIQUE sans défaut (mig. 060).
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: 'Org RLS billing', owner_id: membre.id, join_code: `rls-bill-${Date.now()}` })
      .select('id')
      .single();
    if (orgError) throw orgError;
    orgId = org.id as string;

    const { data: org2, error: org2Error } = await admin
      .from('organizations')
      .insert({
        name: 'Org RLS billing 2',
        owner_id: membre.id,
        join_code: `rls-bill2-${Date.now()}`,
      })
      .select('id')
      .single();
    if (org2Error) throw org2Error;
    orgSansAboId = org2.id as string;

    const { error: memberError } = await admin.from('organization_members').insert([
      { org_id: orgId, user_id: membre.id, role: 'admin' },
      { org_id: orgSansAboId, user_id: membre.id, role: 'admin' },
    ]);
    if (memberError) throw memberError;

    const { error: subError } = await admin.from('org_subscriptions').insert({
      org_id: orgId,
      tier_key: 't20',
      max_members: 20,
      status: 'active',
      stripe_customer_id: 'cus_test_rls',
    });
    if (subError) throw subError;
  });

  afterAll(async () => {
    await admin.from('organizations').delete().in('id', [orgId, orgSansAboId]);
    await deleteTestUsers(membre, etranger);
  });

  it('un membre lit l’abonnement de son organisation', async () => {
    const { data, error } = await membre.client
      .from('org_subscriptions')
      .select('tier_key, max_members, status')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].tier_key).toBe('t20');
  });

  it('un utilisateur extérieur ne voit aucune ligne', async () => {
    const { data, error } = await etranger.client
      .from('org_subscriptions')
      .select('tier_key')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('un client anonyme ne voit aucune ligne', async () => {
    const { data } = await anonClient.from('org_subscriptions').select('tier_key').eq('org_id', orgId);

    expect(data ?? []).toEqual([]);
  });

  it('un membre ne peut PAS s’attribuer le palier illimité', async () => {
    // `.select()` force une réponse « avec représentation » : si RLS bloque
    // en filtrant silencieusement (0 ligne matchée par le USING implicite),
    // `data` sera un tableau vide plutôt qu'une absence d'erreur ambiguë.
    const { data } = await membre.client
      .from('org_subscriptions')
      .update({ tier_key: 'tmax', max_members: null })
      .eq('org_id', orgId)
      .select('tier_key, max_members');

    // Propriété qui compte : aucune ligne n'a été rapportée comme modifiée.
    expect(data ?? []).toEqual([]);

    // Vérification indépendante, sous client utilisateur (pas admin) : la
    // valeur en base n'a pas bougé.
    const { data: after } = await membre.client
      .from('org_subscriptions')
      .select('tier_key, max_members')
      .eq('org_id', orgId)
      .single();
    expect(after?.tier_key).toBe('t20');
    expect(after?.max_members).toBe(20);
  });

  it('un membre ne peut PAS insérer d’abonnement', async () => {
    const { data } = await membre.client
      .from('org_subscriptions')
      .insert({ org_id: orgSansAboId, tier_key: 'tmax', max_members: null, status: 'active' })
      .select('org_id');

    expect(data ?? []).toEqual([]);

    const { data: after } = await membre.client
      .from('org_subscriptions')
      .select('org_id')
      .eq('org_id', orgSansAboId);
    expect(after ?? []).toEqual([]);
  });

  it('un membre ne peut PAS supprimer l’abonnement', async () => {
    const { data } = await membre.client
      .from('org_subscriptions')
      .delete()
      .eq('org_id', orgId)
      .select('org_id');

    expect(data ?? []).toEqual([]);

    const { data: after } = await membre.client
      .from('org_subscriptions')
      .select('org_id')
      .eq('org_id', orgId);
    expect(after).toHaveLength(1);
  });
});
