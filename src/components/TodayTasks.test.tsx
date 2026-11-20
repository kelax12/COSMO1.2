// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '@/modules/tasks';

const toggleComplete = vi.fn();
const toggleBookmark = vi.fn();
const deleteTask = vi.fn();
const restoreTask = vi.fn();
const createEvent = vi.fn();
const navigate = vi.fn();
const showUndoToast = vi.fn();
let tasks: Task[] = [];
let loading = false;

vi.mock('@/modules/tasks', () => ({
  useTasks: () => ({ data: tasks, isLoading: loading }),
  useToggleTaskComplete: () => ({ mutate: toggleComplete }),
  useToggleTaskBookmark: () => ({ mutate: toggleBookmark }),
  useDeleteTask: () => ({ mutate: deleteTask }),
  useRestoreTask: () => ({ mutate: restoreTask }),
}));
vi.mock('@/modules/events', () => ({ useCreateEvent: () => ({ mutate: createEvent }) }));
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/undo-toast', () => ({ showUndoToast: (...a: unknown[]) => showUndoToast(...a) }));
vi.mock('./TaskRow', () => ({
  default: (p: {
    name: string;
    completeLabel: string;
    onComplete: () => void;
    onOpen: () => void;
    actions: { key: string; label: string; run: () => void }[];
  }) => (
    <li>
      <button onClick={p.onComplete}>{p.completeLabel}</button>
      <button onClick={p.onOpen}>{`ouvrir ${p.name}`}</button>
      {p.actions.map((a) => (
        <button key={a.key} onClick={a.run}>{`${p.name}|${a.key}`}</button>
      ))}
    </li>
  ),
}));
vi.mock('./TaskModal', () => ({
  default: (p: { task: Task; showCollaborators?: boolean; onClose: () => void }) => (
    <div role="dialog" aria-label="task-modal">
      {p.task.name}{p.showCollaborators ? ':collab' : ''}
      <button onClick={p.onClose}>fermer-tache</button>
    </div>
  ),
}));
vi.mock('./EventModal', () => ({
  default: (p: { onConvert: (e: unknown) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="event-modal">
      <button onClick={() => p.onConvert({ title: 'ev' })}>convertir</button>
      <button onClick={p.onClose}>fermer-event</button>
    </div>
  ),
}));
vi.mock('./AddToListModal', () => ({
  default: (p: { taskId: string; onClose: () => void }) => (
    <div role="dialog" aria-label="list-modal">{p.taskId}<button onClick={p.onClose}>fermer-liste</button></div>
  ),
}));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
    tp: (key: string, n: number) => `${key}:${n}`,
  }),
}));

import TodayTasks from './TodayTasks';

const dayKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};
let seq = 0;
const make = (over: Partial<Task> = {}): Task => {
  seq += 1;
  return {
    id: `t${seq}`,
    name: `Tâche ${seq}`,
    completed: false,
    priority: 0,
    category: '',
    deadline: dayKey(0),
    estimatedTime: 30,
    bookmarked: false,
    createdAt: new Date().toISOString(),
    ...over,
  } as Task;
};
const names = () =>
  screen.getAllByRole('button', { name: /^ouvrir / }).map((b) => b.textContent?.replace('ouvrir ', ''));

