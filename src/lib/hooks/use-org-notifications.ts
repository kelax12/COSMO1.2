// ═══════════════════════════════════════════════════════════════════
// Badge « Entreprise » (reco #7, version dérivée sans table dédiée) :
// demandes d'adhésion en attente (admins) + nouvelles tâches qui me sont
// assignées depuis ma dernière visite de /entreprise.
//
// 🔴 Ce hook est monté par `Layout`, donc sur TOUTES les pages protégées, pour
// tout membre d'une organisation. Il n'affiche aucune liste : il en dérive un
// nombre et quatre libellés d'aperçu. Tout ce qu'il lit doit donc être payé au
// prix d'un compteur, jamais au prix d'une liste.
//
// Jusqu'au 2026-09-05 il montait `useTeamTasks`, c'est-à-dire une lecture
// org-wide de `team_tasks` bornée à 1 000 lignes — la lecture la plus chère du
// produit (`SCALABILITY.md` §2). Le rechargement en avait été coupé le
// 2026-08-27 (`background`), la LECTURE pas : elle partait toujours au premier
// montage, à chaque chargement de l'application. C'est le finding C-05.
//
// Le compte vient maintenant du serveur, agrégé dans la boîte de réception
// (`badge_tasks`, mig. 142) : la même lecture qui portait déjà les
// notifications en porte les tâches, sans requête supplémentaire.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';
import {
  useActiveOrganization, useOrgJoinRequests, useOrgNotifications, unreadCount,
  useOrgBadgeTasks,
} from '@/modules/organizations';
import { useTeamTasks } from '@/modules/team-projects';
import {
  computeOrgBadges, type OrgBadges, type BadgeSourceTask,
} from './org-badges.helpers';

const lastSeenKey = (orgId: string) => `cosmo_org_last_seen_${orgId}`;

/** Timestamp (ms) de la dernière visite de /entreprise pour cette org. */
export function readOrgLastSeen(orgId: string): number {
  try {
    const raw = localStorage.getItem(lastSeenKey(orgId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** À appeler quand l'utilisateur ouvre /entreprise : remet le badge à zéro. */
export function markOrgSeen(orgId: string): void {
  try { localStorage.setItem(lastSeenKey(orgId), String(Date.now())); } catch { /* no-op */ }
}

const EMPTY_BADGES: OrgBadges = {
  projects: 0, members: 0, total: 0, projectItems: [], memberItems: [],
};

/**
 * Compteurs ventilés par onglet — source unique du badge de navigation ET des
 * badges d'onglet de /entreprise. Le calcul est dans `org-badges.helpers.ts`
 * (testé) ; ce hook ne fait que rassembler ses entrées.
 */
export function useOrgBadges(): OrgBadges {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.myRole === 'admin';
  // Requêtes no-op (enabled: !!orgId) hors entreprise / hors admin.
  const { data: requests = [] } = useOrgJoinRequests(isAdmin ? activeOrg?.id : undefined);
  const { data: notifications = [] } = useOrgNotifications(activeOrg?.id);

  // ── Production : le compte vient du serveur (mig. 142) ────────────
  const badgeTasks = useOrgBadgeTasks(activeOrg?.id);

  // ── Démo : la source reste locale, et c'est un arbitrage ──────────
  //
  // En démo il n'y a pas de base : `useTeamTasks` lit `localStorage`, donc
  // aucune requête, aucun octet. La brancher ici coûte zéro et évite d'écrire
  // une SECONDE dérivation de « nouvelle assignation » dans le repository
  // local — deux définitions du même chiffre finissent toujours par diverger.
  // Hors démo l'identifiant est `undefined`, la requête est désarmée
  // (`enabled: !!orgId`) et RIEN ne part.
  const isDemo = useIsDemo();
  const { data: demoTasks = [] } = useTeamTasks(
    isDemo ? activeOrg?.id : undefined, undefined, { background: true },
  );

  // Les deux sources se rejoignent sur `BadgeSourceTask`, l'intersection que
  // `computeOrgBadges` lit réellement : un seul calcul, deux provenances.
  //
  // Les lignes `notified` ne servent qu'à nommer l'aperçu. On leur retire donc
  // toute assignation (`assigneeIds: []`) : une tâche renvoyée à la fois comme
  // `assigned` et comme `notified` compterait DEUX fois, et le nombre affiché
  // changerait — exactement ce que ce correctif s'interdit.
  const tasks = useMemo<BadgeSourceTask[]>(() => {
    if (isDemo) return demoTasks;
    return badgeTasks.map((t) => ({
      id: t.id,
      name: t.name,
      completed: false,
      assigneeIds: t.kind === 'assigned' && user?.id ? [user.id] : [],
      createdBy: '',
      createdAt: t.createdAt,
    }));
  }, [isDemo, demoTasks, badgeTasks, user?.id]);

  return useMemo(() => {
    if (!activeOrg || !user?.id) return EMPTY_BADGES;
    const pending = requests.filter((r) => r.status === 'pending');
    return computeOrgBadges({
      userId: user.id,
      lastSeen: readOrgLastSeen(activeOrg.id),
      pendingRequests: pending.length,
      // `requesterName` n'est enrichi que pour la vue admin ; l'aperçu tombe
      // sur l'email, puis se tait — jamais sur un UUID, qui ne dit rien.
      pendingRequestNames: pending
        .map((r) => r.requesterName ?? r.requesterEmail ?? '')
        .filter(Boolean),
      tasks,
      unreadNotifications: unreadCount(notifications),
      unreadNotificationTaskIds: notifications
        .filter((n) => n.readAt === null && !!n.taskId)
        .map((n) => n.taskId as string),
    });
  }, [activeOrg, user?.id, requests, tasks, notifications]);
}

/** Total pour la pastille de navigation — signature inchangée (compat). */
export function useOrgNotificationCount(): number {
  return useOrgBadges().total;
}
