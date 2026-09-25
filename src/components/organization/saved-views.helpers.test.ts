import { describe, expect, it } from 'vitest';
import { aText, anId, oneOf } from './use-url-filters';
import { projectPrefsToViewParams, viewParamsToProjectPrefs, type ProjectsUiPrefs } from './team-projects.helpers';

const prefs = (over: Partial<ProjectsUiPrefs> = {}): ProjectsUiPrefs => ({
  view: 'list', viewChosen: false, sort: 'recent', assigneeFilter: null, teamFilter: '', collapsed: {},
  showArchived: false, statusFilter: 'all', kanbanGroupBy: 'status', timelineGroupBy: 'project', ...over,
});

describe('vues enregistrées (mig. 192) — filtres lus dans une URL non fiable', () => {
  it('une énumération rend le défaut pour toute valeur hors liste', () => {
    const parse = oneOf(['open', 'all'] as const, 'open');
    expect(parse('all')).toBe('all');
    expect(parse('DROP TABLE')).toBe('open');
  });

  it('un identifiant malformé est ignoré, un texte est borné', () => {
    expect(anId(null)('abc-123_X')).toBe('abc-123_X');
    expect(anId(null)('../../etc')).toBeNull();
    expect(aText(5)('abcdefgh')).toBe('abcde');
  });

  it('Projets : préférences → paramètres → préférences, aller-retour fidèle', () => {
    const p = prefs({ view: 'kanban', viewChosen: true, sort: 'dueDate', teamFilter: 't1', assigneeFilter: 'u1', statusFilter: 'overdue', showArchived: true });
    const params = projectPrefsToViewParams(p);
    expect(params).toEqual({ view: 'kanban', sort: 'dueDate', team: 't1', assignee: 'u1', status: 'overdue', archived: '1' });
    expect(viewParamsToProjectPrefs(params)).toEqual({
      view: 'kanban', viewChosen: true, sort: 'dueDate', teamFilter: 't1', assigneeFilter: 'u1', statusFilter: 'overdue', showArchived: true,
    });
  });

  it('Projets : une vue vide ramène tous les filtres au défaut', () => {
    expect(projectPrefsToViewParams(prefs())).toEqual({});
    expect(viewParamsToProjectPrefs({})).toEqual({
      view: 'list', viewChosen: false, sort: 'recent', teamFilter: '', assigneeFilter: null, statusFilter: 'all', showArchived: false,
    });
  });

  it('Projets : une valeur forgée dans une vue ne passe pas', () => {
    const next = viewParamsToProjectPrefs({ view: 'hack', sort: 'x', team: '<img>', assignee: 'a b', status: 'z' });
    expect(next).toMatchObject({ view: 'list', viewChosen: false, sort: 'recent', teamFilter: '', assigneeFilter: null, statusFilter: 'all' });
  });
});
