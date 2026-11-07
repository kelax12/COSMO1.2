// ═══════════════════════════════════════════════════════════════════
// Traçage des Edge Functions : le cœur PUR (OBS-02, vague 10.4)
// ═══════════════════════════════════════════════════════════════════
//
// Ce que ce fichier décide, sans toucher ni à Deno ni au SDK :
//   - ce qui est retiré d'un évènement Sentry AVANT son départ ;
//   - le taux d'échantillonnage, lu d'une chaîne d'environnement ;
//   - l'enveloppe d'un gestionnaire : un span par requête, rien d'autre.
//
// ⚠️ Module TS PUR, comme `cors.ts` : un test de `src/` l'importe
// (`src/edge-trace.guard.test.ts`), et `tsc -b` le vérifie à travers cet
// import. Le chargement du SDK et la lecture de `Deno.env` sont dans
// `trace.ts`, qui est le seul fichier que les fonctions importent.
//
// ── CE QUE CE MODULE NE LAISSE JAMAIS PARTIR ────────────────────────
//
// ❌ Ni en-tête (`Authorization`, `Stripe-Signature`, `x-cron-secret`), ni
//    corps de requête, ni adresse IP, ni identifiant d'utilisateur, ni
//    chaîne de requête. Le span ne porte que : le nom de la fonction, la
//    méthode HTTP et le code de réponse. Le SDK, lui, collecte en plus
//    l'URL de la requête entrante (`/functions/v1/<slug>?…`) : elle est
//    retirée ici (`scrubEvent`), et `sendDefaultPii` reste faux.
// ❌ Ce n'est PAS une garde. Un DSN absent, un SDK injoignable, un envoi qui
//    échoue : la fonction répond exactement comme sans traçage. Une panne
//    d'observabilité ne doit jamais devenir une panne de facturation.

/** Taux par défaut : bas, parce que chaque transaction compte au quota Sentry. */
export const DEFAULT_TRACES_SAMPLE_RATE = 0.1

/**
 * Le taux d'échantillonnage depuis `SENTRY_TRACES_SAMPLE_RATE`.
 * Absent, illisible ou hors de [0, 1] : la valeur par défaut, jamais un plafond
 * silencieux à 1 (un `5` tapé pour `0.05` ne doit pas tout tracer).
 */
export function parseSampleRate(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw.trim() === '') return DEFAULT_TRACES_SAMPLE_RATE
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) return DEFAULT_TRACES_SAMPLE_RATE
  return n
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
/** JWT (Supabase, jeton de session) : trois segments base64url dont le premier commence par `eyJ`. */
const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g
/** Clés Stripe et secrets de signature : `sk_live_…`, `rk_…`, `whsec_…`, `pk_…`. */
const STRIPE_KEY_RE = /\b(?:sk|rk|pk|whsec)_[A-Za-z0-9_]{8,}/g
/** Identifiants d'objets Stripe : un client, un abonnement, un paiement identifient une personne. */
const STRIPE_ID_RE = /\b(?:cus|sub|pi|in|ch|re|cs|evt|pm|src|seti|si|acct|ii|txn|po)_[A-Za-z0-9]{6,}/g
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
/** Une URL absolue ou relative suivie d'une chaîne de requête ou d'un fragment. */
const QUERY_RE = /([^\s"'?#]*)[?#][^\s"']*/g

/** Retire d'un texte tout ce qui identifie une personne ou ouvre un accès. */
export function scrubText(s: string): string {
  return s
    .replace(BEARER_RE, 'Bearer [jeton]')
    .replace(JWT_RE, '[jwt]')
    .replace(STRIPE_KEY_RE, '[cle]')
    .replace(STRIPE_ID_RE, '[stripe-id]')
    .replace(QUERY_RE, '$1')
    .replace(EMAIL_RE, '[email]')
    .replace(UUID_RE, '[uuid]')
}

const MAX_DEPTH = 8

/**
 * Nettoie récursivement TOUTES les chaînes d'une valeur. Plus sûr qu'une liste
 * de champs connus : le SDK ajoute des champs d'une version à l'autre, et un
 * champ oublié par une liste blanche partirait en clair.
 */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return scrubText(value) as unknown as T
  if (value === null || typeof value !== 'object' || depth >= MAX_DEPTH) return value
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubDeep(v, depth + 1)
  }
  return out as T
}

