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
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';

/** `true` si le seed doit être produit en anglais. */
export function isEnglishSeed(): boolean {
  return localeStore.locale === 'en';
}

/**
 * Langue dans laquelle les données de démo ont été semées.
 *
 * Le seed n'est écrit qu'UNE fois, dans la langue active à cet instant, puis
 * relu tel quel — c'est nécessaire, ces données sont modifiables (renommer un
 * projet doit tenir). Conséquence : changer de langue après coup laissait une
 * interface traduite par-dessus un contenu resté dans l'ancienne langue.
 * Mesuré en prod le 2026-08-17 : navigateur français → `/` sème en français,
 * puis `/en` affiche « Projects » au-dessus de « Refonte du site ».
 *
 * On mémorise donc la langue du seed pour pouvoir le régénérer quand elle ne
 * correspond plus. Le préfixe `cosmo_demo_` est volontaire : `clearDemoStorage`
 * balaie la clé avec le reste du seed, et l'appelant la réécrit juste après.
 */
const DEMO_SEED_LOCALE_KEY = 'cosmo_demo_seed_locale';

/** Mémorise la langue du seed courant. Silencieux si localStorage est fermé. */
export function recordSeedLocale(): void {
  try {
    localStorage.setItem(DEMO_SEED_LOCALE_KEY, localeStore.locale);
  } catch {
    /* navigation privée stricte — le seed reste correct pour la session */
  }
}

/**
 * `true` si le seed en place est dans la langue active.
 *
 * Une clé absente vaut `DEFAULT_LOCALE` et non « inconnu » : les démos semées
 * avant l'introduction de cette clé l'ont été en français. Les traiter comme
 * une divergence effacerait la démo de tout visiteur francophone au premier
 * chargement suivant le déploiement, pour un contenu déjà correct.
 */
export function seedLocaleMatchesCurrent(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(DEMO_SEED_LOCALE_KEY);
  } catch {
    return true; // localStorage illisible : rien à régénérer, on ne casse rien.
  }
  const seeded: Locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  return seeded === localeStore.locale;
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
