// ═══════════════════════════════════════════════════════════════════
// FRIENDS, les douze méthodes du repository qui n'avaient aucun test.
//
// `supabase.repository.test.ts` (à côté) couvre la lecture des amis et le
// partage de tâches. Ce fichier couvre le reste : retrait d'une demande,
// partage de LISTES, et le modèle de lecture des partages de tâches.
//
// Le repository couvre TROIS surfaces de collaboration et n'en testait qu'une.
// Chaque méthode ci-dessous porte une décision de sécurité prise dans une
// migration : le DELETE de `cancelFriendRequest` (et non un statut), les
// doubles `eq` de défense en profondeur, la résolution d'uid par RPC pour
// `shareList`, et le filtre `is('accepted_at', null)` qui DÉFINIT ce qu'est
// une invitation « en attente ». Un mapping qui change en silence n'est pas
// grave ; une de ces chaînes qui change en silence, si.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseFriendsRepository } from './supabase.repository';

const repo = new SupabaseFriendsRepository();
const ME = () => supabaseMock.user?.id as string;

const friendRow = {
  id: 'f1', name: 'Alice', email: 'alice@test.dev',
  friend_user_id: 'alice-uid', user_id: 'u1',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseFriendsRepository, demandes (lecture et retrait)', () => {
  it('getById: PGRST116 (aucune ligne) donne null, jamais une exception', async () => {
    supabaseMock.queueTable('friends', { data: null, error: { code: 'PGRST116' } });
    await expect(repo.getById('f1')).resolves.toBeNull();
  });

  it('getById: mappe friend_user_id vers userId (cle de matching des collaborateurs)', async () => {
    supabaseMock.queueTable('friends', { data: friendRow });
    const friend = await repo.getById('f1');
    expect(supabaseMock.argsOf('friends', 'eq')).toEqual(['id', 'f1']);
    expect(friend).toEqual({
      id: 'f1', name: 'Alice', email: 'alice@test.dev', avatar: undefined, userId: 'alice-uid',
    });
  });

  it('getById: une vraie erreur remonte (seul PGRST116 est avale)', async () => {
    supabaseMock.queueTable('friends', { data: null, error: { code: '42501', message: 'rls' } });
    await expect(repo.getById('f1')).rejects.toBeTruthy();
  });

  it('getSentRequests: demandes ENVOYEES par moi et encore pending', async () => {
    supabaseMock.queueTable('friend_requests', {
      data: [{
        id: 'r1', email: 'bob@test.dev', status: 'pending', sent_at: '2026-08-01',
        sender_id: ME(), sender_email: 'me@test.dev', receiver_id: 'bob-uid',
      }],
    });

    const sent = await repo.getSentRequests();

    const eqs = supabaseMock.callsFor('friend_requests').filter((c) => c.method === 'eq');
    // L'inverse exact de getPendingRequests : ici je suis l'EXPÉDITEUR.
    // Intervertir ces deux filtres afficherait les demandes reçues dans
    // l'onglet « envoyées », et réciproquement.
    expect(eqs.map((c) => c.args)).toEqual([['status', 'pending'], ['sender_id', ME()]]);
    expect(sent[0]).toMatchObject({ id: 'r1', senderId: ME(), receiverId: 'bob-uid' });
  });

  it('getSentRequests: tableau vide quand deconnecte, sans aucune requete', async () => {
    supabaseMock.user = null;
    await expect(repo.getSentRequests()).resolves.toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('rejectFriendRequest: passe le statut a rejected (geste du DESTINATAIRE)', async () => {
    supabaseMock.queueTable('friend_requests', { data: null });
    await repo.rejectFriendRequest('r1');
    expect((supabaseMock.argsOf('friend_requests', 'update') as Record<string, unknown>[])[0])
      .toEqual({ status: 'rejected' });
    expect(supabaseMock.argsOf('friend_requests', 'eq')).toEqual(['id', 'r1']);
  });

  it('cancelFriendRequest: DELETE et jamais un statut, avec double eq de defense en profondeur', async () => {
    supabaseMock.queueTable('friend_requests', { data: null });

    await repo.cancelFriendRequest('r1');

    const methods = supabaseMock.callsFor('friend_requests').map((c) => c.method);
    // Le cœur du finding : 'rejected' est réservé au destinataire par le
    // WITH CHECK de la mig. 049, et 'cancelled' n'existe pas dans la contrainte
    // CHECK de la table. Un UPDATE ici laissait la demande collée dans la liste.
    expect(methods).toContain('delete');
    expect(methods).not.toContain('update');
    const eqs = supabaseMock.callsFor('friend_requests').filter((c) => c.method === 'eq');
    expect(eqs.map((c) => c.args)).toEqual([['id', 'r1'], ['sender_id', ME()]]);
  });

  it('cancelFriendRequest: refuse si deconnecte, AVANT toute requete', async () => {
    supabaseMock.user = null;
    await expect(repo.cancelFriendRequest('r1')).rejects.toThrow('Non authentifié');
    expect(supabaseMock.queries).toHaveLength(0);
  });
});

describe('SupabaseFriendsRepository, partage de taches (modele de lecture)', () => {
  it('unshareTask: cible la paire (task_id, friend_id), pas seulement la tache', async () => {
    supabaseMock.queueTable('shared_tasks', { data: null });
    await repo.unshareTask('t1', 'alice-uid');
    const eqs = supabaseMock.callsFor('shared_tasks').filter((c) => c.method === 'eq');
    // Sans le second `eq`, retirer UN collaborateur retirerait TOUS les
    // partages de la tâche.
    expect(eqs.map((c) => c.args)).toEqual([['task_id', 't1'], ['friend_id', 'alice-uid']]);
  });

  it('getTaskShares: accepted derive de accepted_at, et un role inconnu retombe sur viewer', async () => {
    supabaseMock.queueTable('shared_tasks', {
      data: [
        { task_id: 't1', friend_id: 'a', role: 'editor', accepted_at: '2026-08-01' },
        { task_id: 't1', friend_id: 'b', role: 'n-importe-quoi', accepted_at: null },
      ],
    });

    const shares = await repo.getTaskShares('t1');

    expect(supabaseMock.argsOf('shared_tasks', 'eq')).toEqual(['task_id', 't1']);
    expect(shares).toEqual([
      { taskId: 't1', friendId: 'a', role: 'editor', accepted: true },
      // Le défaut doit être le MOINS permissif. Un rôle inattendu qui
      // retomberait sur 'editor' donnerait le droit d'écriture par accident.
      { taskId: 't1', friendId: 'b', role: 'viewer', accepted: false },
    ]);
  });

  it('acceptSharedTask: passe par la RPC atomique, zero ecriture directe', async () => {
    supabaseMock.queueRpc('accept_shared_task', { data: null });
    await repo.acceptSharedTask('t1');
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'accept_shared_task', args: { p_task_id: 't1' } }]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('acceptSharedTask: remonte l erreur de la RPC', async () => {
    supabaseMock.queueRpc('accept_shared_task', { error: { message: 'nope', code: '42501' } });
    await expect(repo.acceptSharedTask('t1')).rejects.toBeTruthy();
  });

  it('getMyTaskShares: scope sur shared_by = moi et plafonne a 500', async () => {
    supabaseMock.queueTable('shared_tasks', { data: [{ task_id: 't1', friend_id: 'a', role: 'viewer' }] });
    const shares = await repo.getMyTaskShares();
    expect(supabaseMock.argsOf('shared_tasks', 'eq')).toEqual(['shared_by', ME()]);
    expect(supabaseMock.argsOf('shared_tasks', 'limit')).toEqual([500]);
    expect(shares).toEqual([{ taskId: 't1', friendId: 'a', role: 'viewer' }]);
  });

  it('getMyTaskShares: tableau vide quand deconnecte, sans aucune requete', async () => {
    supabaseMock.user = null;
    await expect(repo.getMyTaskShares()).resolves.toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('getRelatedTaskShares: vide quand deconnecte, donc aucun uid nul interpole dans le .or()', async () => {
    supabaseMock.user = null;
    await expect(repo.getRelatedTaskShares()).resolves.toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });
});

describe('SupabaseFriendsRepository, partage de listes', () => {
  it('shareList: resout l uid du destinataire par RPC quand un email est fourni', async () => {
    supabaseMock.queueRpc('resolve_profile_by_email', { data: 'bob-uid' });
    supabaseMock.queueTable('shared_lists', { data: null });

    await repo.shareList({
      listId: 'l1', friendId: 'ignore-moi', friendEmail: 'BOB@Test.dev',
      name: 'Courses', color: 'blue', tasks: [],
    });

    // L'email est normalisé AVANT la RPC : la résolution est exacte, jamais
    // un ILIKE (même garde que getByEmail, faille N4).
    expect(supabaseMock.rpcCalls[0]).toEqual({
      fn: 'resolve_profile_by_email', args: { p_email: 'bob@test.dev' },
    });
    const inserted = (supabaseMock.argsOf('shared_lists', 'insert') as Record<string, unknown>[][])[0][0];
    // `shared_by` vient de la session, jamais de l'input.
    expect(inserted).toMatchObject({ shared_by: ME(), friend_id: 'bob-uid', name: 'Courses' });
  });

  it('shareList: sans email, garde le friendId fourni et n appelle aucune RPC', async () => {
    supabaseMock.queueTable('shared_lists', { data: null });
    await repo.shareList({ listId: 'l1', friendId: 'bob-uid', name: 'Courses', color: 'blue', tasks: [] });
    expect(supabaseMock.rpcCalls).toHaveLength(0);
    const inserted = (supabaseMock.argsOf('shared_lists', 'insert') as Record<string, unknown>[][])[0][0];
    expect(inserted).toMatchObject({ friend_id: 'bob-uid', shared_by: ME() });
  });

  it('shareList: 23503 et 42501 deviennent des messages lisibles, sans fuite du message brut', async () => {
    supabaseMock.queueTable('shared_lists', { error: { code: '23503', message: 'fk raw' } });
    await expect(repo.shareList({ listId: 'l1', friendId: 'x', name: 'L', color: 'blue', tasks: [] }))
      .rejects.toThrow(/pas \(encore\) inscrit/);

    supabaseMock.queueTable('shared_lists', { error: { code: '42501', message: 'rls raw' } });
    await expect(repo.shareList({ listId: 'l1', friendId: 'x', name: 'L', color: 'blue', tasks: [] }))
      .rejects.toThrow(/demande d'ami/);
  });

  it('shareList: refuse si deconnecte', async () => {
    supabaseMock.user = null;
    await expect(repo.shareList({ listId: 'l1', friendId: 'x', name: 'L', color: 'blue', tasks: [] }))
      .rejects.toThrow('Not authenticated');
  });

  it('getIncomingSharedLists: destinataire = moi ET non acceptees, plafond 200', async () => {
    supabaseMock.queueTable('shared_lists', {
      data: [{
        id: 'g1', shared_by: 'bob-uid', name: 'Courses',
        color: null, tasks: null, accepted_at: null,
      }],
    });

    const grants = await repo.getIncomingSharedLists();

    expect(supabaseMock.argsOf('shared_lists', 'eq')).toEqual(['friend_id', ME()]);
    // `is(accepted_at, null)` EST la définition de « en attente » : sans lui,
    // une liste déjà acceptée réapparaîtrait indéfiniment dans la boîte.
    expect(supabaseMock.argsOf('shared_lists', 'is')).toEqual(['accepted_at', null]);
    expect(supabaseMock.argsOf('shared_lists', 'limit')).toEqual([200]);
    expect(grants[0]).toEqual({
      id: 'g1', name: 'Courses', color: 'blue', tasks: [],
      sharedBy: 'bob-uid', friendId: ME(), accepted: false,
    });
  });

  it('getIncomingSharedLists: tableau vide quand deconnecte, sans aucune requete', async () => {
    supabaseMock.user = null;
    await expect(repo.getIncomingSharedLists()).resolves.toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('acceptSharedList: pose accepted_at et scope sur (id, friend_id = moi)', async () => {
    supabaseMock.queueTable('shared_lists', { data: null });

    await repo.acceptSharedList('g1');

    const patch = (supabaseMock.argsOf('shared_lists', 'update') as Record<string, unknown>[])[0];
    // Un seul champ : la policy autorise le destinataire à poser accepted_at,
    // rien d'autre.
    expect(Object.keys(patch)).toEqual(['accepted_at']);
    expect(typeof patch.accepted_at).toBe('string');
    const eqs = supabaseMock.callsFor('shared_lists').filter((c) => c.method === 'eq');
    expect(eqs.map((c) => c.args)).toEqual([['id', 'g1'], ['friend_id', ME()]]);
  });

  it('acceptSharedList: refuse si deconnecte, AVANT toute requete', async () => {
    supabaseMock.user = null;
    await expect(repo.acceptSharedList('g1')).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('refuseSharedList: DELETE par id, c est la RLS qui tranche qui a le droit', async () => {
    supabaseMock.queueTable('shared_lists', { data: null });
    await repo.refuseSharedList('g1');
    const methods = supabaseMock.callsFor('shared_lists').map((c) => c.method);
    expect(methods).toContain('delete');
    expect(supabaseMock.argsOf('shared_lists', 'eq')).toEqual(['id', 'g1']);
  });

  it('refuseSharedList: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('shared_lists', { error: { message: 'nope', code: '42501' } });
    await expect(repo.refuseSharedList('g1')).rejects.toBeTruthy();
  });
});
