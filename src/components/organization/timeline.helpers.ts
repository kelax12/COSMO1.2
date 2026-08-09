// ═══════════════════════════════════════════════════════════════════
// Vue chronologique de l'onglet Projets
//
// ⚠️ Ce n'est PAS un Gantt, et c'est délibéré. Un Gantt suppose que chaque
// tâche a un DÉBUT et une FIN ; `TeamTask` ne porte qu'une `deadline`. Dessiner
// des barres reviendrait à inventer les dates de début — l'écran aurait l'air
// d'un plan de charge alors qu'il n'en aurait pas la donnée, et on prendrait
// des décisions dessus.
//
// On trace donc ce qu'on sait vraiment : QUAND les choses sont dues, par
// projet (ou par personne). Le jour où `TeamTask` gagne une date de début,
// cette même structure accueille de vraies barres sans rien changer d'autre.
// ═══════════════════════════════════════════════════════════════════

import {
  parseISO, isValid, startOfWeek, addWeeks, subWeeks, differenceInCalendarDays,
  format, startOfMonth, endOfMonth, addMonths,
} from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { TeamTask, TeamProject } from '@/modules/team-projects';

/** Fenêtre affichée par la vue chronologique. */
export interface TimelineRange {
  start: Date;
  end: Date;
  /** Nombre de jours couverts (≥ 1). */
  days: number;
}

/** Colonne d'en-tête (une par semaine). */
export interface TimelineWeek {
  start: Date;
  label: string;
  /** Position en % depuis le début de la fenêtre. */
  offsetPercent: number;
}

/** Bandeau mensuel de l'en-tête. */
export interface TimelineMonthBand {
  label: string;
  offsetPercent: number;
  widthPercent: number;
}

/** Un jalon = une tâche datée, positionnée dans la fenêtre. */
export interface TimelineMarker {
  task: TeamTask;
  /** Position en % depuis le début de la fenêtre (0..100). */
  offsetPercent: number;
  overdue: boolean;
}

/** Une ligne = un projet, ses jalons datés et ses tâches sans date. */
export interface TimelineRow {
  project: TeamProject;
  markers: TimelineMarker[];
  /** Tâches ouvertes du projet sans échéance — jamais des jalons fantômes. */
  unscheduled: TeamTask[];
}

/** Une ligne « par personne » — mêmes jalons, groupés par assigné plutôt que par projet. */
export interface AssigneeTimelineRow {
  /** userId de l'assigné, ou `UNASSIGNED_ID` pour les tâches sans personne. */
  assigneeId: string;
  markers: TimelineMarker[];
  unscheduled: TeamTask[];
}

/** Sentinelle de colonne/ligne « non assignée ». */
export const UNASSIGNED_ID = '__timeline_unassigned__';

const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

const MIN_WEEKS = 4;

/**
 * Fenêtre COMPLÈTE couvrant toutes les échéances ouvertes, alignée sur des
 * semaines pleines (lundi), avec un plancher de 4 semaines pour qu'une seule
 * échéance ne produise pas une timeline d'un jour illisible.
 *
 * C'est la fenêtre du zoom « Tout » — pour l'affichage par défaut, borné,
 * voir `timelineWindow`.
 *
 * `weekStartsOn: 1` est codé en dur volontairement, comme dans
 * `team-stats.helpers` : dériver le début de semaine de la locale ferait
 * démarrer les semaines le dimanche en anglais et décalerait les colonnes d'un
 * utilisateur à l'autre pour les mêmes données.
 */
export function timelineRange(tasks: TeamTask[], now: Date = new Date()): TimelineRange {
  const dates = tasks
    .filter((t) => !t.completed)
    .map((t) => parse(t.deadline))
    .filter((d): d is Date => d !== null);

  const start = startOfWeek(
    dates.reduce((min, d) => (d < min ? d : min), now),
    { weekStartsOn: 1 },
  );

  const lastDeadline = dates.reduce((max, d) => (d > max ? d : max), now);
  let end = addWeeks(start, MIN_WEEKS);
  while (end < lastDeadline) end = addWeeks(end, 1);

  return { start, end, days: Math.max(1, differenceInCalendarDays(end, start)) };
}

/** Niveau de zoom de la vue chronologique. `default` = fenêtre bornée initiale. */
export type TimelineZoom = 'default' | 'month' | 'quarter' | 'all';

const ZOOM_WEEKS: Record<Exclude<TimelineZoom, 'all'>, number> = {
  default: 8,
  month: 4,
  quarter: 13,
};

/** Semaine(s) de battement AVANT aujourd'hui, pour garder le contexte des
 *  échéances tout juste passées sans faire dériver toute la fenêtre. */
const LEAD_IN_WEEKS = 1;

/**
 * Fenêtre réellement affichée, compte tenu du zoom choisi.
 *
 * Les zooms bornés (`default` / `month` / `quarter`) démarrent PRÈS
 * d'aujourd'hui — pas à la plus ancienne échéance ouverte comme
 * `timelineRange` : une tâche en retard de huit mois ne doit plus repousser
 * tout le reste hors champ. `all` retombe sur `timelineRange`, seule fenêtre
 * capable de couvrir une échéance lointaine.
 */
export function timelineWindow(fullRange: TimelineRange, zoom: TimelineZoom, now: Date = new Date()): TimelineRange {
  if (zoom === 'all') return fullRange;
  const start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), LEAD_IN_WEEKS);
  const end = addWeeks(start, ZOOM_WEEKS[zoom]);
  return { start, end, days: Math.max(1, differenceInCalendarDays(end, start)) };
}

