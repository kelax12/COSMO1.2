import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { Bell, UserPlus, AtSign, AlarmClock } from 'lucide-react';
import {
  useOrgNotifications,
  useMarkNotificationsRead,
  unreadCount,
  type OrgNotification,
  type OrgNotificationKind,
  type OrgMember,
} from '@/modules/organizations';
import { buildOrgLink } from './deep-link.helpers';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface OrgNotificationsBellProps {
  orgId: string;
  members: OrgMember[];
}

/** Icône et libellé par type — le trigger n'écrit que ces trois-là. */
const KIND_META: Record<OrgNotificationKind, { Icon: typeof Bell; labelKey: KeyOf<'org'> }> = {
  task_assigned: { Icon: UserPlus, labelKey: 'notifications.kindAssigned' },
  mention: { Icon: AtSign, labelKey: 'notifications.kindMention' },
  task_overdue: { Icon: AlarmClock, labelKey: 'notifications.kindOverdue' },
};

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
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useOrgNotifications(orgId);
  const markRead = useMarkNotificationsRead(orgId);
  const unread = unreadCount(notifications);

  const nameById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.displayName])),
    [members],
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
  };

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread > 0 ? tp('notifications.bellUnread', unread) : t('notifications.bell')}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[rgb(var(--color-accent))] text-white text-caption font-bold inline-flex items-center justify-center">
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
          <p className="px-2 py-1.5 text-caption font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            {t('notifications.title')}
          </p>
          <ul className="space-y-1">
            {notifications.map((notification) => {
              const { Icon, labelKey } = KIND_META[notification.kind];
              // `task_overdue` vient de pg_cron : son `actorId` est TOUJOURS
              // null. Afficher un auteur serait un mensonge — c'est le temps
              // qui passe, personne ne l'a fait.
              const actor = notification.actorId ? nameById.get(notification.actorId) : null;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    disabled={!notification.taskId}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors ${
                      notification.taskId ? 'hover:bg-[rgb(var(--color-hover))]' : 'cursor-default'
                    } ${notification.readAt === null ? 'bg-[rgb(var(--color-accent)/0.08)]' : ''}`}
                  >
                    <Icon size={15} className="mt-0.5 shrink-0 text-[rgb(var(--color-accent))]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label text-[rgb(var(--color-text-primary))]">
                        {actor
                          ? t('notifications.byActor', { actor, label: t(labelKey) })
                          : t(labelKey)}
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
        </div>
      )}
    </div>
  );
};

export default OrgNotificationsBell;
