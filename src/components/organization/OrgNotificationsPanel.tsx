import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { Bell, UserPlus, AtSign, AlarmClock, MessageSquare, ArrowRightLeft, Unlock, TriangleAlert, Target, CalendarPlus, Archive, Network, Settings2 } from 'lucide-react';
import type { OrgMember, OrgNotification, OrgNotificationKind } from '@/modules/organizations';
import { buildOrgLink } from './deep-link.helpers';
import {
  availableFilters,
  filterNotifications,
  groupNotifications,
  notificationLabelKey,
  NOTIFICATION_FILTER_LABEL,
  type NotificationFilter,
} from './notifications.helpers';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface OrgNotificationsPanelProps {
  notifications: OrgNotification[];
  members: OrgMember[];
  onClose: () => void;
  onOpenSettings: () => void;
}

/** Icône et libellé par type — le trigger n'écrit que ceux-là. */
const KIND_META: Record<OrgNotificationKind, { Icon: typeof Bell; labelKey: KeyOf<'org'> }> = {
  task_assigned: { Icon: UserPlus, labelKey: 'notifications.kindAssigned' },
  mention: { Icon: AtSign, labelKey: 'notifications.kindMention' },
  task_overdue: { Icon: AlarmClock, labelKey: 'notifications.kindOverdue' },
  comment: { Icon: MessageSquare, labelKey: 'notifications.kindComment' },
  // Mig. 162 (audit 2026-09-23, M14).
  status_changed: { Icon: ArrowRightLeft, labelKey: 'notifications.kindStatusChanged' },
  unblocked: { Icon: Unlock, labelKey: 'notifications.kindUnblocked' },
  project_at_risk: { Icon: TriangleAlert, labelKey: 'notifications.kindProjectAtRisk' },
  kr_due: { Icon: Target, labelKey: 'notifications.kindKrDue' },
  event_scheduled: { Icon: CalendarPlus, labelKey: 'notifications.kindEventScheduled' },
  // Mig. 164 (audit 2026-09-24, étape 4).
  project_archived: { Icon: Archive, labelKey: 'notifications.kindProjectArchived' },
  role_changed: { Icon: Network, labelKey: 'notifications.kindRoleManagerChanged' },
};

/** Une notification mène-t-elle quelque part ? */
const hasTarget = (n: OrgNotification): boolean =>
  !!(n.taskId || n.projectId || n.krId || n.eventId) || n.kind === 'role_changed';

/**
 * Panneau de la cloche d'entreprise : filtres, sections de récence, liens.
 *
 * Sorti de `OrgNotificationsBell` le 2026-09-25 et chargé à la PREMIÈRE
 * ouverture : la cloche est montée à chaque visite de /entreprise, son panneau
 * ne s'ouvre que parfois. Les filtres et les nouveaux types (audit du
 * 2026-09-24) faisaient passer `OrganizationPage` au-dessus de son plafond.
 */
const OrgNotificationsPanel = ({ notifications, members, onClose, onOpenSettings }: OrgNotificationsPanelProps) => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const nameById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.displayName])),
    [members],
  );

  // Sections de récence, recalculées quand la liste ou le filtre change.
  const filters = useMemo(() => availableFilters(notifications), [notifications]);
  // Un filtre devenu vide (tout marqué, liste relue) retombe sur « Tout ».
  const activeFilter = filters.includes(filter) ? filter : 'all';
  const groups = useMemo(
    () => groupNotifications(filterNotifications(notifications, activeFilter)),
    [notifications, activeFilter],
  );

  const openNotification = (notification: OrgNotification) => {
    onClose();
    if (notification.taskId) navigate(buildOrgLink('projects', { task: notification.taskId }));
    else if (notification.projectId) navigate(buildOrgLink('projects', { project: notification.projectId }));
    else if (notification.krId) navigate(buildOrgLink('okr'));
    else if (notification.eventId) navigate('/agenda');
    else if (notification.kind === 'role_changed') navigate(buildOrgLink('pyramid'));
  };

  return (
        <div
          role="dialog"
          aria-label={t('notifications.title')}
          className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] max-h-[24rem] overflow-y-auto rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-2xl p-2"
        >
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <p className="text-caption font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
              {t('notifications.title')}
            </p>
            {/* Préférences (M14) : couper un type, le recevoir par e-mail. */}
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={t('notifications.settings')}
              title={t('notifications.settings')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <Settings2 size={15} aria-hidden="true" />
            </button>
          </div>
          {/* Filtre par type (M14) : seulement ceux qui ont quelque chose. */}
          {filters.length > 2 && (
            <div role="group" aria-label={t('notifications.filterLabel')} className="flex flex-wrap gap-1 px-2 pb-1">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={activeFilter === f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 rounded-lg text-caption font-semibold transition-colors ${
                    activeFilter === f
                      ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))]'
                      : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                  }`}
                >
                  {t(NOTIFICATION_FILTER_LABEL[f])}
                </button>
              ))}
            </div>
          )}
          {groups.map((group) => (
          <section key={group.period} aria-label={t(group.labelKey)}>
            {/* Un flux plat ne dit pas si « il y a 2 jours » est récent ou
                vieux pour cette organisation. Les sections donnent l'échelle. */}
            <p className="px-2 pt-2 pb-1 text-caption font-semibold text-[rgb(var(--color-text-muted))]">
              {t(group.labelKey)}
            </p>
            <ul className="space-y-1">
            {group.items.map((notification) => {
              // Un type inconnu (base plus récente que le client) ne fait pas
              // tomber la cloche : il prend l'apparence générique.
              const { Icon, labelKey } = KIND_META[notification.kind] ?? { Icon: Bell, labelKey: 'notifications.title' as const };
              // `task_overdue` vient de pg_cron : son `actorId` est TOUJOURS
              // null. Afficher un auteur serait un mensonge — c'est le temps
              // qui passe, personne ne l'a fait.
              const actor = notification.actorId ? nameById.get(notification.actorId) : null;
              const projectName = (notification.meta as { project_name?: string } | null | undefined)?.project_name;
              const label = notification.kind === 'project_archived' && projectName
                ? t('notifications.kindProjectArchivedNamed', { name: projectName })
                : t(notificationLabelKey(notification, labelKey));
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    disabled={!hasTarget(notification)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors ${
                      hasTarget(notification) ? 'hover:bg-[rgb(var(--color-hover))]' : 'cursor-default'
                    } ${notification.readAt === null ? 'bg-[rgb(var(--color-accent)/0.08)]' : ''}`}
                  >
                    <Icon size={15} className="mt-0.5 shrink-0 text-[rgb(var(--color-accent))]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label text-[rgb(var(--color-text-primary))]">
                        {actor ? t('notifications.byActor', { actor, label }) : label}
                      </span>
                      <span className="block text-caption text-[rgb(var(--color-text-muted))]">
                        {formatDistanceToNow(parseISO(notification.createdAt), {
                          addSuffix: true,
                          locale: getDateLocale(),
                        })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            </ul>
          </section>
          ))}
        </div>
  );
};

export default OrgNotificationsPanel;
