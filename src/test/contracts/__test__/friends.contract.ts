// Contrat de `IFriendsRepository` (demandes d'amis, côté expéditeur), démo et Supabase.
// Un seul utilisateur joue : l'acceptation d'une demande REÇUE exige un second compte
// et n'est donc pas couverte ici. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { IFriendsRepository } from '@/modules/friends/repository';
import { contractCase, rejects, type ContractOptions } from './harness';

export interface FriendsContractContext {
  repo: IFriendsRepository;
  /**
   * Adresse d'un destinataire valide. En base, `friend_requests.user_id` est NOT NULL et se déduit du
   * destinataire : une demande vers une adresse non inscrite est refusée (23502). Le côté Supabase
   * crée donc un vrai compte ; la démo n'a pas cette contrainte et renvoie n'importe quelle adresse.
   */
  recipient: () => Promise<string>;
}

export function friendsContract(side: string, make: () => Promise<FriendsContractContext>, opts?: ContractOptions): void {
  describe(`contrat IFriendsRepository · ${side}`, () => {
    let repo: IFriendsRepository;
    let recipient: () => Promise<string>;
    beforeAll(async () => {
      ({ repo, recipient } = await make());
    });

    contractCase(opts, 'une demande envoyée figure parmi les envoyées, pas parmi les reçues', async () => {
      const sent = await repo.sendFriendRequest({ email: await recipient() });
      expect(sent.status).toBe('pending');
      expect((await repo.getSentRequests()).map((r) => r.id)).toContain(sent.id);
      expect((await repo.getPendingRequests()).map((r) => r.id)).not.toContain(sent.id);
    });

    contractCase(opts, 'envoyer deux fois la même demande ne la duplique pas', async () => {
      const email = (await recipient()).toLowerCase();
      const first = await repo.sendFriendRequest({ email });
      const second = await repo.sendFriendRequest({ email });
      expect(second.id).toBe(first.id);
      expect((await repo.getSentRequests()).filter((r) => r.id === first.id)).toHaveLength(1);
    });

    contractCase(opts, 'l’adresse est comparée et enregistrée en minuscules', async () => {
      const email = (await recipient()).toLowerCase();
      const sent = await repo.sendFriendRequest({ email: email.toUpperCase() });
      expect(sent.email).toBe(email);
      expect((await repo.sendFriendRequest({ email })).id).toBe(sent.id);
    });

    contractCase(opts, 'annuler retire la demande (suppression, pas un statut)', async () => {
      const sent = await repo.sendFriendRequest({ email: await recipient() });
      await repo.cancelFriendRequest(sent.id);
      expect((await repo.getSentRequests()).map((r) => r.id)).not.toContain(sent.id);
    });

    contractCase(opts, 'accepter sa propre demande envoyée est refusé', async () => {
      const sent = await repo.sendFriendRequest({ email: await recipient() });
      expect(await rejects(repo.acceptFriendRequest(sent.id))).toBe(true);
    });

    contractCase(opts, 'accepter une demande inconnue est refusé', async () => {
      expect(await rejects(repo.acceptFriendRequest(crypto.randomUUID()))).toBe(true);
    });
  });
}
