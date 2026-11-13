// ═══════════════════════════════════════════════════════════════════
// Connexion admin de cosmo-analytics par le SEUL code TOTP (30 s)
// Seul client : l'écran « Code d'accès » de cosmo-analytics (src/Auth.tsx),
// qui appelle cette fonction avec { code } et lit { access_token, refresh_token }.
//
// Décision d'Axel (2026-11-13) : plus de mot de passe fixe pour l'app entière.
// Le code commun affilié (≥ 8 caractères) n'ouvre que l'onglet Affiliation ;
// un code à 6 chiffres est le code TOTP de l'admin. Le mode de connexion est un
// choix de produit : le changer n'est pas l'affaire de ce fichier.
//
// ── COMMENT ─────────────────────────────────────────────────────────
// GoTrue ne vérifie un TOTP que dans une session déjà ouverte. On ouvre donc
// côté serveur une session aal1 pour l'unique compte de `admin_users`
// (lien magique généré, jamais envoyé), puis on y vérifie le code contre son
// facteur enrôlé : la session passe aal2, `is_admin()` l'accepte. Le secret
// TOTP reste chez GoTrue, rien de neuf n'est stocké.
// Code faux : la session aal1 est révoquée (scope local, les autres
// appareils de l'admin restent connectés) et l'appel rend 401.
//
// ── PLAFONDS (un jeton par tentative, AVANT la vérification) ────────
// Par adresse : 3 / minute, 5 / 15 minutes, 10 / jour (le délai s'allonge à
// chaque palier). Globaux : 150 / heure et 400 / jour, qui servent de verrou
// de dernier recours ET d'alarme (une alerte par heure au plus). Les plafonds
// par adresse sont bien plus bas que le global : un tiers isolé est refusé
// avant d'avoir pu consommer le verrou global.
// 🔴 ÉCHEC FERMÉ : un compteur illisible REFUSE l'essai (`failClosed`).
//
// 🔴 ORIGINE : l'en-tête `Origin` doit être dans les origines de l'app
// cosmo-analytics (`analyticsOrigins`, `_shared/env.ts`), en plus du CORS.
// Variable absente : la fonction refuse de démarrer.
//
// `verify_jwt = false` : l'appelant n'a pas encore de session.
// ❌ Le code n'est jamais journalisé.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { consumeRateLimits, callerIp } from '../_shared/rate-limit.ts'
import { opsAlert } from '../_shared/alert.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { analyticsOrigins } from '../_shared/env.ts'

const FN = 'analytics-admin-login'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ORIGINS = analyticsOrigins()
const STRICT = { failClosed: true }

const corsFor = (req: Request) => corsHeaders(req.headers.get('Origin'), ORIGINS)

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsFor(req) } })
}
const unavailable = (req: Request) => json({ error: 'unavailable' }, 503, req)

async function login(req: Request): Promise<Response> {
  const body = await req.json().catch(() => undefined) as { code?: unknown } | undefined
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!/^\d{6}$/.test(code)) return json({ error: 'invalid_code' }, 401, req)

  const ip = callerIp(req)
  const perIp = await consumeRateLimits(FN, [
    { domain: 'analytics-admin-login-ip-1m', value: ip, limit: 3, window: '1 minute' },
    { domain: 'analytics-admin-login', value: ip, limit: 5, window: '15 minutes' },
    { domain: 'analytics-admin-login-ip-1d', value: ip, limit: 10, window: '1 day' },
  ], STRICT)
  if (!perIp.allowed) return perIp.misconfigured ? unavailable(req) : json({ error: 'rate_limited', retry_after_s: 900 }, 429, req)

  const global = await consumeRateLimits(FN, [
    { domain: 'analytics-admin-login-global', value: 'all', limit: 150, window: '1 hour' },
    { domain: 'analytics-admin-login-global-1d', value: 'all', limit: 400, window: '1 day' },
  ], STRICT)
  if (!global.allowed) {
    if (global.misconfigured) return unavailable(req)
    const gate = await consumeRateLimits(FN, [{ domain: 'analytics-admin-login-alert', value: 'all', limit: 1, window: '1 hour' }], STRICT)
    if (gate.allowed) await opsAlert(FN, 'plafond global atteint : connexion admin de cosmo-analytics fermee')
    return json({ error: 'rate_limited', retry_after_s: 3600 }, 429, req)
  }

  const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: admins, error: listErr } = await admin.from('admin_users').select('user_id')
  // Le code seul ne dit pas QUI se connecte : il faut un admin et un seul.
  if (listErr || admins?.length !== 1) {
    console.error(`${FN}: admin_users ${listErr ? 'illisible' : `compte ${admins?.length ?? 0} lignes, 1 attendue`}`)
    return unavailable(req)
  }
  const { data: user, error: userErr } = await admin.auth.admin.getUserById(admins[0].user_id)
  const email = user?.user?.email
  if (userErr || !email) return unavailable(req)

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link.properties?.hashed_token) return unavailable(req)

  const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: otpErr } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
  if (otpErr) return unavailable(req)

  const { data: factors } = await sb.auth.mfa.listFactors()
  const factor = factors?.totp.find((f) => f.status === 'verified')
  if (!factor) {
    await sb.auth.signOut({ scope: 'local' })
    return json({ error: 'no_factor' }, 409, req)
  }
  const { data: verified, error: mfaErr } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (mfaErr || !verified) {
    await sb.auth.signOut({ scope: 'local' })
    return json({ error: 'invalid_code' }, 401, req)
  }
  return json({ access_token: verified.access_token, refresh_token: verified.refresh_token }, 200, req)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) })
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404, req)
  // L'origine est vérifiée côté serveur, avant tout traitement du corps.
  const origin = req.headers.get('Origin')
  if (!origin || !ORIGINS.has(origin)) return json({ error: 'forbidden_origin' }, 403, req)
  try {
    return await login(req)
  } catch {
    console.error(`${FN}: unexpected error`)
    return unavailable(req)
  }
})
