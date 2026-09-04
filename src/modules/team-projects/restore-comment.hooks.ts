// ═══════════════════════════════════════════════════════════════════
// TEAM COMMENTS — restauration d'un commentaire supprimé (« Annuler »)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-42, arbitrage du 2026-09-03).
//
// `TaskCommentsSection` supprimait un commentaire sur UN SEUL CLIC, sans
// confirmation ni annulation, et il disparaissait pour toute l'équipe. C'était
// la seule suppression du mode entreprise sans aucun filet.
//
// L'item laissait le choix (« confirmation ou toast Annuler, mais l'un des
// deux ») ; l'arbitrage a tranché pour le toast, avec les jumeaux C-41 et
// C-43 : « Toast Annuler partout, et le libellé dit combien. Il faut écrire un
// `useRestoreComment` ».
//
// ── CE QUI EST RESTAURÉ, ET POURQUOI ────────────────────────────────
//
// L'identifiant ET l'horodatage.
//
//   • l'IDENTIFIANT, comme partout ailleurs (contrat R-08,
//     `src/lib/restore-id.ts`) ;
//   • l'HORODATAGE, ce qui est propre à ce cas : un fil de commentaires est
//     ordonné par `createdAt`. Sans lui, « Annuler » remettrait le commentaire
//     À LA FIN du fil, après des réponses qu'il précédait. La conversation
//     serait rendue incompréhensible par le geste censé la réparer.
//
// ❌ Les deux passent par le SECOND argument d'`addComment`, jamais par le
//    payload : celui-ci vient d'un état de composant, donc d'un objet que des
//    devtools peuvent enrichir (raison complète dans `restore-id.ts`).
//
// ⚠️ `author_id` reste posé par le SERVEUR depuis la session, comme à la
//    création. Restaurer un commentaire ne doit jamais permettre d'en écrire
//    un au nom de quelqu'un d'autre — et la policy `WITH CHECK` le vérifie de
//    toute façon.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { reportRestoreFailure } from '@/lib/restore-id';
import { teamProjectKeys } from './constants';
import type { TeamTaskComment } from './types';

/**
 * Restaure un commentaire supprimé, sous son identifiant et à sa place dans
 * le fil.
 *
 * ⚠️ N'appeler QUE depuis un toast d'annulation.
 */
export const useRestoreComment = (taskId: string) => {
  const queryClient = useQueryClient();
  const repository = getTeamProjectsRepository();

  return useMutation({
    mutationFn: (snapshot: TeamTaskComment) =>
      repository.addComment(
        {
          taskId: snapshot.taskId,
          body: snapshot.body,
          mentions: snapshot.mentions,
        },
        { restoreId: snapshot.id, restoreCreatedAt: snapshot.createdAt },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.comments(taskId) });
    },
    // Un « Annuler » raté doit se VOIR : `console.error` est supprimé du
    // bundle de production (vite.config.ts), l'échec serait donc muet.
    onError: (error: Error) => reportRestoreFailure('comment', error),
  });
};
