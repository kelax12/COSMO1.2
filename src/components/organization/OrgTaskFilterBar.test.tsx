// @vitest-environment jsdom
//
// La barre de filtres UNIQUE des onglets Tâches et Projets (cohérence globale,
// 2026-09-25), et son état dans l'URL.
//
// Reprend les trois cas de `TeamTasksToolbar.filter.test.tsx` (critique UI du
// 2026-08-27, « deux grammaires de filtre ») : ils valent désormais pour les
// deux onglets à la fois, puisqu'ils n'ont plus qu'une barre.
//
// ⚠️ Le TÉMOIN reste le plus important : « Tout » ne doit jamais se désactiver
// lui-même, sinon on retire la seule sortie explicite vers l'ensemble.
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { ensureNamespaces } from '@/i18n/catalog';
import { render, screen, fireEvent } from '@testing-library/react';
import OrgTaskFilterBar from './OrgTaskFilterBar';
import {
  readTaskFilters, writeTaskFilters, hasActiveTaskFilter, matchesScope, matchesAttributes, type OrgTaskFilters,
} from './task-filters';
import type { TaskStatusFilter } from './team-projects.helpers';

vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const base: OrgTaskFilters = {
  team: '', assignee: null, project: null, status: 'all', q: '',
  priorities: [], dueFrom: '', dueTo: '', noDue: false, category: null, label: null, group: 'none',
};

const renderBar = (status: TaskStatusFilter) => {
  const setFilters = vi.fn();
  render(
    <OrgTaskFilterBar
      filters={{ ...base, status }}
      setFilters={setFilters}
      defaultStatus="open"
      members={[]}
      teams={[]}
      searchPlaceholder="…"
      searchAria="Rechercher"
    />,
  );
  return setFilters;
};

/** Pastilles d'état : le groupe nommé « Filtrer par état ». */
const statusButtons = () =>
  Array.from(screen.getByRole('group', { name: /état|state/i }).querySelectorAll('button'));

describe('OrgTaskFilterBar — une seule grammaire de filtre', () => {
  // Les libellés de la barre vivent dans `portfolio`, chargé avec les onglets.
  beforeAll(async () => {
    await ensureNamespaces(['portfolio'], 'fr');
  });

  it('re-cliquer une pastille ACTIVE revient à « Tout »', () => {
    const setFilters = renderBar('overdue');
    const active = statusButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(active).toHaveLength(1);
    fireEvent.click(active[0]);
    expect(setFilters).toHaveBeenCalledWith({ status: 'all' });
  });

  // TÉMOIN — cf. l'en-tête.
  it('la pastille « Tout » reste une sortie explicite et ne se désactive pas elle-même', () => {
    const setFilters = renderBar('all');
    const active = statusButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');
    fireEvent.click(active[0]);
    expect(setFilters).toHaveBeenCalledWith({ status: 'all' });
  });

  it('cliquer une pastille INACTIVE applique ce filtre', () => {
    const setFilters = renderBar('all');
    const inactive = statusButtons().filter((b) => b.getAttribute('aria-pressed') === 'false');
    fireEvent.click(inactive[0]);
    expect(setFilters).toHaveBeenCalledTimes(1);
    expect(setFilters).not.toHaveBeenCalledWith({ status: 'all' });
  });
});

