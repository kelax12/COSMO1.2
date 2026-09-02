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
