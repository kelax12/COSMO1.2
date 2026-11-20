// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Habit } from '@/modules/habits';

const createTask = vi.fn();
const createEvent = vi.fn();
const pauseUntil = vi.fn();
const resume = vi.fn();
let paused = false;

vi.mock('@/lib/hooks/use-habit-pauses', () => ({
  useHabitPauses: () => ({ isPaused: () => paused, pauseUntil, resume }),
}));
vi.mock('@/modules/tasks', () => ({ useCreateTask: () => ({ mutate: createTask }) }));
vi.mock('@/modules/categories', () => ({
  useCategories: () => ({ data: [{ id: 'cat-1', name: 'Santé' }] }),
}));
vi.mock('@/modules/events', () => ({ useCreateEvent: () => ({ mutate: createEvent }) }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./EventModal', () => ({
  default: (props: { isOpen: boolean; onClose: () => void; onAddEvent: (e: unknown) => void; lockedFields: string[] }) => (
    <div role="dialog" aria-label="event-modal" data-locked={props.lockedFields.join(',')}>
      <button onClick={() => props.onAddEvent({ title: 'Lecture' })}>valider-evenement</button>
      <button onClick={props.onClose}>fermer-evenement</button>
    </div>
  ),
}));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import HabitActionsMenu from './HabitActionsMenu';
import { toast } from '@/lib/toast';

const habit = { id: 'h1', name: 'Lecture', estimatedTime: 25, completions: {} } as unknown as Habit;
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'actions.more' }));

describe('HabitActionsMenu', () => {
  beforeEach(() => {
    createTask.mockReset();
    createEvent.mockReset();
    pauseUntil.mockReset();
    resume.mockReset();
    vi.mocked(toast.success).mockClear();
    paused = false;
  });

  it('le menu est fermé au repos, s’ouvre au clic et annonce son état', () => {
    render(<HabitActionsMenu habit={habit} />);
    const trigger = screen.getByRole('button', { name: 'actions.more' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('se ferme par Échap et par un clic à l’extérieur, pas par un clic dans le menu', async () => {
    render(<HabitActionsMenu habit={habit} />);
    openMenu();
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    openMenu();
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('« créer une tâche » crée une tâche du jour de même durée, sur la première catégorie', async () => {
    render(<HabitActionsMenu habit={habit} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /actionsMenu\.createTask$|actionsMenu\.createTask/ }));

    expect(createTask).toHaveBeenCalledTimes(1);
    const [payload, callbacks] = createTask.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess: (t: unknown) => void },
    ];
    expect(payload).toMatchObject({
      name: 'Lecture',
      estimatedTime: 25,
      category: 'cat-1',
      completed: false,
    });
    const deadline = new Date(payload.deadline as string);
    expect(deadline.toDateString()).toBe(new Date().toDateString());
    expect(deadline.getHours()).toBe(23);

    callbacks.onSuccess({ id: 't1' });
    expect(toast.success).toHaveBeenCalledWith('actions.taskCreated', expect.objectContaining({ duration: 4000 }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('« planifier dans l’agenda » ouvre la modale d’évènement verrouillée sur titre et date', async () => {
    render(<HabitActionsMenu habit={habit} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /actionsMenu\.scheduleInAgenda/ }));
    const modal = screen.getByRole('dialog', { name: 'event-modal' });
    expect(modal.getAttribute('data-locked')).toBe('title,startDate');

    fireEvent.click(screen.getByText('valider-evenement'));
    expect(createEvent).toHaveBeenCalledTimes(1);
    (createEvent.mock.calls[0][1] as { onSuccess: () => void }).onSuccess();
    expect(toast.success).toHaveBeenCalledWith('actions.scheduled');
    expect(screen.queryByRole('dialog', { name: 'event-modal' })).toBeNull();
  });

  it('fermer la modale d’évènement ne crée rien', () => {
    render(<HabitActionsMenu habit={habit} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /actionsMenu\.scheduleInAgenda/ }));
    fireEvent.click(screen.getByText('fermer-evenement'));
    expect(createEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'event-modal' })).toBeNull();
  });

  it('met l’habitude en pause sans date de reprise, en précisant que la série est gardée', () => {
    render(<HabitActionsMenu habit={habit} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /actions\.pauseHabit/ }));
    expect(pauseUntil).toHaveBeenCalledTimes(1);
    const [id, until] = pauseUntil.mock.calls[0] as [string, Date];
    expect(id).toBe('h1');
    expect(until.getUTCFullYear()).toBe(9999);
    expect(toast.success).toHaveBeenCalledWith(
      'actions.paused',
      expect.objectContaining({ description: 'actions.pauseKeepsStreak' }),
    );
  });

  it('une habitude en pause propose « reprendre » et la relance', () => {
    paused = true;
    render(<HabitActionsMenu habit={habit} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /actions\.resumeHabit/ }));
    expect(resume).toHaveBeenCalledWith('h1');
    expect(pauseUntil).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('actions.resumed');
  });

  it('modifier et supprimer n’existent que sur demande, et déclenchent leurs rappels', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { unmount } = render(<HabitActionsMenu habit={habit} onEdit={onEdit} onDelete={onDelete} />);
    openMenu();
    expect(screen.queryByRole('menuitem', { name: 'actions.edit' })).toBeNull();
    unmount();

    render(<HabitActionsMenu habit={habit} withEditDelete onEdit={onEdit} onDelete={onDelete} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'actions.edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'actions.delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