describe("task-filters — l'état vit dans l'URL", () => {
  it('relit ce qu il écrit, sans toucher aux adresses d objet', () => {
    const f: OrgTaskFilters = { ...base, team: 't1', assignee: 'u1', project: 'p1', status: 'overdue', q: 'devis' };
    const url = writeTaskFilters(new URLSearchParams('?project=pageProjet&task=x'), f, 'open');
    expect(readTaskFilters(url, 'open')).toEqual(f);
    expect(url.get('project')).toBe('pageProjet');
    expect(url.get('task')).toBe('x');
  });

  it("l'état par défaut de l'onglet n'est pas écrit : l'URL nue reste l'arrivée", () => {
    const url = writeTaskFilters(new URLSearchParams(), { ...base, status: 'open' }, 'open');
    expect(url.toString()).toBe('');
    expect(readTaskFilters(url, 'open').status).toBe('open');
    expect(readTaskFilters(url, 'all').status).toBe('all');
  });

  it('une valeur hors vocabulaire est ignorée', () => {
    const f = readTaskFilters(new URLSearchParams('?fStatus=pwned&fTeam=../x&fAssignee=<b>'), 'open');
    expect(f).toEqual({ ...base, status: 'open' });
  });

  it('« sans équipe » est une valeur, pas une absence', () => {
    expect(readTaskFilters(new URLSearchParams('?fTeam=org'), 'all').team).toBe('org');
  });

  it('hasActiveTaskFilter compare au défaut de l onglet', () => {
    expect(hasActiveTaskFilter({ ...base, status: 'open' }, 'open')).toBe(false);
    expect(hasActiveTaskFilter({ ...base, status: 'all' }, 'open')).toBe(true);
  });

  it('matchesScope : équipe via le projet, « org » = projet sans équipe', () => {
    const teamOf = (id: string) => (id === 'pA' ? 't1' : null);
    const task = (projectId: string, assigneeIds: string[] = []) => ({ projectId, assigneeIds });
    expect(matchesScope(task('pA'), { team: 't1', assignee: null }, teamOf)).toBe(true);
    expect(matchesScope(task('pB'), { team: 't1', assignee: null }, teamOf)).toBe(false);
    expect(matchesScope(task('pB'), { team: 'org', assignee: null }, teamOf)).toBe(true);
    expect(matchesScope(task('pA', ['u1']), { team: '', assignee: 'u2' }, teamOf)).toBe(false);
  });
});

describe("task-filters — attributs de la tâche (audit 2026-09-24)", () => {
  const task = (over: Partial<{ priority: number; deadline: string; categoryId: string | null; id: string }> = {}) =>
    ({ id: 't', priority: 3, deadline: '', categoryId: null, ...over });

  it('priorité, plage et « sans échéance » passent par l URL, et en reviennent', () => {
    const f: OrgTaskFilters = { ...base, priorities: [4, 1], dueFrom: '2026-09-01', dueTo: '2026-09-30', category: 'c1', label: 'l1', group: 'assignee' };
    const back = readTaskFilters(writeTaskFilters(new URLSearchParams(), f, 'all'), 'all');
    expect(back).toEqual({ ...f, priorities: [1, 4] });
    expect(hasActiveTaskFilter({ ...base, priorities: [2] }, 'all')).toBe(true);
  });

  it('une URL hostile ne fabrique ni priorité ni date ni regroupement', () => {
    const f = readTaskFilters(new URLSearchParams('?fPrio=0,9,x,2&fDueFrom=hier&fGroup=drop'), 'all');
    expect(f.priorities).toEqual([2]);
    expect(f.dueFrom).toBe('');
    expect(f.group).toBe('none');
  });

  it('matchesAttributes : bornes incluses, sans échéance exclue d une plage', () => {
    const f = { priorities: [], dueFrom: '2026-09-10', dueTo: '2026-09-20', noDue: false, category: null, label: null };
    expect(matchesAttributes(task({ deadline: '2026-09-10' }), f)).toBe(true);
    expect(matchesAttributes(task({ deadline: '2026-09-20' }), f)).toBe(true);
    expect(matchesAttributes(task({ deadline: '2026-09-21' }), f)).toBe(false);
    expect(matchesAttributes(task({ deadline: '' }), f)).toBe(false);
    expect(matchesAttributes(task({ deadline: '' }), { ...f, dueFrom: '', dueTo: '', noDue: true })).toBe(true);
  });

  it('matchesAttributes : une sous-catégorie est dans sa mère ; étiquette non encore lue = rien', () => {
    const f = { priorities: [], dueFrom: '', dueTo: '', noDue: false, category: 'mere', label: null };
    expect(matchesAttributes(task({ categoryId: 'fille' }), f, { categoryIds: new Set(['mere', 'fille']) })).toBe(true);
    expect(matchesAttributes(task({ categoryId: null }), f, { categoryIds: new Set(['mere']) })).toBe(false);
    const withLabel = { ...f, category: null, label: 'l1' };
    // TÉMOIN : tant que la jonction n'est pas lue, le filtre ne laisse RIEN passer.
    expect(matchesAttributes(task({ id: 'a' }), withLabel)).toBe(false);
    expect(matchesAttributes(task({ id: 'a' }), withLabel, { labelTaskIds: new Set(['a']) })).toBe(true);
  });
});