/** true si la tâche n'a pas de date, ou si sa date tombe dans la fenêtre. */
export function inWindowOrUnscheduled(task: TeamTask, range: TimelineRange): boolean {
  const d = parse(task.deadline);
  if (!d) return true;
  return d >= range.start && d <= range.end;
}

/** Colonnes hebdomadaires de l'en-tête. */
export function timelineWeeks(range: TimelineRange): TimelineWeek[] {
  const weeks: TimelineWeek[] = [];
  let cursor = range.start;
  // Borne dure : une plage aberrante ne doit pas boucler indéfiniment.
  for (let i = 0; i < 104 && cursor < range.end; i++) {
    weeks.push({
      start: cursor,
      label: format(cursor, 'd MMM', { locale: getDateLocale() }),
      offsetPercent: (differenceInCalendarDays(cursor, range.start) / range.days) * 100,
    });
    cursor = addWeeks(cursor, 1);
  }
  return weeks;
}

/**
 * Bandeau mensuel de l'en-tête — n'apparaît que si la fenêtre dépasse ~6
 * semaines : en dessous, les libellés de semaine suffisent, un bandeau
 * mensuel n'ajouterait que du bruit.
 */
export function timelineMonths(range: TimelineRange): TimelineMonthBand[] {
  if (range.days < 42) return [];
  const bands: TimelineMonthBand[] = [];
  let cursor = startOfMonth(range.start);
  // Borne dure, même logique que `timelineWeeks`.
  for (let i = 0; i < 60 && cursor < range.end; i++) {
    const segStart = cursor < range.start ? range.start : cursor;
    const segEndRaw = endOfMonth(cursor);
    const segEnd = segEndRaw > range.end ? range.end : segEndRaw;
    bands.push({
      label: format(cursor, 'MMMM yyyy', { locale: getDateLocale() }),
      offsetPercent: Math.max(0, (differenceInCalendarDays(segStart, range.start) / range.days) * 100),
      widthPercent: Math.max(0, ((differenceInCalendarDays(segEnd, segStart) + 1) / range.days) * 100),
    });
    cursor = addMonths(cursor, 1);
  }
  return bands;
}

const markerOffset = (d: Date, range: TimelineRange): number =>
  Math.max(0, Math.min(100, (differenceInCalendarDays(d, range.start) / range.days) * 100));

/**
 * Construit les lignes de la timeline : un projet actif par ligne, ses tâches
 * ouvertes en jalons (datées) ou en compteur « sans date ».
 *
 * Un projet dont TOUTES les tâches ouvertes sont sans date n'est plus écarté
 * — une vue « Planning » qui cache le travail non planifié cache exactement
 * ce qu'elle est censée faire remonter. Seul un projet sans AUCUNE tâche
 * ouverte disparaît : une ligne vide n'apprend rien et coûte un écran.
 */
export function timelineRows(
  tasks: TeamTask[],
  projects: TeamProject[],
  range: TimelineRange,
  now: Date = new Date(),
): TimelineRow[] {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return projects
    .filter((p) => !p.archivedAt)
    .map((project) => {
      const markers: TimelineMarker[] = [];
      const unscheduled: TeamTask[] = [];
      for (const task of tasks) {
        if (task.projectId !== project.id || task.completed) continue;
        const d = parse(task.deadline);
        if (!d) { unscheduled.push(task); continue; }
        markers.push({ task, offsetPercent: markerOffset(d, range), overdue: d < todayStart });
      }
      markers.sort((a, b) => a.offsetPercent - b.offsetPercent);
      return { project, markers, unscheduled };
    })
    .filter((row) => row.markers.length > 0 || row.unscheduled.length > 0);
}

/**
 * Même construction que `timelineRows`, groupée par assigné plutôt que par
 * projet — répond à « qui est chargé quand » plutôt qu'à « où en est ce
 * projet ». Une tâche multi-assignée apparaît sur la ligne de chacun de ses
 * assignés, comme dans le Tableau (mig. 091 / `TeamProjectsKanban`).
 */
export function timelineRowsByAssignee(
  tasks: TeamTask[],
  activeProjectIds: Set<string>,
  range: TimelineRange,
  now: Date = new Date(),
): AssigneeTimelineRow[] {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = new Map<string, AssigneeTimelineRow>();
  const ensure = (id: string): AssigneeTimelineRow => {
    let row = rows.get(id);
    if (!row) { row = { assigneeId: id, markers: [], unscheduled: [] }; rows.set(id, row); }
    return row;
  };

  for (const task of tasks) {
    if (task.completed || !activeProjectIds.has(task.projectId)) continue;
    const ids = task.assigneeIds.length > 0 ? task.assigneeIds : [UNASSIGNED_ID];
    const d = parse(task.deadline);
    for (const id of ids) {
      const row = ensure(id);
      if (!d) { row.unscheduled.push(task); continue; }
      row.markers.push({ task, offsetPercent: markerOffset(d, range), overdue: d < todayStart });
    }
  }

  for (const row of rows.values()) row.markers.sort((a, b) => a.offsetPercent - b.offsetPercent);
  return [...rows.values()];
}

/** Position d'aujourd'hui dans la fenêtre, ou null s'il en sort. */
export function todayOffsetPercent(range: TimelineRange, now: Date = new Date()): number | null {
  const offset = (differenceInCalendarDays(now, range.start) / range.days) * 100;
  if (offset < 0 || offset > 100) return null;
  return offset;
}
