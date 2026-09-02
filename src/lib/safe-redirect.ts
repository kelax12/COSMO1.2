// ═══════════════════════════════════════════════════════════════════
// REDIRECTION DE RETOUR APRÈS AUTHENTIFICATION — `?redirect=`
// ═══════════════════════════════════════════════════════════════════
//
// `ClaimOrgInvitePage` envoie vers `/login?redirect=/org-invite/<token>` pour
// qu'on revienne consommer l'invitation une fois connecté. Personne ne lisait
// ce paramètre : on atterrissait sur `/dashboard`, le jeton d'invitation étant
// à usage unique et non consommé, il fallait retrouver l'e-mail d'origine
// (risque R-04).
//
// 🔴 En le lisant, on ouvre une surface classique : la REDIRECTION SORTANTE.
// `?redirect=https://evil.example` transformerait la page de connexion du
// produit en tremplin d'hameçonnage, avec l'URL de COSMO dans la barre
// d'adresse au moment où la personne saisit son mot de passe.
//
// La garde est donc une ALLOWLIST DE FORME, pas une liste de domaines : on
// n'accepte qu'un chemin interne, et on refuse tout ce qui pourrait sortir de
// l'origine ou tromper l'analyseur d'URL du navigateur.
//
// ❌ Ne jamais « assouplir » cette fonction pour faire passer un cas
//    particulier : la seule raison d'être d'un `?redirect=` non validé est
//    l'hameçonnage.

/** Destination à utiliser quand aucun retour valide n'est demandé. */
export const DEFAULT_POST_AUTH_ROUTE = '/dashboard';

/** Un caractère de contrôle sert à couper l'analyse d'URL : on refuse en bloc. */
function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Rend le chemin de retour s'il est sûr, `null` sinon.
 *
 * Sont refusés :
 *   - tout ce qui ne commence pas par `/` (URL absolue, chemin relatif) ;
 *   - `//evil.example` et `/\evil.example`, que les navigateurs résolvent comme
 *     des URL protocol-relative, donc externes ;
 *   - `/%2f...` et les doubles encodages qui redeviennent `//` une fois décodés ;
 *   - un schéma glissé dans le premier segment (`/javascript:alert(1)`) ;
 *   - les caractères de contrôle, retours à la ligne compris.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw;
  // Une valeur issue de `URLSearchParams` est déjà décodée une fois ; on tente
  // un second décodage pour attraper les doubles encodages (`%252f`).
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) value = decoded;
  } catch {
    // Séquence d'échappement invalide : entrée volontairement malformée.
    return null;
  }

  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.slice(0, 4).toLowerCase() === '/%2f') return null;
  if (hasControlCharacter(value)) return null;
  if (/^\/[^/?#]*:/.test(value)) return null;

  return value;
}

/** Chemin de retour demandé, ou `/dashboard` à défaut. */
export function postAuthRoute(
  raw: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_ROUTE,
): string {
  return safeRedirectPath(raw) ?? fallback;
}
