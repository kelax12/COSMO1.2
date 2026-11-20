// TEAM-PROJECTS · Suivre : dépôt démo (localStorage). Interface : `follows.repository.ts`.

import { readJson, writeJsonOrThrow } from '@/lib/safe-json';
import type { FollowTarget, IProjectFollowsRepository, MyFollows } from './follows.repository';

/** Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`. */
export const TEAM_FOLLOWS_STORAGE_KEY = 'cosmo_team_follows';

type DemoFollows = Record<string, MyFollows>;

const readDemo = (): DemoFollows => readJson<DemoFollows>(TEAM_FOLLOWS_STORAGE_KEY) ?? {};

export class LocalStorageProjectFollowsRepository implements IProjectFollowsRepository {
  async getMyFollows(orgId: string): Promise<MyFollows> {
    return readDemo()[orgId] ?? { taskIds: [], projectIds: [] };
  }

  async setFollow(orgId: string, target: FollowTarget, id: string, follow: boolean): Promise<void> {
    const all = readDemo();
    const mine = all[orgId] ?? { taskIds: [], projectIds: [] };
    const key = target === 'task' ? 'taskIds' : 'projectIds';
    const without = mine[key].filter((x) => x !== id);
    all[orgId] = { ...mine, [key]: follow ? [...without, id] : without };
    writeJsonOrThrow(TEAM_FOLLOWS_STORAGE_KEY, all);
  }
}
