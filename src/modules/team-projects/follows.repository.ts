// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Suivre : interface commune démo / production (mig. 162, M14)
//
// Implémentations : `follows.local.repository.ts` (démo, localStorage) et
// `follows.supabase.repository.ts`. Instanciation : `getProjectFollowsRepository`
// (`src/lib/repository.factory.ts`). Que des méthodes asynchrones (`lazy`).
// ═══════════════════════════════════════════════════════════════════

export type FollowTarget = 'task' | 'project';

export interface MyFollows {
  taskIds: string[];
  projectIds: string[];
}

export interface IProjectFollowsRepository {
  /** Le lecteur ne voit que SES abonnements (RLS `user_id = moi`). */
  getMyFollows(orgId: string): Promise<MyFollows>;
  setFollow(orgId: string, target: FollowTarget, id: string, follow: boolean): Promise<void>;
}
