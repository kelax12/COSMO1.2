// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Recherche globale (mig. 191) — hook SEUL dans son fichier
//
// 🔴 La palette (Ctrl+K) est montée par `Layout`, donc dans le chunk
// d'ENTRÉE. Importer ce hook depuis `governance.hooks` y tirait tous les hooks
// de gouvernance (départ, invitations, journal, vues…) pour une seule
// requête : +1,6 ko gzip mesurés sur l'entrée le 2026-09-25, payés par
// chaque page. Ce fichier ne dépend que de la fabrique de dépôts.
// ═══════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { getOrgGovernanceRepository } from '@/lib/repository.factory';

export const orgSearchKey = (orgId: string, query: string) => ['org-governance', 'search', orgId, query] as const;

/**
 * Recherche SERVEUR dans toute l'organisation, sous les droits de qui cherche.
 * `query` doit déjà être « posée » (anti-rebond côté appelant) : elle entre
 * dans la clé de cache, une clé par frappe ferait une requête par touche.
 */
export const useOrgSearch = (orgId: string | undefined, query: string) => {
  const repository = getOrgGovernanceRepository();
  const q = query.trim();
  return useQuery({
    queryKey: orgSearchKey(orgId ?? '', q.toLowerCase()),
    queryFn: () => repository.search(orgId as string, q),
    enabled: !!orgId && q.length >= 2,
    staleTime: 1000 * 30,
    placeholderData: (previous) => previous,
  });
};
