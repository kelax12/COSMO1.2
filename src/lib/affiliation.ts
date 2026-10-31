// ═══════════════════════════════════════════════════════════════════
// affiliation — lien d'affilié `?aff=<slug>`, en LAST-CLICK, 30 jours.
//
// Un affilié partage `https://thecosmo.app/?aff=<slug>`. Le slug est gardé
// 30 jours sur l'appareil ; une inscription dans ce délai rattache le compte à
// l'affilié, définitivement : metadata `affiliate_slug` de `signUp` (trigger,
// mig. 236), ou RPC `claim_affiliate` pour Google (`affiliate-claim.ts`).
// Chaque arrivée avec un slug valide est comptée par un POST fire-and-forget
// vers l'Edge Function `affiliation-api/click`.
//
// 🔴 EXCEPTION VOULUE, NE PAS « CORRIGER » : contrairement à `attribution.ts`,
// le slug est écrit SANS attendre le consentement et `clearAttributionTraces`
// ne l'efface PAS. Décision d'Axel (2026-10-31), risque CNIL assumé : sans ça,
// un refus du bandeau priverait l'affilié de sa commission. Déclaré dans la
// politique de confidentialité (s10). Spec : analytics/docs/AFFILIATION.md.
//
// Comme tout l'analytics : la valeur vient de l'URL (whitelist stricte, re-
// validée à la lecture) et rien ne doit casser un rendu ni une auth (tout
// accès au stockage et au réseau sous try/catch).
//
// ⚠️ Clé dans `PRESERVE_KEYS` (repository.factory.ts) : survit à la démo.
// ═══════════════════════════════════════════════════════════════════

export const AFFILIATE_STORAGE_KEY = 'cosmo_aff';

export const AFFILIATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

let pinged = false;

export function normalizeAffiliateSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return SLUG_RE.test(raw) ? raw : null;
}

/** Slug d'affilié encore valide, ou `null`. */
export function readAffiliateSlug(): string | null {
  try {
    const raw = localStorage.getItem(AFFILIATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { slug, at } = parsed as Record<string, unknown>;
    if (typeof slug !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return null;
    if (Date.now() - at > AFFILIATE_TTL_MS) return null;
    return normalizeAffiliateSlug(slug);
  } catch {
    return null;
  }
}

function pingClick(slug: string): void {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base || base === 'undefined') return; // mode démo sans backend
  try {
    void fetch(`${base}/functions/v1/affiliation-api/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* réseau indisponible : clic non compté, pas d'erreur. */
  }
}

/** Lit `?aff=` au chargement, le stocke (dernier clic gagnant) et compte le clic. */
export function captureAffiliate(): void {
  let slug: string | null = null;
  try {
    slug = normalizeAffiliateSlug(new URLSearchParams(window.location.search).get('aff'));
  } catch {
    return;
  }
  if (!slug) return;
  try {
    localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {
    /* stockage indisponible */
  }
  if (pinged) return;
  pinged = true;
  pingClick(slug);
}

/** Réservé aux tests. */
export function _resetAffiliatePingForTests(): void {
  pinged = false;
}
