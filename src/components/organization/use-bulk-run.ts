// ═══════════════════════════════════════════════════════════════════
// Exécution d'un geste EN MASSE (audit du 2026-09-24, étape 4)
//
// « Changement de configuration en masse : pas d'actions groupées sur les
// membres, les projets ou les équipes. » Chaque geste de lot passe ici : un
// appel par élément, tous lancés, UN seul toast qui dit combien ont réussi.
//
// ⚠️ Les appels vont au REPOSITORY, jamais aux hooks de mutation : ceux-ci
//    posent un toast chacun, et vingt toasts pour un geste noient l'écran.
// ⚠️ Pas de transaction : un refus serveur sur un élément (droit, dernier
//    admin, propriétaire) n'annule pas les autres. Le toast le DIT au lieu de
//    le taire, et le cache est relu dans tous les cas.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';

export interface BulkOutcome {
  done: number;
  failed: number;
}

/** Lance `run` sur chaque élément, sans s'arrêter au premier refus. */
export async function runBulk<T>(items: T[], run: (item: T) => Promise<unknown>): Promise<BulkOutcome> {
  const results = await Promise.allSettled(items.map((item) => run(item)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { done: results.length - failed, failed };
}

/**
 * `invalidate` : les préfixes de clés à relire après le lot (membres,
 * équipes, projets…). Rend `pending` pour griser la barre pendant le lot.
 */
export const useBulkRun = (invalidate: readonly (readonly unknown[])[]) => {
  const { tp: tpa } = useT('orgAdmin');
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const execute = async <T,>(items: T[], run: (item: T) => Promise<unknown>): Promise<BulkOutcome> => {
    setPending(true);
    try {
      const outcome = await runBulk(items, run);
      if (outcome.failed === 0) toast.success(tpa('bulk.done', outcome.done));
      else toast.error(tpa('bulk.partial', outcome.failed, { done: outcome.done }));
      return outcome;
    } finally {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key });
      setPending(false);
    }
  };

  return { execute, pending };
};
