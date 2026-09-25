// @vitest-environment jsdom
//
// Actions groupées de l'onglet Projets (audit 2026-09-24) : réassigner,
// déplacer, changer de statut, chacune avec son « Annuler », dans toutes les
// vues. Ce qu'on vérifie : seules les tâches qui CHANGENT sont écrites, et
// l'annulation réécrit l'état d'AVANT, tâche par tâche.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TeamTask, UpdateTeamTaskInput } from '@/modules/team-projects';

// `showUndoToast` est de l'interface : on capture l'action d'annulation.
let capturedUndo: (() => void) | null = null;
let capturedLabel = '';
vi.mock('@/lib/undo-toast', () => ({
  showUndoToast: (label: string, onUndo: () => void) => { capturedLabel = label; capturedUndo = onUndo; },
}));

import { nextAssignees, useTeamTasksSelection } from './use-team-tasks-selection';

const task = (patch: Partial<TeamTask>): TeamTask => ({
  id: 't', orgId: 'o', projectId: 'p1', name: 'T', priority: 3, deadline: '',
  assigneeIds: [], createdBy: 'u', completed: false, status: 'todo', completedAt: null,
  createdAt: '', updatedAt: '', ...patch,
});

describe('nextAssignees', () => {
  it('ajoute sans retirer personne (une tâche partagée garde ses co-assignés)', () => {
    expect(nextAssignees(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });
  it('ne duplique pas un assigné déjà présent', () => {
    expect(nextAssignees(['a'], 'a')).toEqual(['a']);
  });
  it('null retire tout le monde', () => {
    expect(nextAssignees(['a', 'b'], null)).toEqual([]);
  });
});

describe('useTeamTasksSelection — lots avec « Annuler »', () => {
  const tasks = [
    task({ id: '1', projectId: 'p1', assigneeIds: ['a'], status: 'todo' }),
    task({ id: '2', projectId: 'p2', assigneeIds: ['z'], status: 'review' }),
  ];
  let updateTask: ReturnType<typeof vi.fn<(task: TeamTask, input: UpdateTeamTaskInput) => void>>;

  const setup = (canAssign?: (id: string) => boolean) => {
    const hook = renderHook(() => useTeamTasksSelection({
      visibleTasks: tasks,
      setCompleted: vi.fn(),
      deleteTask: vi.fn(),
      restoreTask: vi.fn(),
      deletedLabel: (n) => `${n} supprimées`,
      updateTask,
      labels: { reassigned: (n) => `${n} réassignées`, moved: (n) => `${n} déplacées`, statusChanged: (n) => `${n} mises à jour` },
      canAssign,
    }));
    act(() => { hook.result.current.toggleSelect(tasks[0]); hook.result.current.toggleSelect(tasks[1]); });
    return hook;
  };

  beforeEach(() => {
    updateTask = vi.fn<(task: TeamTask, input: UpdateTeamTaskInput) => void>();
    capturedUndo = null;
    capturedLabel = '';
  });

  it('déplace seulement ce qui change, puis l’annulation remet chaque projet d’origine', () => {
    const hook = setup();
    act(() => hook.result.current.bulkMove('p2'));
    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask).toHaveBeenCalledWith(tasks[0], { projectId: 'p2' });
    expect(capturedLabel).toBe('1 déplacées');
    updateTask.mockClear();
    act(() => capturedUndo!());
    expect(updateTask).toHaveBeenCalledWith(tasks[0], { projectId: 'p1' });
    expect(hook.result.current.selectedIds.size).toBe(0);
  });

  it('réassigne en AJOUTANT, et l’annulation rend la liste d’avant', () => {
    const hook = setup();
    act(() => hook.result.current.bulkAssign('b'));
    expect(updateTask).toHaveBeenCalledWith(tasks[0], { assigneeIds: ['a', 'b'] });
    expect(updateTask).toHaveBeenCalledWith(tasks[1], { assigneeIds: ['z', 'b'] });
    updateTask.mockClear();
    act(() => capturedUndo!());
    expect(updateTask).toHaveBeenCalledWith(tasks[0], { assigneeIds: ['a'] });
    expect(updateTask).toHaveBeenCalledWith(tasks[1], { assigneeIds: ['z'] });
  });

  it('refuse un ajout hors portée d’assignation (mig. 115) sans rien écrire', () => {
    const hook = setup((id) => id !== 'b');
    act(() => hook.result.current.bulkAssign('b'));
    expect(updateTask).not.toHaveBeenCalled();
    expect(capturedUndo).toBeNull();
  });

  it('change le statut par `status` seul, et l’annule tâche par tâche', () => {
    const hook = setup();
    act(() => hook.result.current.bulkSetStatus('review'));
    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask).toHaveBeenCalledWith(tasks[0], { status: 'review' });
    updateTask.mockClear();
    act(() => capturedUndo!());
    expect(updateTask).toHaveBeenCalledWith(tasks[0], { status: 'todo' });
  });
});
