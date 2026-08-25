// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS, invitations nominatives, avis de retrait, et les deux
// opérations irréversibles (suppression d'organisation, transfert de
// propriété).
//
// `supabase.repository.test.ts` (à côté) couvre l'annuaire, les demandes
// d'adhésion, les liens d'invitation et les permissions par membre. Ce fichier
// couvre les huit méthodes restantes, qui ont un point commun : elles portent
// toutes une décision de CLOISONNEMENT prise dans une migration.
//
// Le motif à retenir, et que ces tests verrouillent : trois de ces lectures
// passent par une RPC `SECURITY DEFINER` alors qu'un `SELECT` aurait l'air
// plus simple. Ce n'est pas un détail d'implémentation. Un invité n'est pas
// encore membre, et un ex-membre ne l'est plus : ni l'un ni l'autre ne peut
// lire `organizations` (`organizations_select = is_org_member`). Sans la RPC,
// l'écran afficherait « vous êtes invité » sans pouvoir nommer l'entreprise.
// Repasser ces trois lectures en `.from()` ne casserait donc pas la sécurité,
// ça casserait l'écran, en silence, et seulement chez les gens concernés.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseOrganizationsRepository } from './supabase.repository';

const repo = new SupabaseOrganizationsRepository();
const ME = () => supabaseMock.user?.id as string;

const ORG = '22222222-2222-4222-8222-222222222222';

beforeEach(() => supabaseMock.reset());

describe('SupabaseOrganizationsRepository, invitations nominatives (mig. 105)', () => {
  it('inviteFriendToOrg: RPC dediee, jamais un INSERT direct dans org_invitations', async () => {
    supabaseMock.queueRpc('invite_friend_to_org', { data: null });

    await repo.inviteFriendToOrg(ORG, 'ami-uid');

    // La RPC porte la garde « admin OU manager ayant des subordonnés »
    // ajoutée par la mig. 109 (finding B-2). Un INSERT direct court-circuiterait
    // cette garde et laisserait n'importe quel membre faire entrer un tiers.
    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'invite_friend_to_org', args: { p_org: ORG, p_invitee: 'ami-uid' } },
    ]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('inviteFriendToOrg: remonte le refus de la RPC (not_allowed_to_invite)', async () => {
    supabaseMock.queueRpc('invite_friend_to_org', {
      error: { message: 'not_allowed_to_invite', code: 'P0001' },
    });
    await expect(repo.inviteFriendToOrg(ORG, 'ami-uid')).rejects.toBeTruthy();
  });

  it('getPendingSentInvitationIds: mes invitations a MOI, ni acceptees ni refusees', async () => {
    supabaseMock.queueTable('org_invitations', {
      data: [{ invitee_id: 'ami-1' }, { invitee_id: 'ami-2' }],
    });

    const ids = await repo.getPendingSentInvitationIds(ORG);

    const eqs = supabaseMock.callsFor('org_invitations').filter((c) => c.method === 'eq');
    expect(eqs.map((c) => c.args)).toEqual([['org_id', ORG], ['inviter_id', ME()]]);
    const iss = supabaseMock.callsFor('org_invitations').filter((c) => c.method === 'is');
    // Les DEUX `is` sont nécessaires : sans `declined_at`, un refus continuerait
    // d'apparaître comme « invitation en cours » et l'écran refuserait de
    // réinviter la personne.
    expect(iss.map((c) => c.args)).toEqual([['accepted_at', null], ['declined_at', null]]);
    expect(ids).toEqual(['ami-1', 'ami-2']);
  });

  it('getPendingSentInvitationIds: [] quand deconnecte, sans aucune requete', async () => {
    supabaseMock.user = null;
    await expect(repo.getPendingSentInvitationIds(ORG)).resolves.toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('getPendingSentInvitationIds: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('org_invitations', { error: { message: 'boom', code: '42501' } });
    await expect(repo.getPendingSentInvitationIds(ORG)).rejects.toBeTruthy();
  });

  it('getMyOrgInvitations: RPC SECURITY DEFINER, et un inviteur sans nom reste nommable', async () => {
    supabaseMock.queueRpc('get_my_org_invitations', {
      data: [
        { id: 'i1', org_id: ORG, org_name: 'Acme', inviter_id: 'boss', inviter_name: 'Alice', created_at: '2026-08-01' },
        { id: 'i2', org_id: ORG, org_name: 'Acme', inviter_id: 'boss', inviter_name: null, created_at: '2026-08-02' },
      ],
    });

    const invitations = await repo.getMyOrgInvitations();

    // Un invité n'est pas encore membre : il ne peut PAS lire `organizations`.
    // C'est la RPC qui lui donne le nom de l'entreprise.
    expect(supabaseMock.rpcCalls[0].fn).toBe('get_my_org_invitations');
    expect(invitations[0]).toMatchObject({ id: 'i1', orgName: 'Acme', inviterName: 'Alice' });
    // Repli explicite : afficher « invité par null » serait pire que rien.
    expect(invitations[1].inviterName).toBe('Un collaborateur');
  });

  it('getMyOrgInvitations: data null donne [] et non une exception', async () => {
    supabaseMock.queueRpc('get_my_org_invitations', { data: null });
    await expect(repo.getMyOrgInvitations()).resolves.toEqual([]);
  });

  it('getMyOrgInvitations: remonte l erreur de la RPC', async () => {
    supabaseMock.queueRpc('get_my_org_invitations', { error: { message: 'boom', code: '42501' } });
    await expect(repo.getMyOrgInvitations()).rejects.toBeTruthy();
  });

  it('respondOrgInvitation: RPC atomique, accepte ET refuse par le meme chemin', async () => {
    supabaseMock.queueRpc('respond_org_invitation', { data: null });
    await repo.respondOrgInvitation('i1', true);
    supabaseMock.queueRpc('respond_org_invitation', { data: null });
    await repo.respondOrgInvitation('i1', false);

    // Le refus passe par la même RPC que l'acceptation : c'est elle qui pose
    // `declined_at`, donc qui rend la ligne purgeable par le job de rétention
    // à 30 jours (mig. 112, RGPD).
    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'respond_org_invitation', args: { p_invitation: 'i1', p_accept: true } },
      { fn: 'respond_org_invitation', args: { p_invitation: 'i1', p_accept: false } },
    ]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('respondOrgInvitation: remonte l erreur de la RPC', async () => {
    supabaseMock.queueRpc('respond_org_invitation', { error: { message: 'nope', code: 'P0001' } });
    await expect(repo.respondOrgInvitation('i1', true)).rejects.toBeTruthy();
  });
});

describe('SupabaseOrganizationsRepository, avis de retrait (mig. 106)', () => {
  it('getMyOrgRemovalNotices: RPC SECURITY DEFINER, actorName conserve son null', async () => {
    supabaseMock.queueRpc('get_my_org_removal_notices', {
      data: [{ id: 'n1', org_id: ORG, org_name: 'Acme', actor_name: null, created_at: '2026-08-01' }],
    });

    const notices = await repo.getMyOrgRemovalNotices();

    // Un ex-membre ne peut plus lire `organizations` : sans la RPC, l'avis
    // dirait « vous avez été retiré » sans dire de quelle entreprise.
    expect(supabaseMock.rpcCalls[0].fn).toBe('get_my_org_removal_notices');
    expect(notices[0]).toEqual({
      id: 'n1', orgId: ORG, orgName: 'Acme', actorName: null, createdAt: '2026-08-01',
    });
    // Contrairement à `inviterName`, `actorName` n'a PAS de repli : ne pas
    // nommer qui a exclu quelqu'un est une décision, pas un oubli.
  });

  it('getMyOrgRemovalNotices: data null donne []', async () => {
    supabaseMock.queueRpc('get_my_org_removal_notices', { data: null });
    await expect(repo.getMyOrgRemovalNotices()).resolves.toEqual([]);
  });

  it('dismissOrgRemovalNotice: DELETE scope par id ET par mon user_id', async () => {
    supabaseMock.queueTable('org_notifications', { data: null });

    await repo.dismissOrgRemovalNotice('n1');

    const methods = supabaseMock.callsFor('org_notifications').map((c) => c.method);
    expect(methods).toContain('delete');
    const eqs = supabaseMock.callsFor('org_notifications').filter((c) => c.method === 'eq');
    // Défense en profondeur : la policy filtre déjà sur `user_id = auth.uid()`,
    // le second `eq` garantit qu'un id d'avis deviné ne suffit pas.
    expect(eqs.map((c) => c.args)).toEqual([['id', 'n1'], ['user_id', ME()]]);
  });

  it('dismissOrgRemovalNotice: deconnecte, le filtre user_id vaut chaine vide (ne matche rien)', async () => {
    supabaseMock.user = null;
    supabaseMock.queueTable('org_notifications', { data: null });

    await repo.dismissOrgRemovalNotice('n1');

    const eqs = supabaseMock.callsFor('org_notifications').filter((c) => c.method === 'eq');
    // Le repli `?? ''` est volontaire : il produit un filtre qui ne matche
    // AUCUNE ligne, plutôt qu'un filtre absent qui les matcherait toutes.
    expect(eqs.map((c) => c.args)).toEqual([['id', 'n1'], ['user_id', '']]);
  });

  it('dismissOrgRemovalNotice: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('org_notifications', { error: { message: 'nope', code: '42501' } });
    await expect(repo.dismissOrgRemovalNotice('n1')).rejects.toBeTruthy();
  });
});

