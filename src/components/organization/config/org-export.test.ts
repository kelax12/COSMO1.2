import { describe, it, expect } from 'vitest';
import type { TeamTask } from '@/modules/team-projects';
import { buildTasksIcs, icsEscape } from './org-export';

const task = (id: string, deadline: string, name = id): TeamTask => ({
  id, orgId: 'o', projectId: 'p', name, priority: 3, assigneeIds: [], createdBy: 'u', completed: false,
  status: 'todo', createdAt: '', updatedAt: '', deadline,
});

describe('buildTasksIcs', () => {
  it('un événement journée entière par échéance, UID stable, fin exclusive au lendemain', () => {
    const ics = buildTasksIcs([task('a', '2026-12-31', 'Bilan; fin, année')], () => 'Projet', new Date('2026-09-26T10:00:00Z'));
    expect(ics).toContain('UID:team-task-a@thecosmo.app');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
    expect(ics).toContain('SUMMARY:Bilan\\; fin\\, année');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });

  it('une tâche sans échéance n entre pas', () => {
    expect(buildTasksIcs([task('b', '')], () => '')).not.toContain('BEGIN:VEVENT');
  });

  it('icsEscape échappe l antislash et les sauts de ligne', () => {
    expect(icsEscape('a\\b\nc')).toBe('a\\\\b\\nc');
  });
});
