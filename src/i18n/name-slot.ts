// Découpe d'un message traduit autour d'une valeur mise en forme.
//
// Le cas : « Vous avez rejoint **Nova Studio** ! ». On veut le nom en gras,
// donc dans son propre élément — mais découper le message en fragments
// (« Vous avez rejoint » + nom + « ! ») le rend intraduisible : l'ordre des
// mots change d'une langue à l'autre, et un fragment isolé n'a pas de sens
// pour un traducteur.
//
// La phrase reste donc ENTIÈRE dans le catalogue, avec son `{{name}}` à la
// bonne place. On l'interpole avec un jeton, puis on coupe dessus : la partie
// avant et la partie après encadrent l'élément mis en forme, quelle que soit
// la position du nom dans la phrase.
//
// `interpolate()` ne fait qu'une seule passe, le jeton injecté n'est donc
// jamais réinterprété comme une variable.

/** Jeton injecté à la place de la valeur, puis utilisé comme point de coupe. */
export const NAME_SLOT = '{{__slot__}}';

/**
 * Coupe une phrase déjà interpolée avec `NAME_SLOT` en deux morceaux.
 *
 * ```tsx
 * const [before, after] = splitAroundName(t('claim.joined', { name: NAME_SLOT }));
 * return <p>{before}<strong>{org}</strong>{after}</p>;
 * ```
 *
 * Si le jeton est absent (clé manquante, message sans `{{name}}`), la phrase
 * entière est renvoyée en première position et la seconde est vide : on
 * affiche un texte cohérent plutôt qu'un trou.
 */
export function splitAroundName(sentence: string): [string, string] {
  const [before, after = ''] = sentence.split(NAME_SLOT);
  return [before, after];
}
