// @vitest-environment jsdom
// Contrat double mode de `IProjectFollowsRepository` et `IProjectMessagesRepository`
// (ex-dépôts-fonctions, ramenés dans la forme commune). Les listes sont
// exhaustives à la compilation (`satisfies`) ; la démo est rejouée de bout en bout.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: null }));

import type { IProjectFollowsRepository } from './follows.repository';
import type { IProjectMessagesRepository } from './messages.repository';
import { LocalStorageProjectFollowsRepository } from './follows.local.repository';
import { LocalStorageProjectMessagesRepository } from './messages.local.repository';
import { SupabaseProjectFollowsRepository } from './follows.supabase.repository';
import { SupabaseProjectMessagesRepository } from './messages.supabase.repository';

const FOLLOWS = { getMyFollows: true, setFollow: true } satisfies Record<keyof IProjectFollowsRepository, true>;
const MESSAGES = {
  getProjectMessages: true,
  addProjectMessage: true,
  deleteProjectMessage: true,
} satisfies Record<keyof IProjectMessagesRepository, true>;

const SUITES = [
  ['follows', FOLLOWS, LocalStorageProjectFollowsRepository.prototype, SupabaseProjectFollowsRepository.prototype],
  ['messages', MESSAGES, LocalStorageProjectMessagesRepository.prototype, SupabaseProjectMessagesRepository.prototype],
] as const;

describe.each(SUITES)('%s · contrat double mode', (_name, methods, local, prod) => {
  it('démo et production implémentent chaque méthode de l interface', () => {
    for (const proto of [local, prod]) {
      const missing = Object.keys(methods).filter(
        (m) => typeof (proto as unknown as Record<string, unknown>)[m] !== 'function',
      );
      expect(missing).toEqual([]);
    }
  });
});

describe('démo · suivre', () => {
  beforeEach(() => localStorage.clear());

  it('suit puis ne suit plus, par organisation', async () => {
    const repo = new LocalStorageProjectFollowsRepository();
    expect(await repo.getMyFollows('o1')).toEqual({ taskIds: [], projectIds: [] });
    await repo.setFollow('o1', 'task', 't1', true);
    await repo.setFollow('o1', 'project', 'p1', true);
    await repo.setFollow('o1', 'task', 't1', true);
    expect(await repo.getMyFollows('o1')).toEqual({ taskIds: ['t1'], projectIds: ['p1'] });
    expect(await repo.getMyFollows('o2')).toEqual({ taskIds: [], projectIds: [] });
    await repo.setFollow('o1', 'task', 't1', false);
    expect((await repo.getMyFollows('o1')).taskIds).toEqual([]);
  });
});

describe('démo · chat de projet', () => {
  beforeEach(() => localStorage.clear());

  it('écrit, lit par projet, supprime ; refuse un message vide', async () => {
    const repo = new LocalStorageProjectMessagesRepository();
    await expect(repo.addProjectMessage('o1', 'p1', '   ')).rejects.toBeDefined();
    const m = await repo.addProjectMessage('o1', 'p1', '  salut  ');
    await repo.addProjectMessage('o1', 'p2', 'autre');
    expect(m.body).toBe('salut');
    expect((await repo.getProjectMessages('p1')).map((x) => x.id)).toEqual([m.id]);
    await repo.deleteProjectMessage(m.id);
    expect(await repo.getProjectMessages('p1')).toEqual([]);
  });

  it('plafonne le corps à 2000 caractères', async () => {
    const repo = new LocalStorageProjectMessagesRepository();
    const m = await repo.addProjectMessage('o1', 'p1', 'x'.repeat(2500));
    expect(m.body).toHaveLength(2000);
  });
});
