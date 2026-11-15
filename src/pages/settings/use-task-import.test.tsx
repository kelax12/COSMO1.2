// @vitest-environment jsdom
// Import de taches : de la lecture d'un CSV a l'annulation, depots mockes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  tasksRepo: { create: vi.fn(), delete: vi.fn() },
  catRepo: { create: vi.fn(), delete: vi.fn() },
  teamRepo: { createTask: vi.fn(), deleteTask: vi.fn() },
  teamCatRepo: { createCategory: vi.fn(), deleteCategory: vi.fn() },
}));

vi.mock('@/lib/repository.factory', () => ({
  getTasksRepository: () => h.tasksRepo,
  getCategoriesRepository: () => h.catRepo,
  getTeamProjectsRepository: () => h.teamRepo,
  getTeamCategoriesRepository: () => h.teamCatRepo,
}));
vi.mock('@/modules/categories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/categories')>()),
  useCategories: () => ({ data: [] }),
}));
vi.mock('@/modules/team-categories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/team-categories')>()),
  useTeamCategories: () => ({ data: [] }),
}));

import { useTaskImport, MAX_FILE_BYTES } from './use-task-import';

const TODOIST = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE\ntask,Payer la facture,,1,1,,,,,\ntask,Appeler Paul,,4,1,,,,,\n';
const GENERIC = 'Titre,Echeance\nAcheter du pain,2026-12-01\nLire un livre,2026-12-02\n';

const csv = (name: string, body: string) => new File([body], name, { type: 'text/csv' });

function setup(target?: { orgId: string; projectId: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useTaskImport(target), { wrapper });
  return { ...hook, invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  let n = 0;
  h.tasksRepo.create.mockImplementation(async () => ({ id: `t${++n}` }));
  h.tasksRepo.delete.mockResolvedValue(undefined);
  h.catRepo.create.mockImplementation(async (c: { name: string }) => ({ id: `c-${c.name}`, name: c.name }));
  h.catRepo.delete.mockResolvedValue(undefined);
  h.teamRepo.createTask.mockImplementation(async () => ({ id: `tt${++n}` }));
  h.teamRepo.deleteTask.mockResolvedValue(undefined);
  h.teamCatRepo.createCategory.mockImplementation(async (_o: string, c: { name: string }) => ({ id: `tc-${c.name}`, name: c.name }));
  h.teamCatRepo.deleteCategory.mockResolvedValue(undefined);
});

describe('useTaskImport', () => {
  it('demarre a l\'etape fichiers, sans rien', () => {
    const { result } = setup();
    expect(result.current.step).toBe('files');
    expect(result.current.files).toEqual([]);
    expect(result.current.plan.tasks).toEqual([]);
  });

  it('un export Todoist saute le mapping et va a l\'apercu', async () => {
    const { result } = setup();
    await act(() => result.current.addFiles([csv('Travail [123].csv', TODOIST)]));
    expect(result.current.step).toBe('preview');
    expect(result.current.files[0].source).toBe('todoist');
    expect(result.current.plan.tasks).toHaveLength(2);
    expect(result.current.errors).toEqual([]);
  });

  it('un CSV inconnu passe par le mapping, puis le mapping se corrige', async () => {
    const { result } = setup();
    await act(() => result.current.addFiles([csv('perso.csv', GENERIC)]));
    expect(result.current.step).toBe('mapping');
    expect(result.current.files[0].source).toBe('generic');
    act(() => result.current.setMapping('perso.csv', { title: 0, due: 1 }));
    expect(result.current.files[0].mapping).toMatchObject({ title: 0, due: 1 });
    expect(result.current.parsed[0].tasks.length).toBeGreaterThan(0);
  });

  it('fichier trop gros ou illisible : erreur nommee, pas de passage a l\'etape suivante', async () => {
    const { result } = setup();
    const big = csv('gros.csv', 'a,b\n1,2\n');
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 });
    await act(() => result.current.addFiles([big, csv('vide.csv', 'seulement-un-en-tete')]));
    expect(result.current.errors).toHaveLength(2);
    expect(result.current.errors.join(' ')).toContain('gros.csv');
    expect(result.current.errors.join(' ')).toContain('vide.csv');
    expect(result.current.step).toBe('files');
  });

  it('import perso : cree via le depot, passe par running puis done, invalide UNE fois', async () => {
    const { result, invalidate } = setup();
    await act(() => result.current.addFiles([csv('Travail [123].csv', TODOIST)]));
    await act(() => result.current.start());
    expect(result.current.step).toBe('done');
    expect(h.tasksRepo.create).toHaveBeenCalledTimes(2);
    expect(h.teamRepo.createTask).not.toHaveBeenCalled();
    expect(result.current.progress.total).toBe(2);
    expect(result.current.result).not.toBeNull();
    // tasks + categories, une fois chacune
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('annuler l\'import supprime ce qui a ete cree', async () => {
    const { result } = setup();
    await act(() => result.current.addFiles([csv('Travail [123].csv', TODOIST)]));
    await act(() => result.current.start());
    await act(() => result.current.undoAll());
    await waitFor(() => expect(result.current.undo.state).toBe('done'));
    expect(h.tasksRepo.delete).toHaveBeenCalledTimes(2);
    expect(result.current.undo.failed).toBe(0);
  });

  it('annuler sans resultat ne fait rien', async () => {
    const { result } = setup();
    await act(() => result.current.undoAll());
    expect(result.current.undo.state).toBe('idle');
  });

  it('import entreprise : taches dans le projet cible, depots d\'equipe', async () => {
    const { result } = setup({ orgId: 'org1', projectId: 'p1' });
    await act(() => result.current.addFiles([csv('Travail [123].csv', TODOIST)]));
    await act(() => result.current.start());
    expect(h.tasksRepo.create).not.toHaveBeenCalled();
    expect(h.teamRepo.createTask).toHaveBeenCalledTimes(2);
    expect(h.teamRepo.createTask.mock.calls[0][0]).toBe('org1');
    expect(h.teamRepo.createTask.mock.calls[0][1]).toMatchObject({ projectId: 'p1', status: 'todo' });
    await act(() => result.current.undoAll());
    expect(h.teamRepo.deleteTask).toHaveBeenCalledTimes(2);
  });

  it('reset remet tout a l\'etat initial', async () => {
    const { result } = setup();
    await act(() => result.current.addFiles([csv('Travail [123].csv', TODOIST)]));
    act(() => result.current.setIncludeCompleted(true));
    act(() => result.current.reset());
    expect(result.current.step).toBe('files');
    expect(result.current.files).toEqual([]);
    expect(result.current.includeCompleted).toBe(false);
    expect(result.current.result).toBeNull();
  });
});
