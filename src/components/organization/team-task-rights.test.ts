import { describe, it, expect } from 'vitest';
import { canDeleteTeamTask, canEditTeamTask } from './team-task-rights';

// Miroir des policies (mig. 115, 152) : les menus ne proposent plus ce que le
// serveur refuserait (audit du 2026-09-24).
describe('droits sur une tâche d’équipe', () => {
  const task = { createdBy: 'author', assigneeIds: ['doer'] };
  const none = { 'task.editAny': false, 'task.deleteAny': false };

  it('modifier : editAny, créateur ou assigné', () => {
    expect(canEditTeamTask(none, 'author', task)).toBe(true);
    expect(canEditTeamTask(none, 'doer', task)).toBe(true);
    expect(canEditTeamTask(none, 'other', task)).toBe(false);
    expect(canEditTeamTask({ 'task.editAny': true }, 'other', task)).toBe(true);
    expect(canEditTeamTask(none, undefined, task)).toBe(false);
  });

  it('supprimer : deleteAny ou créateur, jamais le simple assigné', () => {
    expect(canDeleteTeamTask(none, 'author', task)).toBe(true);
    expect(canDeleteTeamTask(none, 'doer', task)).toBe(false);
    expect(canDeleteTeamTask({ 'task.deleteAny': true }, 'other', task)).toBe(true);
  });
});
