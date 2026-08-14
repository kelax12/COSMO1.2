// ═══════════════════════════════════════════════════════════════════
// RLS — les helpers d'organisation ne sont plus appelables en RPC.
//
// POURQUOI CE FICHIER EXISTE (audit sécurité 2026-08-14)
//
// Les helpers qui portent la RLS du mode entreprise sont `SECURITY DEFINER`,
// donc « sans RLS », et étaient exposés comme RPC PostgREST à tout utilisateur
// authentifié. Aucun ne vérifiait que l'appelant appartenait à l'organisation
// passée en argument. Un utilisateur extérieur obtenait ainsi la liste des
// membres d'une organisation dont il connaissait l'UUID — alors que la lecture
// directe de `organization_members` lui renvoyait bien 0 ligne. La table était
// protégée ; les fonctions la contournaient.
//
// La mig. 100 retire `get_subtree`, `has_subordinates` et `org_admin_count`
// de l'API exposée (REVOKE sur `authenticated`) sans toucher à leur corps :
// dans une fonction `SECURITY DEFINER`, le rôle effectif est le PROPRIÉTAIRE,
// donc les appels internes continuent de fonctionner. C'est ce qui préserve
// `claim_org_invite`, qui les appelle alors que l'utilisateur n'est PAS ENCORE
// membre — une garde `is_org_member()` dans la fonction aurait cassé
// l'invitation d'entreprise.
//
// Une régression serait silencieuse : un futur `GRANT EXECUTE` rouvrirait la
// fuite sans qu'aucun écran ne change. D'où un test d'intégration contre une
// vraie base, et non un test unitaire mocké.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

/** UUID valide mais inexistant : la forme est correcte, la cible n'existe pas. */
const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

describe('RLS — helpers d’organisation retirés de l’API (mig. 100)', () => {
  let etranger: TestUser;

  beforeAll(async () => {
    etranger = await createTestUser();
  });

  afterAll(async () => {
    await deleteTestUsers(etranger);
  });

  it('la RLS de organization_members reste le rempart : aucune ligne visible', async () => {
    const { data, error } = await etranger.client
      .from('organization_members')
      .select('user_id, org_id');

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it('get_subtree n’est plus appelable par un utilisateur authentifié', async () => {
    const { error } = await etranger.client.rpc('get_subtree', {
      p_org: UUID_INEXISTANT,
      p_root: UUID_INEXISTANT,
    });

    // Avant la mig. 100, cet appel répondait — et renvoyait les membres dès
    // lors que l'UUID visé existait. C'était la fuite.
    expect(error).not.toBeNull();
  });

  it('has_subordinates n’est plus appelable par un utilisateur authentifié', async () => {
    const { error } = await etranger.client.rpc('has_subordinates', {
      p_org: UUID_INEXISTANT,
      p_user: UUID_INEXISTANT,
    });

    expect(error).not.toBeNull();
  });

  it('org_admin_count n’est plus appelable par un utilisateur authentifié', async () => {
    const { error } = await etranger.client.rpc('org_admin_count', {
      p_org: UUID_INEXISTANT,
    });

    expect(error).not.toBeNull();
  });

  it('les trois helpers restent inaccessibles au rôle anonyme', async () => {
    for (const [nom, args] of [
      ['get_subtree', { p_org: UUID_INEXISTANT, p_root: UUID_INEXISTANT }],
      ['has_subordinates', { p_org: UUID_INEXISTANT, p_user: UUID_INEXISTANT }],
      ['org_admin_count', { p_org: UUID_INEXISTANT }],
    ] as const) {
      const { error } = await anonClient.rpc(nom, args);
      expect(error, `${nom} ne doit pas répondre à anon`).not.toBeNull();
    }
  });

  it('i_have_subordinates reste appelable et ne parle que de l’appelant', async () => {
    // Le remplaçant exposé : il force `auth.uid()`, donc il ne peut pas servir
    // à sonder la hiérarchie d'un tiers. Sur une organisation dont l'appelant
    // n'est pas membre, la réponse est `false`, jamais une fuite.
    const { data, error } = await etranger.client.rpc('i_have_subordinates', {
      p_org: UUID_INEXISTANT,
    });

    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});
