// Dérivations pures de `OrganizationPage` : adresse → redirection, section
// demandée → section servie, sections visibles, badge d'une entrée. Sorties de
// la page pour être testées seules (ARCHITECTURE § 3).
import { sectionOpenWhileOverQuota } from '@/modules/billing/org-billing.logic';
import { safeRedirectPath } from '@/lib/safe-redirect';
import type { OrgSection, OrgSectionDef } from './org-sections';
import type { BadgeSection, sectionNotificationBadges } from './org-section-badges';
import {
  isOrgSectionSegment,
  legacyOrgTabRedirect,
  orgSectionPath,
  readTeamIdSegment,
} from './deep-link.helpers';

export type OrgRoute =
  | { redirect: string; teamId?: undefined }
  | { redirect: null; teamId: string | null };

/**
 * Adresse de l'espace entreprise → redirection éventuelle, sinon l'équipe
 * ouverte. Ordre voulu : `?tab=` d'abord (⚠️ À GARDER POUR TOUJOURS : retour
 * Stripe `?tab=billing&checkout=success`, e-mails `renewal-notice`), passé par
 * `safeRedirectPath` (no-open-redirect.test.ts) ; puis un segment inconnu vers
 * l'aperçu ; puis un second segment hors `teams` ou sans forme d'id vers la
 * section elle-même.
 */
export function resolveOrgRoute(
  searchParams: URLSearchParams,
  section: string | undefined,
  entityId: string | undefined,
): OrgRoute {
  const legacyTarget = safeRedirectPath(legacyOrgTabRedirect(searchParams));
  if (legacyTarget) return { redirect: legacyTarget };
  if (section !== undefined && !isOrgSectionSegment(section)) return { redirect: '/entreprise' };
  const teamId = section === 'teams' ? readTeamIdSegment(entityId) : null;
  if (entityId !== undefined && !teamId) return { redirect: orgSectionPath(section) };
  return { redirect: null, teamId };
}

/**
 * Section servie pour la section demandée. Sans droit sur `billing` ou
 * `stats`, retombée sur l'aperçu ; l'organigramme est masqué pour tous
 * (mig. 229) ; `reports` vit dans Paramètres.
 */
export function resolveOrgTab(urlTab: OrgSection, access: { isOwner: boolean; canStats: boolean }): OrgSection {
  if ((urlTab === 'billing' && !access.isOwner) || urlTab === 'pyramid' || (urlTab === 'stats' && !access.canStats)) {
    return 'overview';
  }
  return urlTab === 'reports' ? 'settings' : urlTab;
}

/** Entrées de navigation visibles : ni masquées, ni réservées, ni verrouillées par le quota. */
export function visibleOrgSections<T extends Pick<OrgSectionDef, 'id' | 'hidden' | 'managerOnly'>>(
  sections: readonly T[],
  viewer: { canStats: boolean; isAdmin: boolean; isOwner: boolean; overQuota: boolean },
): T[] {
  const quotaViewer = { isAdmin: viewer.isAdmin, isOwner: viewer.isOwner };
  return sections
    .filter((item) => !item.hidden)
    .filter((item) => (item.id === 'stats' ? viewer.canStats : !item.managerOnly || viewer.isAdmin))
    .filter((item) => !viewer.overQuota || sectionOpenWhileOverQuota(item.id, quotaViewer));
}

export interface OrgNavBadgeCounts {
  projects: number;
  projectItems: string[];
  members: number;
  memberItems: string[];
}

/**
 * Badge d'une entrée : Projets et Membres ont un compteur dérivé, les autres
 * comptent les notifications non lues de la boîte de réception.
 */
export function orgSectionBadge(
  id: OrgSection,
  badges: OrgNavBadgeCounts,
  sectionBadges: ReturnType<typeof sectionNotificationBadges>,
  kindLabel: (kind: string) => string,
): { count: number; items: string[] } {
  const extra = (id in sectionBadges) ? sectionBadges[id as BadgeSection] : null;
  const extraItems = extra ? extra.kinds.map(kindLabel) : [];
  if (id === 'projects') return { count: badges.projects + (extra?.count ?? 0), items: [...badges.projectItems, ...extraItems] };
  if (id === 'members') return { count: badges.members, items: badges.memberItems };
  return { count: extra?.count ?? 0, items: extraItems };
}

/** Titre de l'aperçu d'un badge. */
export function badgePreviewKey(id: OrgSection) {
  if (id === 'members') return 'page.badgePreviewMembers' as const;
  if (id === 'projects') return 'page.badgePreviewProjects' as const;
  return 'page.badgePreviewSection' as const;
}
