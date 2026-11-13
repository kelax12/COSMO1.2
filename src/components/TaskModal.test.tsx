// @vitest-environment jsdom
//
// Filet de caractérisation de la fiche tâche (vague 15.1, TST-02).
//
// Ces tests figent ce que la personne VOIT et FAIT dans la fiche : création,
// modification, validation, sous-tâches, récurrence, échéance, annulation,
// suppression. Ils montent les vrais hooks sur les dépôts de démonstration
// (cf. `src/test/tasks-ui-harness.tsx`). Un test rouge après la refonte des
// vagues 13 (échéance stockée comme un jour) et 14 (chargement par pages) dit
// qu'un comportement visible a bougé, pas qu'une implémentation a changé.
//
// Les tests dont le nom commence par « ÉCHÉANCE » sont ceux que la vague 13
// modifie : à relire en priorité.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import TaskModal from './TaskModal';
import {
  renderApp, resetDemoWorld, setViewport, makeTask, storedTasks, fakeAuth, fakeBilling,
  dayKeyFromToday, TODAY_KEY, lazyT, findFiche, warmDemoCaches, itBug } from '@/test/tasks-ui-harness';
import { deadlineDayKey, deadlineFromDayKey } from '@/lib/deadline';
import { useTimezonePref, todayKeyInTz, DEFAULT_TIMEZONE_PREF } from '@/lib/timezone';
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
const toastError = vi.fn();
vi.mock('@/lib/toast', () => ({
  toast: Object.assign(vi.fn(), {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));
const undoToast = vi.fn();
vi.mock('@/lib/undo-toast', () => ({ showUndoToast: (...a: unknown[]) => undoToast(...a) }));

const errors = lazyT('errors');
const tasksT = lazyT('tasks');
const modalT = lazyT('taskModal');

const REPORT = makeTask({ id: 't1', name: 'Écrire le rapport', priority: 2, dueDay: dayKeyFromToday(3), estimatedTime: 45 });

beforeAll(async () => { await warmDemoCaches(); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY_KEY}T10:00:00`));
  setViewport('desktop');
  resetDemoWorld([REPORT]);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  toastSuccess.mockReset();
  toastError.mockReset();
  undoToast.mockReset();
});

const nameField = () => screen.getByLabelText(/Nom de la tâche/);
const tab = (name: RegExp) => screen.getByRole('tab', { name });
const stored = (id: string) => storedTasks().find((t) => t.id === id);

async function openCreation(onClose = vi.fn()) {
  const view = renderApp(<TaskModal isOpen onClose={onClose} isCreating />);
  await screen.findByRole('heading', { name: 'Nouvelle tâche' });
  return { ...view, onClose };
}

async function openEdition(task: Task = REPORT, onClose = vi.fn()) {
  const view = renderApp(<TaskModal isOpen onClose={onClose} task={task} />);
  await findFiche('Modifier la tâche');
  return { ...view, onClose };
}

/** Ouvre le sélecteur d'échéance et clique un preset (Aujourd'hui, Demain, Lundi prochain). */
async function pickDeadlinePreset(label: string) {
  fireEvent.click(screen.getByRole('button', { name: /Sélectionner une date|\d{2}\/\d{2}\/\d{4}/ }));
  fireEvent.click(await screen.findByRole('button', { name: label }));
}

describe('TaskModal · création', () => {
  it('montre « Nouvelle tâche », « Créer la tâche » et aucune suppression', async () => {
    await openCreation();
    expect(screen.getByRole('button', { name: 'Créer la tâche' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Supprimer/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
  });

  it('ne montre d\'abord que le nom, les autres champs se déplient à la demande', async () => {
    await openCreation();
    expect(screen.queryByLabelText('Sélectionner la priorité de la tâche')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    expect(screen.getByLabelText('Sélectionner la priorité de la tâche')).toBeTruthy();
    expect(screen.getByLabelText(/Durée \(min\)/)).toBeTruthy();
  });

  it('crée la tâche, garde la fiche ouverte et la remet à zéro pour la suivante', async () => {
    const { onClose } = await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Appeler le plombier' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Appeler le plombier')).toBe(true));
    await waitFor(() => expect((nameField() as HTMLInputElement).value).toBe(''));
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(tasksT.t('modal.created', { name: 'Appeler le plombier' }));
  });

  it('enregistre priorité, durée et favori saisis', async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Préparer la réunion' } });
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    fireEvent.change(screen.getByLabelText('Sélectionner la priorité de la tâche'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter le temps estimé de 5 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter le temps estimé de 5 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));
    expect(screen.getByRole('button', { name: 'Retirer des favoris' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Préparer la réunion')).toBe(true));
    const created = storedTasks().find((t) => t.name === 'Préparer la réunion')!;
    expect(created.priority).toBe(1);
    expect(created.estimatedTime).toBe(10);
    expect(created.bookmarked).toBe(true);
    expect(created.completed).toBe(false);
  });

  it('refuse un nom vide : l\'erreur s\'affiche sous le champ et rien n\'est créé', async () => {
    await openCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    const alert = await screen.findByText(errors.t('validation.taskForm.nameRequired'));
    expect(alert).toBeTruthy();
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    expect(storedTasks()).toHaveLength(1);
  });

  it('refuse un nom de deux lettres : message « trop court », toast d\'erreur, rien de créé', async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    expect(await screen.findByText(errors.t('validation.taskForm.nameTooShort'))).toBeTruthy();
    expect(toastError).toHaveBeenCalledWith(errors.t('validation.taskForm.nameTooShort'));
    expect(storedTasks()).toHaveLength(1);
  });

  it('refuse un nom de plus de 100 caractères', async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'x'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    expect(await screen.findByText(errors.t('validation.taskForm.nameTooLong'))).toBeTruthy();
    expect(storedTasks()).toHaveLength(1);
  });

  it('efface l\'erreur de nom dès que la personne se remet à taper', async () => {
    await openCreation();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    await screen.findByText(errors.t('validation.taskForm.nameRequired'));
    fireEvent.change(nameField(), { target: { value: 'Ranger' } });
    expect(screen.queryByText(errors.t('validation.taskForm.nameRequired'))).toBeNull();
  });

  it('« Annuler » ferme sans confirmation, même avec un nom saisi (le brouillon protège la saisie)', async () => {
    const { onClose } = await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Idée à garder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Abandonner les modifications/)).toBeNull();
  });

  it('restitue le brouillon à la réouverture après une fermeture accidentelle', async () => {
    const first = await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Brouillon à retrouver' } });
    first.unmount();
    await openCreation();
    await waitFor(() => expect((nameField() as HTMLInputElement).value).toBe('Brouillon à retrouver'));
  });

  it('révèle la description sur demande', async () => {
    await openCreation();
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    expect(screen.queryByLabelText(/^Description/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une description' }));
    expect(screen.getByLabelText(/^Description/)).toBeTruthy();
  });

  it("règle le statut dès la création et l'enregistre avec la tâche", async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Statut choisi' } });
    fireEvent.click(tab(/Options avancées/));
    const enCours = screen.getByRole('radio', { name: /En cours/ });
    expect(screen.getByRole('radio', { name: /À faire/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(enCours);
    expect(enCours.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Statut choisi')).toBe(true));
    expect(storedTasks().find((t) => t.name === 'Statut choisi')!.status).toBe('in_progress');
  });

  it('propose les dépendances dès la création', async () => {
    await openCreation();
    fireEvent.click(tab(/Dépendances/));
    expect(screen.getByText('Bloquée par')).toBeTruthy();
    expect(screen.getAllByRole('searchbox').length).toBeGreaterThan(0);
  });
});

describe('TaskModal · sous-tâches', () => {
  it('en création : ajoute des sous-tâches, les compte dans l\'onglet et les enregistre avec la tâche', async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Déménager' } });
    fireEvent.click(tab(/^Sous-tâches/));
    const input = screen.getByRole('textbox', { name: 'Ajouter une sous-tâche' });
    fireEvent.change(input, { target: { value: 'Trouver des cartons' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'Réserver le camion' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Trouver des cartons')).toBeTruthy();
    expect(screen.getByText('Réserver le camion')).toBeTruthy();
    expect(tab(/^Sous-tâches/).textContent).toBe('Sous-tâches (2)');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Cocher « Trouver des cartons »' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Déménager')).toBe(true));
    const subs = storedTasks().find((t) => t.name === 'Déménager')!.subtasks ?? [];
    expect(subs.map((s) => [s.name, s.completed])).toEqual([
      ['Trouver des cartons', true],
      ['Réserver le camion', false],
    ]);
  });

  it('ignore une sous-tâche vide', async () => {
    await openCreation();
    fireEvent.click(tab(/^Sous-tâches/));
    const input = screen.getByRole('textbox', { name: 'Ajouter une sous-tâche' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('en édition : coche une sous-tâche existante et l\'enregistre aussitôt', async () => {
    const withSubs = makeTask({
      id: 't2', name: 'Préparer le voyage', dueDay: dayKeyFromToday(5),
      subtasks: [{ id: 's1', name: 'Passeport', completed: false }, { id: 's2', name: 'Valise', completed: true }],
    });
    resetDemoWorld([withSubs]);
    await openEdition(withSubs);
    fireEvent.click(tab(/^Sous-tâches/));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Cocher « Passeport »' }));
    await waitFor(() => expect(stored('t2')?.subtasks?.find((s) => s.id === 's1')?.completed).toBe(true));
    expect(stored('t2')?.subtasks?.find((s) => s.id === 's2')?.completed).toBe(true);
  });
});

describe('TaskModal · modification', () => {
  it('préremplit nom, priorité, durée et propose la suppression', async () => {
    await openEdition();
    expect((nameField() as HTMLInputElement).value).toBe('Écrire le rapport');
    expect((screen.getByLabelText('Sélectionner la priorité de la tâche') as HTMLSelectElement).value).toBe('2');
    expect((screen.getByLabelText(/Durée \(min\)/) as HTMLInputElement).value).toBe('45');
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Plus d'options/ })).toBeNull();
  });

  it('garde « Sauvegarder » inactif tant que rien n\'a changé, puis signale « Non sauvegardé »', async () => {
    await openEdition();
    const save = screen.getByRole('button', { name: 'Sauvegarder' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.queryByText('Non sauvegardé')).toBeNull();
    fireEvent.change(nameField(), { target: { value: 'Écrire le rapport final' } });
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(screen.getByText('Non sauvegardé')).toBeTruthy();
  });

  it('enregistre la modification puis ferme, sans toucher à « terminée »', async () => {
    const { onClose } = await openEdition();
    fireEvent.change(nameField(), { target: { value: 'Écrire le rapport final' } });
    fireEvent.change(screen.getByLabelText('Sélectionner la priorité de la tâche'), { target: { value: '4' } });
    const save = screen.getByRole('button', { name: 'Sauvegarder' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const after = stored('t1')!;
    expect(after.name).toBe('Écrire le rapport final');
    expect(after.priority).toBe(4);
    expect(after.completed).toBe(false);
    expect(after.deadline).toBe(REPORT.deadline);
  });

  it('refuse d\'enregistrer un nom vidé : l\'erreur s\'affiche et la tâche est inchangée', async () => {
    const { onClose } = await openEdition();
    fireEvent.change(nameField(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    expect(await screen.findByText(errors.t('validation.taskForm.nameRequired'))).toBeTruthy();
    expect(stored('t1')?.name).toBe('Écrire le rapport');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ferme sans question quand rien n\'a changé', async () => {
    const { onClose } = await openEdition();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le formulaire' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('demande confirmation avant d\'abandonner une modification non enregistrée', async () => {
    const { onClose } = await openEdition();
    fireEvent.change(nameField(), { target: { value: 'Autre nom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le formulaire' }));

    expect(await screen.findByText('Abandonner les modifications ?')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer la saisie' }));
    expect(onClose).not.toHaveBeenCalled();
    expect((nameField() as HTMLInputElement).value).toBe('Autre nom');

    fireEvent.click(screen.getByRole('button', { name: 'Fermer le formulaire' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abandonner' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stored('t1')?.name).toBe('Écrire le rapport');
  });

  it('charge la description complète de la tâche et la montre d\'emblée', async () => {
    const described = makeTask({ id: 't3', name: 'Rédiger la note', description: 'Contexte détaillé de la note', dueDay: dayKeyFromToday(2) });
    resetDemoWorld([described]);
    await openEdition({ ...described, description: undefined });
    const field = (await screen.findByLabelText(/^Description/)) as HTMLTextAreaElement;
    await waitFor(() => expect(field.value).toBe('Contexte détaillé de la note'));
    // Charger la description ne doit pas passer pour une modification de la personne.
    expect((screen.getByRole('button', { name: 'Sauvegarder' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TaskModal · listes', () => {
  // 🔴 BUG DÉCRIT : l'effet d'initialisation du formulaire dépend de
  // `lists.length`. Créer une liste depuis « Options avancées » change cette
  // longueur : le formulaire se réinitialise sur la tâche d'origine, et le nom
  // modifié (comme la liste qu'on vient de cocher) disparaît.
  itBug('créer une liste dans « Options avancées » ne perd pas le nom modifié (BUG : formulaire réinitialisé)', async () => {
    await openEdition();
    fireEvent.change(nameField(), { target: { value: 'Rapport renommé' } });
    fireEvent.click(tab(/Options avancées/));
    fireEvent.click(screen.getByRole('button', { name: 'Créer une liste' }));
    const input = screen.getByPlaceholderText('Nom de la liste...');
    fireEvent.change(input, { target: { value: 'Ma nouvelle liste' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByRole('button', { name: /Ma nouvelle liste/ });
    fireEvent.click(tab(/Détails/));
    expect((nameField() as HTMLInputElement).value).toBe('Rapport renommé');
  });

  it("coche une liste existante dans « Options avancées » et l'enregistre avec la tâche", async () => {
    await openEdition();
    fireEvent.click(tab(/Options avancées/));
    const listButtons = screen.getAllByRole('button', { pressed: false });
    expect(listButtons.length).toBeGreaterThan(0);
    fireEvent.click(listButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cosmo_lists') ?? '[]').some((l: { taskIds: string[] }) => l.taskIds.includes('t1'))).toBe(true));
  });
});

describe('TaskModal · récurrence', () => {
  it('n\'offre la récurrence qu\'une fois une échéance posée', async () => {
    await openCreation();
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    expect(screen.queryByLabelText('Récurrence')).toBeNull();
    await pickDeadlinePreset('Demain');
    expect((screen.getByLabelText('Récurrence') as HTMLSelectElement).value).toBe('none');
  });

  it('crée une tâche qui se répète chaque semaine', async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Arroser les plantes' } });
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    await pickDeadlinePreset('Demain');
    fireEvent.change(screen.getByLabelText('Récurrence'), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Arroser les plantes')).toBe(true));
    expect(storedTasks().find((t) => t.name === 'Arroser les plantes')!.recurrence).toBe('weekly');
  });

  it('relit et modifie la récurrence d\'une tâche existante', async () => {
    const weekly = makeTask({ id: 't4', name: 'Point hebdo', dueDay: dayKeyFromToday(1), recurrence: 'weekly' });
    resetDemoWorld([weekly]);
    await openEdition(weekly);
    const select = screen.getByLabelText('Récurrence') as HTMLSelectElement;
    expect(select.value).toBe('weekly');
    fireEvent.change(select, { target: { value: 'daily' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(stored('t4')?.recurrence).toBe('daily'));
  });
});

describe('TaskModal · ÉCHÉANCE (vague 13)', () => {
  const clock = () => renderHook(() => useTimezonePref());

  afterEach(() => {
    const { result } = clock();
    act(() => result.current.setMode('default'));
    act(() => result.current.setOffsetHours(0));
  });

  it('ÉCHÉANCE · le champ affiche le jour stocké, jj/mm/aaaa', async () => {
    await openEdition();
    const [y, m, d] = dayKeyFromToday(3).split('-');
    expect(screen.getByRole('button', { name: `${d}/${m}/${y}` })).toBeTruthy();
  });

  it('ÉCHÉANCE · choisir « Demain » stocke l\'instant de minuit de demain dans le fuseau de la personne', async () => {
    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Rappeler le notaire' } });
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    await pickDeadlinePreset('Demain');
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Rappeler le notaire')).toBe(true));
    const task = storedTasks().find((t) => t.name === 'Rappeler le notaire')!;
    expect(task.deadline).toBe(deadlineFromDayKey(dayKeyFromToday(1)));
    expect(deadlineDayKey(task.deadline)).toBe(dayKeyFromToday(1));
  });

  it('ÉCHÉANCE · garder l\'échéance en enregistrant une autre modification ne la déplace pas', async () => {
    await openEdition();
    fireEvent.change(nameField(), { target: { value: 'Écrire le rapport v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(stored('t1')?.name).toBe('Écrire le rapport v2'));
    expect(deadlineDayKey(stored('t1')!.deadline)).toBe(dayKeyFromToday(3));
  });

  it('ÉCHÉANCE · « Pas de date » efface l\'échéance et masque la récurrence', async () => {
    await openEdition();
    fireEvent.click(screen.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pas de date' }));
    await waitFor(() => expect(screen.queryByLabelText('Récurrence')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(stored('t1')?.deadline ?? '').toBe(''));
  });

  it('ÉCHÉANCE · fuseau manuel : une échéance stockée s\'affiche au jour vécu dans CE fuseau', async () => {
    const { result } = clock();
    act(() => result.current.setMode('manual'));
    act(() => result.current.setOffsetHours(-10));
    const pref = { mode: 'manual', offsetHours: -10 } as const;
    const task = makeTask({ id: 't5', name: 'Tâche du fuseau', priority: 3 });
    // Minuit du 12 novembre à UTC-10 : le jour vécu est le 12, même si le jour UTC est le 12 à 10 h.
    task.deadline = deadlineFromDayKey('2026-11-12', pref);
    resetDemoWorld([task]);
    await openEdition(task);
    expect(screen.getByRole('button', { name: '12/11/2026' })).toBeTruthy();
  });

  it('ÉCHÉANCE · fuseau manuel : enregistrer sans toucher à l\'échéance ne la décale pas d\'un jour', async () => {
    const { result } = clock();
    act(() => result.current.setMode('manual'));
    act(() => result.current.setOffsetHours(-10));
    const pref = { mode: 'manual', offsetHours: -10 } as const;
    const task = makeTask({ id: 't6', name: 'Tâche du fuseau', priority: 3 });
    task.deadline = deadlineFromDayKey('2026-11-12', pref);
    resetDemoWorld([task]);
    await openEdition(task);
    fireEvent.change(nameField(), { target: { value: 'Tâche du fuseau bis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(stored('t6')?.name).toBe('Tâche du fuseau bis'));
    expect(deadlineDayKey(stored('t6')!.deadline, pref)).toBe('2026-11-12');
  });

  // 🔴 BUG DÉCRIT : les presets du calendrier (`buildDatePresets`) calculent
  // « Aujourd'hui » avec `toLocaleDateString('en-CA')`, donc le fuseau de la
  // MACHINE, alors que `src/lib/CLAUDE.md` interdit cette lecture dans un chemin
  // qui touche aux échéances et que le fuseau manuel est censé piloter
  // « ses listes Aujourd'hui ». Avec un fuseau manuel qui change de jour par
  // rapport à la machine, « Aujourd'hui » pose le jour de la machine.
  itBug('ÉCHÉANCE · fuseau manuel : le preset « Aujourd\'hui » pose le jour du fuseau choisi (BUG : jour de la machine)', async () => {
    const machineOffset = -new Date().getTimezoneOffset() / 60;
    // Un décalage garanti de changer de jour par rapport à la machine à 10 h locales.
    const chosen = machineOffset <= 0 ? Math.min(14, Math.trunc(machineOffset) + 14) : Math.max(-12, Math.trunc(machineOffset) - 11);
    const { result } = clock();
    act(() => result.current.setMode('manual'));
    act(() => result.current.setOffsetHours(chosen));
    const pref = { mode: 'manual', offsetHours: chosen } as const;
    const todayInChosenTz = todayKeyInTz(pref);
    expect(todayInChosenTz).not.toBe(TODAY_KEY); // précondition : le jour change bien

    await openCreation();
    fireEvent.change(nameField(), { target: { value: 'Tâche du jour choisi' } });
    fireEvent.click(screen.getByRole('button', { name: /Plus d'options/ }));
    await pickDeadlinePreset('Aujourd\'hui');
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    await waitFor(() => expect(storedTasks().some((t) => t.name === 'Tâche du jour choisi')).toBe(true));
    const task = storedTasks().find((t) => t.name === 'Tâche du jour choisi')!;
    expect(deadlineDayKey(task.deadline, pref)).toBe(todayInChosenTz);
    expect(DEFAULT_TIMEZONE_PREF.mode).toBe('default');
  });
});

describe('TaskModal · suppression et annulation', () => {
  it('supprime une tâche perso sans confirmation, ferme, et propose « Annuler »', async () => {
    const { onClose } = await openEdition();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(stored('t1')).toBeUndefined());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(undoToast).toHaveBeenCalledTimes(1);
    expect(undoToast.mock.calls[0][0]).toBe(tasksT.t('modal.deleted'));
  });

  it('« Annuler » rend la tâche sous son identifiant d\'origine', async () => {
    await openEdition();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(undoToast).toHaveBeenCalled());
    await act(async () => { undoToast.mock.calls[0][1](); });
    await waitFor(() => expect(stored('t1')?.name).toBe('Écrire le rapport'));
  });

  it('demande confirmation pour une tâche collaborative, et rien n\'est supprimé avant le « Oui »', async () => {
    const shared = makeTask({ id: 't7', name: 'Dossier à plusieurs', dueDay: dayKeyFromToday(2), isCollaborative: true });
    resetDemoWorld([shared]);
    const { onClose } = await openEdition(shared);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText(modalT.t('delete.bodyOwner'))).toBeTruthy();
    expect(stored('t7')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('abandonne la suppression collaborative quand on annule la confirmation', async () => {
    const shared = makeTask({ id: 't8', name: 'Dossier à plusieurs', dueDay: dayKeyFromToday(2), isCollaborative: true });
    resetDemoWorld([shared]);
    await openEdition(shared);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Annuler/ }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(stored('t8')).toBeDefined();
  });
});
