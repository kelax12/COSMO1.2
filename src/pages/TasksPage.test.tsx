// @vitest-environment jsdom
//
// Filet de caractérisation de la page Tâches (vague 15.1, TST-02).
//
// La page assemble l'en-tête, la barre de listes, les filtres, le tableau et
// la fiche. Ces tests figent ce que la personne y voit et y fait : recherche,
// tri mémorisé, vue « terminées », ouverture de la fiche, listes, état
// d'erreur. Les noms « ÉCHÉANCE » (vague 13) et « LONGUE LISTE » (vague 14)
// désignent ce que ces deux vagues vont modifier.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import TasksPage from './TasksPage';
import {
  renderApp, resetDemoWorld, setViewport, makeTask, storedTasks, fakeAuth, fakeBilling,
  dayKeyFromToday, TODAY_KEY, lazyT, findFiche, warmDemoCaches } from '@/test/tasks-ui-harness';
import type { Task } from '@/modules/tasks';

vi.mock('@/modules/auth/AuthContext', async (orig) => ({
  ...(await orig<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));
vi.mock('@/modules/billing/billing.context', async (orig) => ({
  ...(await orig<typeof import('@/modules/billing/billing.context')>()),
  useBilling: () => fakeBilling(),
}));
vi.mock('@/lib/toast', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock('@/lib/undo-toast', () => ({ showUndoToast: vi.fn() }));

const tasksT = lazyT('tasks');

const table = () => screen.getByRole('table', { hidden: true });
// Les lignes des tâches d'ÉQUIPE de l'organisation de démonstration n'ont pas de nom
// accessible : on ne compte que les lignes perso. `hidden` : une fiche ouverte masque le tableau.
const rowNames = () => within(table()).queryAllByRole('row', { hidden: true }).slice(1).map((r) => r.getAttribute('aria-label')).filter((n): n is string => !!n);
const stored = (id: string) => storedTasks().find((t) => t.id === id);
const searchField = () => screen.getByLabelText(tasksT.t('filter.searchByName')) as HTMLInputElement;
const sortSelect = () => screen.getByLabelText(tasksT.t('filter.sortBy')) as HTMLSelectElement;

const BASE: Task[] = [
  makeTask({ id: 'a', name: 'Alpha budget', priority: 3, dueDay: dayKeyFromToday(2) }),
  makeTask({ id: 'b', name: 'Bravo contrat', priority: 1, dueDay: dayKeyFromToday(9), bookmarked: true }),
  makeTask({ id: 'c', name: 'Charlie facture', priority: 5, dueDay: dayKeyFromToday(-4) }),
  makeTask({ id: 'd', name: 'Delta budget', priority: 2, dueDay: TODAY_KEY }),
  makeTask({ id: 'e', name: 'Echo archive', priority: 2, completed: true, completedAt: '2026-11-06T09:00:00.000Z' }),
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
  vi.restoreAllMocks();
});

async function openPage(route: Parameters<typeof renderApp>[1] = {}) {
  const view = renderApp(<TasksPage />, route);
  await waitFor(() => expect(rowNames().length).toBeGreaterThan(0));
  return view;
}

describe('TasksPage · affichage', () => {
  it('montre le titre, la liste des tâches ouvertes triées par priorité, sans les terminées', async () => {
    await openPage();
    expect(screen.getAllByText('Tâches').length).toBeGreaterThan(0);
    expect(rowNames()).toEqual(['Bravo contrat', 'Delta budget', 'Alpha budget', 'Charlie facture']);
  });

  it('résume le travail à faire et le retard dans l\'en-tête', async () => {
    await openPage();
    expect(screen.getAllByText(tasksT.tp('header.openCount', 4)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(tasksT.tp('header.overdueCount', 1)).length).toBeGreaterThan(0);
  });

  it('propose « Créer une tâche » quand il n\'y a aucune tâche', async () => {
    resetDemoWorld([]);
    renderApp(<TasksPage />);
    expect(await screen.findByText('Aucune tâche')).toBeTruthy();
  });

  it('affiche l\'état d\'erreur et un bouton « Réessayer » quand le chargement échoue', async () => {
    // Aucune tâche enregistrée et écriture refusée : le dépôt de démo échoue à l'amorçage.
    localStorage.removeItem('cosmo_demo_tasks');
    const realSetItem = Storage.prototype.setItem;
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'cosmo_demo_tasks') throw new Error('quota dépassé');
      return realSetItem.call(this, key, value);
    });
    renderApp(<TasksPage />);
    expect(await screen.findByText(tasksT.t('error.title'))).toBeTruthy();
    refuse.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: tasksT.t('error.retry') }));
    await waitFor(() => expect(rowNames().length).toBeGreaterThan(0));
  });
});

