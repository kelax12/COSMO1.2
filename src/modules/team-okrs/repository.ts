// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import {
  TeamOKR,
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
  SyncTeamKRInput,
  TrashedTeamOKR,
} from './types';

export interface ITeamOKRsRepository {
  getAll(orgId: string): Promise<TeamOKR[]>;
  create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR>;
  update(okrId: string, input: UpdateTeamOKRInput): Promise<void>;
  /**
   * Met l'objectif à la CORBEILLE (mig. 193), jamais un DELETE : ses KR, points
   * d'étape et liens de projets disparaissent avec lui et reviennent avec
   * `restore`. Purge définitive à 30 jours.
   */
  remove(okrId: string): Promise<void>;
  /** Objectifs que l'appelant peut restaurer, les plus récents d'abord. */
  getTrash(orgId: string): Promise<TrashedTeamOKR[]>;
  restore(okrId: string): Promise<void>;
  /** Suppression DÉFINITIVE depuis la corbeille — admin seulement. */
  purge(okrId: string): Promise<void>;
  updateKeyResult(krId: string, input: UpdateTeamKRInput): Promise<void>;
  /**
   * Synchronise l'ensemble des KR d'un OKR (édition) : met à jour les KR
   * existants (id présent), insère les nouveaux, supprime les absents.
   */
  syncKeyResults(okrId: string, orgId: string, krs: SyncTeamKRInput[]): Promise<void>;
}
