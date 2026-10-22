import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrgMember, OrgTreeNode } from '@/modules/organizations';
import {
  collapsedStorageKey,
  readCollapsedIds,
  LARGE_PYRAMID_THRESHOLD,
  hasStoredCollapsed,
  defaultCollapsedIds,
  ancestorIds,
} from './pyramid.helpers';

/**
 * État replié de la pyramide, extrait de `PyramidTab` (plafond de 600 lignes
 * de `architecture.guard`).
 *
 * - Persisté par organisation. L'org est mémorisée avec l'état pour ne pas
 *   écraser le stockage d'une autre org lors d'un changement d'org active.
 * - Repli par défaut d'un GRAND organigramme (audit du 2026-09-24), une seule
 *   fois, et seulement si aucune préférence n'existe.
 * - Pendant une recherche, seul le CHEMIN jusqu'aux résultats est déplié.
 */
export function usePyramidCollapse({ orgId, roots, memberCount, visibleMembers, matchIds }: {
  orgId: string;
  roots: OrgTreeNode[];
  memberCount: number;
  visibleMembers: OrgMember[];
  matchIds: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<{ org: string; ids: Set<string> }>(() => ({
    org: orgId,
    ids: readCollapsedIds(orgId),
  }));
  // Lu AVANT que l'effet de persistance n'écrive : il écrit dès le premier
  // rendu, ce qui ferait croire à une préférence.
  const defaultCollapsePending = useRef<string | null>(hasStoredCollapsed(orgId) ? null : orgId);

  useEffect(() => {
    if (collapsed.org !== orgId) {
      defaultCollapsePending.current = hasStoredCollapsed(orgId) ? null : orgId;
      setCollapsed({ org: orgId, ids: readCollapsedIds(orgId) });
    }
  }, [orgId, collapsed.org]);

  // Les membres arrivent en asynchrone : on attend qu'un arbre existe, puis on
  // décide une fois. Une petite équipe reste dépliée, comme avant.
  useEffect(() => {
    if (defaultCollapsePending.current !== orgId || collapsed.org !== orgId || roots.length === 0) return;
    defaultCollapsePending.current = null;
    if (memberCount > LARGE_PYRAMID_THRESHOLD) {
      setCollapsed({ org: orgId, ids: defaultCollapsedIds(roots) });
    }
  }, [orgId, collapsed.org, roots, memberCount]);

  useEffect(() => {
    if (collapsed.org !== orgId) return;
    try {
      localStorage.setItem(collapsedStorageKey(orgId), JSON.stringify([...collapsed.ids]));
    } catch {
      // Quota localStorage plein : l'état replié n'est simplement pas persisté.
    }
  }, [collapsed, orgId]);

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const ids = new Set(prev.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { org: prev.org, ids };
    });

  // À mille personnes, tout déplier pour montrer un nom rendait l'organigramme
  // illisible. Le reste garde le repli choisi.
  const effectiveCollapsedIds = useMemo(() => {
    if (matchIds.size === 0) return collapsed.ids;
    const path = ancestorIds(visibleMembers, matchIds);
    return new Set([...collapsed.ids].filter((id) => !path.has(id)));
  }, [matchIds, visibleMembers, collapsed.ids]);

  return { effectiveCollapsedIds, toggleCollapse };
}
