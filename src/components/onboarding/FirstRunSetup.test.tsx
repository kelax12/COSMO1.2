// @vitest-environment jsdom
//
// L'écran d'accueil câble trois mutations réelles. `first-run.test.ts` prouve
// la forme des charges utiles ; ce fichier prouve le CÂBLAGE : que la réponse
// tapée part bien vers la bonne mutation, et surtout qu'une étape passée n'en
// déclenche AUCUNE. Un onboarding qui crée ce qu'on a refusé de lui donner est
// pire que pas d'onboarding.
//
// Parcours depuis le 2026-10-03 (planétaire) : présentation → tâches → agenda
// (rien à créer) → habitude → objectif → bilan.
//
// ⚠️ Chaque écran d'étape entre APRÈS la sortie du précédent
// (`AnimatePresence mode="wait"`) : on ATTEND le champ suivant (`findBy…`)
// au lieu de le supposer présent. Les boutons d'action, eux, vivent hors de
// la transition et sont toujours ceux de l'étape courante.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MotionGlobalConfig } from 'framer-motion';
import FirstRunSetup from './FirstRunSetup';
import { FIRST_RUN_FLAG } from './first-run';

const createTask = vi.fn();
const createHabit = vi.fn();
const createOkr = vi.fn();
let tasks: unknown[] = [];
let isDemo = false;

vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => isDemo }));
vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'u-1', name: 'Axel Martin', email: 'a@x.fr' } }),
}));
vi.mock('@/modules/tasks', () => ({
  useTasks: () => ({ data: tasks, isSuccess: true }),
  useCreateTask: () => ({ mutate: createTask }),
}));
vi.mock('@/modules/habits', () => ({ useCreateHabit: () => ({ mutate: createHabit }) }));
vi.mock('@/modules/okrs', () => ({ useCreateOkr: () => ({ mutate: createOkr }) }));

const ui = (path = '/dashboard') => (
  <MemoryRouter initialEntries={[path]}>
    <FirstRunSetup />
  </MemoryRouter>
);

const TASKS = /faire cette semaine/i;
const HABIT = /habitude que vous voulez tenir/i;
const OKR = /objectif pour les trois prochains mois/i;

const type = async (label: RegExp, value: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });

const click = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }));

/** De la présentation à la question des tâches. */
const start = async () => {
  click(/^Commencer/);
  await screen.findByLabelText(TASKS);
};
/** Passe l'étape Agenda, qui n'a rien à créer, et attend l'habitude. */
const pastAgenda = async () => {
  click(/^Compris/);
  await screen.findByLabelText(HABIT);
};

