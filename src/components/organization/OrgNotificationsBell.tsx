import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { Bell, UserPlus, AtSign, AlarmClock, MessageSquare, ArrowRightLeft, Unlock, TriangleAlert, Target, CalendarPlus, Archive, Network, Settings2 } from 'lucide-react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import {
  useOrgNotifications,
  useMarkNotificationsRead,
  unreadCount,
  type OrgNotification,
  type OrgNotificationKind,
  type OrgMember,
} from '@/modules/organizations';
import { buildOrgLink } from './deep-link.helpers';
import {
  availableFilters,
  filterNotifications,
  groupNotifications,
  notificationLabelKey,
  NOTIFICATION_FILTER_LABEL,
  type NotificationFilter,
} from './notifications.helpers';

// Chargée à l'ouverture seulement : la cloche est montée sur chaque visite.
const OrgNotificationSettingsDialog = lazyWithRetry(() => import('./OrgNotificationSettingsDialog'));
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface OrgNotificationsBellProps {
  orgId: string;
  members: OrgMember[];
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
 * Cloche de notifications d'entreprise (mig. 095 + 096).
 *
 * ⚠️ Corrige un trou livré : les triggers de la mig. 095 et le job `pg_cron`
 * de la mig. 096 écrivaient dans `org_notifications` depuis leur application
 * en production, mais AUCUN composant ne lisait `useOrgNotifications` — les
 * notifications s'accumulaient sans que personne puisse jamais les voir.
 * Constaté en ouvrant l'espace entreprise dans un navigateur, pas en relisant
 * le code.
 *
 * En mode démo le hook renvoie volontairement une liste vide (une notification
 * factice inviterait à cliquer sur un événement qui n'a pas eu lieu) : la
 * cloche est donc masquée plutôt qu'affichée à zéro.
 */
const OrgNotificationsBell = ({ orgId, members }: OrgNotificationsBellProps) => {
  const { t, tp } = useT('org');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useOrgNotifications(orgId);
  const markRead = useMarkNotificationsRead(orgId);
  const unread = unreadCount(notifications);

  const nameById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.displayName])),
    [members],
  );

  // Sections de récence. Recalculées à chaque changement de la liste — donc au
  // plus une fois par poll, jamais à chaque rendu du panneau.
  const filters = useMemo(() => availableFilters(notifications), [notifications]);
  // Un filtre devenu vide (tout marqué, liste relue) retombe sur « Tout ».
  const activeFilter = filters.includes(filter) ? filter : 'all';
  const groups = useMemo(
    () => groupNotifications(filterNotifications(notifications, activeFilter)),
    [notifications, activeFilter],
  );

  // Fermeture au clic extérieur et à Échap — un panneau ancré qui ne se ferme
  // que par son propre bouton piège le pointeur.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Rien à montrer et rien à annoncer (démo, ou organisation sans historique) :
  // une cloche morte est du bruit dans un en-tête déjà chargé.
  if (notifications.length === 0) return null;

  const toggle = () => {
    setOpen((wasOpen) => {
      // Marquage à l'OUVERTURE seulement, et seulement s'il y a quelque chose
      // à marquer : la mutation filtre déjà `read_at IS NULL` côté serveur,
      // inutile d'émettre un UPDATE pour rien.
      if (!wasOpen && unread > 0) markRead.mutate();
      return !wasOpen;
    });
  };

  const openNotification = (notification: OrgNotification) => {
    setOpen(false);
    if (notification.taskId) navigate(buildOrgLink('projects', { task: notification.taskId }));
    else if (notification.projectId) navigate(buildOrgLink('projects', { project: notification.projectId }));
    else if (notification.krId) navigate(buildOrgLink('okr'));
    else if (notification.eventId) navigate('/agenda');
    else if (notification.kind === 'role_changed') navigate(buildOrgLink('pyramid'));
  };

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread > 0 ? tp('notifications.bellUnread', unread) : t('notifications.bell')}
        className="relative w-11 h-11 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] text-caption font-bold inline-flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
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
              onClick={() => { setOpen(false); setSettingsOpen(true); }}
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
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <OrgNotificationSettingsDialog orgId={orgId} open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
    </div>
  );
};

export default OrgNotificationsBell;
