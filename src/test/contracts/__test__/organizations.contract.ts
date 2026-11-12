// Contrat de `IOrganizationsRepository` (organisation, membres, rôle), démo et Supabase.
// L'utilisateur qui joue crée ses organisations : il en est propriétaire et administrateur.
// Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { IOrganizationsRepository } from '@/modules/organizations/repository';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface OrganizationsContractContext {
  repo: IOrganizationsRepository;
  /** Identifiant de l'utilisateur qui joue le contrat. */
  userId: string;
}

export function organizationsContract(
  side: string,
  make: () => Promise<OrganizationsContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat IOrganizationsRepository · ${side}`, () => {
    let ctx: OrganizationsContractContext;
    beforeAll(async () => {
      ctx = await make();
    });
    const mine = async (id: string) => (await ctx.repo.getMyOrganizations()).find((o) => o.id === id);

    contractCase(opts, 'créer une organisation en fait son créateur administrateur', async () => {
      const name = unique('Org');
      const org = await ctx.repo.createOrganization(name);
      const read = await mine(org.id);
      expect(read && { name: read.name, role: read.myRole, hasCode: Boolean(read.joinCode) }).toEqual({
        name,
        role: 'admin',
        hasCode: true,
      });
      const members = await ctx.repo.getMembers(org.id);
      expect(members.map((m) => ({ userId: m.userId, role: m.role }))).toEqual([{ userId: ctx.userId, role: 'admin' }]);
    });

    contractCase(opts, 'met à jour le profil de l’organisation', async () => {
      const org = await ctx.repo.createOrganization(unique('Org'));
      const updated = await ctx.repo.updateOrganization(org.id, { name: 'Renommée', description: 'Une description' });
      expect({ name: updated.name, description: updated.description }).toEqual({
        name: 'Renommée',
        description: 'Une description',
      });
      const read = await mine(org.id);
      expect(read && { name: read.name, description: read.description }).toEqual({
        name: 'Renommée',
        description: 'Une description',
      });
    });

    contractCase(opts, 'régénérer le code d’invitation en rend un nouveau, lisible ensuite', async () => {
      const org = await ctx.repo.createOrganization(unique('Org'));
      const before = (await mine(org.id))?.joinCode;
      const code = await ctx.repo.regenerateJoinCode(org.id);
      expect(code).not.toBe(before);
      expect((await mine(org.id))?.joinCode).toBe(code);
    });

    contractCase(opts, 'rejoindre avec un code inconnu est refusé', async () => {
      expect(await rejects(ctx.repo.requestJoin('COSMO-ZZZZZZ'))).toBe(true);
    });

    contractCase(opts, 'rejoindre sa propre organisation est refusé', async () => {
      const org = await ctx.repo.createOrganization(unique('Org'));
      const code = (await mine(org.id))?.joinCode ?? '';
      expect(await rejects(ctx.repo.requestJoin(code))).toBe(true);
    });

    contractCase(opts, 'supprimer l’organisation la retire de la liste', async () => {
      const org = await ctx.repo.createOrganization(unique('Org'));
      await ctx.repo.deleteOrganization(org.id);
      expect(await mine(org.id)).toBeUndefined();
    });

    contractCase(opts, 'modifier une organisation inconnue est refusé', async () => {
      expect(await rejects(ctx.repo.updateOrganization(crypto.randomUUID(), { name: 'X' }))).toBe(true);
    });
  });
}
