// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — portefeuille en mode DÉMO (mig. 153, M2)
//
// Jalons et dépendances entre projets en localStorage. Rejoue les gardes que
// la base applique par trigger (même organisation, pas de cycle, un jalon ne
// change pas de projet) : sans elles, la démo laisserait construire ce que la
// production refuse.
//
// Séparé de `local.repository.ts` pour le garder sous le plafond de 600 lignes.
// ═══════════════════════════════════════════════════════════════════

import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { DEPENDENCY_ERRORS, makeDependencyError } from '@/modules/tasks/dependency-errors';
import type {
  CreateTeamProjectMilestoneInput,
  TeamProject,
  TeamProjectDependency,
  TeamProjectMilestone,
  UpdateTeamProjectMilestoneInput,
} from './types';
import { DEMO_MILESTONES, DEMO_MILESTONES_EN, DEMO_PROJECT_DEPENDENCIES } from './demo-seed';

// Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`.
export const TEAM_PROJECT_MILESTONES_STORAGE_KEY = 'cosmo_team_project_milestones';
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

const readMilestones = (): TeamProjectMilestone[] =>
  readOrSeed(TEAM_PROJECT_MILESTONES_STORAGE_KEY, localizeSeed(DEMO_MILESTONES, DEMO_MILESTONES_EN));
const readDependencies = (): TeamProjectDependency[] =>
  readOrSeed(TEAM_PROJECT_DEPENDENCIES_STORAGE_KEY, DEMO_PROJECT_DEPENDENCIES);

export function getMilestones(orgId: string): TeamProjectMilestone[] {
  return readMilestones()
    .filter((m) => m.orgId === orgId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function createMilestone(
  orgId: string,
  input: CreateTeamProjectMilestoneInput,
  projects: TeamProject[],
): void {
  // `org_id` se déduit du projet, jamais de l'appelant (trigger de la mig. 153).
  const project = projects.find((p) => p.id === input.projectId);
  if (!project || project.orgId !== orgId) throw makeApiError('not_found');
  const name = input.name.trim();
  if (!name || name.length > 200 || !input.dueDate) throw makeApiError('invalid_input');
  writeJsonOrThrow(TEAM_PROJECT_MILESTONES_STORAGE_KEY, [
    ...readMilestones(),
    {
      id: crypto.randomUUID(),
      orgId: project.orgId,
      projectId: project.id,
      name,
      dueDate: input.dueDate,
      completedAt: null,
      createdAt: new Date().toISOString(),
    } satisfies TeamProjectMilestone,
  ]);
}

export function updateMilestone(milestoneId: string, input: UpdateTeamProjectMilestoneInput): void {
  const all = readMilestones();
  const m = all.find((x) => x.id === milestoneId);
  if (!m) throw makeApiError('not_found');
  if (input.name !== undefined) m.name = input.name.trim();
  if (input.dueDate !== undefined) m.dueDate = input.dueDate;
  if (input.completed !== undefined) m.completedAt = input.completed ? new Date().toISOString() : null;
  writeJsonOrThrow(TEAM_PROJECT_MILESTONES_STORAGE_KEY, all);
}

export function deleteMilestone(milestoneId: string): void {
  writeJsonOrThrow(TEAM_PROJECT_MILESTONES_STORAGE_KEY, readMilestones().filter((m) => m.id !== milestoneId));
}

/** Jalons d'un projet, pour la duplication (copiés sous le nouveau projet). */
export function milestonesOf(projectId: string): TeamProjectMilestone[] {
  return readMilestones().filter((m) => m.projectId === projectId);
}

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
