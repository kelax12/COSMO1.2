// ═══════════════════════════════════════════════════════════════════
// Effets de la page /entreprise sortis d'`OrganizationPage` (audit 2026-09-24)
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useMemo } from 'react';
import { useTeamProjects } from '@/modules/team-projects';
import { buildOrgLink, readEntityParam } from './deep-link.helpers';
import { projectColor } from './team-projects.helpers';
import { recordRecent, useOrgPins } from './org-pins';
import type { OrgShortcutGroup } from './org-sections';

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
