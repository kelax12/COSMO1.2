// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import {
  TeamOKR,
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
} from './types';

export interface ITeamOKRsRepository {
  getAll(orgId: string): Promise<TeamOKR[]>;
  create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR>;
  update(okrId: string, input: UpdateTeamOKRInput): Promise<void>;
  remove(okrId: string): Promise<void>;
  updateKeyResult(krId: string, input: UpdateTeamKRInput): Promise<void>;
}
