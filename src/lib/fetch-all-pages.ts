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

/**
 * Page rendue par un lecteur à curseur : les lignes, et le curseur de la
 * suivante (`null` = c'était la dernière).
 */
export interface CursorPage<T, C> {
  rows: T[];
  next: C | null;
}

/**
 * Enchaîne des pages de CLÉ (keyset) jusqu'à la dernière, SANS plafond.
 *
 * V14.1 (PER-01) : c'est la lecture des sous-ensembles bornés par nature (le
 * travail en cours, une fenêtre de dates, les tâches d'une catégorie). Elle ne
 * tronque jamais : un plafond y referait exactement le défaut que l'audit a
 * relevé, des lignes absentes de l'écran sans que rien ne le dise.
 *
 * Garde-fou contre une boucle infinie : un serveur qui rendrait deux fois le
 * même curseur lève au lieu de tourner.
 */
export async function fetchAllByCursor<T, C>(
  fetchPage: (cursor: C | null) => Promise<CursorPage<T, C>>,
  sameCursor: (a: C, b: C) => boolean,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: C | null = null;
  for (;;) {
    const page: CursorPage<T, C> = await fetchPage(cursor);
    all.push(...page.rows);
    if (page.next === null) return all;
    if (cursor !== null && sameCursor(cursor, page.next)) {
      throw new Error('fetchAllByCursor: cursor did not advance');
    }
    cursor = page.next;
  }
}

/**
 * ⚠️ PLAFONNÉ à `MAX_ROWS`. Ne sert plus qu'aux lectures pas encore converties
 * (habitudes, OKR, journal des KR, OKR d'équipe, `useEvents()` complet) : la
 * liste nominative et la raison de chacune vivent dans
 * `docs/PERFORMANCE.md` § « Lectures complètes restantes ». Toute nouvelle
 * lecture passe par `fetchAllByCursor` ou par une page.
 */
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
