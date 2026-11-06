// ═══════════════════════════════════════════════════════════════════
// L'environnement des Edge Functions : variables obligatoires et CORS
// ═══════════════════════════════════════════════════════════════════
//
// Le seul fichier que les `index.ts` importent pour l'un ou l'autre. La
// politique elle-même est dans `cors.ts`, pur et testé depuis `src/` ; ce
// fichier ne fait que la brancher sur `Deno.env`.
//
//   const APP_URL = requireEnv('APP_URL')       // lève si absente
//   const cors = corsHeadersFor(req)            // une seule politique
//
// 🔴 ÉCHEC FERMÉ. `requireEnv` lève au chargement du module : sans `APP_URL`,
// la fonction refuse de démarrer, et `npm run check:edge-smoke` le voit à la
// sonde suivante. C'est voulu. L'ancien `APP_URL ?? 'http://localhost:5173'`
// démarrait très bien, puis renvoyait les clients de Stripe vers localhost.
//
// `CORS_DEV_ORIGINS` (facultative, jamais posée en production) : liste
// d'origines locales séparées par des virgules, pour `supabase functions serve`.

import { allowedOrigins, corsHeaders, requireValue } from './cors.ts'

/** Une variable d'environnement obligatoire. Absente ou vide : on lève. */
export function requireEnv(name: string): string {
  return requireValue(name, Deno.env.get(name))
}

let origins: ReadonlySet<string> | null = null

/** Les en-têtes CORS de la réponse à `req`, selon la politique unique de `cors.ts`. */
export function corsHeadersFor(req: Request): Record<string, string> {
  origins ??= allowedOrigins(requireEnv('APP_URL'), Deno.env.get('CORS_DEV_ORIGINS'))
  return corsHeaders(req.headers.get('Origin'), origins)
}
