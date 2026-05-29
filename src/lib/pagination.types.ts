// ═══════════════════════════════════════════════════════════════════
// Pagination — Types partagés entre tous les modules
// ═══════════════════════════════════════════════════════════════════

/**
 * Paramètres d'entrée pour une requête paginée
 */
export interface PaginationParams {
  limit?: number;         // Nombre d'éléments par page (défaut : 50)
  cursor?: string;        // ID du dernier élément vu (pour la page suivante)
  cursorDate?: string;    // created_at du dernier élément vu (pour le tri)
}

/**
 * Résultat d'une requête paginée
 */
export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;    // null = plus de données
  nextCursorDate: string | null;
  hasMore: boolean;
  total?: number;               // optionnel, coûteux à calculer
}

export const DEFAULT_PAGE_SIZE = 50;

// Validate cursor params before template-interpolating them into PostgREST
// `.or()` filters. Comma/paren/operator injection would otherwise let a
// caller (URL search param, persisted state) bypass the cursor cutoff or
// perturb the query. Faille N6 — appliqué à tasks/habits/events/okrs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

export function assertValidCursor(cursor: string, cursorDate: string): void {
  if (!UUID_RE.test(cursor) || !ISO_RE.test(cursorDate)) {
    throw new Error('Invalid pagination cursor');
  }
}
