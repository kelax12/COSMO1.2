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

// ═══════════════════════════════════════════════════════════════════
// ÉCRITURE — le silence n'est PAS toujours le bon comportement (C-46)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 L'écriture n'est pas du câblage, contrairement à la lecture.
//
// `safeSetItem` avale l'échec. Pour une préférence d'affichage c'est le bon
// comportement : rien n'est perdu que l'utilisateur ait produit. Pour une
// donnée qu'il vient de CRÉER — une tâche, un objectif, une progression de
// KR — c'est une perte sans signal : l'écran affiche la ligne (le cache React
// Query l'a), le rechargement suivant ne la retrouve pas, et rien n'a jamais
// dit qu'elle n'avait pas été enregistrée.
//
// MESURÉ (audit A-2) : une saisie de progression de KR en mode démo a fait
// remonter un `QuotaExceededError` des 5 Mo directement depuis le repository.
// Câbler `safeSetItem` partout aurait fait disparaître ce signal.
//
// Les écritures des dépôts de démo se classent donc en DEUX familles :
//
//   • le SEED (`readOrSeed` : on vient de cloner un jeu de démonstration) →
//     `safeSetItem`. L'écriture ratée n'a rien coûté, l'appelant a déjà son
//     clone en mémoire et la prochaine lecture re-sèmera.
//   • la PERSISTANCE d'une donnée de l'utilisateur → `writeJsonOrThrow`, qui
//     LÈVE. La mutation React Query remonte alors dans son `onError`, et la
//     personne voit un message au lieu de croire son travail enregistré.

import { makeApiError } from './normalizeApiError';

/** Reconnaît un dépassement de quota, quel que soit le navigateur. */
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  // Chrome/Firefox nomment ; Safari ne renseigne que `code` (22), et Firefox
  // en navigation privée renvoie 1014 sous un autre nom.
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

/**
 * Écrit une valeur JSON dans `localStorage`, ou LÈVE une `ApiError` dont le
 * message vient du catalogue.
 *
 * ❌ Ne jamais remplacer par `safeSetItem` « pour ne plus voir d'erreur » :
 *    l'erreur est le seul signal que la donnée n'a pas été enregistrée.
 */
export function writeJsonOrThrow(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Le texte vient du catalogue, jamais du moteur JS : c'est ce message qui
    // sera interpolé dans le toast `mutation.*` de l'appelant (cf. C-62).
    throw makeApiError(
      isQuotaError(err) ? 'storage_full' : 'storage_unavailable',
      err instanceof Error ? err.message : String(err),
    );
  }
}

