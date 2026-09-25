// ═══════════════════════════════════════════════════════════════════
// Pastilles de section de l'espace entreprise (audit du 2026-09-24)
//
// Séparé de `notifications.helpers.ts` le 2026-09-25 : ce calcul est lu par
// `OrganizationPage` à chaque visite, le reste (regroupement, filtres) par le
// seul panneau de la cloche, chargé à l'ouverture. Les réunir gardait tout le
// module dans le chunk de la page.
// ═══════════════════════════════════════════════════════════════════

import type { OrgNotification, OrgNotificationKind } from '@/modules/organizations';

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
