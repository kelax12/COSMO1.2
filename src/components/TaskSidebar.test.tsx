// @vitest-environment jsdom
//
// Filet de caractérisation de la barre latérale « Tâches disponibles » de
// l'agenda (vague 15.1, TST-02) : ce que la personne voit dans la liste des
// tâches à planifier, comment elle la filtre, et ce que font le menu d'une
// carte, la création et l'ouverture de la fiche.
//
// Les noms « ÉCHÉANCE » désignent ce que la vague 13 modifie.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import TaskSidebar from './TaskSidebar';
import {
  renderApp, resetDemoWorld, setViewport, makeTask, storedTasks, fakeAuth, fakeBilling,
  dayKeyFromToday, TODAY_KEY, lazyT, findFiche, warmDemoCaches } from '@/test/tasks-ui-harness';
import { storedDeadlineInstant } from '@/lib/deadline';
import { useTimezonePref, todayKeyInTz } from '@/lib/timezone';
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
const undoToast = vi.fn();
vi.mock('@/lib/undo-toast', () => ({ showUndoToast: (...a: unknown[]) => undoToast(...a) }));

const agenda = lazyT('agenda');

const BASE: Task[] = [
  makeTask({ id: 'a', name: 'Alpha rapport', priority: 3, category: 'cat-2', dueDay: '2026-11-12', estimatedTime: 90 }),
  makeTask({ id: 'b', name: 'Bravo appel', priority: 1, category: 'cat-3', estimatedTime: 20, bookmarked: true }),
  makeTask({ id: 'c', name: 'Charlie plan', priority: 0, estimatedTime: 0 }),
  makeTask({ id: 'd', name: 'Delta fini', priority: 2, completed: true }),
];

const stored = (id: string) => storedTasks().find((t) => t.id === id);
const cardOf = (name: string) => screen.getByText(name).closest('[data-task]') as HTMLElement;
// La démo a une organisation avec des tâches d'équipe assignées à l'utilisateur : les cartes
// « Pro » partagent le conteneur. `names()` ne liste que les cartes perso, `proNames()` les autres.
const cardsOf = (source: 'perso' | 'pro') => Array.from(document.querySelectorAll('#external-events-container [data-task]'))
  .map((el) => JSON.parse(el.getAttribute('data-task') ?? '{}') as { name: string; source?: string })
  .filter((d) => (d.source ?? 'pro') === source)
  .map((d) => d.name);
const names = () => cardsOf('perso');

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
  undoToast.mockReset();
});

async function openSidebar(props: Partial<React.ComponentProps<typeof TaskSidebar>> = {}) {
  const view = renderApp(<TaskSidebar {...props} />, { route: '/agenda' });
  await waitFor(() => expect(names().length).toBeGreaterThan(0));
  return view;
}

