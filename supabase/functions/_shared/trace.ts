// ═══════════════════════════════════════════════════════════════════
// Traçage Sentry des Edge Functions : l'unique import des fonctions (OBS-02)
// ═══════════════════════════════════════════════════════════════════
//
//   import { withTrace } from '../_shared/trace.ts'
//   Deno.serve(withTrace('stripe-org-portal', async (req) => { … }))
//
// 🔴 POURQUOI. Les Edge Functions n'avaient aucune mesure : une facturation
// lente ou une exception levée hors de tout `try` n'arrivait nulle part. Le
// front avait Sentry, le serveur non (audit du 2026-11-06, OBS-02).
//
// ── UN SECRET, ET SON ABSENCE N'EST PAS UNE PANNE ───────────────────
//
//   supabase secrets set SENTRY_DSN_EDGE=https://…@o….ingest.de.sentry.io/…
//
// Absent ou vide : `withTrace` rend le gestionnaire TEL QUEL, le SDK n'est
// même pas téléchargé (import dynamique), la fonction démarre et répond comme
// avant. C'est de l'OBSERVABILITÉ, pas une garde : la règle « jamais une garde
// conditionnelle à son secret » (supabase/functions/CLAUDE.md) vise ce qui
// PROTÈGE, et rien ici ne protège. Un DSN absent se voit autrement : la
// ligne `SENTRY_DSN_EDGE` du registre des secrets (`check:secrets-age`) est
// rouge tant que le secret n'est pas posé.
//
// `SENTRY_TRACES_SAMPLE_RATE` (facultatif) règle l'échantillonnage des spans,
// 0,1 par défaut. Les EXCEPTIONS, elles, partent toujours.
//
// ── CE QUI PART, CE QUI NE PART JAMAIS ──────────────────────────────
//
// Voir l'en-tête de `trace-core.ts` : nom de la fonction, méthode, code de
// réponse, durée. Jamais d'en-tête, de corps, d'IP, d'URL ni d'identifiant
// d'utilisateur. Le SDK tourne sans intégration par défaut
// (`defaultIntegrations: false`) : il ne lit ni l'environnement, ni les
// variables, ni les contextes de l'isolat.
//
// ❌ Ne jamais passer d'identifiant (compte, client Stripe, organisation) en
//    attribut de span. Le test `src/edge-trace.guard.test.ts` lit ce fichier.

import {
  parseSampleRate,
  scrubEvent,
  wrapHandler,
  type TraceSdk,
} from './trace-core.ts'

let sdkPromise: Promise<TraceSdk | null> | null = null

/** Charge et initialise le SDK une seule fois par isolat. Ne lève jamais. */
function loadSdk(): Promise<TraceSdk | null> {
  const dsn = Deno.env.get('SENTRY_DSN_EDGE')?.trim()
  if (!dsn) return Promise.resolve(null)
  sdkPromise ??= (async () => {
    try {
      // 🔴 Spécificateur LITTÉRAL, jamais une variable : le déploiement (`--use-api`)
      // n'embarque que les modules qu'il voit dans le graphe d'imports. Une variable
      // ferait échouer l'import à l'exécution, avalé plus bas : la fonction répondrait,
      // sans aucun span, et rien ne le dirait. Version épinglée, alignée sur
      // `@sentry/react` du front (package-lock).
      const Sentry = await import('npm:@sentry/deno@10.70.0')
      Sentry.init({
        dsn,
        environment: 'production',
        // Pas d'intégration par défaut : sur un isolat partagé, elles lisent
        // des globaux qui ne sont pas les nôtres.
        defaultIntegrations: false,
        tracesSampleRate: parseSampleRate(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE')),
        sendDefaultPii: false,
        beforeSend: (event: object) => scrubEvent(event),
        beforeSendTransaction: (event: object) => scrubEvent(event),
      })
      return Sentry as TraceSdk
    } catch {
      // SDK injoignable : la fonction répond sans traçage, on ne réessaie pas
      // à chaque requête de cet isolat.
      return null
    }
  })()
  return sdkPromise
}

type EdgeRuntimeGlobal = { waitUntil?: (work: Promise<unknown>) => void }

function waitUntil(): ((work: Promise<unknown>) => void) | null {
  const rt = (globalThis as { EdgeRuntime?: EdgeRuntimeGlobal }).EdgeRuntime
  return rt?.waitUntil ? (work) => rt.waitUntil!(work) : null
}

/**
 * Enveloppe un gestionnaire dans un span Sentry, si `SENTRY_DSN_EDGE` est posé.
 * Sinon, le gestionnaire est rendu tel quel.
 */
export function withTrace(
  slug: string,
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Response | Promise<Response> {
  if (!Deno.env.get('SENTRY_DSN_EDGE')?.trim()) return handler
  return wrapHandler(slug, handler, { load: loadSdk, waitUntil: waitUntil() })
}
