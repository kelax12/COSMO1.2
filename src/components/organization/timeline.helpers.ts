// ═══════════════════════════════════════════════════════════════════
// Vue chronologique de l'onglet Projets
//
// Depuis la mig. 153 (M2), une tâche porte une date de DÉBUT (`startDate`) et
// un projet ses dates de début et de fin : la frise trace alors de vraies
// barres. Elle ne les INVENTE toujours pas : une tâche sans début reste un
// point à son échéance, un projet sans dates n'a pas de bandeau. C'était la
// règle de départ (« dessiner des barres reviendrait à inventer les dates de
// début ») et elle tient : on ne dessine que la donnée qu'on a.
// ═══════════════════════════════════════════════════════════════════

import {
  parseISO, isValid, startOfWeek, addWeeks, subWeeks, differenceInCalendarDays,
  format, startOfMonth, endOfMonth, addMonths,
} from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { TeamTask, TeamProject, TeamProjectMilestone } from '@/modules/team-projects';

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

/** Une tâche datée, positionnée dans la fenêtre. */
export interface TimelineMarker {
  task: TeamTask;
  /** Position de l'échéance en % depuis le début de la fenêtre (0..100). */
  offsetPercent: number;
  /**
   * Position du DÉBUT (mig. 153), si la tâche en a un : la tâche est alors une
   * barre de `startOffsetPercent` à `offsetPercent`. `null` = un point.
   */
  startOffsetPercent: number | null;
  overdue: boolean;
}

/** Bandeau d'un projet daté (mig. 153), de son début à sa fin. */
export interface TimelineSpan {
  startPercent: number;
  endPercent: number;
}

/** Jalon de projet (mig. 153) placé sur la ligne du projet. */
export interface TimelineMilestoneMark {
  milestone: TeamProjectMilestone;
  offsetPercent: number;
}

/** Une ligne = un projet, ses tâches datées et ses tâches sans date. */
export interface TimelineRow {
  project: TeamProject;
  markers: TimelineMarker[];
  /** Tâches ouvertes du projet sans échéance — jamais des jalons fantômes. */
  unscheduled: TeamTask[];
  span: TimelineSpan | null;
  milestones: TimelineMilestoneMark[];
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
export function timelineRange(
  tasks: TeamTask[],
  now: Date = new Date(),
  /** Dates de projets et de jalons (mig. 153), pour que « Tout » les couvre. */
  extraDates: (string | null | undefined)[] = [],
): TimelineRange {
  const dates = [
    ...tasks.filter((t) => !t.completed).flatMap((t) => [t.deadline, t.startDate]),
    ...extraDates,
  ]
    .map((d) => parse(d))
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

/**
 * true si la tâche n'a pas de date, ou si elle CROISE la fenêtre : une barre
 * commencée avant la fenêtre et finie après reste visible, rognée aux bords.
 */
export function inWindowOrUnscheduled(task: TeamTask, range: TimelineRange): boolean {
  const d = parse(task.deadline);
  if (!d) return true;
  const start = parse(task.startDate) ?? d;
  return start <= range.end && d >= range.start;
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

/** Marqueur d'une tâche datée : un point, ou une barre si elle a un début. */
function markerOf(task: TeamTask, deadline: Date, range: TimelineRange, todayStart: Date): TimelineMarker {
  const start = parse(task.startDate);
  return {
    task,
    offsetPercent: markerOffset(deadline, range),
    startOffsetPercent: start && start <= deadline ? markerOffset(start, range) : null,
    overdue: deadline < todayStart,
  };
}

/** Bandeau d'un projet : seulement s'il a DEUX dates et qu'il croise la fenêtre. */
export function projectSpan(project: TeamProject, range: TimelineRange): TimelineSpan | null {
  const start = parse(project.startDate);
  const end = parse(project.dueDate);
  if (!start || !end || end < range.start || start > range.end) return null;
  return { startPercent: markerOffset(start, range), endPercent: markerOffset(end, range) };
}

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
  milestones: TeamProjectMilestone[] = [],
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
        markers.push(markerOf(task, d, range, todayStart));
      }
      markers.sort((a, b) => a.offsetPercent - b.offsetPercent);
      const marks = milestones
        .filter((m) => m.projectId === project.id)
        .map((m) => ({ m, d: parse(m.dueDate) }))
        .filter((x): x is { m: TeamProjectMilestone; d: Date } => !!x.d && x.d >= range.start && x.d <= range.end)
        .map(({ m, d }) => ({ milestone: m, offsetPercent: markerOffset(d, range) }));
      return { project, markers, unscheduled, span: projectSpan(project, range), milestones: marks };
    })
    // Un projet daté ou jalonné garde sa ligne même sans tâche ouverte : c'est
    // un engagement du portefeuille, pas une ligne vide.
    .filter((row) => row.markers.length > 0 || row.unscheduled.length > 0 || row.span !== null || row.milestones.length > 0);
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
      row.markers.push(markerOf(task, d, range, todayStart));
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
