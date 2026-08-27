// Prochains événements d'entreprise — extraction + placement sur la frise.
//
// La donnée est la même qu'avant le passage au rendu visuel : échéances des
// tâches d'équipe ouvertes (tous assignés confondus) et dates de fin d'OKR.
// Aucun modèle d'événement partagé n'est nécessaire.
import { parseISO } from 'date-fns';
import type { TeamTask } from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';

export type OrgEventKind = 'task' | 'okr';

/** Distance à aujourd'hui, la seule chose qui pilote la couleur d'une pastille. */
export type OrgEventUrgency = 'now' | 'soon' | 'later';

export interface OrgEvent {
  id: string;
  date: Date;
  name: string;
  kind: OrgEventKind;
  projectName?: string;
  /** Jours entiers restants, 0 = aujourd'hui. */
  daysLeft: number;
  urgency: OrgEventUrgency;
}

/** Un événement placé sur la frise : abscisse en %, et rangée haute ou basse. */
export interface PlacedOrgEvent extends OrgEvent {
  percent: number;
  row: 'top' | 'bottom';
}

const DAY_MS = 86_400_000;

/** Minuit LOCAL — les échéances sont saisies en date locale, cf. CLAUDE.md. */
const startOfLocalDay = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const urgencyOf = (daysLeft: number): OrgEventUrgency => {
  if (daysLeft <= 2) return 'now';
  if (daysLeft <= 7) return 'soon';
  return 'later';
};

/**
 * Événements à venir, triés par date, bornés à `max`.
 *
 * `now` est injectable : sans ça le test dépendrait du jour où il tourne.
 */
export const buildOrgEvents = (
  tasks: TeamTask[],
  okrs: TeamOKR[],
  activeProjectIds: Set<string>,
  projectNameById: Map<string, string>,
  now: Date = new Date(),
  max = 6,
): OrgEvent[] => {
  const today = startOfLocalDay(now);
  const items: OrgEvent[] = [];
  const push = (id: string, iso: string, name: string, kind: OrgEventKind, projectName?: string) => {
    const date = startOfLocalDay(parseISO(iso));
    if (Number.isNaN(date.getTime()) || date < today) return;
    const daysLeft = Math.round((date.getTime() - today.getTime()) / DAY_MS);
    items.push({ id, date, name, kind, projectName, daysLeft, urgency: urgencyOf(daysLeft) });
  };

  for (const task of tasks) {
    if (task.completed || !task.deadline || !activeProjectIds.has(task.projectId)) continue;
    push(`task-${task.id}`, task.deadline, task.name, 'task', projectNameById.get(task.projectId));
  }
  for (const okr of okrs) {
    if (!okr.endDate) continue;
    push(`okr-${okr.id}`, okr.endDate, okr.title, 'okr');
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, max);
};

/** Écart minimal entre deux pastilles, en % de la frise. */
const MIN_GAP = 9;

/**
 * Place les événements sur l'axe horizontal.
 *
 * L'abscisse est PROPORTIONNELLE au temps : c'est tout l'intérêt de la frise
 * face à la liste qu'elle remplace. Deux corrections seulement :
 * un écart minimal pour que deux échéances du même jour restent lisibles,
 * puis une renormalisation pour que cet écart ne déborde jamais du cadre.
 */
export const placeOrgEvents = (events: OrgEvent[]): PlacedOrgEvent[] => {
  if (events.length === 0) return [];
  if (events.length === 1) return [{ ...events[0], percent: 50, row: 'bottom' }];

  const span = events[events.length - 1].daysLeft - events[0].daysLeft;
  const raw = events.map((e) =>
    span > 0 ? ((e.daysLeft - events[0].daysLeft) / span) * 100 : 0,
  );

  const spread: number[] = [];
  raw.forEach((p, i) => {
    spread.push(i === 0 ? p : Math.max(p, spread[i - 1] + MIN_GAP));
  });

  const width = spread[spread.length - 1] - spread[0];
  const scale = width > 100 ? 100 / width : 1;
  // Cas dégénéré : toutes les échéances le même jour. L'abscisse ne porte plus
  // aucune information, autant centrer le paquet plutôt que le coller à gauche.
  const offset = (100 - width * scale) / 2;

  return events.map((e, i) => ({
    ...e,
    percent: Math.round(((spread[i] - spread[0]) * scale + offset) * 10) / 10,
    row: i % 2 === 0 ? 'bottom' : 'top',
  }));
};
