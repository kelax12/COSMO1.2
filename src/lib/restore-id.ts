// ═══════════════════════════════════════════════════════════════════
// RESTAURATION D'UN OBJET SUPPRIMÉ — « Annuler » doit rendre le MÊME objet
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02, risque R-08).
//
// Cinq chemins d'annulation faisaient exactement la même chose :
//
//     const { id: _id, ...rest } = snapshot;
//     createMutation.mutate(rest);
//
// L'objet revenait, mais sous un NOUVEL identifiant. Tout ce qui référençait
// l'ancien restait orphelin, en silence :
//
//   - catégorie : les tâches qui la portaient gardaient un identifiant mort.
//     Mesuré en production, 13 tâches sur 611 et 2 objectifs sur 14 étaient
//     déjà dans cet état ; « Annuler » donnait l'illusion d'avoir réparé (R-02).
//   - liste : le tri mémorisé par liste (`sortPrefs`) et la sélection courante
//     sont keyés par identifiant, donc perdus.
//   - événement : les liens `taskId` et l'auteur d'origine.
//   - OKR : les tâches qui portent un `krId` pointant sur un KR de cet OKR.
//   - tâche : ses rattachements aux listes et à un KR.
//
// ── POURQUOI UN SECOND ARGUMENT, ET PAS UN CHAMP `id` DANS L'INPUT ──
//
// La première version de ce correctif ajoutait un `id?` optionnel aux entrées
// de création. Le test de garde `supabase.repository.test.ts` l'a refusée, et
// il avait raison : ces entrées viennent d'un état de formulaire, donc d'un
// objet que des devtools peuvent enrichir. Accepter `id` y aurait ouvert un
// ORACLE D'EXISTENCE — forger l'identifiant d'une catégorie appartenant à
// quelqu'un d'autre fait répondre 23505 (collision de clé primaire) au lieu de
// réussir, ce qui révèle qu'elle existe. Aucune donnée ne fuit, mais la
// réponse du serveur cesse d'être indépendante des lignes des autres.
//
// L'identifiant de restauration passe donc par un SECOND ARGUMENT de
// `create()`, hors du payload : il n'est atteignable que par un appel écrit
// exprès, jamais par un objet qui traverse un formulaire.
//
//     repository.create(payload, { restoreId: snapshot.id })
//
// Côté React, seuls les hooks `useRestoreX` l'utilisent. Les `useCreateX`
// restent inchangés, et les whitelists `mapToDb` aussi : `user_id` continue
// d'être posé par le serveur depuis la session, jamais par le client.
//
// ❌ Ne JAMAIS étendre ce motif à `user_id`, `org_id` ou toute colonne qui
//    décide de QUI voit la ligne.
// ⚠️ N'utiliser `useRestoreX` QUE depuis un « Annuler ». Une création
//    ordinaire laisse la base choisir l'identifiant.
//
// ── CE QUE ÇA NE RATTRAPE PAS ──────────────────────────────────────
//
// Les lignes supprimées EN CASCADE ne reviennent pas pour autant.
// `kr_completions` cascade depuis `okrs` ET `key_results` (vérifié en
// production) : restaurer un OKR sous son identifiant d'origine ramène
// l'objectif, ses KR et les tâches qui les référencent, mais pas le journal
// des complétions, donc pas les points du graphique « KR réalisés ». Seule une
// suppression logique le permettrait. C'est documenté à l'appel concerné.

// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { toast } from 'sonner';
import { translator } from '@/i18n/useT';

/** Options de création. Le champ n'est renseigné que par une restauration. */
export interface CreateOptions {
  /**
   * Identifiant à imposer à la ligne créée.
   *
   * Présent → la ligne revient sous cet identifiant. Absent → la base en
   * choisit un, comportement normal de toute création.
   */
  restoreId?: string;
}

/**
 * Sépare l'identifiant du reste, pour un « Annuler ».
 *
 * Remplace le `const { id: _id, ...rest } = snapshot` que les cinq chemins
 * écrivaient : celui-ci JETAIT l'identifiant sans le dire, celui-là le rend
 * pour qu'on le repasse en second argument.
 */
export function splitRestore<T extends { id: string }>(
  snapshot: T,
): { payload: Omit<T, 'id'>; options: CreateOptions } {
  const { id, ...payload } = snapshot;
  return { payload, options: { restoreId: id } };
}

// ═══════════════════════════════════════════════════════════════════
// QUAND « ANNULER » ÉCHOUE
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02). Les cinq `useRestoreX` avaient tous le
// même `onError` :
//
//     onError: (error: Error) => { console.error('[useRestoreX]', error); }
//
// Or `console.error` est listé dans `esbuild.pure` (`vite.config.ts`) : l'appel
// est SUPPRIMÉ du bundle de production. En production, une restauration ratée
// ne produisait donc strictement rien — pas de toast, pas de log, pas de
// Sentry. L'utilisateur cliquait « Annuler », voyait le toast se fermer, et
// repartait en croyant son objet revenu. Il ne l'était pas.
//
// C'est le pire endroit du produit pour un échec muet : l'utilisateur vient
// justement de dire qu'il ne voulait PAS supprimer.
//
// ❌ Ne jamais confier un chemin d'erreur à `console.*` : la production le
//    supprime. Un toast pour la personne, Sentry pour nous.

/** Entité restaurable — sert à choisir le message et à étiqueter l'alerte. */
export type RestorableEntity = 'task' | 'category' | 'list' | 'event' | 'okr' | 'comment';

/** Clé de catalogue (namespace `errors`) par entité. */
const RESTORE_ERROR_KEYS = {
  task: 'mutation.restoreTask',
  category: 'mutation.restoreCategory',
  list: 'mutation.restoreList',
  event: 'mutation.restoreEvent',
  okr: 'mutation.restoreOkr',
  comment: 'mutation.restoreComment',
} as const satisfies Record<RestorableEntity, string>;

/**
 * `onError` partagé des cinq hooks de restauration : prévient la personne ET
 * l'équipe.
 *
 * Le message vient du catalogue, jamais d'une phrase en dur : c'est un toast,
 * donc de l'interface. `error.message` est celui d'`ApiError`, déjà résolu
 * depuis le catalogue et sûr à afficher (jamais le texte serveur, faille V7/N1).
 */
export function reportRestoreFailure(entity: RestorableEntity, error: Error): void {
  toast.error(
    translator('errors').t(RESTORE_ERROR_KEYS[entity], { message: error.message }),
  );
  monitoring.captureException(error, {
    level: 'error',
    tags: { context: 'restore-undo', restore_entity: entity },
  });
}
