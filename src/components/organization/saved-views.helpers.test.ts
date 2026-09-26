import { describe, expect, it } from 'vitest';
import { aText, anId, oneOf } from './use-url-filters';
import { projectDisplayViewParams, viewParamsToProjectDisplay, type ProjectsUiPrefs } from './team-projects.helpers';
import { taskFiltersToViewParams, viewParamsToTaskFilters } from './task-filters';

const prefs = (over: Partial<ProjectsUiPrefs> = {}): ProjectsUiPrefs => ({
  ...(viewParamsToProjectDisplay({}) as ProjectsUiPrefs),
  collapsed: {}, kanbanGroupBy: 'status', timelineGroupBy: 'project', ...over,
} as ProjectsUiPrefs);

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

  it('Projets : affichage → paramètres → affichage, aller-retour fidèle', () => {
    const p = prefs({ view: 'kanban', viewChosen: true, sort: 'dueDate', showArchived: true });
    const params = projectDisplayViewParams(p);
    expect(params).toEqual({ view: 'kanban', sort: 'dueDate', archived: '1' });
    expect(viewParamsToProjectDisplay(params)).toEqual({ view: 'kanban', viewChosen: true, sort: 'dueDate', showArchived: true });
  });

  it('Projets : une vue vide ramène l affichage au défaut', () => {
    expect(projectDisplayViewParams(prefs())).toEqual({});
  });

  it('Filtres : les mêmes clés qu un lien partagé, et une valeur forgée ne passe pas', () => {
    const f = {
      team: 't1', assignee: 'u1', project: null, status: 'overdue' as const, q: 'devis',
      priorities: [], dueFrom: '', dueTo: '', noDue: false, category: null, label: null, group: 'none' as const,
    };
    const params = taskFiltersToViewParams(f, 'all');
    expect(params).toEqual({ fTeam: 't1', fAssignee: 'u1', fStatus: 'overdue', fQ: 'devis' });
    expect(viewParamsToTaskFilters(params, 'all')).toEqual(f);
    expect(viewParamsToTaskFilters({ fTeam: '<img>', fAssignee: 'a b', fStatus: 'z' }, 'all'))
      .toMatchObject({ team: '', assignee: null, status: 'all' });
    expect(viewParamsToProjectDisplay({ view: 'hack', sort: 'x' })).toMatchObject({ view: 'list', viewChosen: false, sort: 'recent' });
  });
});
