// ═══════════════════════════════════════════════════════════════════
// LECTURE DE localStorage QUI NE FAIT JAMAIS TOMBER UN ÉCRAN (règle B14)
// ═══════════════════════════════════════════════════════════════════
//
// `JSON.parse(localStorage.getItem(...))` lève sur deux choses distinctes, et
// les deux arrivent en vrai :
//   - une valeur CORROMPUE (écriture interrompue, extension, ancien format) ;
//   - `localStorage` lui-même qui jette (Safari privé, cookies bloqués,
//     webview) — là c'est `getItem` qui lève, avant même le parse.
//
// Un dépôt de démo qui lève dans son lecteur fait tomber la page entière :
// c'est une donnée d'AGRÉMENT qui casse le produit. On retombe donc sur une
// valeur par défaut, et le mode démo se re-sème tout seul.
//
// ❌ Ne jamais écrire `JSON.parse(localStorage.getItem(k))` en direct.
//    CLAUDE.md cite cette règle depuis longtemps ; le helper qu'elle nommait
//    n'existait plus dans le dépôt (revue du 2026-09-02, point 15).

/** Lit une clé de `localStorage`. `null` si le stockage est indisponible. */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Écrit une clé de `localStorage`. Silencieuse si le stockage est plein/bloqué. */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota dépassé ou stockage indisponible : rien à rattraper ici */
  }
}

/**
 * Parse une valeur JSON, `null` si elle est absente ou illisible.
 *
 * Rend `null` plutôt que de lever : l'appelant décide s'il re-sème, retombe
 * sur un tableau vide, ou remonte l'incident.
 */
export function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Idem, borné aux tableaux : tout ce qui n'est pas un tableau rend `null`. */
export function safeParseArray<T>(raw: string | null | undefined): T[] | null {
  const parsed = safeParse<unknown>(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : null;
}

/** Lit + parse une clé de `localStorage` en une fois. */
export function readJson<T>(key: string): T | null {
  return safeParse<T>(safeGetItem(key));
}

/** Lit + parse un TABLEAU depuis `localStorage`. */
export function readJsonArray<T>(key: string): T[] | null {
  return safeParseArray<T>(safeGetItem(key));
}
