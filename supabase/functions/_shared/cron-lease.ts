// ═══════════════════════════════════════════════════════════════════
// Bail des Edge Functions planifiées (mig. 245, ARC-06)
//
// Chaque fonction appelée par un ordonnanceur (pg_cron, et GitHub tant que la
// bascule n'est pas faite) prend ce bail AVANT de lire sa sélection. Deux
// exécutions simultanées ne travaillent donc jamais en même temps : la
// seconde rend `{ skipped: 'already_running' }` sans rien lire ni envoyer.
//
// Pourquoi c'est nécessaire : les cinq fonctions sont idempotentes en REJEU
// (contrainte UNIQUE posée APRÈS l'envoi, `emailed_at`, `delivered_at`), mais
// pas en CONCURRENCE. Deux passages lancés ensemble lisent la même sélection
// avant que l'un ait écrit sa trace, et chacun envoie : un avis de
// reconduction en double pour la même échéance, un webhook livré deux fois.
//
// Durée : `CRON_LEASE_TTL_SECONDS`, au-delà de la limite d'exécution d'une
// Edge Function (400 s au plus) : un passage tué par la plateforme ne tient
// plus son bail quand le suivant arrive, et un passage vivant le tient
// toujours.
//
// ⚠️ MODULE PUR : aucun import Deno, aucun `opsAlert`. La fonction appelante
//    décide de l'alerte ; ce module est exécuté par
//    `src/edge-cron-lease.guard.test.ts`.
// ⚠️ RPC ABSENTE (mig. 245 pas encore appliquée en production) : la
//    fonction travaille SANS bail, comme avant la 245, et le dit. Refuser de
//    travailler rendrait l'avis L215-1 impossible jusqu'à l'application ;
//    travailler sans bail, c'est le comportement qu'on avait.
// ═══════════════════════════════════════════════════════════════════

/** 8 minutes : plus que la limite d'exécution d'une Edge Function (400 s). */
export const CRON_LEASE_TTL_SECONDS = 480

interface RpcError {
  code?: string
  message?: string
}

/** Le strict nécessaire de `supabase.rpc`, pour être testable sans réseau. */
export type RpcCall = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>

export type CronLease =
  | { kind: 'held'; token: string }
  | { kind: 'busy' }
  | { kind: 'unavailable' }
  | { kind: 'error' }

/** PostgREST `PGRST202` (fonction introuvable) ou Postgres `42883`. */
export function isMissingFunction(error: RpcError | null | undefined): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

export async function acquireCronLease(rpc: RpcCall, job: string, ttlSeconds = CRON_LEASE_TTL_SECONDS): Promise<CronLease> {
  const { data, error } = await rpc('cron_lease_acquire', { p_job: job, p_ttl_seconds: ttlSeconds })
  if (error) return isMissingFunction(error) ? { kind: 'unavailable' } : { kind: 'error' }
  return typeof data === 'string' && data.length > 0 ? { kind: 'held', token: data } : { kind: 'busy' }
}

/** Rend le bail. Une erreur ici n'est pas grave : il expire seul. */
export async function releaseCronLease(rpc: RpcCall, job: string, lease: CronLease): Promise<void> {
  if (lease.kind !== 'held') return
  try {
    await rpc('cron_lease_release', { p_job: job, p_token: lease.token })
  } catch {
    // Le bail expire après CRON_LEASE_TTL_SECONDS.
  }
}

/**
 * Exécute `work` sous le bail de `job`.
 *   · bail pris            → `work()`, puis le bail est rendu, même sur exception ;
 *   · bail tenu ailleurs   → `onBusy()` (réponse 200 `skipped`), `work` n'est pas appelé ;
 *   · RPC absente          → `work()` sans bail (mig. 245 non appliquée) ;
 *   · autre erreur de RPC  → `onError()` : la base ne répond pas, la sélection
 *                            échouerait de toute façon.
 */
export async function withCronLease(
  rpc: RpcCall,
  job: string,
  handlers: { work: () => Promise<Response>; onBusy: () => Response; onError: () => Promise<Response> },
): Promise<Response> {
  const lease = await acquireCronLease(rpc, job)
  if (lease.kind === 'busy') return handlers.onBusy()
  if (lease.kind === 'error') return handlers.onError()
  if (lease.kind === 'unavailable') console.warn(`cron lease unavailable for ${job}: migration 245 not applied, running without lease`)
  try {
    return await handlers.work()
  } finally {
    await releaseCronLease(rpc, job, lease)
  }
}
