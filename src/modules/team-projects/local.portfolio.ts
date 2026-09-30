// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — portefeuille en mode DÉMO (mig. 153, M2)
//
// Dépendances et équipes associées des projets en localStorage. Rejoue les
// gardes que la base applique par trigger (même organisation, pas de cycle) :
// sans elles, la démo laisserait construire ce que la
// production refuse.
//
// Séparé de `local.repository.ts` pour le garder sous le plafond de 600 lignes.
// ═══════════════════════════════════════════════════════════════════

import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { DEPENDENCY_ERRORS, makeDependencyError } from '@/modules/tasks/dependency-errors';
import type {
  TeamProject,
  TeamProjectDependency,
  TeamProjectTeam,
} from './types';
import { DEMO_PROJECT_DEPENDENCIES } from './demo-seed';

// Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`.
export const TEAM_PROJECT_DEPENDENCIES_STORAGE_KEY = 'cosmo_team_project_dependencies';

function readOrSeed<T>(key: string, seed: T): T {
  const raw = safeGetItem(key);
  if (raw) {
    try { return JSON.parse(raw) as T; } catch { /* réensemence (B14) */ }
  }
  const clone = JSON.parse(JSON.stringify(seed)) as T;
  safeSetItem(key, JSON.stringify(clone));
  return clone;
}

const readDependencies = (): TeamProjectDependency[] =>
  readOrSeed(TEAM_PROJECT_DEPENDENCIES_STORAGE_KEY, DEMO_PROJECT_DEPENDENCIES);

export function getProjectDependencies(orgId: string, projects: TeamProject[]): TeamProjectDependency[] {
  const inOrg = new Set(projects.filter((p) => p.orgId === orgId).map((p) => p.id));
  return readDependencies().filter((d) => inOrg.has(d.projectId) && inOrg.has(d.dependsOnId));
}

/** `true` si `dependsOnId` dépend déjà, directement ou non, de `projectId`. */
export function wouldCycle(deps: TeamProjectDependency[], projectId: string, dependsOnId: string): boolean {
  const seen = new Set<string>();
  const stack = [dependsOnId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === projectId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const d of deps) if (d.projectId === current) stack.push(d.dependsOnId);
  }
  return false;
}

export function addProjectDependency(projectId: string, dependsOnId: string, projects: TeamProject[]): void {
  if (projectId === dependsOnId) throw makeDependencyError(DEPENDENCY_ERRORS.cycle);
  const deps = readDependencies();
  if (deps.some((d) => d.projectId === projectId && d.dependsOnId === dependsOnId)) return;
  const a = projects.find((p) => p.id === projectId);
  const b = projects.find((p) => p.id === dependsOnId);
  if (!a || !b) throw makeDependencyError(DEPENDENCY_ERRORS.taskMissing);
  if (a.orgId !== b.orgId) throw makeDependencyError(DEPENDENCY_ERRORS.crossAccount);
  if (wouldCycle(deps, projectId, dependsOnId)) throw makeDependencyError(DEPENDENCY_ERRORS.cycle);
  writeJsonOrThrow(TEAM_PROJECT_DEPENDENCIES_STORAGE_KEY, [...deps, { projectId, dependsOnId }]);
}

export function removeProjectDependency(projectId: string, dependsOnId: string): void {
  writeJsonOrThrow(
    TEAM_PROJECT_DEPENDENCIES_STORAGE_KEY,
    readDependencies().filter((d) => !(d.projectId === projectId && d.dependsOnId === dependsOnId)),
  );
}

// ─── Équipes associées (mig. 164) ────────────────────────────────────

export const TEAM_PROJECT_TEAMS_STORAGE_KEY = 'cosmo_team_project_teams';

const readProjectTeams = (): (TeamProjectTeam & { orgId: string })[] =>
  readOrSeed<(TeamProjectTeam & { orgId: string })[]>(TEAM_PROJECT_TEAMS_STORAGE_KEY, []);

export function getProjectTeams(orgId: string): TeamProjectTeam[] {
  return readProjectTeams()
    .filter((r) => r.orgId === orgId)
    .map(({ projectId, teamId }) => ({ projectId, teamId }));
}

export function addProjectTeam(orgId: string, projectId: string, teamId: string, projects: TeamProject[]): void {
  // Même organisation, comme la policy INSERT de la mig. 164.
  const project = projects.find((p) => p.id === projectId);
  if (!project || project.orgId !== orgId) throw makeApiError('not_found');
  const rows = readProjectTeams();
  if (rows.some((r) => r.projectId === projectId && r.teamId === teamId)) return;
  writeJsonOrThrow(TEAM_PROJECT_TEAMS_STORAGE_KEY, [...rows, { orgId, projectId, teamId }]);
}

export function removeProjectTeam(projectId: string, teamId: string): void {
  writeJsonOrThrow(
    TEAM_PROJECT_TEAMS_STORAGE_KEY,
    readProjectTeams().filter((r) => !(r.projectId === projectId && r.teamId === teamId)),
  );
}

/** CASCADE de la purge d'un projet : dépendances, équipes associées. */
export function purgeProjectPortfolio(projectId: string): void {
  writeJsonOrThrow(
    TEAM_PROJECT_DEPENDENCIES_STORAGE_KEY,
    readDependencies().filter((d) => d.projectId !== projectId && d.dependsOnId !== projectId),
  );
  writeJsonOrThrow(TEAM_PROJECT_TEAMS_STORAGE_KEY, readProjectTeams().filter((r) => r.projectId !== projectId));
}
