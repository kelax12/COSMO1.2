import { Suspense, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import {
  useOrgNotifications,
  useMarkNotificationsRead,
  unreadCount,
  type OrgMember,
} from '@/modules/organizations';
import { useT } from '@/i18n/useT';

// Chargés à l'ouverture seulement : la cloche est montée sur chaque visite.
const OrgNotificationsPanel = lazyWithRetry(() => import('./OrgNotificationsPanel'));
const OrgNotificationSettingsDialog = lazyWithRetry(() => import('./OrgNotificationSettingsDialog'));

interface OrgNotificationsBellProps {
  orgId: string;
  members: OrgMember[];
}

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
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useOrgNotifications(orgId);
  const markRead = useMarkNotificationsRead(orgId);
  const unread = unreadCount(notifications);

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
        <Suspense fallback={null}>
          <OrgNotificationsPanel
            notifications={notifications}
            members={members}
            onClose={() => setOpen(false)}
            onOpenSettings={() => { setOpen(false); setSettingsOpen(true); }}
          />
        </Suspense>
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
