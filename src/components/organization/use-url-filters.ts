// Filtres d'un écran portés par l'URL (recommandation « vues enregistrées »).
//
// Un filtre qui vit dans un `useState` se perd au rechargement, ne se partage
// pas et ne se nomme pas. Dans l'URL, il survit à tout cela, et une vue
// enregistrée n'est plus qu'un jeu de paramètres qu'on réécrit.
//
// 🔴 L'URL est une entrée NON FIABLE : chaque valeur passe par son `parse`,
// qui rend le défaut pour tout ce qu'il ne reconnaît pas. Une valeur égale au
// défaut n'est jamais écrite, pour que l'adresse d'un écran « neuf » reste nue.

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export interface UrlFilterSpec<T> {
  /** Nom du paramètre d'URL. */
  param: string;
  defaultValue: T;
  /** Valeur lue → valeur typée, ou `defaultValue` si elle n'est pas reconnue. */
  parse(raw: string): T;
  /** Valeur typée → texte d'URL. Défaut : `String(value)`. */
  serialize?(value: T): string;
}

type Specs = Record<string, UrlFilterSpec<unknown>>;
type ValuesOf<S extends Specs> = { [K in keyof S]: S[K] extends UrlFilterSpec<infer T> ? T : never };

export function useUrlFilters<S extends Specs>(specs: S) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(specs)) {
      const raw = searchParams.get(spec.param);
      out[key] = raw === null ? spec.defaultValue : spec.parse(raw);
    }
    return out as ValuesOf<S>;
  }, [searchParams, specs]);

  const serialize = (spec: UrlFilterSpec<unknown>, value: unknown) =>
    spec.serialize ? spec.serialize(value) : String(value ?? '');

  /** Change un ou plusieurs filtres, sans empiler d'entrée d'historique. */
  const setFilters = useCallback((patch: Partial<ValuesOf<S>>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        const spec = specs[key];
        if (!spec) continue;
        const text = serialize(spec, value);
        if (value === spec.defaultValue || text === '' || text === serialize(spec, spec.defaultValue)) next.delete(spec.param);
        else next.set(spec.param, text);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, specs]);

  /** Les filtres qui s'écartent du défaut, tels qu'écrits dans l'URL : le contenu d'une vue. */
  const currentParams = useMemo(() => {
    const out: Record<string, string> = {};
    for (const spec of Object.values(specs)) {
      const raw = searchParams.get(spec.param);
      if (raw !== null && raw !== '') out[spec.param] = raw;
    }
    return out;
  }, [searchParams, specs]);

  /**
   * Remplace TOUS les filtres de l'écran par ceux d'une vue. Les paramètres
   * étrangers à l'écran (`project`, `task`…) sont laissés tels quels, et ceux
   * qu'une vue apporterait sans que l'écran les connaisse sont ignorés.
   */
  const applyParams = useCallback((params: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const spec of Object.values(specs)) {
        const value = params[spec.param];
        if (value) next.set(spec.param, value);
        else next.delete(spec.param);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, specs]);

  return { values, setFilters, currentParams, applyParams };
}

/** Fabrique de `parse` pour une énumération : toute valeur hors liste rend le défaut. */
export const oneOf = <T extends string>(allowed: readonly T[], fallback: T) =>
  (raw: string): T => ((allowed as readonly string[]).includes(raw) ? (raw as T) : fallback);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Identifiant d'entité (UUID Supabase, id de démo) ; sinon le défaut. */
export const anId = (fallback: string | null = null) =>
  (raw: string): string | null => (ID_RE.test(raw) ? raw : fallback);

/** Texte libre, borné. */
export const aText = (max = 100) => (raw: string): string => raw.slice(0, max);
