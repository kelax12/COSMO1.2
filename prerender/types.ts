// Types partagés du prérendu, et l'unique helper `requis`. Les types sont effacés
// à l'exécution par Node (suppression native des types) : pas d'enum, pas de
// namespace, pas de propriété de paramètre, rien qui demande une transformation.
import type { Locale } from '@/i18n/locale';

/** `{ locale → HTML indexable }`. Une locale absente n'est pas publiée. */
export type LocaleContent = Partial<Record<Locale, string>>;

export interface SeoMeta {
  title: string;
  description: string;
}

/** `{ locale → { title, description } }`. */
export type LocaleMeta = Partial<Record<Locale, SeoMeta>>;

/** Un bloc JSON-LD propre à une route, avec l'`id` de sa balise `<script>`. */
export interface LdEntry {
  obj: Record<string, unknown>;
  id?: string;
}

/**
 * Une route publique, décrite par son chemin FRANÇAIS canonique : les autres
 * langues en dérivent par `localizePath`, il n'y a jamais deux tables de
 * chemins à tenir synchronisées.
 */
export interface Route {
  path: string;
  /** Page de contenu dont le rendu React est peint avant React (cf. copies.ts). */
  copy?: string;
  /** Parcours de landing dont la capture du hero est peinte avant React. */
  heroTrack?: 'perso' | 'entreprise';
  meta: LocaleMeta;
  content: LocaleContent;
  extraLd?: (locale: Locale) => LdEntry[];
}

/** Valeur d'une locale, ou une erreur NOMMÉE : un `undefined` ne se glisse pas dans une page. */
export function requis<T>(valeur: T | undefined | null, quoi: string): T {
  if (valeur === undefined || valeur === null) throw new Error(`prerender: ${quoi} introuvable`);
  return valeur;
}
