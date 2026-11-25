// Extrait de src/modules/okrs/hooks.ts le 2026-11-25 : hooks sans ecran (orphan-hooks.guard).
// Non compile : les imports d'origine sont dans src/modules/okrs/hooks.ts.

/**
 * OKR actifs / terminés, DÉRIVÉS de `useOkrs()`, jamais refetchés.
 *
 * ❌ Ne pas les rebrancher sur `useFilteredOkrs`. Une clé React Query
 * différente = une requête réseau de plus, et le repository Supabase enchaîne
 * ensuite un second appel à `key_results` pour hydrater les OKR lus : deux
 * requêtes, pas une. `useWeeklyCheckin()` est monté par le tableau de bord à
 * CHAQUE ouverture, et ne s'en sert que pour tester `length > 0` un lundi ou
 * un mardi. Ces deux requêtes partaient donc tous les jours pour rien
 * (mesuré : 32 requêtes à l'ouverture, dont celles-ci).
 *
 * `completed` est une colonne déjà présente sur chaque OKR chargé : le filtre
 * se fait en mémoire, sur une liste qui tient en dizaines d'éléments.
 */
export const useActiveOkrs = () => {
  const { data, ...rest } = useOkrs();
  const filtered = useMemo(() => (data ?? []).filter((okr) => !okr.completed), [data]);
  return { ...rest, data: filtered };
};
