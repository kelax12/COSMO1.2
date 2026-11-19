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
// inchangée) ; chaque autre langue n'apporte qu'un overlay partiel, keyé par
// id et rangé sous sa locale (`{ en: … }`), dans le même esprit que les catalogues i18n (fr = référence + repli,
// en = overrides). Un id absent de l'overlay retombe silencieusement sur le
// français plutôt que de planter — jamais vu en pratique (la table est tenue
// à jour manuellement à côté du seed), mais c'est le même choix de repli que
// `resolveMessage()` dans `src/i18n/catalog.ts`.
// ═══════════════════════════════════════════════════════════════════
import { localeStore } from '@/i18n/store';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';

/** Locales qui recouvrent le seed français : toutes sauf la référence. */
export type SeedOverlayLocale = Exclude<Locale, 'fr'>;

/**
 * Overlays d'un seed, un par locale traduite. Une locale absente (ou la
 * locale de référence) garde le français : ajouter une langue = ajouter une
 * clé ici, sans aucune condition chez l'appelant.
 */
export type SeedOverlays<O> = Readonly<Partial<Record<SeedOverlayLocale, O>>>;

/**
 * Overlay de la locale active, `null` si elle n'en a pas (le français, ou une
 * langue pas encore traduite) : l'appelant garde alors le seed tel quel.
 */
export function seedOverlay<O>(overlays: SeedOverlays<O>): O | null {
  const locale = localeStore.locale;
  // Littéral `'fr'` et non `DEFAULT_LOCALE` : c'est lui qui rétrécit le type
  // vers `SeedOverlayLocale`, sans transtypage.
  if (locale === 'fr') return null;
  return overlays[locale] ?? null;
}

/** Un libellé de seed : le français fait foi, chaque autre langue est facultative. */
export type SeedText = Readonly<{ fr: string } & Partial<Record<SeedOverlayLocale, string>>>;

/** Libellé de seed dans la locale active, repli sur le français. */
export function seedText(text: SeedText): string {
  return seedOverlay<string>(text) ?? text.fr;
}

/**
 * Langue dans laquelle les données de démo ont été semées.
 *
 * Le seed n'est écrit qu'UNE fois, dans la langue active à cet instant, puis
 * relu tel quel — c'est nécessaire, ces données sont modifiables (renommer un
 * projet doit tenir). Conséquence : changer de langue après coup laissait une
 * interface traduite par-dessus un contenu resté dans l'ancienne langue.
 * Exemple : navigateur français → `/` sème en français,
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
  let stored: string | null;
  try {
    stored = localStorage.getItem(DEMO_SEED_LOCALE_KEY);
  } catch {
    return true; // localStorage illisible : rien à régénérer, on ne casse rien.
  }
  const seeded: Locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  return seeded === localeStore.locale;
}

/**
 * Applique l'overlay de la locale active, par id, sur un tableau seedé
 * français. Sans overlay pour cette locale, rend une copie inchangée.
 *
 * `pick` extrait du `Partial<T>` de l'overlay les seuls champs à réellement
 * fusionner — nécessaire quand l'overlay ne porte qu'un sous-ensemble des
 * clés de `T` (ex. `{ title }` pour un Habit dont le champ est `name`).
 */
export function localizeSeed<T extends { id: string }>(
  items: readonly T[],
  overlays: SeedOverlays<Readonly<Record<string, Partial<T>>>>
): T[] {
  const overlay = seedOverlay(overlays);
  if (!overlay) return [...items];
  return items.map((item) => {
    const patch = overlay[item.id];
    return patch ? { ...item, ...patch } : item;
  });
}
