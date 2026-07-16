// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getStatsRepository } from '@/lib/repository.factory';
import { statsKeys } from './constants';
import type { WorkTimeRange } from './types';

/**
 * Agrégats « temps investi » par plage de dates (un bucket par plage).
 *
 * staleTime 0 : contrairement aux entités, les buckets ne sont pas
 * invalidés par les mutations tasks/habits/events/okrs — on refetch donc
 * à chaque montage pour refléter les complétions faites juste avant
 * d'ouvrir la page. Coût : un appel RPC léger (payload ~1 kB).
 * keepPreviousData évite le flash à vide quand la période change.
 */
export function useWorkTimeStats(ranges: WorkTimeRange[]) {
  return useQuery({
    queryKey: statsKeys.workTime(ranges),
    queryFn: () => getStatsRepository().getWorkTimeStats(ranges),
    enabled: ranges.length > 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}
