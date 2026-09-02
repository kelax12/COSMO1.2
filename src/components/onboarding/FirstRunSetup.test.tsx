// @vitest-environment jsdom
//
// L'écran d'accueil câble trois mutations réelles. `first-run.test.ts` prouve
// la forme des charges utiles ; ce fichier prouve le CÂBLAGE : que la réponse
// tapée part bien vers la bonne mutation, et surtout qu'une étape passée n'en
// déclenche AUCUNE. Un onboarding qui crée ce qu'on a refusé de lui donner est
// pire que pas d'onboarding.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FirstRunSetup from './FirstRunSetup';
import { FIRST_RUN_FLAG } from './first-run';

const createTask = vi.fn();
const createHabit = vi.fn();
const createOkr = vi.fn();
let tasks: unknown[] = [];
let isDemo = false;

vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => isDemo }));
vi.mock('@/modules/auth/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/modules/tasks', () => ({
  useTasks: () => ({ data: tasks, isSuccess: true }),
  useCreateTask: () => ({ mutate: createTask }),
}));
vi.mock('@/modules/habits', () => ({ useCreateHabit: () => ({ mutate: createHabit }) }));
vi.mock('@/modules/okrs', () => ({ useCreateOkr: () => ({ mutate: createOkr }) }));

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const click = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }));

describe('FirstRunSetup', () => {
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
    const { container } = render(<FirstRunSetup />);
    expect(container.innerHTML).toBe('');
  });

  it("ne s'affiche pas en mode demo", () => {
    isDemo = true;
    const { container } = render(<FirstRunSetup />);
    expect(container.innerHTML).toBe('');
  });

  it("ne s'affiche pas deux fois sur le meme appareil", () => {
    localStorage.setItem(FIRST_RUN_FLAG, '1');
    const { container } = render(<FirstRunSetup />);
    expect(container.innerHTML).toBe('');
  });

  it('cree la tache tapee sans exiger un clic sur « Ajouter »', () => {
    render(<FirstRunSetup />);
    type(/faire cette semaine/i, 'Rappeler le comptable');
    click(/Continuer/);
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask.mock.calls[0][0].name).toBe('Rappeler le comptable');
  });

  it('cree plusieurs taches ajoutees a la liste', () => {
    render(<FirstRunSetup />);
    type(/faire cette semaine/i, 'Une');
    click(/^Ajouter$/);
    type(/faire cette semaine/i, 'Deux');
    click(/Continuer/);
    expect(createTask).toHaveBeenCalledTimes(2);
    expect(createTask.mock.calls.map((c) => c[0].name)).toEqual(['Une', 'Deux']);
  });

  it('ne cree RIEN quand chaque etape est passee', () => {
    render(<FirstRunSetup />);
    click(/Passer cette etape/);
    click(/Passer cette etape/);
    click(/Passer cette etape/);
    expect(createTask).not.toHaveBeenCalled();
    expect(createHabit).not.toHaveBeenCalled();
    expect(createOkr).not.toHaveBeenCalled();
    // L'ecran est refermé et ne reviendra pas.
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('ne cree rien non plus quand on ferme l ecran d un coup', () => {
    render(<FirstRunSetup />);
    click(/Passer l'accueil/);
    expect(createTask).not.toHaveBeenCalled();
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('cree habitude et objectif aux etapes suivantes', () => {
    render(<FirstRunSetup />);
    click(/Passer cette etape/);
    type(/habitude que vous voulez tenir/i, 'Marcher 30 minutes');
    click(/Continuer/);
    expect(createHabit).toHaveBeenCalledTimes(1);
    expect(createHabit.mock.calls[0][0].name).toBe('Marcher 30 minutes');

    type(/objectif pour les trois prochains mois/i, 'Lancer la v2');
    click(/Entrer dans COSMO/);
    expect(createOkr).toHaveBeenCalledTimes(1);
    expect(createOkr.mock.calls[0][0].title).toBe('Lancer la v2');
    // Derniere etape : l'ecran se referme.
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it("n'ouvre pas d'objectif vide quand seul le resultat cle est rempli", () => {
    // Un OKR sans intitule n'a aucun sens, et le schema zod le refuserait
    // apres coup avec un message d'erreur que personne n'a demande.
    render(<FirstRunSetup />);
    click(/Passer cette etape/);
    click(/Passer cette etape/);
    fireEvent.change(screen.getByPlaceholderText(/Publier la page de vente/), {
      target: { value: 'Un resultat orphelin' },
    });
    click(/Entrer dans COSMO/);
    expect(createOkr).not.toHaveBeenCalled();
  });
});
