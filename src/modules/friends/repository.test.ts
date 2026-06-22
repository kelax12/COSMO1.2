// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageFriendsRepository (démo).
// Couvre les invariants : deep-copy des seeds (B12), safeParse storage
// corrompu (B14), refus d'accepter une demande sortante (B13), dédup partage
// (B11).
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageFriendsRepository } from './repository';
import {
  FRIENDS_STORAGE_KEY,
  FRIEND_REQUESTS_STORAGE_KEY,
  SHARED_TASKS_STORAGE_KEY,
} from './constants';

let repo: LocalStorageFriendsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageFriendsRepository();
});

describe('lecture & seeds', () => {
  it('seede les amis démo et NE mute PAS la constante (B12)', async () => {
    const a = await repo.getAll();
    expect(a.length).toBe(3);
    a[0].name = 'MUTATED';
    // Une nouvelle instance relit le storage : la mutation locale n'a pas
    // corrompu une constante partagée → reseed propre après clear.
    localStorage.clear();
    const fresh = await new LocalStorageFriendsRepository().getAll();
    expect(fresh[0].name).toBe('Marie Dupont');
  });

  it('reseed défensif si le storage est corrompu (B14)', async () => {
    localStorage.setItem(FRIENDS_STORAGE_KEY, '{not json');
    const a = await repo.getAll();
    expect(a.length).toBe(3);
  });

  it('getById / getByEmail (insensible à la casse)', async () => {
    await repo.getAll();
    expect((await repo.getById('friend-1'))?.name).toBe('Marie Dupont');
    expect(await repo.getById('absent')).toBeNull();
    expect((await repo.getByEmail('MARIE.DUPONT@email.com'))?.id).toBe('friend-1');
  });

  it('getPendingRequests / getSentRequests', async () => {
    const pending = await repo.getPendingRequests();
    expect(pending.length).toBe(2); // 2 demandes entrantes démo
    // Les entrantes ont un senderEmail → getSentRequests (sortantes) = vide.
    expect(await repo.getSentRequests()).toHaveLength(0);
  });
});

describe('demandes d’amis', () => {
  it('sendFriendRequest dédoublonne par email', async () => {
    await repo.getPendingRequests();
    const r1 = await repo.sendFriendRequest({ email: 'new@x.com' });
    const r2 = await repo.sendFriendRequest({ email: 'NEW@x.com' });
    expect(r1.id).toBe(r2.id);
  });

  it('acceptFriendRequest crée un ami et dérive le nom depuis l’email', async () => {
    await repo.getPendingRequests();
    const friend = await repo.acceptFriendRequest('req-demo-1'); // sender lucas.moreau
    expect(friend.email).toBe('lucas.moreau@email.com');
    expect(friend.name).toBe('Lucas Moreau');
    expect((await repo.getPendingRequests()).some((r) => r.id === 'req-demo-1')).toBe(false);
  });

  it('refuse d’accepter une demande sortante (B13)', async () => {
    // Une demande sortante n'a pas de senderEmail.
    localStorage.setItem(
      FRIEND_REQUESTS_STORAGE_KEY,
      JSON.stringify([{ id: 'out-1', email: 'x@y.com', status: 'pending', sentAt: new Date().toISOString() }]),
    );
    await expect(repo.acceptFriendRequest('out-1')).rejects.toThrow();
    await expect(repo.acceptFriendRequest('inexistante')).rejects.toThrow();
  });

  it('rejectFriendRequest passe la demande à rejected', async () => {
    await repo.getPendingRequests();
    await repo.rejectFriendRequest('req-demo-1');
    expect((await repo.getPendingRequests()).some((r) => r.id === 'req-demo-1')).toBe(false);
  });

  it('removeFriend retire un ami', async () => {
    await repo.getAll();
    await repo.removeFriend('friend-1');
    expect(await repo.getById('friend-1')).toBeNull();
  });
});

describe('partage de tâches', () => {
  it('shareTask dédoublonne par friendId (B11) et applique le rôle', async () => {
    await repo.shareTask({ taskId: 't1', friendId: 'friend-1', role: 'editor' });
    await repo.shareTask({ taskId: 't1', friendId: 'friend-1', role: 'viewer' }); // ignoré (déjà partagé)
    const shares = await repo.getTaskShares('t1');
    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({ friendId: 'friend-1', role: 'editor', accepted: true });
  });

  it('unshareTask retire la grant', async () => {
    await repo.shareTask({ taskId: 't1', friendId: 'friend-1' });
    await repo.unshareTask('t1', 'friend-1');
    expect(await repo.getTaskShares('t1')).toHaveLength(0);
  });

  it('acceptSharedTask marque accepted', async () => {
    localStorage.setItem(SHARED_TASKS_STORAGE_KEY, JSON.stringify({ t1: [{ friendId: 'f1', role: 'viewer', accepted: false }] }));
    await repo.acceptSharedTask('t1');
    expect((await repo.getTaskShares('t1'))[0].accepted).toBe(true);
  });

  it('getMyTaskShares / getRelatedTaskShares agrègent toutes les grants', async () => {
    await repo.shareTask({ taskId: 't1', friendId: 'f1' });
    await repo.shareTask({ taskId: 't2', friendId: 'f2', role: 'editor' });
    expect(await repo.getMyTaskShares()).toHaveLength(2);
    const related = await repo.getRelatedTaskShares();
    expect(related).toHaveLength(2);
    expect(related[0].sharedBy).toBe('demo-user');
  });

  it('getSharedTasksMap tolère un storage corrompu (B14)', async () => {
    localStorage.setItem(SHARED_TASKS_STORAGE_KEY, 'corrupted{');
    expect(await repo.getMyTaskShares()).toEqual([]);
  });
});
