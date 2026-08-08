// ═══════════════════════════════════════════════════════════════════
// Notifications d'entreprise (mig. 095)
//
// Table append-only cote client : le serveur ecrit via trigger, l'utilisateur
// ne peut que LIRE, marquer lue et supprimer les siennes. Aucune fonction
// d'ecriture n'est donc exposee ici — ce n'est pas un oubli.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { appModeStore } from '@/lib/app-mode.store';

/**
 * `task_overdue` (mig. 096) est produit par pg_cron, pas par une action
 * humaine : son `actorId` est donc TOUJOURS null. Afficher un auteur pour ce
 * type serait un mensonge — c'est le temps qui passe, personne ne l'a fait.
 */
export type OrgNotificationKind = 'task_assigned' | 'mention' | 'task_overdue';

export interface OrgNotification {
  id: string;
  orgId: string;
  actorId: string | null;
  kind: OrgNotificationKind;
  taskId: string | null;
  /** null = non lue. Une date plutôt qu'un booléen (cf. mig. 095). */
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  org_id: string;
  actor_id: string | null;
  kind: string;
  task_id: string | null;
  read_at: string | null;
  created_at: string;
}

const mapNotification = (r: NotificationRow): OrgNotification => ({
  id: r.id,
  orgId: r.org_id,
  actorId: r.actor_id,
  kind: r.kind as OrgNotificationKind,
  taskId: r.task_id,
  readAt: r.read_at,
  createdAt: r.created_at,
});

export const orgNotificationKeys = {
  all: ['org-notifications'] as const,
  list: (orgId: string) => [...orgNotificationKeys.all, orgId] as const,
};

/**
 * Notifications de l'organisation active.
 *
 * En mode démo il n'y a pas de base : on renvoie une liste vide plutôt que de
 * simuler des notifications. Une notification factice inviterait à cliquer sur
 * quelque chose qui n'a pas eu lieu.
 */
export const useOrgNotifications = (orgId: string | undefined) =>
  useQuery({
    queryKey: orgNotificationKeys.list(orgId ?? ''),
    queryFn: async (): Promise<OrgNotification[]> => {
      if (appModeStore.isDemo || !supabase) return [];
      const { data, error } = await supabase
        .from('org_notifications')
        .select('*')
        .eq('org_id', orgId as string)
        // Même ordre que l'index (user_id, created_at DESC).
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw normalizeApiError(error);
      return (data as NotificationRow[]).map(mapNotification);
    },
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });

/** Marque tout comme lu. Un seul UPDATE plutôt qu'un par ligne. */
export const useMarkNotificationsRead = (orgId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (appModeStore.isDemo || !supabase) return;
      const { error } = await supabase
        .from('org_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('org_id', orgId)
        // Ne réécrit pas les lignes déjà lues : sans ce filtre, chaque ouverture
        // du panneau réécrirait tout l'historique et écraserait la date de
        // première lecture.
        .is('read_at', null);
      if (error) throw normalizeApiError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgNotificationKeys.list(orgId) });
    },
  });
};

/** Nombre de non-lues — alimente la pastille de navigation. */
export const unreadCount = (notifications: OrgNotification[]): number =>
  notifications.filter((n) => n.readAt === null).length;