describe('SupabaseOrganizationsRepository, opérations irréversibles', () => {
  it('deleteOrganization: RPC SECURITY DEFINER (mig. 075), aucune suppression a la main', async () => {
    supabaseMock.queueRpc('delete_organization', { data: null });

    await repo.deleteOrganization(ORG);

    // La cascade est portée par la RPC. La reproduire côté client donnerait une
    // suppression partielle si un DELETE échoue au milieu.
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'delete_organization', args: { p_org: ORG } }]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('deleteOrganization: remonte le refus de la RPC (admin only)', async () => {
    supabaseMock.queueRpc('delete_organization', { error: { message: 'not_admin', code: 'P0001' } });
    await expect(repo.deleteOrganization(ORG)).rejects.toBeTruthy();
  });

  it('transferOwnership: RPC SECURITY DEFINER (mig. 081), proprietaire actuel uniquement', async () => {
    supabaseMock.queueRpc('transfer_org_ownership', { data: null });

    await repo.transferOwnership(ORG, 'nouveau-owner');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'transfer_org_ownership', args: { p_org: ORG, p_new_owner: 'nouveau-owner' } },
    ]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('transferOwnership: remonte le refus de la RPC', async () => {
    supabaseMock.queueRpc('transfer_org_ownership', { error: { message: 'not_owner', code: 'P0001' } });
    await expect(repo.transferOwnership(ORG, 'x')).rejects.toBeTruthy();
  });
});
