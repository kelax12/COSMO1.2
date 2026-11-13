// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getKRCompletionsRepository } from '@/lib/repository.factory';
import { IKRCompletionsRepository } from './repository';
import { krCompletionKeys, krCompletionsWindowStart } from './constants';

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
 * Le journal des `KR_COMPLETIONS_WINDOW_DAYS` derniers jours : ce que lisent
 * les graphiques et les statistiques (PER-01). La clé change à minuit, la
 * fenêtre glisse avec elle. L'historique d'un OKR : `useLoadOkrJournal`.
 */
export const useKRCompletions = (options?: { enabled?: boolean }) => {
  const repository = useKRCompletionsRepository();
  const since = krCompletionsWindowStart();
  return useQuery({
    queryKey: krCompletionKeys.since(since),
    queryFn: () => repository.getSince(since),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Relit au geste le journal ENTIER d'un OKR, sans plafond ni fenêtre : la
 * capture d'« Annuler » avant suppression (C-01) doit ramener aussi les
 * complétions plus anciennes que la fenêtre des écrans.
 */
export const useLoadOkrJournal = () => {
  const repository = useKRCompletionsRepository();
  return useCallback((okrId: string) => repository.getFiltered({ okrId }), [repository]);
};

/**
 * Le journal ENTIER, pour l'export de portabilité (RGPD art. 20) : paginé et
 * filtré explicitement sur la personne connectée.
 */
export const useKRCompletionsExport = () => {
  const repository = useKRCompletionsRepository();
  return useQuery({
    queryKey: krCompletionKeys.export(),
    queryFn: () => repository.getAllForExport(),
  });
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════
