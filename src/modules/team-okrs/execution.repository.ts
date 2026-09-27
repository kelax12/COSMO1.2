// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — interface commune démo / production
// ═══════════════════════════════════════════════════════════════════

import type {
  KRCheckin,
  KRProjectLink,
  PostKRCheckinInput,
} from './execution.types';

export interface IOkrExecutionRepository {
  getKRProjects(orgId: string): Promise<KRProjectLink[]>;
  /** Remplace les projets reliés à un KR. */
  setKRProjects(orgId: string, krId: string, projectIds: string[]): Promise<void>;

  getCheckins(krId: string): Promise<KRCheckin[]>;
  postCheckin(input: PostKRCheckinInput): Promise<void>;
}
