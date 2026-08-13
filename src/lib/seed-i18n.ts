// ═══════════════════════════════════════════════════════════════════
// seed-i18n — localisation du contenu de démo (tâches/habitudes/agenda/OKR/
// catégories/amis), qui n'a JAMAIS transité par le catalogue i18n : c'est de
// la donnée seedée en localStorage, pas de la copie UI.
//
// Un visiteur anglophone qui clique « Try the demo » depuis /en/ voyait le
// chrome de l'app en anglais mais des tâches, habitudes et événements en
// français — incompréhensible pour lui.
//
// Le français reste la table CANONIQUE de chaque module (id → objet complet,
// inchangée) ; ce module ne fournit qu'un overlay anglais partiel, keyé par
// id, dans le même esprit que les catalogues i18n (fr = référence + repli,
// en = overrides). Un id absent de l'overlay retombe silencieusement sur le
// français plutôt que de planter — jamais vu en pratique (la table est tenue
// à jour manuellement à côté du seed), mais c'est le même choix de repli que
// `resolveMessage()` dans `src/i18n/catalog.ts`.
// ═══════════════════════════════════════════════════════════════════
import { localeStore } from '@/i18n/store';

/** `true` si le seed doit être produit en anglais. */
export function isEnglishSeed(): boolean {
  return localeStore.locale === 'en';
}

/**
 * Applique un overlay anglais par id sur un tableau seedé français.
 *
 * `pick` extrait du `Partial<T>` de l'overlay les seuls champs à réellement
 * fusionner — nécessaire quand l'overlay ne porte qu'un sous-ensemble des
 * clés de `T` (ex. `{ title }` pour un Habit dont le champ est `name`).
 */
export function localizeSeed<T extends { id: string }>(
  items: readonly T[],
  overlay: Readonly<Record<string, Partial<T>>>
): T[] {
  if (!isEnglishSeed()) return [...items];
  return items.map((item) => {
    const patch = overlay[item.id];
    return patch ? { ...item, ...patch } : item;
  });
}
