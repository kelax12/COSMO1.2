// @vitest-environment jsdom
//
// « Deux grammaires de filtre pour la même donnée » — finding P1 de la critique
// UI du 2026-08-27. Les deux onglets partageaient déjà le type
// (`TaskStatusFilter`) et le helper (`filterByStatus`) ; ce qui divergeait,
// c'était la réponse au clic sur une pastille DÉJÀ active : l'onglet Projets la
// désactive, l'onglet Tâches ne faisait rien.
//
// ⚠️ Le second test est le TÉMOIN, et il est le plus important des deux : sans
// lui, on pourrait « unifier » en faisant basculer AUSSI la pastille « Tout »
// sur elle-même — ce qui la rendrait inerte au clic et retirerait la seule
// affordance explicite de retour à l'ensemble. Unifier un geste ne doit pas
// coûter une sortie.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamTasksToolbar from './TeamTasksToolbar';

vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const renderToolbar = (statusFilter: 'open' | 'overdue' | 'doneThisWeek' | 'all') => {
  const onStatusFilter = vi.fn();
  render(
    <TeamTasksToolbar
      searchTerm=""
      onSearchTerm={() => {}}
      sortField="deadline"
      onSortField={() => {}}
      sortDirection="asc"
      onToggleSortDirection={() => {}}
      statusFilter={statusFilter}
      onStatusFilter={onStatusFilter}
      canCreate={false}
      onCreate={() => {}}
      shownLabel={null}
    />,
  );
  return onStatusFilter;
};

/** La pastille active porte `aria-pressed="true"` — c'est ce que lit un lecteur d'écran. */
const pressed = () =>
  screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');

describe('TeamTasksToolbar — une seule grammaire de filtre', () => {
  it("re-cliquer une pastille ACTIVE revient à « Tout », comme dans l'onglet Projets", () => {
    const onStatusFilter = renderToolbar('overdue');
    const active = pressed();
    expect(active).toHaveLength(1);
    fireEvent.click(active[0]);
    expect(onStatusFilter).toHaveBeenCalledWith('all');
  });

  // TÉMOIN — cf. l'en-tête.
  it("la pastille « Tout » reste une sortie explicite et ne se désactive pas elle-même", () => {
    const onStatusFilter = renderToolbar('all');
    const active = pressed();
    expect(active).toHaveLength(1);
    fireEvent.click(active[0]);
    expect(onStatusFilter).toHaveBeenCalledWith('all');
  });

  it('cliquer une pastille INACTIVE applique bien ce filtre', () => {
    const onStatusFilter = renderToolbar('all');
    const inactive = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'false');
    fireEvent.click(inactive[0]);
    expect(onStatusFilter).toHaveBeenCalledTimes(1);
    expect(onStatusFilter).not.toHaveBeenCalledWith('all');
  });
});
