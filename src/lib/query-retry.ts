// ═══════════════════════════════════════════════════════════════════
// FAUT-IL RETENTER CETTE REQUÊTE ? — prédicat `retry` de React Query
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE MODULE EXISTE (revue du 2026-09-02).
//
// Le prédicat vivait en ligne dans `src/App.tsx`, il n'était donc testable par
// rien, et il était FAUX de deux façons qui s'additionnaient :
//
//     const msg = error instanceof Error ? error.message : '';
//     if (msg.includes('PGRST') || msg.includes('row-level security')) return false;
//
//   1. `error instanceof Error` était faux pour TOUTES les erreurs de
//      repository : `normalizeApiError` rendait un objet littéral (corrigé le
//      même jour). `msg` valait donc systématiquement la chaîne vide.
//   2. Même corrigé, le test portait sur le MESSAGE — or le message d'une
//      `ApiError` vient du catalogue i18n, il est générique et traduit. Le
//      code, lui, vit dans `.code`. La garde n'aurait jamais pu matcher, même
//      avec une vraie `Error`.
//
// Résultat : chaque refus RLS définitif était retenté une fois, doublant les
// requêtes perdues, exactement ce que le commentaire d'origine disait vouloir
// éviter.
//
// ── LA RÈGLE ───────────────────────────────────────────────────────
//
// On retente UNE fois, et seulement quand on ne sait pas ce qui a échoué.
//
//   • Le serveur a NOMMÉ l'échec (`42501`, `PGRST116`, `seat_limit_reached`…) :
//     le rejouer produira exactement le même nom. On abandonne tout de suite.
//   • Dépassement de délai : on abandonne aussi, et c'est le contraire d'un
//     détail. Sur Safari mobile, la première connexion à froid dépasse
//     régulièrement notre délai de 8 s ; un retour aveugle enchaîne
//     8 s + 1 s + 8 s ≈ 17 s avant d'afficher quoi que ce soit, ce que
//     l'utilisateur lit comme « vingt secondes de chargement ». Le cache
//     localStorage (AuthContext) rend l'ouverture suivante instantanée, et
//     `visibilitychange → refetchQueries` (mobileFocus) rattrape l'état périmé
//     sans faire attendre personne.
//   • Réseau perdu ou cause inconnue : là, un second essai a un sens.
//
// ❌ Ne jamais identifier une erreur par une SOUS-CHAÎNE de son message : il
//    est traduit. C'est la règle du dépôt, et c'est ce bug-ci.

import { isTimeoutError } from './withTimeout';

/**
 * Les deux seuls codes qui veulent dire « on ne sait pas ».
 *
 * Tout le reste est un refus nommé par le serveur, donc reproductible.
 */
const RETRYABLE_CODES: ReadonlySet<string> = new Set(['NETWORK_ERROR', 'GENERIC_ERROR']);

/**
 * Code d'erreur porté par la valeur lancée, s'il y en a un.
 *
 * Couvre `ApiError` (le cas normal) MAIS AUSSI une `PostgrestError` brute :
 * quelques chemins lancent encore l'erreur Supabase sans la normaliser, et
 * eux aussi méritent d'être reconnus comme définitifs.
 */
export function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code !== '' ? code : null;
}

/** Le serveur a-t-il nommé cet échec ? Alors le rejouer ne changera rien. */
export function isDefinitiveError(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && !RETRYABLE_CODES.has(code);
}

/**
 * Prédicat `retry` de React Query. Un seul nouvel essai, et seulement quand la
 * cause est inconnue.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (isTimeoutError(error)) return false;
  return !isDefinitiveError(error);
}
