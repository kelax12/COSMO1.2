// @vitest-environment jsdom
//
// L'écran d'accueil câble quatre mutations réelles. `first-run.test.ts` prouve
// la forme des charges utiles ; ce fichier prouve le CÂBLAGE : que la réponse
// tapée part bien vers la bonne mutation, qu'une étape passée n'en déclenche
// AUCUNE, et (2026-10-05) qu'un retour arrière ne recrée rien.
//
// ⚠️ Chaque écran entre APRÈS la sortie du précédent (`AnimatePresence
// mode="wait"`) : on ATTEND le champ suivant (`findBy…`). Les boutons
// d'action vivent hors de la transition.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MotionGlobalConfig } from 'framer-motion';
import FirstRunSetup from './FirstRunSetup';
import { BUSINESS_PENDING_FLAG, FIRST_RUN_FLAG } from './first-run';

const createTask = vi.fn();
const createHabit = vi.fn();
const createOkr = vi.fn();
const createEvent = vi.fn();
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
vi.mock('@/modules/events', () => ({ useCreateEvent: () => ({ mutate: createEvent }) }));

const ui = (path = '/dashboard') => (
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/tasks" element={<p>page tâches</p>} />
      <Route path="/entreprise/onboarding" element={<p>accueil entreprise</p>} />
      <Route path="*" element={<FirstRunSetup />} />
    </Routes>
  </MemoryRouter>
);

const TASKS = /faire cette semaine/i;
const HABIT = /habitude que vous voulez tenir/i;
const OKR = /objectif pour les trois prochains mois/i;
const AGENDA = /place.*vos tâches/i;

const type = async (label: RegExp, value: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });
const click = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }));

