// Helpers purs partagés par les composants du mode « test » (refonte shadcn
// de la section To-Do). Aucune logique métier : uniquement présentation/format.
import type { Task } from '@/modules/tasks';

/** Options de priorité — alignées sur src/components/task-modal/constants.ts. */
export const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 — Très haute', short: 'P1' },
  { value: 2, label: 'P2 — Haute', short: 'P2' },
  { value: 3, label: 'P3 — Moyenne', short: 'P3' },
  { value: 4, label: 'P4 — Basse', short: 'P4' },
  { value: 5, label: 'P5 — Très basse', short: 'P5' },
] as const;

/** Couleur (classes Tailwind) d'un badge de priorité. */
export function priorityBadgeClass(p: number): string {
  switch (p) {
    case 1:
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 2:
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 3:
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 4:
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/** Tri options pour le Select. */
export const SORT_OPTIONS = [
  { value: 'deadline', label: 'Échéance' },
  { value: 'priority', label: 'Priorité' },
  { value: 'name', label: 'Nom' },
  { value: 'createdAt', label: 'Création' },
  { value: 'estimatedTime', label: 'Durée estimée' },
] as const;

/** Une tâche est-elle en retard ? */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.completed || !task.deadline) return false;
  return new Date(task.deadline) < now;
}

/** Format court d'échéance : « 14 juin » ou « Aujourd'hui ». */
export function formatDeadline(deadline: string): string {
  if (!deadline) return '—';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Aujourd'hui";
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Minutes → « 1 h 30 » / « 45 min ». */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

/** Convertit un ISO en valeur pour <input type="datetime-local"> (locale). */
export function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valeur d'un <input datetime-local> → ISO string. */
export function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Aujourd'hui à 23:59:59 en ISO (défaut d'échéance création). */
export function todayEodIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}
