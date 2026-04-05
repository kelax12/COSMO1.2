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
