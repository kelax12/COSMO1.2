// Créneau par défaut quand on planifie une tâche dans l'agenda, et conversions
// entre ISO et valeur de champ local. Sortis de l'ancienne popup « Planifier »
// (`ScheduleEventModal`, supprimée le 2026-10-29 au profit d'EventModal).
import type { Task } from '@/modules/tasks';

/** Ce que la planification lit d'une tâche (une tâche d'équipe s'y ramène). */
export type SchedulableTask = Pick<Task, 'id' | 'name' | 'category' | 'deadline' | 'estimatedTime'>;

/** ISO → valeur <input type="datetime-local"> (locale). */
export function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valeur <input datetime-local> → ISO string. */
export function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Échéance de la tâche (ou aujourd'hui) à 12:00, + fin selon durée estimée. */
export function defaultSlot(task: SchedulableTask | null): { start: string; end: string } {
  const base = task?.deadline ? new Date(task.deadline) : new Date();
  if (Number.isNaN(base.getTime())) base.setTime(Date.now());
  base.setHours(12, 0, 0, 0);
  const end = new Date(base);
  end.setMinutes(end.getMinutes() + (task?.estimatedTime || 60));
  return { start: isoToLocalInput(base.toISOString()), end: isoToLocalInput(end.toISOString()) };
}
