// ═══════════════════════════════════════════════════════════════════
// Compteurs de badge de l'espace entreprise
//
// Le calcul vivait inline dans `use-org-notifications.ts` et ne produisait
// qu'un total pour la navigation. Il est extrait ici pour être ventilé par
// onglet ET testé : c'est la seule partie qui décide quelque chose.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTask } from '@/modules/team-projects';

export interface OrgBadgeInput {
  userId: string;
  /** Timestamp (ms) de la dernière visite de /entreprise. */
  lastSeen: number;
  /** Demandes d'adhésion en attente (0 si non-admin). */
  pendingRequests: number;
  tasks: TeamTask[];
  /**
   * Notifications serveur non lues (mig. 095) — 0 en démo, où il n'y a pas de
   * base. Elles SUPPLANTENT le comptage dérivé des tâches quand elles
   * existent : `lastSeen` est en localStorage, donc faux dès qu'on change
   * d'appareil, là où `read_at` est partagé.
   */
  unreadNotifications?: number;
  /**
   * Tâches visées par les notifications non lues. Sert UNIQUEMENT à nommer
   * l'aperçu quand les notifications supplantent le comptage dérivé — sans
   * quoi le badge afficherait un nombre qu'aucune liste ne peut expliquer,
   * ce qui est précisément le défaut que l'aperçu corrige.
   */
  unreadNotificationTaskIds?: string[];
  /**
   * Noms des personnes dont l'adhésion est en attente, dans le même ordre que
   * `pendingRequests` les compte. Facultatif : le compteur reste juste sans
   * eux, seul l'aperçu détaillé s'appauvrit.
   */
  pendingRequestNames?: string[];
}

/**
 * Nombre maximum d'items nommés dans un aperçu de badge. Au-delà, l'aperçu
 * dit « et N autres » : une liste de 30 tâches n'aide personne à décider s'il
 * faut ouvrir l'onglet, et c'est la seule question à laquelle il répond.
 */
export const BADGE_PREVIEW_LIMIT = 4;

export interface OrgBadges {
  /** Tâches nouvellement assignées → onglet Projets. */
  projects: number;
  /** Demandes d'adhésion en attente → onglet Membres. */
  members: number;
  /** Somme — c'est ce qu'affiche la pastille de navigation. */
  total: number;
  /**
   * Ce qui compose chaque compteur, tronqué à `BADGE_PREVIEW_LIMIT`. Un
   * chiffre seul oblige à ouvrir l'onglet pour savoir ce qui a changé — ces
   * listes sont là pour répondre sans navigation.
   *
   * Peut être plus court que le compteur : quand les notifications serveur
   * supplantent le comptage dérivé, on connaît le nombre sans connaître les
   * libellés.
   */
  projectItems: string[];
  memberItems: string[];
}

export const computeOrgBadges = ({
  userId, lastSeen, pendingRequests, tasks, unreadNotifications, pendingRequestNames,
  unreadNotificationTaskIds,
}: OrgBadgeInput): OrgBadges => {
  const newlyAssigned = tasks.filter((t) => {
    if (t.completed || !t.assigneeIds.includes(userId)) return false;
    // S'auto-assigner ne notifie pas : on sait déjà ce qu'on vient d'écrire.
    if (t.createdBy === userId) return false;
    const created = Date.parse(t.createdAt);
    return Number.isFinite(created) && created > lastSeen;
  });
  const derived = newlyAssigned.length;

  // Les notifications serveur font autorité dès qu'il y en a : le comptage
  // dérivé n'est qu'un filet pour les organisations dont aucune tâche n'a
  // encore été réassignée depuis l'application de la mig. 095.
  const serverWins = !!unreadNotifications && unreadNotifications > 0;
  const projects = serverWins ? unreadNotifications : derived;

  // Quand le serveur fait autorité, l'aperçu se reconstruit depuis les tâches
  // que ses notifications désignent. Une notification dont la tâche n'est pas
  // (ou plus) lisible est simplement omise : mieux vaut un aperçu plus court
  // que le compteur qu'un libellé inventé.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const projectItems = serverWins
    ? (unreadNotificationTaskIds ?? [])
        .map((id) => byId.get(id)?.name)
        .filter((name): name is string => !!name)
        .slice(0, BADGE_PREVIEW_LIMIT)
    : newlyAssigned.slice(0, BADGE_PREVIEW_LIMIT).map((t) => t.name);

  return {
    projects,
    members: pendingRequests,
    total: projects + pendingRequests,
    projectItems,
    memberItems: (pendingRequestNames ?? []).slice(0, BADGE_PREVIEW_LIMIT),
  };
};
