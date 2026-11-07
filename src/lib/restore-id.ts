// ═══════════════════════════════════════════════════════════════════
// RESTAURATION D'UN OBJET SUPPRIMÉ — « Annuler » doit rendre le MÊME objet
// ═══════════════════════════════════════════════════════════════════
//
// Pourquoi : une annulation qui recréait l'objet sous un NOUVEL identifiant
// laissait orphelin tout ce qui référençait l'ancien (tâches d'une catégorie,
// tri mémorisé d'une liste, liens `taskId` d'un événement, `krId` d'un OKR,
// rattachements d'une tâche).
//
// Pourquoi un SECOND ARGUMENT et pas un champ `id` dans l'input : ces entrées
// viennent d'un état de formulaire, enrichissable par des devtools. Accepter
// `id` y ouvrirait un ORACLE D'EXISTENCE (forger l'identifiant d'une ligne
// d'autrui ferait répondre 23505 au lieu de réussir). L'identifiant de
// restauration passe donc hors du payload, atteignable par un appel écrit exprès :
//
//     repository.create(payload, { restoreId: snapshot.id })
//
// Seuls les hooks `useRestoreX` l'utilisent ; `user_id` reste posé par le
// serveur depuis la session.
//
// ❌ Ne JAMAIS étendre ce motif à `user_id`, `org_id` ou toute colonne qui
//    décide de QUI voit la ligne.
// ⚠️ N'utiliser `useRestoreX` QUE depuis un « Annuler ».
// ⚠️ Les lignes supprimées EN CASCADE ne reviennent pas : restaurer un OKR
// ramène l'objectif, ses KR et leurs tâches, mais pas `kr_completions` (donc pas
// les points du graphique « KR réalisés »). Seule une suppression logique le
// permettrait.

// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { toast } from '@/lib/toast';
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
// Les `useRestoreX` n'avaient qu'un `onError` en `console.error`, supprimé du
// bundle de production (`esbuild.pure` dans `vite.config.ts`) : une restauration
// ratée ne produisait ni toast, ni log, ni Sentry, au pire endroit pour un
// échec muet (la personne vient de dire qu'elle ne voulait PAS supprimer).
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
