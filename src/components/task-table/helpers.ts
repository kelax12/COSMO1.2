// ═══════════════════════════════════════════════════════════════════
// task-table/helpers — formatters purs partagés par list.tsx, TaskCard.tsx
// et TaskRow (desktop). Aucune logique métier (filtrage/tri = task-filtering.ts).
// ═══════════════════════════════════════════════════════════════════
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatDate = (dateString: string | undefined) => {
  try {
    if (!dateString) return '—';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return '—';
  }
};

// Échéance « intelligente » : Aujourd'hui / Demain / « 4 juin ».
export const formatDeadlineSmart = (dateString: string | undefined): string => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
};

// Durée « x h xx min » / « 45 min » / « 2 h ».
export const formatDuration = (minutes: number | undefined): string => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
};

// En retard : échéance passée et tâche non complétée.
export const isTaskOverdue = (deadline: string | undefined, completed: boolean): boolean => {
  if (completed || !deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d < new Date();
};
