// ═══════════════════════════════════════════════════════════════════
// sentry-tracing : la MESURE DE PERFORMANCE de Sentry, et ce qui la borne
// ═══════════════════════════════════════════════════════════════════
//
// OBS-02 (audit du 2026-11-06, vague 10.4) : on ne savait pas quelle action
// était lente. La capture d'erreurs existait ; la performance n'était qu'un
// `tracesSampleRate: 0.1` en dur, branché sans condition et sans nettoyage des
// noms de span. Ce module porte, en fonctions pures et testées :
//
//   1. le TAUX d'échantillonnage, paramétrable (`VITE_SENTRY_TRACES_SAMPLE_RATE`) ;
//   2. la DÉCISION de consentement (`tracingEnabled`) ;
//   3. le nom des routes PARAMÉTRÉ (`parameterizeRoute`) ;
//   4. le NETTOYAGE d'une transaction avant son départ (`scrubTransaction`).
//
// Il n'importe PAS `@sentry/react` : la porte unique reste `sentry-client.ts`
// (`monitoring.guard.test.ts`). Ce fichier est sûr dans le chunk d'entrée, il
// ne pèse que son texte.
//
// ── LA DÉCISION DE CONSENTEMENT (écrite dans docs/OBSERVABILITE.md) ──
//
// Les ERREURS restent hors consentement (intérêt légitime, sécurité du
// service, aucune écriture sur l'appareil). La PERFORMANCE est conditionnée :
// `tracingEnabled` ne rend vrai que pour `'accepted'`. `null` n'est pas une
// acceptation (règle du dépôt), et une réponse expirée relit `null`.

import type { CookieConsent } from './cookie-consent';
import { scrubText, scrubUrl } from './sentry-scrub';

/** 10 % : bas, parce que chaque transaction compte au quota Sentry. */
export const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

/**
 * Le taux depuis `VITE_SENTRY_TRACES_SAMPLE_RATE`. Absent, illisible ou hors de
 * [0, 1] : la valeur par défaut. Jamais un plafonnement silencieux à 1 : un `5`
 * tapé pour `0.05` ne doit pas tout tracer.
 */
export function parseTracesSampleRate(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw.trim() === '') return DEFAULT_TRACES_SAMPLE_RATE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return DEFAULT_TRACES_SAMPLE_RATE;
  return n;
}

/** La mesure de performance n'est permise que sur un « Accepter » explicite. */
export function tracingEnabled(consent: CookieConsent): boolean {
  return consent === 'accepted';
}

/** `tracesSampler` : le taux tant que le consentement tient, 0 dès qu'il tombe. */
export function makeTracesSampler(
  rate: number,
  consent: () => CookieConsent,
): () => number {
  return () => (tracingEnabled(consent()) ? rate : 0);
}

// ── Noms de route ───────────────────────────────────────────────────

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un segment opaque : long, sans espace, fait de caractères de jeton. */
const OPAQUE_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;
const NUMERIC_SEGMENT = /^\d+$/;
const EMAIL_SEGMENT = /@/;

/** Segments qui précèdent un identifiant, par route connue du produit. */
const PARAM_AFTER: ReadonlyArray<{ after: string; param: string }> = [
  { after: 'invite', param: ':token' },
  { after: 'org-invite', param: ':token' },
  { after: 'blog', param: ':slug' },
];

/**
 * `/invite/abc…` devient `/invite/:token`, `/entreprise/okr/<uuid>` devient
 * `/entreprise/okr/:id`. Le nom d'une transaction doit rester un GABARIT : un
 * nom par visiteur serait à la fois une fuite et une cardinalité qui noie
 * l'agrégat.
 *
 * Idempotent, ne lève jamais. La chaîne de requête et le fragment sont retirés.
 */
export function parameterizeRoute(name: string): string {
  const path = name.split(/[?#]/)[0];
  const segments = path.split('/');
  const out = segments.map((seg, i) => {
    if (seg === '') return seg;
    const known = PARAM_AFTER.find((p) => segments[i - 1] === p.after);
    if (known && !seg.startsWith(':')) return known.param;
    if (UUID_SEGMENT.test(seg) || NUMERIC_SEGMENT.test(seg) || OPAQUE_SEGMENT.test(seg)) return ':id';
    if (EMAIL_SEGMENT.test(seg)) return ':email';
    return seg;
  });
  return scrubText(out.join('/'));
}

// ── Nettoyage d'une transaction ─────────────────────────────────────

/** Clés de span qui portent une chaîne de requête ou un fragment : retirées. */
const DROPPED_DATA_KEYS = new Set([
  'http.query', 'url.query', 'http.fragment', 'url.fragment', 'query', 'search',
]);
/** Clés de span qui portent une adresse : nettoyées et privées de leur requête. */
const URL_DATA_KEYS = new Set([
  'url', 'http.url', 'url.full', 'url.path', 'http.target', 'from', 'to',
]);

/** Une adresse sans chaîne de requête ni fragment, jetons et identifiants masqués. */
export function scrubSpanUrl(url: string): string {
  return scrubUrl(url.split(/[?#]/)[0]);
}

/** `GET https://x.supabase.co/rest/v1/tasks?user_id=eq.…` → `GET https://x.supabase.co/rest/v1/tasks`. */
function scrubDescription(description: string): string {
  return description
    .split(' ')
    .map((token) => (/^https?:\/\//.test(token) || token.startsWith('/') ? scrubSpanUrl(token) : scrubText(token)))
    .join(' ');
}

interface ScrubbableSpan {
  description?: string;
  data?: { [key: string]: unknown };
}

interface ScrubbableTransaction {
  transaction?: string;
  user?: unknown;
  request?: { url?: string; query_string?: unknown; headers?: unknown; cookies?: unknown };
  spans?: ScrubbableSpan[];
  contexts?: { trace?: { data?: { [key: string]: unknown } } };
}

function scrubData(data: { [key: string]: unknown } | undefined): void {
  if (!data) return;
  for (const key of Object.keys(data)) {
    if (DROPPED_DATA_KEYS.has(key)) {
      delete data[key];
    } else if (URL_DATA_KEYS.has(key) && typeof data[key] === 'string') {
      data[key] = scrubSpanUrl(data[key] as string);
    } else if (typeof data[key] === 'string') {
      data[key] = scrubText(data[key] as string);
    }
  }
}

/**
 * Ce qui part d'une transaction : un nom de route paramétré, des spans sans
 * chaîne de requête, sans identifiant ni utilisateur.
 *
 * Rend `null` (la transaction est jetée) si la mesure n'est plus permise : le
 * consentement a pu tomber entre le début du span et son envoi.
 */
export function scrubTransaction<T extends ScrubbableTransaction>(
  event: T,
  consent: CookieConsent,
): T | null {
  if (!tracingEnabled(consent)) return null;
  if (event.transaction) event.transaction = parameterizeRoute(event.transaction);
  // La performance n'a pas besoin de savoir QUI : l'identifiant technique du
  // compte, posé pour relier les erreurs, ne suit pas les transactions.
  delete event.user;
  if (event.request) {
    if (event.request.url) event.request.url = scrubSpanUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.headers;
    delete event.request.cookies;
  }
  scrubData(event.contexts?.trace?.data);
  if (event.spans) {
    for (const span of event.spans) {
      if (span.description) span.description = scrubDescription(span.description);
      scrubData(span.data);
    }
  }
  return event;
}
