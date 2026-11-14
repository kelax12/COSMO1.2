// @vitest-environment jsdom
//
// Filet de caractérisation du tableau de tâches (vague 15.1, TST-02).
//
// Couvre `TaskTable` et `src/components/task-table/` : tri, filtres rapides,
// sélection multiple, actions de ligne, clavier, états vides, échéances et
// longue liste. Les vrais hooks tournent sur les dépôts de démonstration ; la
// page n'est pas montée (c'est `TasksPage.test.tsx`).
//
// Deux familles sont nommées pour que les vagues qui suivent les retrouvent :
//   - « ÉCHÉANCE » : vague 13 (l'échéance devient un jour stocké comme tel) ;
//   - « LONGUE LISTE » : vague 14 (chargement par pages).
//
// Le DOM contient À LA FOIS le tableau desktop et les cartes mobiles (la
// bascule est en CSS, que jsdom n'applique pas) : on interroge le tableau avec
// `within(table)` et les cartes par leur raccourci annoncé.
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import TaskTable from './TaskTable';
import {
  renderApp, resetDemoWorld, setViewport, makeTask, storedTasks, fakeAuth, fakeBilling,
  dayKeyFromToday, TODAY_KEY, lazyT, findFiche, warmDemoCaches } from '@/test/tasks-ui-harness';
import { storedDeadlineInstant, deadlineDayKey } from '@/lib/deadline';
import { useTimezonePref, todayKeyInTz, addDaysToKey } from '@/lib/timezone';
import type { Task } from '@/modules/tasks';

