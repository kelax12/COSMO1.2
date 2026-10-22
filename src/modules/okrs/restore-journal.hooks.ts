// ═══════════════════════════════════════════════════════════════════
// OKR — « Annuler » rend AUSSI le journal des complétions (C-01)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI.
//
// `kr_completions` cascade depuis `okrs` ET `key_results` (vérifié en
// production). `useRestoreOkr` ramenait l'objectif, ses KR et les `task.krId`
// qui les visent — mais pas le journal. Le graphique « KR réalisés » du
// tableau de bord gardait son trou, DÉFINITIVEMENT, alors que la personne
// venait justement de dire qu'elle ne voulait PAS supprimer.
//
// C'était documenté comme une limite dans `CLAUDE.md` § R-08 et dans le
// commentaire de `OKRPage`, jamais traité. Une limite écrite reste une perte
// de données.
//
// ── LES DEUX TEMPS, ET POURQUOI CET ORDRE ───────────────────────────
//
// 1. CAPTURER AVANT. Les lignes disparaissent avec l'OKR : elles doivent être
//    lues avant le `delete`, pas après. C'est l'appelant qui capture, parce
//    que lui seul sait quand il s'apprête à supprimer.
// 2. RÉINSÉRER APRÈS. La restauration recrée d'abord l'objectif sous SON
//    identifiant (les `kr_id` / `okr_id` du journal pointent dessus, un id
//    neuf rendrait les lignes orphelines), puis rejoue le journal.
//
// ❌ JAMAIS UN INSERT CLIENT LIBRE, et la première version de ce hook s'y est
//    trompée. Elle appelait `getKRCompletionsRepository().create()` — soit
//    exactement ce que l'arbitrage du 2026-09-03 fait SUPPRIMER avec
//    `useCreateKRCompletion` (« un INSERT client libre dans un journal
//    append-only que ce fichier interdit par ailleurs »). Passer par le
//    repository plutôt que par le hook gardait le défaut en changeant son nom.
//
//    L'écriture du journal appartient au REPOSITORY OKR
//    (`restoreCompletions`), au même endroit que `recordKRReps` — le chemin
//    que l'item C-01 désigne explicitement. Aucun code client ne touche plus
//    `kr_completions`.
//
// ── LA BORNE ────────────────────────────────────────────────────────
//
// 🔴 `MAX_REPS_PER_WRITE` (faille B18) s'applique DANS LE REPOSITORY, là où
// vit déjà celle de `recordKRReps` : le tableau vient d'une lecture, mais il
// traverse l'état d'un composant, donc un objet que des devtools peuvent
// enrichir. La borner ici ET là serait la dupliquer ; la borner ici SEULEMENT
// la laisserait contournable par un appel direct au repository.
//
// ── CE QUE ÇA NE RATTRAPE PAS ───────────────────────────────────────
//
// Les identifiants des lignes de journal ne sont PAS restaurés : le journal
// est un ensemble d'événements, pas un graphe. Rien ne référence une ligne de
// `kr_completions` — seul son contenu (kr_id, okr_id, completed_at) compte, et
// c'est lui qui alimente le graphique.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOKRsRepository } from '@/lib/repository.factory';
import { reportRestoreFailure, splitRestore } from '@/lib/restore-id';
import { krCompletionKeys } from '@/modules/kr-completions/constants';
import type { KRCompletion } from '@/modules/kr-completions/types';
import { okrsKeys } from './constants';
import type { CreateOKRInput, OKR } from './types';

export interface RestoreOkrPayload {
  /** L'objectif tel qu'il était juste avant la suppression. */
  okr: OKR;
  /**
   * Les lignes de journal de CET objectif, capturées AVANT le `delete`.
   * Vide si l'appelant n'a rien pu capturer : la restauration reste utile.
   */
  completions: KRCompletion[];
}

/**
 * Restaure un OKR supprimé, journal des complétions compris.
 *
 * ⚠️ N'appeler QUE depuis un toast d'annulation.
 */
export const useRestoreOkrWithJournal = () => {
  const queryClient = useQueryClient();
  const repository = getOKRsRepository();

  return useMutation({
    mutationFn: async ({ okr, completions }: RestoreOkrPayload) => {
      const { payload, options } = splitRestore(okr);
      // L'objectif D'ABORD : les `okr_id` / `kr_id` du journal le désignent.
      const restored = await repository.create(payload as CreateOKRInput, options);
      // Puis le journal, par le repository — jamais depuis ici.
      await repository.restoreCompletions(completions);
      return restored;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: okrsKeys.all });
      // Le graphique « KR réalisés » lit cette clé : sans elle, le journal est
      // revenu en base et l'écran continue d'afficher son trou.
      queryClient.invalidateQueries({ queryKey: krCompletionKeys.all });
    },
    // Un « Annuler » raté doit se VOIR : `console.error` est supprimé du
    // bundle de production (vite.config.ts), l'échec serait donc muet.
    onError: (error: Error) => reportRestoreFailure('okr', error),
  });
};
