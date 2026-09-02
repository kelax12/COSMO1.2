// ═══════════════════════════════════════════════════════════════════
// task-table/helpers — formatters purs partagés par list.tsx, TaskCard.tsx
// et TaskRow (desktop). Aucune logique métier (filtrage/tri = task-filtering.ts).
// ═══════════════════════════════════════════════════════════════════
import { format } from 'date-fns';
// Alias : ce module exporte déjà son propre `formatDate` (helper métier qui
// accepte une chaîne et gère l'absence de date).
import { formatDate as formatDateIntl, getDateLocale } from '@/i18n/format';
import { daysUntilDeadline, deadlineDayKey, isOverdue } from '@/lib/deadline';

/** Clé de jour → Date locale, pour formater le jour VÉCU et pas l'instant. */
const dayKeyToLocalDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (dateString: string | undefined) => {
  try {
    if (!dateString) return '—';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: getDateLocale() });
  } catch {
    return '—';
  }
};

// Échéance « intelligente » (#28) : relative sous ±7 jours (« Aujourd'hui »,
// « Demain », « mer. », « il y a 2 j »), absolue au-delà. « dans 3 j » demande
// zéro calcul mental là où « 12 juil. » en demande un — sur chaque ligne.
export const formatDeadlineSmart = (dateString: string | undefined): string => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  // L'écart se compte en JOURS vécus dans le fuseau retenu, pas entre deux
  // minuits calculés en heure machine : « Aujourd'hui » s'affichait « Hier »
  // pour tout décalage négatif (risque R-01).
  const diffDays = daysUntilDeadline(dateString);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays === -1) return 'Hier';
  if (diffDays < 0 && diffDays > -7) return `il y a ${-diffDays} j`;
  // 2–6 jours : jour de la semaine, sans ambiguïté dans cette fenêtre.
  if (diffDays > 1 && diffDays < 7) {
    return format(dayKeyToLocalDate(deadlineDayKey(dateString)), 'EEEE', { locale: getDateLocale() });
  }
  return formatDateIntl(d, { day: 'numeric', month: 'long' });
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

// En retard = échéance d'un JOUR RÉVOLU. L'ancienne comparaison d'instants
// (`new Date(deadline) < new Date()`) faisait basculer une tâche due
// aujourd'hui en rouge dès 00 h 01, puisque son minuit était déjà passé.
export const isTaskOverdue = (deadline: string | undefined, completed: boolean): boolean =>
  isOverdue(deadline, completed);
