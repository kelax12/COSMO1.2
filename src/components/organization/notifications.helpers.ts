// ═══════════════════════════════════════════════════════════════════
// Regroupement du flux de notifications d'entreprise.
//
// La cloche affichait une liste chronologique plate : à cinq entrées elle
// reste lisible, à trente elle ne dit plus rien. Les notifications se lisent
// en fait par récence — « qu'est-ce qui a bougé depuis hier ? » — pas comme un
// journal continu. Ce module ne fait que la découpe ; le rendu reste au
// composant, et le calcul est ici pour être testé sans DOM.
// ═══════════════════════════════════════════════════════════════════

import type { OrgNotification, OrgNotificationKind } from '@/modules/organizations';
import type { KeyOf } from '@/i18n/catalog';

export type NotificationPeriod = 'today' | 'week' | 'earlier';

export interface NotificationGroup {
  period: NotificationPeriod;
  /** Clé de catalogue du titre de section. */
  labelKey: KeyOf<'org'>;
  items: OrgNotification[];
}

const PERIOD_LABEL: Record<NotificationPeriod, KeyOf<'org'>> = {
  today: 'notifications.periodToday',
  week: 'notifications.periodWeek',
  earlier: 'notifications.periodEarlier',
};

/** Ordre d'affichage — du plus récent au plus ancien, jamais recalculé. */
const PERIOD_ORDER: NotificationPeriod[] = ['today', 'week', 'earlier'];

/**
 * Période d'une notification, relative à `now`.
 *
 * La frontière « aujourd'hui » est le minuit LOCAL, pas « il y a moins de
 * 24 h » : une notification d'hier 23 h ne doit pas apparaître sous
 * « Aujourd'hui » simplement parce qu'on la lit à 8 h du matin.
 *
 * Une date illisible retombe dans `earlier` plutôt que de disparaître : perdre
 * silencieusement une notification est pire que la classer trop bas.
 */
export const periodOf = (createdAt: string, now: Date): NotificationPeriod => {
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return 'earlier';

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return 'today';

  // 7 jours glissants à partir de minuit — pas la semaine calendaire, qui
  // ferait basculer tout le flux dans « Plus tôt » chaque lundi matin.
  const weekAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  return ts >= weekAgo ? 'week' : 'earlier';
};

/**
 * Découpe le flux en sections non vides, dans l'ordre de récence.
 *
 * L'ordre des notifications à l'intérieur d'une section est celui reçu (la
 * requête trie déjà par date décroissante) : re-trier ici masquerait un
 * éventuel défaut de tri côté serveur au lieu de le rendre visible.
 */
export const groupNotifications = (
  notifications: OrgNotification[],
  now: Date = new Date(),
): NotificationGroup[] => {
  const buckets = new Map<NotificationPeriod, OrgNotification[]>();
  for (const n of notifications) {
    const period = periodOf(n.createdAt, now);
    const arr = buckets.get(period);
    if (arr) arr.push(n);
    else buckets.set(period, [n]);
  }

  return PERIOD_ORDER.flatMap((period) => {
    const items = buckets.get(period);
    return items && items.length > 0
      ? [{ period, labelKey: PERIOD_LABEL[period], items }]
      : [];
  });
};

// ─── Filtre par type (audit du 2026-09-24, M14) ──────────────────────
//
// Douze types dans un seul flux : on ne retrouvait plus « qui m'a mentionné ».
// Les filtres regroupent les types par QUESTION qu'on se pose, pas un bouton
// par type technique.

export type NotificationFilter = 'all' | 'work' | 'mentions' | 'deadlines' | 'projects' | 'org';

const FILTER_KINDS: Record<Exclude<NotificationFilter, 'all'>, readonly OrgNotificationKind[]> = {
  work: ['task_assigned', 'status_changed', 'unblocked'],
  mentions: ['mention', 'comment'],
  deadlines: ['task_overdue', 'kr_due', 'event_scheduled'],
  projects: ['project_at_risk', 'project_archived'],
  org: ['role_changed'],
};

export const NOTIFICATION_FILTERS: readonly NotificationFilter[] = ['all', 'work', 'mentions', 'deadlines', 'projects', 'org'];

export const NOTIFICATION_FILTER_LABEL: Record<NotificationFilter, KeyOf<'org'>> = {
  all: 'notifications.filterAll',
  work: 'notifications.filterWork',
  mentions: 'notifications.filterMentions',
  deadlines: 'notifications.filterDeadlines',
  projects: 'notifications.filterProjects',
  org: 'notifications.filterOrg',
};

/** Un type inconnu (base plus récente que le client) reste visible sous « Tout ». */
export const filterNotifications = (
  notifications: OrgNotification[],
  filter: NotificationFilter,
): OrgNotification[] =>
  filter === 'all' ? notifications : notifications.filter((n) => FILTER_KINDS[filter].includes(n.kind));

/** Les filtres qui ont au moins une notification : un filtre vide est un clic pour rien. */
export const availableFilters = (notifications: OrgNotification[]): NotificationFilter[] =>
  NOTIFICATION_FILTERS.filter((f) => f === 'all' || filterNotifications(notifications, f).length > 0);

/**
 * Libellé d'une notification. `role_changed` (mig. 164) en porte trois, selon
 * `meta.change` : sans cette distinction, « votre position a changé » ne dit
 * pas si l'on gagne ou perd la vue sur une équipe.
 */
export const notificationLabelKey = (n: OrgNotification, fallback: KeyOf<'org'>): KeyOf<'org'> => {
  if (n.kind !== 'role_changed') return fallback;
  const change = (n.meta as { change?: string } | null | undefined)?.change;
  if (change === 'now_manager') return 'notifications.kindRoleNowManager';
  if (change === 'no_longer_manager') return 'notifications.kindRoleNoLongerManager';
  return 'notifications.kindRoleManagerChanged';
};

// ─── Pastilles de section (audit du 2026-09-24) ──────────────────────
//
// Seuls Projets et Membres portaient un compteur. Les autres sections se
// déduisent des notifications NON LUES déjà lues par la boîte de réception :
// aucune requête de plus. `task_assigned` n'y figure PAS : il nourrit déjà la
// pastille Projets (`useOrgBadges`), le compter ici le montrerait deux fois.

export type BadgeSection = 'tasks' | 'projects' | 'okr' | 'pyramid';

const SECTION_KINDS: Record<BadgeSection, readonly OrgNotificationKind[]> = {
  tasks: ['mention', 'comment', 'status_changed', 'unblocked', 'task_overdue'],
  projects: ['project_at_risk', 'project_archived'],
  okr: ['kr_due'],
  pyramid: ['role_changed'],
};

export interface SectionBadge {
  count: number;
  /** Types présents, pour nommer l'aperçu sans relire la liste. */
  kinds: OrgNotificationKind[];
}

export const sectionNotificationBadges = (
  notifications: OrgNotification[],
): Record<BadgeSection, SectionBadge> => {
  const out = {} as Record<BadgeSection, SectionBadge>;
  for (const section of Object.keys(SECTION_KINDS) as BadgeSection[]) {
    const unread = notifications.filter((n) => n.readAt === null && SECTION_KINDS[section].includes(n.kind));
    out[section] = { count: unread.length, kinds: [...new Set(unread.map((n) => n.kind))] };
  }
  return out;
};
