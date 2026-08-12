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
import { ORG_NOTIFICATIONS_STORAGE_KEY } from './constants';

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

// ─── Mode démo ───────────────────────────────────────────────────────
//
// La démo renvoyait `[]` : la cloche restait donc invisible, et rien ne
// montrait à quoi ressemble une notification. Les seeds ci-dessous pointent
// tous vers des tâches d'équipe qui EXISTENT réellement dans la démo — c'est
// la condition qui rendait l'ancien choix légitime : ne pas inviter à cliquer
// sur quelque chose qui n'a pas eu lieu.

const DEMO_ORG_ID = 'org-demo-1';
const DAY = 24 * 60 * 60 * 1000;
const demoIso = (offset: number): string => new Date(Date.now() + offset * DAY).toISOString();

const DEMO_NOTIFICATIONS: OrgNotification[] = [
  // Mention : répond au commentaire seedé sur « Plan de communication ».
  { id: 'notif-seed-1', orgId: DEMO_ORG_ID, actorId: 'friend-1', kind: 'mention', taskId: 'ttask-8', readAt: null, createdAt: demoIso(-1) },
  // Retard : produit par pg_cron en production, donc jamais d'auteur.
  { id: 'notif-seed-2', orgId: DEMO_ORG_ID, actorId: null, kind: 'task_overdue', taskId: 'ttask-17', readAt: null, createdAt: demoIso(-1) },
  { id: 'notif-seed-3', orgId: DEMO_ORG_ID, actorId: 'friend-1', kind: 'task_assigned', taskId: 'ttask-20', readAt: null, createdAt: demoIso(-2) },
  // Déjà lue : sans elle, l'état « lu » du panneau ne se voit jamais.
  { id: 'notif-seed-4', orgId: DEMO_ORG_ID, actorId: 'friend-2', kind: 'task_assigned', taskId: 'ttask-8', readAt: demoIso(-3), createdAt: demoIso(-4) },
];

/** Lecture protégée du localStorage (règle B14 : jamais de JSON.parse nu). */
const readDemoNotifications = (): OrgNotification[] => {
  const raw = localStorage.getItem(ORG_NOTIFICATIONS_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as OrgNotification[];
    } catch {
      /* seed de secours ci-dessous */
    }
  }
  const clone = JSON.parse(JSON.stringify(DEMO_NOTIFICATIONS)) as OrgNotification[];
  localStorage.setItem(ORG_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(clone));
  return clone;
};

/**
 * Notifications de l'organisation active.
 *
 * En mode démo il n'y a pas de base : les notifications viennent du
 * localStorage, seedées au premier accès et bornées à l'org demandée — même
 * contrat de filtrage qu'en production.
 */
export const useOrgNotifications = (orgId: string | undefined) =>
  useQuery({
    queryKey: orgNotificationKeys.list(orgId ?? ''),
    queryFn: async (): Promise<OrgNotification[]> => {
      if (appModeStore.isDemo) {
        return readDemoNotifications()
          .filter((n) => n.orgId === orgId)
          .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
      }
      if (!supabase) return [];
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
      if (appModeStore.isDemo) {
        // Même sémantique qu'en prod : on ne réécrit QUE les non-lues, sinon
        // chaque ouverture du panneau écraserait la date de première lecture.
        const now = new Date().toISOString();
        const next = readDemoNotifications().map((n) =>
          n.orgId === orgId && n.readAt === null ? { ...n, readAt: now } : n,
        );
        localStorage.setItem(ORG_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
        return;
      }
      if (!supabase) return;
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
