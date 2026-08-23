// ═══════════════════════════════════════════════════════════════════
// Regroupement du flux de notifications d'entreprise.
//
// La cloche affichait une liste chronologique plate : à cinq entrées elle
// reste lisible, à trente elle ne dit plus rien. Les notifications se lisent
// en fait par récence — « qu'est-ce qui a bougé depuis hier ? » — pas comme un
// journal continu. Ce module ne fait que la découpe ; le rendu reste au
// composant, et le calcul est ici pour être testé sans DOM.
// ═══════════════════════════════════════════════════════════════════

import type { OrgNotification } from '@/modules/organizations';
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
