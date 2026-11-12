// Contrat de `IFriendsRepository` (demandes d'amis, côté expéditeur), démo et Supabase.
// Un seul utilisateur joue : l'acceptation d'une demande REÇUE exige un second compte
// et n'est donc pas couverte ici. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { IFriendsRepository } from '@/modules/friends/repository';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface FriendsContractContext {
  repo: IFriendsRepository;
}

const mail = (tag: string) => `${unique(tag).replace(/\s+/g, '-').toLowerCase()}@example.com`;

export function friendsContract(side: string, make: () => Promise<FriendsContractContext>, opts?: ContractOptions): void {
  describe(`contrat IFriendsRepository · ${side}`, () => {
    let repo: IFriendsRepository;
    beforeAll(async () => {
      ({ repo } = await make());
    });

    contractCase(opts, 'une demande envoyée figure parmi les envoyées, pas parmi les reçues', async () => {
      const sent = await repo.sendFriendRequest({ email: mail('envoi') });
      expect(sent.status).toBe('pending');
      expect((await repo.getSentRequests()).map((r) => r.id)).toContain(sent.id);
      expect((await repo.getPendingRequests()).map((r) => r.id)).not.toContain(sent.id);
    });

    contractCase(opts, 'envoyer deux fois la même demande ne la duplique pas', async () => {
      const email = mail('doublon');
      const first = await repo.sendFriendRequest({ email });
      const second = await repo.sendFriendRequest({ email });
      expect(second.id).toBe(first.id);
      expect((await repo.getSentRequests()).filter((r) => r.id === first.id)).toHaveLength(1);
    });

    contractCase(opts, 'l’adresse est comparée et enregistrée en minuscules', async () => {
      const email = mail('casse');
      const sent = await repo.sendFriendRequest({ email: email.toUpperCase() });
      expect(sent.email).toBe(email);
      expect((await repo.sendFriendRequest({ email })).id).toBe(sent.id);
    });

    contractCase(opts, 'annuler retire la demande (suppression, pas un statut)', async () => {
      const sent = await repo.sendFriendRequest({ email: mail('annule') });
      await repo.cancelFriendRequest(sent.id);
      expect((await repo.getSentRequests()).map((r) => r.id)).not.toContain(sent.id);
    });

    contractCase(opts, 'accepter sa propre demande envoyée est refusé', async () => {
      const sent = await repo.sendFriendRequest({ email: mail('soi') });
      expect(await rejects(repo.acceptFriendRequest(sent.id))).toBe(true);
    });

    contractCase(opts, 'accepter une demande inconnue est refusé', async () => {
      expect(await rejects(repo.acceptFriendRequest(crypto.randomUUID()))).toBe(true);
    });
  });
}
