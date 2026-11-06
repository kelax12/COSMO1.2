// ═══════════════════════════════════════════════════════════════════
// La politique CORS des Edge Functions appelées du navigateur (COD-03, SEC-09)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Jusqu'au 2026-11-06, chaque fonction recopiait son propre `corsHeadersFor`,
// avec trois politiques différentes : `APP_URL` seule ; `APP_URL` plus
// `localhost:5173` et `localhost:3000` EN PRODUCTION (`report-bug`,
// `send-org-invite`, `verify-org-domain`) ; et une valeur par défaut
// `APP_URL ?? 'http://localhost:5173'` dans huit fonctions, qui faisait d'une
// variable absente une redirection Stripe vers localhost au lieu d'un échec.
//
// Une seule politique, ici :
//   - l'origine de production, dérivée d'`APP_URL`, OBLIGATOIRE ;
//   - une origine locale SEULEMENT si `CORS_DEV_ORIGINS` est posée, et
//     seulement une origine de boucle locale (`http://localhost:<port>`,
//     `http://127.0.0.1:<port>`) : la variable ne peut pas ouvrir la porte à
//     un site tiers, même posée par erreur en production.
//
// ⚠️ Module TS PUR, sans API Deno : un test de `src/` l'importe, et `tsc -b`
// le vérifie à travers cet import. La lecture de l'environnement vit dans
// `env.ts`, qui est le seul fichier que les fonctions importent.
//
// ❌ Ne jamais réécrire un `corsHeadersFor` dans un `index.ts`, ni une valeur
//    par défaut `localhost` : `src/edge-cors.guard.test.ts` les refuse.

/** Les en-têtes que le client Supabase envoie à une Edge Function. */
export const CORS_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'

/** Une origine de boucle locale, et rien d'autre : schéma http, port explicite. */
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/

/**
 * Une valeur de configuration obligatoire : absente ou vide, on LÈVE.
 *
 * Pas de valeur par défaut, jamais : une variable manquante doit se voir comme
 * une fonction qui refuse de démarrer, pas comme une fonction qui marche vers
 * le mauvais endroit.
 */
export function requireValue(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`variable d'environnement obligatoire absente : ${name}`)
  }
  return value.trim()
}

/**
 * L'ensemble des origines autorisées.
 *
 * `appUrl` est réduite à son origine (`https://thecosmo.app/` et
 * `https://thecosmo.app` donnent la même) ; une valeur qui n'est pas une URL
 * lève. Une entrée de `devOrigins` qui n'est pas une origine de boucle locale
 * lève aussi : une variable de développement mal écrite est une erreur de
 * configuration, pas une origine de plus.
 */
export function allowedOrigins(appUrl: string, devOrigins?: string): ReadonlySet<string> {
  const origins = new Set<string>([new URL(appUrl).origin])
  for (const raw of (devOrigins ?? '').split(',')) {
    const origin = raw.trim()
    if (origin === '') continue
    if (!LOOPBACK_ORIGIN.test(origin)) {
      throw new Error(`CORS_DEV_ORIGINS n'accepte que des origines locales (http://localhost:<port>), pas ${origin}`)
    }
    origins.add(origin)
  }
  return origins
}

/**
 * Les en-têtes CORS d'une réponse.
 *
 * L'origine n'est renvoyée que si elle est dans l'allowlist : jamais le joker,
 * qui amplifierait la portée d'un JWT qui fuit (rejeu depuis n'importe quelle
 * origine, faille N7). `Vary: Origin` empêche un cache intermédiaire de servir
 * à une origine la réponse calculée pour une autre.
 */
export function corsHeaders(origin: string | null, allowed: ReadonlySet<string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Vary': 'Origin',
  }
  if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}
