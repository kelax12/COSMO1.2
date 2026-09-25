// ═══════════════════════════════════════════════════════════════════
// Effets de la page /entreprise sortis d'`OrganizationPage` (audit 2026-09-24)
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects } from '@/modules/team-projects';
import { buildOrgLink, readEntityParam } from './deep-link.helpers';
import { projectColor } from './team-projects.helpers';
import { recordRecent, useOrgPins } from './org-pins';
import type { OrgShortcutGroup } from './org-sections';

const managerSeenKey = (orgId: string, userId: string) => `cosmo_org_manager_seen_${orgId}_${userId}`;

/**
 * « Vous encadrez maintenant X » : un toast, UNE fois, quand Statistiques et
 * Pyramide apparaissent dans la navigation parce qu'on vient de recevoir un
 * subordonné. Sans lui, le menu changeait sous les yeux sans explication.
 *
 * Le dernier état connu est gardé par organisation et par personne. La
 * première visite ENREGISTRE l'état sans rien dire : un manager de longue date
 * ne doit pas être félicité le jour où cette fonction est livrée. Seul le
 * passage de « non » à « oui » déclenche le message. Les admins voient ces
 * sections depuis toujours : rien à annoncer.
 */
export const useManagerSectionsToast = (
  orgId: string | undefined,
  userId: string | undefined,
  members: OrgMember[],
  membersLoaded: boolean,
  isAdmin: boolean,
) => {
  const { t } = useT('org');
  const reports = useMemo(
    () => (userId ? members.filter((m) => m.managerId === userId) : []),
    [members, userId],
  );
  const managesSomeone = reports.length > 0;
  useEffect(() => {
    if (!orgId || !userId || !membersLoaded || isAdmin) return;
    const key = managerSeenKey(orgId, userId);
    let previous: string | null = null;
    try { previous = localStorage.getItem(key); } catch { return; }
    const now = managesSomeone ? '1' : '0';
    if (previous === now) return;
    try { localStorage.setItem(key, now); } catch { /* sans stockage : pas de toast */ return; }
    if (previous === '0' && managesSomeone) {
      const names = reports.slice(0, 2).map((m) => m.displayName).join(', ');
      toast.info(t('page.managerToast', { names: reports.length > 2 ? `${names}…` : names }));
    }
  }, [orgId, userId, membersLoaded, isAdmin, managesSomeone, reports, t]);
};

/**
 * Groupe « Épinglés » (ou « Récents » tant que rien n'est épinglé) du panneau
 * de droite. Une ouverture de projet par l'URL (`?project=`, que la palette,
 * « Mes projets » et ce même groupe émettent) est notée comme récente.
 */
export const useOrgShortcuts = (
  orgId: string | undefined,
  userId: string | undefined,
  section: string,
  searchParams: URLSearchParams,
): { shortcuts: OrgShortcutGroup; togglePin: (projectId: string) => void } => {
  const { data: projects = [] } = useTeamProjects(orgId);
  const { pinned, recent, toggle } = useOrgPins(orgId, userId);
  const openedProject = section === 'projects' ? readEntityParam(searchParams, 'project') : null;

  useEffect(() => {
    if (orgId && userId && openedProject) recordRecent(orgId, userId, openedProject);
  }, [orgId, userId, openedProject]);

  const shortcuts = useMemo<OrgShortcutGroup>(() => {
    // Un projet archivé ou devenu invisible ne s'affiche pas, sans être retiré
    // de la liste : il revient s'il est restauré.
    const byId = new Map(projects.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
    const kind = pinned.some((id) => byId.has(id)) ? 'pinned' : 'recent';
    const ids = kind === 'pinned' ? pinned : recent;
    return {
      kind,
      items: ids.flatMap((id) => {
        const p = byId.get(id);
        return p
          ? [{
            id: p.id,
            label: p.name,
            dotClass: projectColor(p.color).dot,
            href: buildOrgLink('projects', { project: p.id }),
            pinned: pinned.includes(p.id),
          }]
          : [];
      }),
    };
  }, [projects, pinned, recent]);

  return { shortcuts, togglePin: toggle };
};
