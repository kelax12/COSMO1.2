// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — étiquettes et historique par tâche en mode DÉMO
// (mig. 093 et 094)
//
// Retirés le 2026-09-05 (C-49) faute d'écran, rebranchés le 2026-09-25 par
// la fiche de tâche d'équipe (onglet Détails et onglet Historique). Séparé de
// `local.repository.ts` pour le garder sous le plafond de 600 lignes.
// ═══════════════════════════════════════════════════════════════════

import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { CreateTeamLabelInput, TeamLabel, TeamTaskActivity, TeamTaskLabel } from './types';
import {
  TEAM_LABELS_STORAGE_KEY,
  TEAM_TASK_LABELS_STORAGE_KEY,
  TEAM_TASK_ACTIVITY_STORAGE_KEY,
} from './constants';
import { DEMO_USER_ID, DEMO_LABELS, DEMO_LABELS_EN, DEMO_TASK_LABELS, DEMO_ACTIVITY } from './demo-seed';

/** Même lecture que `local.repository.ts` : une valeur illisible est ré-ensemencée. */
function readOrSeed<T>(key: string, seed: T): T {
  const data = safeGetItem(key);
  if (data) {
    try {
      return JSON.parse(data) as T;
    } catch {
      // illisible : on repart de la graine, comme au premier passage
    }
  }
  const clone = JSON.parse(JSON.stringify(seed)) as T;
  safeSetItem(key, JSON.stringify(clone));
  return clone;
}

const labelsArray = (): TeamLabel[] =>
  readOrSeed<TeamLabel[]>(TEAM_LABELS_STORAGE_KEY, localizeSeed(DEMO_LABELS, DEMO_LABELS_EN));
const taskLabelsArray = (): TeamTaskLabel[] =>
  readOrSeed<TeamTaskLabel[]>(TEAM_TASK_LABELS_STORAGE_KEY, DEMO_TASK_LABELS);

export const getLabels = (orgId: string): TeamLabel[] =>
  labelsArray()
    .filter((l) => l.orgId === orgId)
    .sort((a, b) => a.name.localeCompare(b.name));

export const createLabel = (orgId: string, input: CreateTeamLabelInput): TeamLabel => {
  const all = labelsArray();
  // Miroir de l'index unique insensible à la casse (mig. 093) : sans lui, la
  // démo accepterait « bug » et « Bug » là où la prod renverrait une erreur.
  const wanted = input.name.trim().toLowerCase();
  if (all.some((l) => l.orgId === orgId && l.name.trim().toLowerCase() === wanted)) {
    throw makeApiError('duplicate_label');
  }
  const label: TeamLabel = {
    id: crypto.randomUUID(),
    orgId,
    name: input.name.trim(),
    color: input.color ?? '#6366f1',
    createdBy: DEMO_USER_ID,
    createdAt: new Date().toISOString(),
  };
  writeJsonOrThrow(TEAM_LABELS_STORAGE_KEY, [...all, label]);
  return label;
};

export const getTaskLabels = (taskId: string): TeamTaskLabel[] =>
  taskLabelsArray().filter((tl) => tl.taskId === taskId);

export const addTaskLabel = (taskId: string, labelId: string): void => {
  const all = taskLabelsArray();
  // Miroir de la PK composite : poser deux fois la même étiquette est un no-op.
  if (all.some((tl) => tl.taskId === taskId && tl.labelId === labelId)) return;
  writeJsonOrThrow(TEAM_TASK_LABELS_STORAGE_KEY, [...all, { taskId, labelId }]);
};

export const removeTaskLabel = (taskId: string, labelId: string): void => {
  writeJsonOrThrow(
    TEAM_TASK_LABELS_STORAGE_KEY,
    taskLabelsArray().filter((tl) => !(tl.taskId === taskId && tl.labelId === labelId)),
  );
};

/**
 * En production ce journal est écrit par un trigger. En démo il n'y a pas de
 * base : on rend ce qui a été semé, sans jamais l'écrire depuis l'interface.
 * C'est ce qui garde la même propriété append-only des deux côtés.
 */
export const getTaskActivity = (taskId: string): TeamTaskActivity[] =>
  readOrSeed<TeamTaskActivity[]>(TEAM_TASK_ACTIVITY_STORAGE_KEY, DEMO_ACTIVITY)
    .filter((a) => a.taskId === taskId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