const start = async () => {
  click(/^Commencer/);
  await screen.findByLabelText(TASKS);
};
const toAgenda = async () => screen.findByRole('heading', { name: AGENDA });
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
    for (const m of [createTask, createHabit, createOkr, createEvent]) m.mockReset();
    // Le dépôt rend la tâche créée : son id relie le créneau de l'agenda.
    createTask.mockImplementation((input, opts) => opts?.onSuccess?.({ id: `t-${input.name}` }));
  });

  it("ne s'affiche pas pour un compte qui a deja des taches", () => {
    tasks = [{ id: 't1' }];
    render(ui());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("ne s'affiche pas en mode demo", () => {
    isDemo = true;
    render(ui());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("ne s'affiche pas deux fois sur le meme appareil", () => {
    localStorage.setItem(FIRST_RUN_FLAG, '1');
    render(ui());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("ne s'ouvre pas par-dessus l'espace entreprise, qui a son propre accueil", () => {
    render(ui('/entreprise'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('salue par le prenom et presente avant de demander quoi que ce soit', async () => {
    render(ui());
    expect(screen.getByText('Bonjour Axel.')).toBeTruthy();
    expect(screen.queryByLabelText(TASKS)).toBeNull();
    await start();
  });

  it('rappelle l entreprise remise a plus tard, et y ramene', async () => {
    localStorage.setItem(BUSINESS_PENDING_FLAG, '1');
    render(ui());
    click(/reprendre mon entreprise/i);
    expect(await screen.findByText('accueil entreprise')).toBeTruthy();
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
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

  it('revenir en arriere ne recree rien, et n ajoute que le nouveau', async () => {
    render(ui());
    await start();
    await type(TASKS, 'Une');
    click(/^Continuer/);
    await toAgenda();
    click(/^Retour/);
    expect(await screen.findByText('Déjà dans votre liste')).toBeTruthy();
    click(/^Continuer/);
    await toAgenda();
    expect(createTask).toHaveBeenCalledTimes(1);
    click(/^Retour/);
    await type(TASKS, 'Deux');
    click(/^Continuer/);
    expect(createTask.mock.calls.map((c) => c[0].name)).toEqual(['Une', 'Deux']);
  });

  it("bloque un vrai creneau relie a la premiere tache, seulement si on le choisit", async () => {
    render(ui());
    await start();
    await type(TASKS, 'Rappeler le comptable');
    click(/^Continuer/);
    await toAgenda();
    fireEvent.click(screen.getByRole('radio', { name: /demain/i }));
    fireEvent.click(screen.getByRole('radio', { name: '14:00' }));
    click(/bloquer ce créneau/i);
    expect(createEvent).toHaveBeenCalledTimes(1);
    const event = createEvent.mock.calls[0][0];
    expect(event.title).toBe('Rappeler le comptable');
    expect(event.taskId).toBe('t-Rappeler le comptable');
    expect(new Date(event.start).getHours()).toBe(14);
    expect(new Date(event.end).getTime() - new Date(event.start).getTime()).toBe(3600_000);
  });

  it("sans creneau choisi, l'etape Agenda ne cree rien", async () => {
    render(ui());
    await start();
    await type(TASKS, 'Une');
    click(/^Continuer/);
    await toAgenda();
    await pastAgenda();
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('ne cree RIEN quand chaque etape est passee', async () => {
    render(ui());
    await start();
    click(/Passer cette étape/);
    await toAgenda();
    await pastAgenda();
    click(/Passer cette étape/);
    await screen.findByLabelText(OKR);
    click(/Passer cette étape/);
    expect(await screen.findByText(/Rien pour l'instant/)).toBeTruthy();
    click(/Entrer dans COSMO/);
    for (const m of [createTask, createHabit, createOkr, createEvent]) expect(m).not.toHaveBeenCalled();
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

  it("l'habitude prend la duree choisie (ou celle de l'idee), l'objectif sa cible", async () => {
    render(ui());
    await start();
    click(/Passer cette étape/);
    await toAgenda();
    await pastAgenda();
    click(/Lire 20 minutes/);
    click(/^Continuer/);
    expect(createHabit.mock.calls[0][0]).toMatchObject({ name: 'Lire 20 minutes', estimatedTime: 20 });

    await type(OKR, 'Lancer la v2');
    fireEvent.change(screen.getByPlaceholderText(/Publier la page de vente/), { target: { value: 'Signer des clients' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex\. 10/), { target: { value: '10' } });
    click(/^Continuer/);
    const okr = createOkr.mock.calls[0][0];
    expect(okr.title).toBe('Lancer la v2');
    expect(okr.keyResults[0]).toMatchObject({ title: 'Signer des clients', targetValue: 10 });
    // Bilan : ce qui a été créé, et rien d'autre.
    expect(await screen.findByText('Habitude suivie : Lire 20 minutes')).toBeTruthy();
    expect(screen.getByText('Objectif : Lancer la v2')).toBeTruthy();
    // Le drapeau se pose à la SORTIE, pas en arrivant sur le bilan.
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBeNull();
    click(/Entrer dans COSMO/);
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('le bilan propose une suite concrete', async () => {
    render(ui());
    await start();
    await type(TASKS, 'Une');
    click(/^Continuer/);
    await toAgenda();
    await pastAgenda();
    click(/Passer cette étape/);
    await screen.findByLabelText(OKR);
    click(/Passer cette étape/);
    fireEvent.click(await screen.findByRole('button', { name: /voir mes tâches/i }));
    expect(await screen.findByText('page tâches')).toBeTruthy();
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
  });

  it('reste ouvert quand la premiere tache creee revient dans le cache', async () => {
    // 🔴 REGRESSION MESUREE LE 2026-09-08 : la garde d'ouverture relue à chaque
    // rendu refermait l'accueil dès la première tâche créée.
    const { rerender } = render(ui());
    await start();
    await type(TASKS, 'Rappeler le comptable');
    click(/^Continuer/);
    tasks = [{ id: 't1', name: 'Rappeler le comptable' }];
    rerender(ui());
    await toAgenda();
    await pastAgenda();
  });

  it("n'ouvre pas d'objectif vide quand seul le resultat cle est rempli", async () => {
    render(ui());
    await start();
    click(/Passer cette étape/);
    await toAgenda();
    await pastAgenda();
    click(/Passer cette étape/);
    fireEvent.change(await screen.findByPlaceholderText(/Publier la page de vente/), {
      target: { value: 'Un resultat orphelin' },
    });
    click(/^Continuer/);
    expect(createOkr).not.toHaveBeenCalled();
  });
});
