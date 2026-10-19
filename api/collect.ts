// Collecteur de la mesure d'audience maison (mig. 222).
//
// Reçoit les évènements de `src/lib/traffic.ts` (sendBeacon), y ajoute ce que
// seul le serveur connaît (pays/région/ville fournis par Vercel, famille de
// navigateur), puis appelle la RPC `track_hit` avec la clé PUBLIQUE.
//
// L'IP et le user-agent ne sont transmis à la base que pour calculer
// l'empreinte du jour (sel quotidien, supprimé le lendemain). Ils ne sont
// jamais stockés, ni ici ni là-bas.
import { parseUserAgent } from '../src/lib/traffic-ua';

export const config = { runtime: 'edge' };

const MAX_BODY = 2048;
const KINDS = new Set(['view', 'leave', 'cta']);
const TEXT_FIELDS = ['path', 'referrer_host', 'utm_source', 'utm_medium', 'utm_campaign', 'lang', 'cta'] as const;

const noContent = () => new Response(null, { status: 204 });

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try { return decodeURIComponent(value); } catch { return value; }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  // Même origine seulement : la mesure ne vient que des pages de COSMO.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) return new Response(null, { status: 403 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return new Response(null, { status: 400 }); }
  if (typeof body.kind !== 'string' || !KINDS.has(body.kind)) return new Response(null, { status: 400 });

  const ua = req.headers.get('user-agent') ?? '';
  const facts = parseUserAgent(ua);
  if (facts.bot) return noContent();

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return noContent();

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
    await fetch(`${url}/rest/v1/rpc/track_hit`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: payload }),
    });
  } catch { /* une mesure perdue ne doit jamais renvoyer d'erreur au visiteur */ }
  return noContent();
}
