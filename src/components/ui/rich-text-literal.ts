/**
 * Neutralise le balisage d'une valeur SAISIE PAR UN UTILISATEUR avant de
 * l'interpoler dans une phrase passée à `RichText`.
 *
 * 🔴 POURQUOI (audit de sécurité du 2026-09-30). `RichText` interprète `[x](url)`
 * et `**x**` dans TOUTE la chaîne, interpolations comprises. Le nom d'une tâche
 * partagée s'affiche chez le destinataire d'un lien de partage
 * (`ShareInviteClaimer`) : une tâche nommée `[Réclamez votre prime](https://…)`
 * devenait un lien cliquable DANS l'interface COSMO, chez quelqu'un qui n'a
 * rien demandé. Les crochets et l'astérisque sont remplacés par leurs formes
 * pleine chasse, visuellement proches : le nom reste lisible, il ne se lit
 * plus comme du balisage.
 *
 * ❌ Toute valeur venue d'un utilisateur (nom, titre, e-mail) passe par ici
 * avant d'entrer dans une chaîne rendue par `RichText`.
 */
export const richTextLiteral = (value: string | null | undefined): string =>
  (value ?? '').replace(/\[/g, '［').replace(/\]/g, '］').replace(/\*/g, '∗');