describe('TasksPage · recherche, tri et vue « terminées »', () => {
  it('filtre par nom, puis la croix vide la recherche', async () => {
    await openPage();
    fireEvent.change(searchField(), { target: { value: 'budget' } });
    await waitFor(() => expect(rowNames()).toEqual(['Delta budget', 'Alpha budget']));
    fireEvent.click(screen.getAllByRole('button', { name: tasksT.t('filter.clearSearch') })[0]);
    await waitFor(() => expect(rowNames()).toHaveLength(4));
  });

  it('le raccourci « / » met le focus sur la recherche, sauf quand on tape déjà dans un champ', async () => {
    await openPage();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(searchField());
    fireEvent.change(searchField(), { target: { value: 'a' } });
    const notEdited = fireEvent.keyDown(searchField(), { key: '/' });
    expect(notEdited).toBe(true);
    expect(searchField().value).toBe('a');
  });

  it('trie par nom, et le critère est mémorisé à la réouverture de la page', async () => {
    const first = await openPage();
    fireEvent.change(sortSelect(), { target: { value: 'name' } });
    await waitFor(() => expect(rowNames()).toEqual(['Alpha budget', 'Bravo contrat', 'Charlie facture', 'Delta budget']));
    first.unmount();

    await openPage();
    expect(sortSelect().value).toBe('name');
    expect(rowNames()).toEqual(['Alpha budget', 'Bravo contrat', 'Charlie facture', 'Delta budget']);
  });

  it('inverse l\'ordre avec le bouton de sens du tri', async () => {
    await openPage();
    fireEvent.change(sortSelect(), { target: { value: 'name' } });
    await waitFor(() => expect(rowNames()[0]).toBe('Alpha budget'));
    fireEvent.click(screen.getByRole('button', { name: tasksT.t('sort.asc') }));
    await waitFor(() => expect(rowNames()).toEqual(['Delta budget', 'Charlie facture', 'Bravo contrat', 'Alpha budget']));
    expect(screen.getByRole('button', { name: tasksT.t('sort.desc') })).toBeTruthy();
  });

  it('la pastille « Terminées » bascule sur les tâches terminées, et « Tous » revient à la liste', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: /^Terminées/ }));
    await waitFor(() => expect(rowNames()).toEqual(['Echo archive']));
    fireEvent.click(screen.getByRole('button', { name: /^Terminées/ }));
    await waitFor(() => expect(rowNames()).toHaveLength(4));
  });

  it('le sélecteur de tri propose cinq critères, sans entrée « terminées »', async () => {
    await openPage();
    const values = Array.from(sortSelect().options).map((o) => o.value);
    expect(values).toEqual(['priority', 'deadline', 'createdAt', 'name', 'category']);
  });
});

describe('TasksPage · création et ouverture de la fiche', () => {
  it('« Nouvelle tâche » ouvre la fiche de création', async () => {
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: tasksT.t('actions.newTaskAria') }));
    expect(await screen.findByRole('heading', { name: 'Nouvelle tâche' })).toBeTruthy();
  });

  it('l\'évènement « open-task-create » (bouton + du Layout) ouvre aussi la création', async () => {
    await openPage();
    act(() => { window.dispatchEvent(new Event('open-task-create')); });
    expect(await screen.findByRole('heading', { name: 'Nouvelle tâche' })).toBeTruthy();
  });

  it('cliquer une ligne ouvre la fiche de la tâche, et la fermer rend la page intacte', async () => {
    await openPage();
    fireEvent.click(within(table()).getByRole('row', { name: 'Alpha budget' }));
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le formulaire' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Modifier la tâche' })).toBeNull());
    expect(rowNames()).toHaveLength(4);
  });

  it('ouvre directement la fiche demandée par la navigation (state.openTaskId)', async () => {
    await openPage({ route: { pathname: '/tasks', state: { openTaskId: 'c' } } });
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
    expect((screen.getByLabelText(/Nom de la tâche/) as HTMLInputElement).value).toBe('Charlie facture');
  });

  it('une modification enregistrée depuis la fiche se retrouve dans la liste', async () => {
    await openPage();
    fireEvent.click(within(table()).getByRole('row', { name: 'Alpha budget' }));
    const name = (await screen.findByLabelText(/Nom de la tâche/)) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Alpha budget révisé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(stored('a')?.name).toBe('Alpha budget révisé'));
    await waitFor(() => expect(rowNames()).toContain('Alpha budget révisé'));
  });
});

describe('TasksPage · ÉCHÉANCE (vague 13)', () => {
  it('ÉCHÉANCE · la liste « Aujourd\'hui » ne contient que les tâches dues ce jour, et son compteur le dit', async () => {
    await openPage();
    const chip = screen.getByRole('button', { name: /Aujourd'hui/ });
    expect(chip.textContent).toContain('1');
    fireEvent.click(chip);
    await waitFor(() => expect(rowNames()).toEqual(['Delta budget']));
  });

  it('ÉCHÉANCE · à 23 h 59, la tâche du jour reste dans « Aujourd\'hui » et le retard ne change pas', async () => {
    vi.setSystemTime(new Date(`${TODAY_KEY}T23:59:00`));
    await openPage();
    expect(screen.getAllByText(tasksT.tp('header.overdueCount', 1)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Aujourd'hui/ }));
    await waitFor(() => expect(rowNames()).toEqual(['Delta budget']));
  });
});

describe('TasksPage · LONGUE LISTE (vague 14)', () => {
  const many = (n: number): Task[] =>
    Array.from({ length: n }, (_, i) => makeTask({
      id: `m${String(i).padStart(3, '0')}`,
      name: `Tâche ${String(i).padStart(3, '0')}`,
      priority: (i % 5) + 1,
    }));

  it('LONGUE LISTE · 300 tâches : la page les charge et les monte toutes dans le tableau', async () => {
    resetDemoWorld(many(300));
    renderApp(<TasksPage />);
    await waitFor(() => expect(rowNames()).toHaveLength(300), { timeout: 10000 });
    expect(screen.getAllByText(tasksT.tp('header.openCount', 300)).length).toBeGreaterThan(0);
  });

  it('LONGUE LISTE · la recherche porte sur toute la liste chargée, pas sur ce qui est affiché', async () => {
    resetDemoWorld(many(300));
    renderApp(<TasksPage />);
    await waitFor(() => expect(rowNames()).toHaveLength(300), { timeout: 10000 });
    fireEvent.change(searchField(), { target: { value: 'Tâche 29' } });
    await waitFor(() => expect(rowNames()).toHaveLength(10));
  });
});
