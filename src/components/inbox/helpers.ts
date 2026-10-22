/**
 * Nom lisible tiré d'une adresse, quand le compte n'a pas encore de nom
 * (`prenom.nom@…` → « Prenom Nom »).
 *
 * Dans son propre fichier plutôt que dans le composant qui l'utilise : un
 * module qui exporte autre chose qu'un composant casse le rafraîchissement à
 * chaud de tout le fichier.
 */
export const prettyName = (email?: string) =>
  email
    ?.split('@')[0]
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ') ?? email;