describe('TodayTasks', () => {
  beforeEach(() => {
    [toggleComplete, toggleBookmark, deleteTask, restoreTask, createEvent, navigate, showUndoToast].forEach((m) => m.mockReset());
    tasks = [];
    loading = false;
    seq = 0;
  });

  it('montre un squelette pendant le chargement', () => {
    loading = true;
    const { container } = render(<TodayTasks />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(screen.queryByText('sections.priorityTasks')).toBeNull();
  });

  it('sans aucune tâche, invite à en créer et mène à la page Tâches', () => {
    render(<TodayTasks />);
    expect(screen.getByText('todayTasks.empty.noneTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'todayTasks.empty.noneAction' }));
    expect(navigate).toHaveBeenCalledWith('/tasks');
  });

  it('avec des tâches mais rien de prioritaire, annonce que tout est dégagé', () => {
    tasks = [make({ deadline: dayKey(10), priority: 4 })];
    render(<TodayTasks />);
    expect(screen.getByText('todayTasks.empty.clearTitle')).toBeTruthy();
  });

  it('retient les tâches du jour et les priorités hautes, jamais les terminées ni les P3+ lointaines', () => {
    tasks = [
      make({ name: 'Du jour', deadline: dayKey(0), priority: 4 }),
      make({ name: 'Urgente lointaine', deadline: dayKey(20), priority: 1 }),
      make({ name: 'Lointaine banale', deadline: dayKey(20), priority: 4 }),
      make({ name: 'Faite', deadline: dayKey(0), completed: true }),
      make({ name: 'Sans priorité lointaine', deadline: dayKey(20), priority: 0 }),
    ];
    render(<TodayTasks />);
    expect(names().sort()).toEqual(['Du jour', 'Urgente lointaine']);
  });

  it('trie les favorites d’abord, puis par priorité, la tâche sans priorité en dernier', () => {
    tasks = [
      make({ name: 'Sans priorité', priority: 0 }),
      make({ name: 'P5', priority: 5 }),
      make({ name: 'P1', priority: 1 }),
      make({ name: 'Favorite P5', priority: 5, bookmarked: true }),
    ];
    render(<TodayTasks />);
    expect(names()).toEqual(['Favorite P5', 'P1', 'P5', 'Sans priorité']);
  });

  it('plafonne la liste à cinq tâches', () => {
    tasks = Array.from({ length: 8 }, (_, i) => make({ name: `N${i}`, priority: 3 }));
    render(<TodayTasks />);
    expect(names()).toHaveLength(5);
    expect(screen.getByText('todayTasks.summary:5')).toBeTruthy();
  });

  it('terminer, mettre en favori et ouvrir passent par les bonnes actions', () => {
    tasks = [make({ name: 'A', priority: 3 })];
    render(<TodayTasks />);
    fireEvent.click(screen.getByRole('button', { name: 'todayTasks.markDone' }));
    expect(toggleComplete).toHaveBeenCalledWith('t1');
    fireEvent.click(screen.getByRole('button', { name: 'A|bookmark' }));
    expect(toggleBookmark).toHaveBeenCalledWith('t1');
    fireEvent.click(screen.getByRole('button', { name: 'ouvrir A' }));
    expect(screen.getByRole('dialog', { name: 'task-modal' }).textContent).toContain('A');
    fireEvent.click(screen.getByText('fermer-tache'));
    expect(screen.queryByRole('dialog', { name: 'task-modal' })).toBeNull();
  });

  it('convertir en évènement ouvre la modale puis crée l’évènement lié à la tâche', () => {
    tasks = [make({ name: 'A', priority: 3 })];
    render(<TodayTasks />);
    fireEvent.click(screen.getByRole('button', { name: 'A|event' }));
    fireEvent.click(screen.getByText('convertir'));
    expect(createEvent).toHaveBeenCalledWith({ title: 'ev', taskId: 't1' });
    expect(screen.queryByRole('dialog', { name: 'event-modal' })).toBeNull();
  });

  it('ajouter à une liste et gérer les collaborateurs ouvrent leurs modales', () => {
    tasks = [make({ name: 'A', priority: 3 })];
    render(<TodayTasks />);
    fireEvent.click(screen.getByRole('button', { name: 'A|list' }));
    expect(screen.getByRole('dialog', { name: 'list-modal' }).textContent).toContain('t1');
    fireEvent.click(screen.getByText('fermer-liste'));
    fireEvent.click(screen.getByRole('button', { name: 'A|collab' }));
    expect(screen.getByRole('dialog', { name: 'task-modal' }).textContent).toContain(':collab');
  });

  it('supprime une tâche perso tout de suite, avec un toast « annuler » qui la restaure sous son id', () => {
    const task = make({ name: 'A', priority: 3 });
    tasks = [task];
    render(<TodayTasks />);
    fireEvent.click(screen.getByRole('button', { name: 'A|delete' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deleteTask).toHaveBeenCalledWith('t1', expect.any(Object));

    (deleteTask.mock.calls[0][1] as { onSuccess: () => void }).onSuccess();
    expect(showUndoToast).toHaveBeenCalledWith('todayTasks.deleted', expect.any(Function));
    (showUndoToast.mock.calls[0][1] as () => void)();
    expect(restoreTask).toHaveBeenCalledWith(task, expect.any(Object));
  });

  it('une tâche collaborative demande confirmation avant d’être supprimée, et annuler ne supprime rien', () => {
    tasks = [make({ name: 'Partagée', priority: 3, isCollaborative: true })];
    render(<TodayTasks />);
    fireEvent.click(screen.getByRole('button', { name: 'Partagée|delete' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(deleteTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'todayTasks.deleteDialog.cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Partagée|delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'todayTasks.deleteDialog.confirm' }));
    expect(deleteTask).toHaveBeenCalledWith('t1', expect.any(Object));
  });
});
