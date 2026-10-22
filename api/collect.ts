// Collecteur de la mesure d'audience maison (mig. 222).
//
// Reçoit les évènements de `src/lib/traffic.ts` (sendBeacon), y ajoute ce que
// seul le serveur connaît (pays/région/ville fournis par Vercel, famille de
// navigateur), puis appelle la RPC `track_hit` avec la clé SECRÈTE du projet.
//
// 🔴 Depuis la mig. 223 (finding TR-1 de faille.md), `track_hit` n'est
// exécutable que par `service_role` : ce collecteur est le SEUL chemin
// d'écriture, et ses filtres (origine, taille, robots) ne se contournent plus
// en appelant `/rest/v1/rpc/track_hit` avec la clé publique.
// La clé vient de `SUPABASE_SECRET_KEY`, posée par l'intégration Vercel ↔
// Supabase, en production seulement, au type « sensible ». Sans préfixe
// `VITE_`, Vite ne l'inclut jamais dans le bundle servi au navigateur. Elle ne
// part que dans l'en-tête `apikey`, n'est jamais renvoyée ni journalisée.
// ❌ Aucun repli sur la clé publique : sans secret, rien n'est écrit.
//
// Le navigateur ignore la réponse (sendBeacon). Un défaut de configuration ou
// un refus de la base rend donc un 5xx, visible dans les journaux Vercel : un
// 204 silencieux rendrait une mesure cassée indiscernable d'une audience nulle.
//
// L'IP et le user-agent ne sont transmis à la base que pour calculer
// l'empreinte du jour (sel quotidien, supprimé le lendemain). Ils ne sont
// jamais stockés, ni ici ni là-bas. L'IP est celle de `x-forwarded-for`, que
// Vercel réécrit lui-même : un client ne peut pas la choisir.
import { parseUserAgent } from '../src/lib/traffic-ua.js';

export const config = { runtime: 'edge' };

const MAX_BODY = 2048;
const KINDS = new Set(['view', 'leave', 'cta']);
const TEXT_FIELDS = ['path', 'referrer_host', 'utm_source', 'utm_medium', 'utm_campaign', 'lang', 'cta'] as const;

const status = (code: number) => new Response(null, { status: code });

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Même origine seulement. `Origin: null` (iframe isolée) ou illisible : refusée. */
function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

/**
 * Une clé `sb_secret_…` n'est pas un JWT : envoyée en `Authorization: Bearer`,
 * la plateforme la rejette (« Invalid JWT »). L'ancienne clé `service_role`,
 * elle, en est un et doit aussi partir en Bearer.
 */
function authHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return status(405);
  if (!sameOrigin(req.headers.get('origin'), req.headers.get('host'))) return status(403);

  // La taille annoncée d'abord, pour ne pas lire un corps démesuré ; puis la
  // taille réelle, en octets (un « é » en vaut deux).
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return status(413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY) return status(413);

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return status(400); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return status(400);
  const body = parsed as Record<string, unknown>;
  if (typeof body.kind !== 'string' || !KINDS.has(body.kind)) return status(400);

  const ua = req.headers.get('user-agent') ?? '';
  const facts = parseUserAgent(ua);
  if (facts.bot) return status(204);

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('collect: SUPABASE_SECRET_KEY ou VITE_SUPABASE_URL absente, aucun évènement écrit');
    return status(503);
  }

  const payload: Record<string, unknown> = {
    kind: body.kind,
    ip: (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '').split(',')[0].trim(),
    ua,
    country: req.headers.get('x-vercel-ip-country') ?? undefined,
    region: decodeHeader(req.headers.get('x-vercel-ip-country-region')),
    city: decodeHeader(req.headers.get('x-vercel-ip-city')),
    browser: facts.browser,
    os: facts.os,
    device: facts.device,
  };
  for (const field of TEXT_FIELDS) {
    if (typeof body[field] === 'string') payload[field] = body[field];
  }
  if (typeof body.duration_ms === 'number') payload.duration_ms = String(Math.round(body.duration_ms));
  if (typeof body.scroll_pct === 'number') payload.scroll_pct = String(Math.round(body.scroll_pct));

  try {
    const res = await fetch(`${url}/rest/v1/rpc/track_hit`, {
      method: 'POST',
      headers: { ...authHeaders(key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: payload }),
    });
    // `false` (évènement écarté par un plafond) est une réponse normale : 200.
    if (!res.ok) {
      console.error(`collect: track_hit a répondu HTTP ${res.status}`);
      return status(502);
    }
  } catch {
    console.error('collect: track_hit injoignable');
    return status(502);
  }
  return status(204);
}
