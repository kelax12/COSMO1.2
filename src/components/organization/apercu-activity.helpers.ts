import type { TeamTaskActivity } from '@/modules/team-projects';
import { buildActivityItems, type ActivityItem, type ActivityKind } from './my-work.helpers';

/**
 * Widget « Activité de l'équipe » refait le 2026-10-20 : un chiffre et le
 * fait marquant (petit), la répartition par type (moyen), le fil groupé par
 * personne (grand). Tout se lit dans le JOURNAL des tâches.
 *
 * ⚠️ Le journal ne contient pas les commentaires : ils ne sont donc pas
 * comptés ici, et le widget ne prétend pas le contraire.
 */

export const DAY_MS = 24 * 3600 * 1000;

/** Les entrées du journal des dernières 24 h, les plus récentes d'abord. */
export const recentItems = (activity: readonly TeamTaskActivity[], now: Date = new Date()): ActivityItem[] =>
  buildActivityItems([...activity], Number.MAX_SAFE_INTEGER).filter((i) => now.getTime() - new Date(i.date).getTime() <= DAY_MS);

/** Une entrée qui me concerne : quelqu'un d'autre a touché une de mes tâches. */
export const isAboutMe = (item: ActivityItem, myTaskIds: ReadonlySet<string>, me: string): boolean =>
  item.actorId !== me && myTaskIds.has(item.taskId);

/** Ce qui me concerne d'abord, puis le reste ; chaque groupe du plus récent au plus ancien. */
export const highlights = (items: readonly ActivityItem[], myTaskIds: ReadonlySet<string>, me: string): ActivityItem[] => [
  ...items.filter((i) => isAboutMe(i, myTaskIds, me)),
  ...items.filter((i) => !isAboutMe(i, myTaskIds, me)),
];

export type CountedKind = 'completed' | 'created' | 'assigned' | 'postponed';
export const COUNTED_KINDS: readonly CountedKind[] = ['completed', 'created', 'assigned', 'postponed'];

export const kindCounts = (items: readonly ActivityItem[]): Record<CountedKind, number> => {
  const out: Record<CountedKind, number> = { completed: 0, created: 0, assigned: 0, postponed: 0 };
  for (const i of items) if ((COUNTED_KINDS as readonly ActivityKind[]).includes(i.kind)) out[i.kind as CountedKind] += 1;
  return out;
};

export interface ActorGroup {
  actorId: string | null;
  items: ActivityItem[];
  /** Au moins une de ses actions porte sur une de mes tâches. */
  onMine: boolean;
}

export type ActivityFilter = 'all' | 'mine' | 'completed';

/** Le fil groupé par personne, la plus récemment active en tête. */
export function groupByActor(
  items: readonly ActivityItem[],
  myTaskIds: ReadonlySet<string>,
  me: string,
  filter: ActivityFilter = 'all',
): ActorGroup[] {
  const kept = items.filter((i) => (
    filter === 'mine' ? isAboutMe(i, myTaskIds, me) : filter === 'completed' ? i.kind === 'completed' : true
  ));
  const groups = new Map<string, ActorGroup>();
  for (const item of kept) {
    const key = item.actorId ?? '';
    const g = groups.get(key) ?? { actorId: item.actorId, items: [], onMine: false };
    g.items.push(item);
    g.onMine ||= isAboutMe(item, myTaskIds, me);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => (a.date > b.date ? -1 : 1)) }))
    .sort((a, b) => (a.items[0].date > b.items[0].date ? -1 : 1));
}
