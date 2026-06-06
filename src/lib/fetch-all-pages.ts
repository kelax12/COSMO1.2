// ═══════════════════════════════════════════════════════════════════
// fetchAllPages — récupère TOUTES les lignes d'un getAll() en paginant
// ═══════════════════════════════════════════════════════════════════
//
// Remplace le `.limit(500)` sec (qui tronquait silencieusement les données
// d'un power-user au-delà de 500 items) par une boucle de pages :
//   - tant qu'une page est pleine, on demande la suivante (`.range(from,to)`)
//   - on s'arrête à la première page incomplète (= dernière page)
//   - un plafond dur `maxRows` borne le pire cas (compte pathologique)
//
// Coût : pour ≤ `pageSize` lignes, UNE seule requête (comme avant). Une 2ᵉ
// requête n'arrive que si l'utilisateur dépasse `pageSize`. Le filtrage UI
// reste 100 % côté client (smart-lists, « Aujourd'hui », filtres) — il a
// juste désormais le jeu de données complet à filtrer.
//
// `fetchPage(from, to)` doit renvoyer les lignes de l'intervalle inclusif
// [from, to] et **lever** en cas d'erreur (cohérent avec normalizeApiError).

export type PageFetcher<T> = (from: number, to: number) => Promise<T[]>;

export const PAGE_SIZE = 1000;
export const MAX_ROWS = 5000;

export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  pageSize: number = PAGE_SIZE,
  maxRows: number = MAX_ROWS,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1;
    const rows = await fetchPage(from, to);
    all.push(...rows);
    // Page incomplète → c'était la dernière. Évite une requête vide de plus.
    if (rows.length < to - from + 1) break;
  }
  return all;
}
