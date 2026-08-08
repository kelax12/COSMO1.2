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
// projet. Le jour où `TeamTask` gagne une date de début, cette même structure
// accueille de vraies barres sans rien changer d'autre.
// ═══════════════════════════════════════════════════════════════════

import { parseISO, isValid, startOfWeek, addWeeks, differenceInCalendarDays, format } from 'date-fns';
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

/** Un jalon = une tâche datée, positionnée dans la fenêtre. */
export interface TimelineMarker {
  task: TeamTask;
  /** Position en % depuis le début de la fenêtre (0..100). */
  offsetPercent: number;
  overdue: boolean;
}

/** Une ligne = un projet et ses jalons. */
export interface TimelineRow {
  project: TeamProject;
  markers: TimelineMarker[];
}

const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

const MIN_WEEKS = 4;

/**
 * Fenêtre couvrant toutes les échéances ouvertes, alignée sur des semaines
 * pleines (lundi), avec un plancher de 4 semaines pour qu'une seule échéance
 * ne produise pas une timeline d'un jour illisible.
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
 * Construit les lignes de la timeline : un projet actif par ligne, ses tâches
 * ouvertes et datées en jalons. Les projets sans aucune échéance sont écartés —
 * une ligne vide n'apprend rien et coûte un écran.
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
      for (const task of tasks) {
        if (task.projectId !== project.id || task.completed) continue;
        const d = parse(task.deadline);
        if (!d) continue;
        markers.push({
          task,
          offsetPercent: Math.max(
            0,
            Math.min(100, (differenceInCalendarDays(d, range.start) / range.days) * 100),
          ),
          overdue: d < todayStart,
        });
      }
      markers.sort((a, b) => a.offsetPercent - b.offsetPercent);
      return { project, markers };
    })
    .filter((row) => row.markers.length > 0);
}

/** Position d'aujourd'hui dans la fenêtre, ou null s'il en sort. */
export function todayOffsetPercent(range: TimelineRange, now: Date = new Date()): number | null {
  const offset = (differenceInCalendarDays(now, range.start) / range.days) * 100;
  if (offset < 0 || offset > 100) return null;
  return offset;
}
