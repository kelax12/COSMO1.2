// ═══════════════════════════════════════════════════════════════════
// FILTRE `.in('id', ids)` DÉCOUPÉ EN LOTS
// ═══════════════════════════════════════════════════════════════════
//
// PostgREST reçoit ses filtres dans l'URL. Un `.in('id', ids)` sur 500 UUID
// produit une query string d'environ 19 ko : bien au-delà des ~8 ko qu'acceptent
// les intermédiaires HTTP usuels, donc un **414 URI Too Long** — et il tombe
// AVANT que la troncature de la lecture précédente ne devienne visible, ce qui
// le rend illisible depuis le symptôme (revue du 2026-09-02, point 14).
//
// Mesuré : un UUID coûte 36 caractères, plus la virgule encodée `%2C` (3), soit
// ~39 octets par identifiant. 100 par lot ≈ 3,9 ko d'URL, avec de la marge.
//
// ❌ Ne jamais enchaîner un `.in()` sur une liste dont la taille vient d'une
//    lecture bornée : la borne de la lecture devient la taille de l'URL.

/** Taille d'un lot. 100 UUID ≈ 3,9 ko d'URL, sous toutes les limites usuelles. */
export const IN_FILTER_CHUNK_SIZE = 100;

/** Découpe une liste en lots de `size`. */
export function chunk<T>(items: readonly T[], size: number = IN_FILTER_CHUNK_SIZE): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Exécute `fetchChunk` sur chaque lot d'identifiants et concatène les résultats.
 *
 * Les lots partent EN PARALLÈLE : la découpe ne doit pas transformer une
 * requête en file d'attente. Une liste vide ne déclenche aucune requête.
 */
export async function fetchInChunks<Id, Row>(
  ids: readonly Id[],
  fetchChunk: (chunkIds: Id[]) => Promise<Row[]>,
  size: number = IN_FILTER_CHUNK_SIZE,
): Promise<Row[]> {
  if (ids.length === 0) return [];
  const batches = await Promise.all(chunk(ids, size).map(fetchChunk));
  return batches.flat();
}