describe('FirstRunSetup', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  beforeEach(() => {
    localStorage.clear();
    tasks = [];
    isDemo = false;
    createTask.mockClear();
    createHabit.mockClear();
    createOkr.mockClear();
  });

  it("ne s'affiche pas pour un compte qui a deja des taches", () => {
    tasks = [{ id: 't1' }];
    const { container } = render(ui());
    expect(container.innerHTML).toBe('');
  });

  it("ne s'affiche pas en mode demo", () => {
    isDemo = true;
    const { container } = render(ui());
    expect(container.innerHTML).toBe('');
  });

  it("ne s'affiche pas deux fois sur le meme appareil", () => {
    localStorage.setItem(FIRST_RUN_FLAG, '1');
    const { container } = render(ui());
    expect(container.innerHTML).toBe('');
  });

  it("ne s'ouvre pas par-dessus l'espace entreprise, qui a son propre accueil", () => {
    const { container } = render(ui('/entreprise'));
    expect(container.innerHTML).toBe('');
  });

  it('salue par le prenom et presente avant de demander quoi que ce soit', async () => {
    render(ui());
    expect(screen.getByText('Bonjour Axel.')).toBeTruthy();
    expect(screen.queryByLabelText(TASKS)).toBeNull();
    await start();
  });

  it('cree la tache tapee sans exiger un clic sur « Ajouter »', async () => {
    render(ui());
    await start();
    await type(TASKS, 'Rappeler le comptable');
    click(/^Continuer/);
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask.mock.calls[0][0].name).toBe('Rappeler le comptable');
  });

  it('cree plusieurs taches ajoutees a la liste, idees comprises', async () => {
    render(ui());
    await start();
    await type(TASKS, 'Une');
    click(/^Ajouter$/);
    click(/Faire les courses/);
    await type(TASKS, 'Deux');
    click(/^Continuer/);
    expect(createTask.mock.calls.map((c) => c[0].name)).toEqual(['Une', 'Faire les courses', 'Deux']);
  });

  it("montre la premiere tache creee a l'etape Agenda, sans rien creer de plus", async () => {
    render(ui());
    await start();
    await type(TASKS, 'Rappeler le comptable');
    click(/^Continuer/);
    expect(await screen.findByRole('heading', { name: /place.*vos tâches/i })).toBeTruthy();
    await pastAgenda();
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createHabit).not.toHaveBeenCalled();
  });

  it('ne cree RIEN quand chaque etape est passee', async () => {
    render(ui());
    await start();
    click(/Passer cette étape/);
    await screen.findByRole('heading', { name: /place.*vos tâches/i });
    await pastAgenda();
    click(/Passer cette étape/);
    await screen.findByLabelText(OKR);
    click(/Passer cette étape/);
    expect(await screen.findByText(/Rien pour l'instant/)).toBeTruthy();
    click(/Entrer dans COSMO/);
    expect(createTask).not.toHaveBeenCalled();
    expect(createHabit).not.toHaveBeenCalled();
    expect(createOkr).not.toHaveBeenCalled();
    // L'ecran est refermé et ne reviendra pas.
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('une etape passee oublie ce qui avait ete tape', async () => {
    render(ui());
    await start();
    await type(TASKS, 'Brouillon abandonne');
    click(/Passer cette étape/);
    expect(createTask).not.toHaveBeenCalled();
  });

  it('ne cree rien non plus quand on ferme l ecran d un coup', () => {
    render(ui());
    click(/Passer l'accueil/);
    expect(createTask).not.toHaveBeenCalled();
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('cree habitude et objectif aux etapes suivantes, puis fait le bilan', async () => {
    render(ui());
    await start();
    click(/Passer cette étape/);
    await screen.findByRole('heading', { name: /place.*vos tâches/i });
    await pastAgenda();
    await type(HABIT, 'Marcher 30 minutes');
    click(/^Continuer/);
    expect(createHabit).toHaveBeenCalledTimes(1);
    expect(createHabit.mock.calls[0][0].name).toBe('Marcher 30 minutes');

    await type(OKR, 'Lancer la v2');
    click(/^Continuer/);
    expect(createOkr).toHaveBeenCalledTimes(1);
    expect(createOkr.mock.calls[0][0].title).toBe('Lancer la v2');
    // Bilan : ce qui a été créé, et rien d'autre.
    expect(await screen.findByText('Habitude suivie : Marcher 30 minutes')).toBeTruthy();
    expect(screen.getByText('Objectif : Lancer la v2')).toBeTruthy();
    // Le drapeau se pose à la SORTIE, pas en arrivant sur le bilan.
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBeNull();
    click(/Entrer dans COSMO/);
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('reste ouvert quand la premiere tache creee revient dans le cache', async () => {
    // 🔴 REGRESSION MESUREE LE 2026-09-08, trouvee par le parcours
    // `e2e/stubbed/first-run.spec.ts` et par lui seul.
    //
    // `useCreateTask` ecrit la tache creee dans le cache React Query
    // (`setQueryData`) : `useTasks().data` n'est donc plus vide des la premiere
    // reponse. La garde d'ouverture etant relue a chaque rendu, l'accueil se
    // refermait ENTRE la question des taches et la suivante.
    const { rerender } = render(ui());
    await start();
    await type(TASKS, 'Rappeler le comptable');
    click(/^Continuer/);

    tasks = [{ id: 't1', name: 'Rappeler le comptable' }];
    rerender(ui());

    await screen.findByRole('heading', { name: /place.*vos tâches/i });
    await pastAgenda();
  });

  it("n'ouvre pas d'objectif vide quand seul le resultat cle est rempli", async () => {
    // Un OKR sans intitule n'a aucun sens, et le schema zod le refuserait
    // apres coup avec un message d'erreur que personne n'a demande.
    render(ui());
    await start();
    click(/Passer cette étape/);
    await screen.findByRole('heading', { name: /place.*vos tâches/i });
    await pastAgenda();
    click(/Passer cette étape/);
    fireEvent.change(await screen.findByPlaceholderText(/Publier la page de vente/), {
      target: { value: 'Un resultat orphelin' },
    });
    click(/^Continuer/);
    expect(createOkr).not.toHaveBeenCalled();
  });
});