describe('TaskSidebar · liste', () => {
  it('liste les tâches non terminées, avec priorité, durée et échéance', async () => {
    await openSidebar();
    expect(screen.getByRole('heading', { name: 'Tâches disponibles' })).toBeTruthy();
    expect(names().sort()).toEqual(['Alpha rapport', 'Bravo appel', 'Charlie plan']);

    const alpha = within(cardOf('Alpha rapport'));
    expect(alpha.getByText('P3')).toBeTruthy();
    expect(alpha.getByText('1 h 30')).toBeTruthy();
    expect(alpha.getByText(agenda.t('sidebar.deadline', { date: '12/11/2026' }))).toBeTruthy();

    const charlie = within(cardOf('Charlie plan'));
    expect(charlie.queryByText(/^P\d/)).toBeNull();
    expect(charlie.getByText("Pas d'échéance")).toBeTruthy();
    expect(charlie.getByText(String.fromCharCode(0x2014))).toBeTruthy();
  });

  it('sans aucune tâche perso, la liste perso est vide', async () => {
    resetDemoWorld([]);
    renderApp(<TaskSidebar />, { route: '/agenda' });
    fireEvent.change(await screen.findByPlaceholderText('Rechercher une tâche...'), { target: { value: 'introuvable' } });
    expect(await screen.findByText('Aucune tâche trouvée')).toBeTruthy();
  });

  it('marque « Déjà planifiée » une tâche qui a un événement dans l\'agenda', async () => {
    localStorage.setItem('cosmo_demo_events', JSON.stringify([
      { id: 'ev1', title: 'Alpha rapport', start: '2026-11-09T09:00:00.000Z', end: '2026-11-09T10:00:00.000Z', taskId: 'a', color: '#3B82F6' },
    ]));
    await openSidebar();
    await waitFor(() => expect(within(cardOf('Alpha rapport')).getByText(agenda.t('sidebar.alreadyScheduled'))).toBeTruthy());
    expect(within(cardOf('Bravo appel')).getByText(agenda.t('sidebar.dragHint'))).toBeTruthy();
  });

  it('le bouton de fermeture n\'existe que si le parent fournit onClose', async () => {
    const onClose = vi.fn();
    const first = await openSidebar({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau des tâches' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();
    await openSidebar();
    expect(screen.queryByRole('button', { name: 'Fermer le panneau des tâches' })).toBeNull();
  });
});

describe('TaskSidebar · filtres', () => {
  it('filtre par nom, sans tenir compte de la casse', async () => {
    await openSidebar();
    fireEvent.change(screen.getByPlaceholderText('Rechercher une tâche...'), { target: { value: 'BRAVO' } });
    expect(names()).toEqual(['Bravo appel']);
    fireEvent.change(screen.getByPlaceholderText('Rechercher une tâche...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Aucune tâche trouvée')).toBeTruthy();
  });

  it('filtre par priorité exacte', async () => {
    await openSidebar();
    fireEvent.change(screen.getByLabelText('Filtrer par priorité'), { target: { value: '3' } });
    expect(names()).toEqual(['Alpha rapport']);
  });

  it('filtre par catégorie', async () => {
    await openSidebar();
    fireEvent.change(screen.getByLabelText('Filtrer par catégorie'), { target: { value: 'cat-3' } });
    expect(names()).toEqual(['Bravo appel']);
  });

  it('les puces Tout / Perso / Pro disent laquelle est active', async () => {
    await openSidebar();
    const group = screen.getByRole('group', { name: 'Filtrer par origine des tâches' });
    expect(within(group).getByRole('button', { name: 'Tout' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: 'Pro' }));
    expect(within(group).getByRole('button', { name: 'Pro' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: 'Tout' }).getAttribute('aria-pressed')).toBe('false');
    // « Pro » ne montre que les tâches d'équipe de l'organisation de démonstration.
    expect(names()).toEqual([]);
    await waitFor(() => expect(cardsOf('pro').length).toBeGreaterThan(0));
    fireEvent.click(within(group).getByRole('button', { name: 'Perso' }));
    expect(names()).toHaveLength(3);
    expect(cardsOf('pro')).toEqual([]);
  });
});

describe('TaskSidebar · menu d\'une carte', () => {
  const openMenu = (name: string) => {
    fireEvent.click(within(cardOf(name)).getByRole('button', { name: 'Options de la tâche' }));
  };

  it('le bouton « … » ouvre le menu sans ouvrir la fiche', async () => {
    await openSidebar();
    openMenu('Alpha rapport');
    expect(await screen.findByRole('button', { name: 'Modifier la tâche' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Modifier la tâche' })).toBeNull();
  });

  it('le clic droit ouvre le même menu, Échap le ferme', async () => {
    await openSidebar();
    fireEvent.contextMenu(cardOf('Alpha rapport'), { clientX: 40, clientY: 40 });
    expect(await screen.findByRole('button', { name: 'Dupliquer la tâche' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dupliquer la tâche' })).toBeNull());
  });

  it('« Modifier la tâche » ouvre la fiche pré-remplie', async () => {
    await openSidebar();
    openMenu('Alpha rapport');
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la tâche' }));
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
    expect((screen.getByLabelText(/Nom de la tâche/) as HTMLInputElement).value).toBe('Alpha rapport');
  });

  it('« Dupliquer la tâche » crée « … (copie) » non terminée', async () => {
    await openSidebar();
    openMenu('Bravo appel');
    fireEvent.click(await screen.findByRole('button', { name: 'Dupliquer la tâche' }));
    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Bravo appel (copie)')).toBe(true));
    const copy = storedTasks().find((t) => t.name === 'Bravo appel (copie)')!;
    expect(copy.completed).toBe(false);
    expect(copy.priority).toBe(1);
    await waitFor(() => expect(names()).toContain('Bravo appel (copie)'));
  });

  it('« Supprimer la tâche » supprime sans confirmation et propose « Annuler »', async () => {
    await openSidebar();
    openMenu('Charlie plan');
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la tâche' }));
    await waitFor(() => expect(stored('c')).toBeUndefined());
    expect(undoToast).toHaveBeenCalledWith(agenda.t('sidebar.taskDeleted'), expect.any(Function));
    await act(async () => { undoToast.mock.calls[0][1](); });
    await waitFor(() => expect(stored('c')?.name).toBe('Charlie plan'));
  });

  it('propose de supprimer les événements associés, dit combien, et les rend à l\'annulation', async () => {
    localStorage.setItem('cosmo_demo_events', JSON.stringify([
      { id: 'ev1', title: 'Alpha 1', start: '2026-11-09T09:00:00.000Z', end: '2026-11-09T10:00:00.000Z', taskId: 'a', color: '#3B82F6' },
      { id: 'ev2', title: 'Alpha 2', start: '2026-11-10T09:00:00.000Z', end: '2026-11-10T10:00:00.000Z', taskId: 'a', color: '#3B82F6' },
    ]));
    await openSidebar();
    await waitFor(() => expect(within(cardOf('Alpha rapport')).getByText(agenda.t('sidebar.alreadyScheduled'))).toBeTruthy());
    openMenu('Alpha rapport');
    fireEvent.click(await screen.findByRole('button', { name: agenda.tp('sidebar.deleteLinkedEvents', 2) }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cosmo_demo_events') ?? '[]')).toHaveLength(0));
    expect(undoToast).toHaveBeenCalledWith(agenda.tp('sidebar.linkedEventsDeleted', 2), expect.any(Function));
    await act(async () => { undoToast.mock.calls[0][1](); });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cosmo_demo_events') ?? '[]')).toHaveLength(2));
    expect(stored('a')).toBeDefined();
  });

  it('cliquer la carte ouvre la fiche, mais pas juste après avoir ouvert le menu', async () => {
    await openSidebar();
    fireEvent.click(cardOf('Alpha rapport'));
    expect(await findFiche('Modifier la tâche')).toBeTruthy();
  });
});

describe('TaskSidebar · création et aide', () => {
  it('« Ajouter une tâche » ouvre la fiche de création', async () => {
    await openSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une tâche' }));
    expect(await screen.findByRole('heading', { name: 'Nouvelle tâche' })).toBeTruthy();
  });

  it('le guide se déplie à la demande et ce choix est retenu', async () => {
    const first = await openSidebar();
    expect(screen.queryByText(agenda.t('sidebar.help.heading'))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "Afficher le guide d'utilisation" }));
    expect(screen.getAllByText(agenda.t('sidebar.help.heading')).length).toBeGreaterThan(0);
    first.unmount();
    await openSidebar();
    expect(screen.getAllByText(agenda.t('sidebar.help.heading')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTitle('Fermer le tutoriel'));
    expect(screen.queryByText(agenda.t('sidebar.help.heading'))).toBeNull();
  });
});

describe('TaskSidebar · ÉCHÉANCE (vague 13)', () => {
  const clock = () => renderHook(() => useTimezonePref());

  it('ÉCHÉANCE · la carte affiche le jour choisi, jj/mm/aaaa, pour une échéance stockée à minuit local', async () => {
    resetDemoWorld([makeTask({ id: 'x', name: 'Échéance du jour', dueDay: '2026-11-20' })]);
    renderApp(<TaskSidebar />, { route: '/agenda' });
    await waitFor(() => expect(names()).toEqual(['Échéance du jour']));
    expect(within(cardOf('Échéance du jour')).getByText(agenda.t('sidebar.deadline', { date: '20/11/2026' }))).toBeTruthy();
  });

  // Bug corrigé par DAT-01 : la carte formatait `new Date(task.deadline)`, jour de
  // la MACHINE ; elle passe par `deadlineLocalDate`. L'échéance semée est une
  // valeur d'avant la bascule (instant), que la démo ramène au jour du fuseau choisi.
  it('ÉCHÉANCE · fuseau manuel : la carte affiche le jour du fuseau choisi', async () => {
    const machineOffset = -new Date().getTimezoneOffset() / 60;
    const chosen = machineOffset <= 0 ? Math.min(14, Math.trunc(machineOffset) + 14) : Math.max(-12, Math.trunc(machineOffset) - 11);
    const pref = { mode: 'manual', offsetHours: chosen } as const;
    const { result } = clock();
    act(() => result.current.setMode('manual'));
    act(() => result.current.setOffsetHours(chosen));
    try {
      const day = todayKeyInTz(pref);
      resetDemoWorld([makeTask({ id: 'x', name: 'Échéance du fuseau', deadline: storedDeadlineInstant(day, pref) })]);
      renderApp(<TaskSidebar />, { route: '/agenda' });
      await waitFor(() => expect(names()).toEqual(['Échéance du fuseau']));
      const [y, m, d] = day.split('-');
      expect(within(cardOf('Échéance du fuseau')).getByText(agenda.t('sidebar.deadline', { date: `${d}/${m}/${y}` }))).toBeTruthy();
    } finally {
      act(() => result.current.setMode('default'));
      act(() => result.current.setOffsetHours(0));
    }
  });

  it('ÉCHÉANCE · la barre latérale ne classe pas par retard : une tâche en retard reste listée', async () => {
    resetDemoWorld([makeTask({ id: 'x', name: 'Ancienne', dueDay: dayKeyFromToday(-30) })]);
    renderApp(<TaskSidebar />, { route: '/agenda' });
    await waitFor(() => expect(names()).toEqual(['Ancienne']));
  });
});

describe('TaskSidebar · LONGUE LISTE (vague 14)', () => {
  it('LONGUE LISTE · 150 tâches : toutes les cartes sont montées, sans pagination ni fenêtrage', async () => {
    resetDemoWorld(Array.from({ length: 150 }, (_, i) => makeTask({ id: `m${i}`, name: `Tâche ${String(i).padStart(3, '0')}`, priority: (i % 5) + 1 })));
    renderApp(<TaskSidebar />, { route: '/agenda' });
    await waitFor(() => expect(names()).toHaveLength(150), { timeout: 10000 });
  });
});
