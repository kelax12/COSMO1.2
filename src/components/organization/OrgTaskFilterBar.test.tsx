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
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrgTaskFilterBar from './OrgTaskFilterBar';
import {
  readTaskFilters, writeTaskFilters, hasActiveTaskFilter, matchesScope, type OrgTaskFilters,
} from './task-filters';
import type { TaskStatusFilter } from './team-projects.helpers';

vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const base: OrgTaskFilters = { team: '', assignee: null, project: null, status: 'all', q: '' };

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
    const f: OrgTaskFilters = { team: 't1', assignee: 'u1', project: 'p1', status: 'overdue', q: 'devis' };
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
