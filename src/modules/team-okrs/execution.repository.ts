// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — interface commune démo / production
// ═══════════════════════════════════════════════════════════════════

import type {
  CreateOkrCycleInput,
  KRCheckin,
  KRProjectLink,
  OkrCycle,
  PostKRCheckinInput,
} from './execution.types';

export interface IOkrExecutionRepository {
  getCycles(orgId: string): Promise<OkrCycle[]>;
  createCycle(orgId: string, input: CreateOkrCycleInput): Promise<OkrCycle>;
  deleteCycle(cycleId: string): Promise<void>;

  getKRProjects(orgId: string): Promise<KRProjectLink[]>;
  /** Remplace les projets reliés à un KR. */
  setKRProjects(orgId: string, krId: string, projectIds: string[]): Promise<void>;

  getCheckins(krId: string): Promise<KRCheckin[]>;
  postCheckin(input: PostKRCheckinInput): Promise<void>;
}
