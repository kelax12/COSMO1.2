// ═══════════════════════════════════════════════════════════════════
// L'écran se souvient des DERNIERS filtres (remplace les vues enregistrées,
// mig. 192 retirée du front) — par organisation et par onglet, dans
// `localStorage` : ce n'est pas une donnée qu'on partage, seulement une
// commodité par appareil, comme les épinglés du panneau (`org-pins.ts`).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { safeGetItem, safeParse, safeSetItem } from '@/lib/safe-json';
import { TASK_FILTER_PARAMS } from './task-filters';

const F_PARAM_NAMES: readonly string[] = Object.values(TASK_FILTER_PARAMS);

export const rememberedFiltersKey = (scope: string, orgId: string): string =>
  `cosmo_org_filters:${scope}:${orgId}`;

/** Les seuls paramètres `f*` d'une URL, sous forme d'objet (pas d'adresse d'objet). */
export function extractFParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of F_PARAM_NAMES) {
    const v = params.get(name);
    if (v !== null) out[name] = v;
  }
  return out;
}

/** Au moins un filtre `f*` est-il déjà posé dans l'URL ? */
export function hasAnyFParam(params: URLSearchParams): boolean {
  return F_PARAM_NAMES.some((name) => params.has(name));
}

/**
 * Se souvient des derniers filtres `f*` par organisation et par écran.
 *
 * - Au montage : si l'URL n'en porte AUCUN, restaure ceux mémorisés
 *   (`replace: true`, pour ne pas empiler une entrée d'historique inventée).
 * - À chaque changement : réécrit ce qui est mémorisé.
 *
 * Une URL explicite (lien partagé, navigation avec filtres) gagne toujours :
 * on ne restaure que sur un écran nu.
 */
export const useRememberedTaskFilters = (orgId: string | undefined, scope: 'tasks' | 'projects'): void => {
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!orgId || restoredFor.current === orgId) return;
    restoredFor.current = orgId;
    if (hasAnyFParam(searchParams)) return;
    const stored = safeParse<Record<string, string>>(safeGetItem(rememberedFiltersKey(scope, orgId)));
    if (!stored || Object.keys(stored).length === 0) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(stored)) {
          if (F_PARAM_NAMES.includes(key) && typeof value === 'string') next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchParams` exclu volontairement : `restoredFor` fige déjà une restauration par organisation, relire l'URL courante ici rejouerait la restauration à chaque frappe au lieu d'une fois au montage.
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    safeSetItem(rememberedFiltersKey(scope, orgId), JSON.stringify(extractFParams(searchParams)));
  }, [searchParams, orgId, scope]);
};