/** Les rubriques d'un évènement qui n'ont aucune raison de partir. */
const DROPPED_FIELDS = ['request', 'user', 'server_name', 'sdk'] as const

/**
 * L'évènement tel qu'il peut partir : sans requête entrante (en-têtes, URL,
 * corps), sans utilisateur, sans nom d'hôte, et toutes ses chaînes nettoyées.
 */
export function scrubEvent<T extends object>(event: T): T {
  const copy = { ...event } as Record<string, unknown>
  for (const field of DROPPED_FIELDS) delete copy[field]
  return scrubDeep(copy) as T
}

/** La part du SDK que l'enveloppe utilise, et rien d'autre. */
export interface TraceSpan {
  setAttribute(key: string, value: string | number | boolean): void
  setStatus(status: { code: number; message?: string }): void
}

export interface TraceSdk {
  startSpan<T>(
    options: { name: string; op: string; attributes?: Record<string, string | number | boolean> },
    callback: (span: TraceSpan) => T,
  ): T
  captureException(error: unknown, context?: { tags?: Record<string, string> }): string
  /** Vide la file d'envoi. Rend `false` si le délai est dépassé. */
  flush(timeoutMs: number): Promise<boolean>
}

export interface TraceDeps {
  /** Rend le SDK prêt, ou `null` : DSN absent, chargement impossible. Ne lève pas. */
  load: () => Promise<TraceSdk | null>
  /** Planifie un travail après la réponse (`EdgeRuntime.waitUntil`), ou `null`. */
  waitUntil?: ((work: Promise<unknown>) => void) | null
}

/** Code de statut OpenTelemetry d'une erreur (`SPAN_STATUS_ERROR`). */
const SPAN_STATUS_ERROR = 2
/** Au-delà, un envoi qui traîne ne doit plus retenir l'isolat. */
const FLUSH_TIMEOUT_MS = 2000

/**
 * Enveloppe un gestionnaire HTTP d'Edge Function dans un span.
 *
 * Le nom du span est `<METHODE> <slug>` : jamais l'URL de la requête, qui porte
 * des paramètres. Une exception qui sort du gestionnaire est capturée PUIS
 * relancée telle quelle : la réponse 500 qui en résulte est celle d'avant.
 *
 * Si le SDK n'est pas disponible, le gestionnaire est appelé tel quel.
 */
export function wrapHandler(
  slug: string,
  handler: (req: Request) => Response | Promise<Response>,
  deps: TraceDeps,
): (req: Request) => Promise<Response> {
  return async (req) => {
    let sdk: TraceSdk | null = null
    try {
      sdk = await deps.load()
    } catch {
      sdk = null
    }
    if (!sdk) return handler(req)
    const active = sdk

    const method = /^[A-Z]{3,7}$/.test(req.method) ? req.method : 'OTHER'
    try {
      return await active.startSpan(
        {
          name: `${method} ${slug}`,
          op: 'function.edge',
          attributes: { 'edge.function': slug, 'http.request.method': method },
        },
        async (span) => {
          const res = await handler(req)
          span.setAttribute('http.response.status_code', res.status)
          if (res.status >= 500) span.setStatus({ code: SPAN_STATUS_ERROR, message: 'server_error' })
          return res
        },
      )
    } catch (err) {
      try {
        active.captureException(err, { tags: { 'edge.function': slug } })
      } catch { /* l'observabilité ne casse jamais ce qu'elle observe */ }
      throw err
    } finally {
      try {
        const flushing = active.flush(FLUSH_TIMEOUT_MS).catch(() => false)
        if (deps.waitUntil) deps.waitUntil(flushing)
        else await flushing
      } catch { /* idem */ }
    }
  }
}