vi.mock('@/modules/auth/AuthContext', async (orig) => ({
  ...(await orig<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));
vi.mock('@/modules/billing/billing.context', async (orig) => ({
  ...(await orig<typeof import('@/modules/billing/billing.context')>()),
  useBilling: () => fakeBilling(),
}));
const toastSuccess = vi.fn();
vi.mock('@/lib/toast', () => ({
  toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
const undoToast = vi.fn();
vi.mock('@/lib/undo-toast', () => ({ showUndoToast: (...a: unknown[]) => undoToast(...a) }));

const tasksT = lazyT('tasks');

/** Tableau contrôlé comme le fait la page : le parent tient la direction du tri. */
function ControlledTable(props: Partial<React.ComponentProps<typeof TaskTable>> & { initialDir?: 'asc' | 'desc' }) {
  const { initialDir = 'asc', ...rest } = props;
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir);
  const [showCompleted, setShowCompleted] = useState(rest.showCompleted ?? false);
  return (
    <TaskTable
      sortField="priority"
      {...rest}
      sortDirection={dir}
      onSortDirectionChange={setDir}
      showCompleted={showCompleted}
      onShowCompletedChange={setShowCompleted}
    />
  );
}

const table = () => screen.getByRole('table');
// Les lignes des tâches d'ÉQUIPE de l'organisation de démonstration (assignées à
// l'utilisateur de démo) n'ont pas de nom accessible : on ne compte que les lignes perso.
const rowNames = () => within(table()).getAllByRole('row').slice(1).map((r) => r.getAttribute('aria-label')).filter((n): n is string => !!n);
const rowOf = (name: string) => within(table()).getByRole('row', { name });
const stored = (id: string) => storedTasks().find((t) => t.id === id);
const cards = () => document.querySelectorAll('[aria-keyshortcuts="Shift+F10"]');

const BASE: Task[] = [
  makeTask({ id: 'a', name: 'Alpha', priority: 3, dueDay: dayKeyFromToday(2), estimatedTime: 30 }),
  makeTask({ id: 'b', name: 'Bravo', priority: 1, dueDay: dayKeyFromToday(9), estimatedTime: 90, bookmarked: true }),
  makeTask({ id: 'c', name: 'Charlie', priority: 5, dueDay: dayKeyFromToday(-4), estimatedTime: 15 }),
  makeTask({ id: 'd', name: 'Delta', priority: 0, estimatedTime: 0 }),
  makeTask({ id: 'e', name: 'Echo', priority: 2, dueDay: dayKeyFromToday(0), completed: true, completedAt: '2026-11-06T09:00:00.000Z' }),
  makeTask({ id: 'f', name: 'Foxtrot', priority: 4, dueDay: dayKeyFromToday(1), isCollaborative: true }),
];

beforeAll(async () => { await warmDemoCaches(); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY_KEY}T10:00:00`));
  setViewport('desktop');
  resetDemoWorld(BASE);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  toastSuccess.mockReset();
  undoToast.mockReset();
});

describe('TaskTable · affichage et tri', () => {
  it('liste les tâches ouvertes, pas les terminées, triées par priorité (sans priorité en dernier)', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toEqual(['Bravo', 'Alpha', 'Foxtrot', 'Charlie', 'Delta']));
  });

  it('montre priorité, durée et « Pas d\'échéance » sur chaque ligne', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const bravo = within(rowOf('Bravo'));
    expect(bravo.getByText('1')).toBeTruthy();
    expect(bravo.getByText('1 h 30')).toBeTruthy();
    const delta = within(rowOf('Delta'));
    expect(delta.getByLabelText('Aucune priorité')).toBeTruthy();
    expect(delta.getByText("Pas d'échéance")).toBeTruthy();
  });

  it('inverse le tri en recliquant sur l\'en-tête, avec une flèche qui le dit', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const header = within(table()).getByRole('columnheader', { name: /Priorité/ });
    expect(header.textContent).toContain('↑');
    fireEvent.click(header);
    // Une tâche sans priorité (Delta) reste la dernière, quel que soit le sens du tri.
    await waitFor(() => expect(rowNames()).toEqual(['Charlie', 'Foxtrot', 'Alpha', 'Bravo', 'Delta']));
    expect(within(table()).getByRole('columnheader', { name: /Priorité/ }).textContent).toContain('↓');
  });

  it('trie par nom, par échéance (sans échéance en dernier) et par durée', async () => {
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(rowNames()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Foxtrot']));

    fireEvent.click(within(table()).getByRole('columnheader', { name: /Dead line/ }));
    await waitFor(() => expect(rowNames()).toEqual(['Charlie', 'Foxtrot', 'Alpha', 'Bravo', 'Delta']));

    fireEvent.click(within(table()).getByRole('columnheader', { name: /Durée/ }));
    // Alpha et Foxtrot durent 30 min : à égalité, l'ordre de lecture tranche. Depuis
    // la V14.1 la démo lit comme la production (`created_at` puis `id` décroissants),
    // et toutes ces tâches partagent le même `created_at` : Foxtrot (f) avant Alpha (a).
    await waitFor(() => expect(rowNames()).toEqual(['Delta', 'Charlie', 'Foxtrot', 'Alpha', 'Bravo']));
  });

  it('montre les tâches terminées quand la vue « terminées » est demandée', async () => {
    renderApp(<ControlledTable showCompleted />);
    await waitFor(() => expect(rowNames()).toEqual(['Echo']));
  });
});

describe('TaskTable · filtres rapides', () => {
  const chip = (name: RegExp) => screen.getByRole('button', { name });

  it('« Favoris » ne garde que les favoris, un second clic rend toute la liste', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(chip(/Favoris/));
    await waitFor(() => expect(rowNames()).toEqual(['Bravo']));
    fireEvent.click(chip(/Tous/));
    await waitFor(() => expect(rowNames()).toHaveLength(5));
  });

  it('« Terminées » montre les tâches terminées avec leur date de validation', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(chip(/Terminées/));
    await waitFor(() => expect(rowNames()).toEqual(['Echo']));
    expect(within(table()).getByRole('columnheader', { name: /Date de validation/ })).toBeTruthy();
  });

  it('« Collaboration » ne garde que les tâches partagées', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(chip(/Collaboration/));
    await waitFor(() => expect(rowNames()).toEqual(['Foxtrot']));
  });

  it('« Retard » ne garde que les échéances de jours révolus', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(chip(/^Retard/));
    await waitFor(() => expect(rowNames()).toEqual(['Charlie']));
  });

  // Corrigé avec la mig. 249 : `applyQuickFilter('overdue')` comparait des
  // INSTANTS (`new Date(task.deadline) < now`) ; il passe par `isOverdue`
  // (jours révolus), comme la ligne, le bandeau et l'en-tête de la page.
  it('ÉCHÉANCE · le filtre « Retard » ne montre pas une tâche due aujourd\'hui', async () => {
    resetDemoWorld([
      makeTask({ id: 'today', name: 'Due ce jour', dueDay: TODAY_KEY }),
      makeTask({ id: 'past', name: 'Due avant-hier', dueDay: dayKeyFromToday(-2) }),
    ]);
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    fireEvent.click(chip(/^Retard/));
    await waitFor(() => expect(rowNames()).toEqual(['Due avant-hier']));
  });
});

describe('TaskTable · ÉCHÉANCE (vague 13)', () => {
  const deadlineCell = (name: string) => within(rowOf(name)).getByText((_, el) => el?.tagName === 'TIME');

  it('ÉCHÉANCE · affiche « Aujourd\'hui », « Demain », « Hier » et « il y a N j » selon le jour', async () => {
    resetDemoWorld([
      makeTask({ id: '1', name: 'T aujourdhui', dueDay: TODAY_KEY }),
      makeTask({ id: '2', name: 'T demain', dueDay: dayKeyFromToday(1) }),
      makeTask({ id: '3', name: 'T hier', dueDay: dayKeyFromToday(-1) }),
      makeTask({ id: '4', name: 'T trois jours', dueDay: dayKeyFromToday(-3) }),
    ]);
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    expect(deadlineCell('T aujourdhui').textContent).toBe("Aujourd'hui");
    expect(deadlineCell('T demain').textContent).toBe('Demain');
    expect(deadlineCell('T hier').textContent).toBe('Hier');
    expect(deadlineCell('T trois jours').textContent).toBe('il y a 3 j');
  });

  it('ÉCHÉANCE · un jour entre 2 et 6 jours s\'écrit en jour de semaine, au-delà en date longue', async () => {
    resetDemoWorld([
      makeTask({ id: '1', name: 'T mardi', dueDay: dayKeyFromToday(3) }),
      makeTask({ id: '2', name: 'T lointaine', dueDay: dayKeyFromToday(13) }),
    ]);
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    expect(deadlineCell('T mardi').textContent).toBe('mardi');
    expect(deadlineCell('T lointaine').textContent).toBe('20 novembre');
  });

  it('ÉCHÉANCE · seule une échéance révolue est rouge : celle d\'aujourd\'hui ne l\'est pas', async () => {
    resetDemoWorld([
      makeTask({ id: '1', name: 'T aujourdhui', dueDay: TODAY_KEY }),
      makeTask({ id: '2', name: 'T hier', dueDay: dayKeyFromToday(-1) }),
    ]);
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    expect(deadlineCell('T aujourdhui').className).not.toContain('danger-text');
    expect(deadlineCell('T hier').className).toContain('danger-text');
  });

  it('ÉCHÉANCE · à 23 h 59 comme à 00 h 01, une tâche due aujourd\'hui n\'est pas en retard', async () => {
    resetDemoWorld([makeTask({ id: '1', name: 'T aujourdhui', dueDay: TODAY_KEY })]);
    for (const hhmm of ['00:01:00', '23:59:00']) {
      vi.setSystemTime(new Date(`${TODAY_KEY}T${hhmm}`));
      const view = renderApp(<ControlledTable />);
      await waitFor(() => expect(rowNames()).toEqual(['T aujourdhui']));
      expect(deadlineCell('T aujourdhui').textContent).toBe("Aujourd'hui");
      expect(screen.queryByText(tasksT.tp('table.overdueCount', 1))).toBeNull();
      view.unmount();
    }
  });

  it('ÉCHÉANCE · le bandeau « en retard » compte les jours révolus et propose un report en bloc', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    expect(screen.getByText(tasksT.tp('table.overdueCount', 1))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tout replanifier' })).toBeTruthy();
  });

  it('ÉCHÉANCE · fuseau manuel : le jour affiché et le retard suivent le fuseau choisi, pas la machine', async () => {
    const machineOffset = -new Date().getTimezoneOffset() / 60;
    // Un fuseau dont le jour en cours diffère de celui de la machine à 10 h locales.
    const chosen = machineOffset <= 0 ? Math.min(14, Math.trunc(machineOffset) + 14) : Math.max(-12, Math.trunc(machineOffset) - 11);
    const pref = { mode: 'manual', offsetHours: chosen } as const;
    const { result } = renderHook(() => useTimezonePref());
    act(() => result.current.setMode('manual'));
    act(() => result.current.setOffsetHours(chosen));
    try {
      const todayThere = todayKeyInTz(pref);
      expect(todayThere).not.toBe(TODAY_KEY);
      resetDemoWorld([
        makeTask({ id: '1', name: 'T jour du fuseau', deadline: storedDeadlineInstant(todayThere, pref) }),
        makeTask({ id: '2', name: 'T veille du fuseau', deadline: storedDeadlineInstant(addDaysToKey(todayThere, -1), pref) }),
      ]);
      renderApp(<ControlledTable sortField="name" />);
      await waitFor(() => expect(rowNames()).toHaveLength(2));
      expect(deadlineCell('T jour du fuseau').textContent).toBe("Aujourd'hui");
      expect(deadlineCell('T jour du fuseau').className).not.toContain('danger-text');
      expect(deadlineCell('T veille du fuseau').textContent).toBe('Hier');
      expect(deadlineCell('T veille du fuseau').className).toContain('danger-text');
    } finally {
      act(() => result.current.setMode('default'));
      act(() => result.current.setOffsetHours(0));
    }
  });

  it('ÉCHÉANCE · replanifier une tâche en retard « à demain » stocke le jour de demain', async () => {
    resetDemoWorld([makeTask({ id: 'late', name: 'En retard', dueDay: dayKeyFromToday(-3) })]);
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toEqual(['En retard']));
    const trigger = within(rowOf('En retard')).getByRole('button', { name: 'Actions pour En retard' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const sub = await screen.findByRole('menuitem', { name: /Reporter/ });
    fireEvent.keyDown(sub, { key: 'ArrowRight' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Demain' }));
    await waitFor(() => expect(deadlineDayKey(stored('late')!.deadline)).toBe(dayKeyFromToday(1)));
    expect(stored('late')!.deadline).toBe(dayKeyFromToday(1));
  });
});

describe('TaskTable · actions de ligne', () => {
  const openMenu = async (name: string) => {
    const trigger = within(rowOf(name)).getByRole('button', { name: `Actions pour ${name}` });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return screen.findByRole('menu');
  };

  it('coche une tâche : elle passe à « terminée » et quitte la liste', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(within(rowOf('Alpha')).getByRole('checkbox', { name: 'Marquer comme complétée' }));
    await waitFor(() => expect(stored('a')?.completed).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(rowNames()).not.toContain('Alpha'));
  });

  it('« Modifier » ouvre la fiche de la tâche', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const menu = await openMenu('Alpha');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Modifier' }));
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
    expect((screen.getByLabelText(/Nom de la tâche/) as HTMLInputElement).value).toBe('Alpha');
  });

  it('bascule le favori, et le menu propose ensuite de le retirer', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    let menu = await openMenu('Alpha');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Favori' }));
    await waitFor(() => expect(stored('a')?.bookmarked).toBe(true));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    menu = await openMenu('Alpha');
    expect(within(menu).getByRole('menuitem', { name: 'Retirer le favori' })).toBeTruthy();
  });

  it('duplique la tâche en « (copie) », non terminée', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const menu = await openMenu('Alpha');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Dupliquer la tâche' }));
    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Alpha (copie)')).toBe(true));
    const copy = storedTasks().find((t) => t.name === 'Alpha (copie)')!;
    expect(copy.completed).toBe(false);
    expect(copy.priority).toBe(3);
    expect(copy.deadline).toBe(stored('a')!.deadline);
  });

  it('supprime une tâche perso sans confirmation et propose « Annuler »', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const menu = await openMenu('Delta');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Supprimer' }));
    await waitFor(() => expect(stored('d')).toBeUndefined());
    expect(undoToast).toHaveBeenCalledWith(tasksT.t('toast.deleted'), expect.any(Function));
    await act(async () => { undoToast.mock.calls[0][1](); });
    await waitFor(() => expect(stored('d')?.name).toBe('Delta'));
  });

  it('demande confirmation avant de supprimer une tâche collaborative', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const menu = await openMenu('Foxtrot');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Supprimer' }));
    expect(await screen.findByText(tasksT.t('table.deleteTitle'))).toBeTruthy();
    expect(stored('f')).toBeDefined();
  });

  it('clavier : flèches changent de ligne, Entrée ouvre la fiche, « x » complète', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    const first = rowOf('Bravo');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowOf('Alpha'));
    fireEvent.keyDown(rowOf('Alpha'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowOf('Bravo'));

    fireEvent.keyDown(rowOf('Bravo'), { key: 'x' });
    await waitFor(() => expect(stored('b')?.completed).toBe(true));

    fireEvent.keyDown(rowOf('Alpha'), { key: 'Enter' });
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
  });

  it('ouvre la fiche au clic sur la ligne', async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(rowOf('Charlie'));
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
  });
});

describe('TaskTable · sélection multiple', () => {
  const enterSelection = async () => {
    renderApp(<ControlledTable />);
    await waitFor(() => expect(rowNames()).toHaveLength(5));
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }));
  };
  const pick = (name: string) => fireEvent.click(within(rowOf(name)).getByRole('checkbox', { name: tasksT.t('table.selectTaskAria', { name }) }));

  it('affiche une case nommée par tâche et un compteur dans la barre d\'actions', async () => {
    await enterSelection();
    pick('Alpha');
    pick('Bravo');
    expect(await screen.findByText(tasksT.tp('table.selected', 2))).toBeTruthy();
    expect(within(rowOf('Alpha')).getByRole('checkbox', { name: tasksT.t('table.deselectTaskAria', { name: 'Alpha' }) }).getAttribute('aria-checked')).toBe('true');
  });

  it('complète les tâches sélectionnées en une fois', async () => {
    await enterSelection();
    pick('Alpha');
    pick('Delta');
    fireEvent.click(await screen.findByRole('button', { name: /Compléter/ }));
    await waitFor(() => expect(stored('a')?.completed).toBe(true));
    expect(stored('d')?.completed).toBe(true);
    expect(stored('b')?.completed).toBe(false);
  });

  it('supprime la sélection après une confirmation explicite', async () => {
    await enterSelection();
    pick('Alpha');
    pick('Charlie');
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer/ }));
    const confirm = await screen.findByText(tasksT.tp('bulk.deleteCount', 2));
    expect(stored('a')).toBeDefined();
    const sheet = confirm.closest('[role="alertdialog"], [role="dialog"]') as HTMLElement;
    fireEvent.click(within(sheet).getByRole('button', { name: /^Supprimer/ }));
    await waitFor(() => expect(stored('a')).toBeUndefined());
    expect(stored('c')).toBeUndefined();
    expect(stored('b')).toBeDefined();
  });

  it('« Annuler » quitte la sélection et retire les cases', async () => {
    await enterSelection();
    expect(within(rowOf('Alpha')).queryByRole('checkbox', { name: tasksT.t('table.selectTaskAria', { name: 'Alpha' }) })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(within(rowOf('Alpha')).queryByRole('checkbox', { name: tasksT.t('table.selectTaskAria', { name: 'Alpha' }) })).toBeNull());
  });
});

describe('TaskTable · états vides', () => {
  it('sans tâche : « Aucune tâche » et un bouton qui ouvre la création', async () => {
    resetDemoWorld([]);
    renderApp(<ControlledTable />);
    expect(await screen.findByText('Aucune tâche')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Créer une tâche' }));
    expect(await screen.findByRole('heading', { name: 'Nouvelle tâche' })).toBeTruthy();
  });

  it('vue « terminées » vide : « Aucune tâche complétée », sans bouton de création', async () => {
    resetDemoWorld([]);
    renderApp(<ControlledTable showCompleted />);
    expect(await screen.findByText('Aucune tâche complétée')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Créer une tâche' })).toBeNull();
  });
});

describe('TaskTable · LONGUE LISTE (vague 14)', () => {
  const many = (n: number): Task[] =>
    Array.from({ length: n }, (_, i) => makeTask({
      id: `m${String(i).padStart(3, '0')}`,
      name: `Tâche ${String(i).padStart(3, '0')}`,
      priority: (i % 5) + 1,
      dueDay: dayKeyFromToday((i % 20) - 5),
    }));

  it('LONGUE LISTE · le tableau desktop monte TOUTES les lignes d\'un coup (aucune pagination)', async () => {
    resetDemoWorld(many(120));
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(rowNames()).toHaveLength(120));
    expect(rowNames()[0]).toBe('Tâche 000');
    expect(rowNames()[119]).toBe('Tâche 119');
  });

  it('LONGUE LISTE · sous 50 tâches, la liste mobile les monte toutes', async () => {
    resetDemoWorld(many(49));
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(cards().length).toBe(49));
  });

  it('LONGUE LISTE · à partir de 50 tâches, la liste mobile n\'en monte qu\'une fenêtre', async () => {
    resetDemoWorld(many(200));
    renderApp(<ControlledTable sortField="name" />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    expect(cards().length).toBeLessThan(200);
  });

  it('LONGUE LISTE · le marqueur de fin de liste donne le total, pas le nombre monté', async () => {
    resetDemoWorld(many(200));
    renderApp(<ControlledTable sortField="name" />);
    expect(await screen.findByText(tasksT.tp('table.endOfList', 200))).toBeTruthy();
  });

  it('LONGUE LISTE · « Voir les terminées » est proposé avec filtre actif et le décompte caché', async () => {
    resetDemoWorld([
      ...many(3),
      // Terminées RÉCEMMENT (V14.1) : sans `completedAt`, une terminée est NULL en
      // base et n'appartient qu'à l'archive, pas au jeu de travail.
      makeTask({ id: 'z1', name: 'Fait 1', completed: true, completedAt: new Date().toISOString() }),
      makeTask({ id: 'z2', name: 'Fait 2', completed: true, completedAt: new Date().toISOString() }),
    ]);
    renderApp(<ControlledTable hasActiveFilter />);
    const button = await screen.findByRole('button', { name: tasksT.tp('table.seeCompleted', 2) });
    fireEvent.click(button);
    await waitFor(() => expect(rowNames().sort()).toEqual(['Fait 1', 'Fait 2']));
  });
});
