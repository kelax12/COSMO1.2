// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { getKRCompletionsRepository } from '@/lib/repository.factory';
import { IKRCompletionsRepository } from './repository';
import { krCompletionKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════

// Sélection du repository : le factory est déjà un singleton paramétré par
// `appModeStore.isDemo`, et `resetRepositories()` le vide à chaque bascule
// (AuthContext). Le `useMemo(..., [isDemo])` qui vivait ici était donc
// redondant, et son commentaire était faux : `resetRepositories()` est aussi
// appelé sur des chemins où `isDemo` NE change pas (déconnexion d'une vraie
// session), où la mémo rendait alors l'instance que le factory venait de
// jeter. Six modules (events, lists, categories, friends, team-projects,
// organizations) font déjà cet appel direct. Audit A-2, item C-06.
const useKRCompletionsRepository = (): IKRCompletionsRepository => getKRCompletionsRepository();

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all KR completion records
 */
export const useKRCompletions = (options?: { enabled?: boolean }) => {
  const repository = useKRCompletionsRepository();
  return useQuery({
    queryKey: krCompletionKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════
