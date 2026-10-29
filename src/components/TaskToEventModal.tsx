// ═══════════════════════════════════════════════════════════════════
// Planifier une tâche dans l'agenda (2026-10-29).
//
// Remplace la popup « Planifier » (`ScheduleEventModal`) : un seul écran de
// création d'événement dans tout le produit, `EventModal`, ouvert ici
// prérempli depuis la tâche (titre, catégorie, durée, créneau par défaut sur
// son échéance).
//
// ⚠️ Tâche d'ÉQUIPE (`linkTask = false`) : `events.task_id` référence une tâche
// PERSO, l'événement n'est donc pas lié. Sa catégorie n'est pas une catégorie
// perso : on la propose seule, avec sa couleur, via `categoriesOverride`.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import EventModal from '@/components/EventModal';
import { useCreateEvent } from '@/modules/events';
import { defaultSlot, localInputToIso, type SchedulableTask } from '@/lib/schedule-slot';

interface TaskToEventModalProps {
  task: SchedulableTask;
  onClose: () => void;
  linkTask?: boolean;
  /** Catégorie d'équipe : nom et couleur à proposer à la place des catégories perso. */
  teamCategory?: { name: string; color: string };
}

const TaskToEventModal: React.FC<TaskToEventModalProps> = ({ task, onClose, linkTask = true, teamCategory }) => {
  const createEvent = useCreateEvent();
  const slot = useMemo(() => {
    const { start, end } = defaultSlot(task);
    return { start: localInputToIso(start), end: localInputToIso(end) };
  }, [task]);

  return (
    <EventModal
      isOpen
      mode="add"
      task={task}
      prefilledTimeSlot={slot}
      onClose={onClose}
      categoriesOverride={teamCategory
        ? [{ id: task.category, name: teamCategory.name, color: teamCategory.color, parentId: null }]
        : undefined}
      onAddEvent={(data) => createEvent.mutate({ ...data, taskId: linkTask ? task.id : undefined, isPrivate: true })}
    />
  );
};

export default TaskToEventModal;
