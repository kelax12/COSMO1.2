// ═══════════════════════════════════════════════════════════════════
// Vue de la page Tâches : Liste ou Tableau, mémorisée par appareil
//
// Store externe plutôt qu'un état de `TasksPage` : la bascule vit dans
// l'en-tête (`TasksHeader`) et le rendu dans la page, et `TasksPage` est à
// 558 lignes pour un plafond de 600 (`architecture.guard`). Même forme que
// `pages/tasks/search-open.store.ts`, sauf que c'est une PRÉFÉRENCE : elle
// survit au démontage et au rechargement (localStorage, via `safe-json`).
// ═══════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/safe-json';

export type TasksView = 'list' | 'board';
export const TASKS_VIEW_KEY = 'cosmo_tasks_view';

const listeners = new Set<() => void>();

export function readTasksView(): TasksView {
  return safeGetItem(TASKS_VIEW_KEY) === 'board' ? 'board' : 'list';
}

let current: TasksView = readTasksView();

export function setTasksView(view: TasksView): void {
  current = view;
  safeSetItem(TASKS_VIEW_KEY, view);
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTasksView(): TasksView {
  return useSyncExternalStore(subscribe, () => current, () => 'list');
}

// ─── Axe des colonnes du Tableau : Statut ou État (2026-10-09) ─────
// Même mécanique : préférence par appareil, lue par le Tableau seul.

export type BoardAxis = 'status' | 'health';
export const TASKS_BOARD_AXIS_KEY = 'cosmo_tasks_board_axis';

export function readBoardAxis(): BoardAxis {
  return safeGetItem(TASKS_BOARD_AXIS_KEY) === 'health' ? 'health' : 'status';
}

let currentAxis: BoardAxis = readBoardAxis();

export function setBoardAxis(axis: BoardAxis): void {
  currentAxis = axis;
  safeSetItem(TASKS_BOARD_AXIS_KEY, axis);
  listeners.forEach((listener) => listener());
}

export function useBoardAxis(): BoardAxis {
  return useSyncExternalStore(subscribe, () => currentAxis, () => 'status');
}
