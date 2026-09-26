// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import {
  TeamOKR,
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
  SyncTeamKRInput,
} from './types';

export interface ITeamOKRsRepository {
  getAll(orgId: string): Promise<TeamOKR[]>;
  create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR>;
  update(okrId: string, input: UpdateTeamOKRInput): Promise<void>;
  remove(okrId: string): Promise<void>;
  updateKeyResult(krId: string, input: UpdateTeamKRInput): Promise<void>;
  /**
   * Synchronise l'ensemble des KR d'un OKR (édition) : met à jour les KR
   * existants (id présent), insère les nouveaux, supprime les absents.
   */
  /**
   * Remplace les KR d'un objectif. Rend les identifiants dans l'ordre de
   * `krs` (existant ou créé), pour qu'on puisse y relier des projets : un
   * identifiant de KR neuf est généré par le dépôt, jamais pris dans la saisie.
   */
  syncKeyResults(okrId: string, orgId: string, krs: SyncTeamKRInput[]): Promise<string[]>;
}
