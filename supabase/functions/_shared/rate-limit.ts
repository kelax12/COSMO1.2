// ═══════════════════════════════════════════════════════════════════
// Plafond de débit partagé par les Edge Functions (finding C-31)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `report-bug` est un relais d'e-mail OUVERT : la fonction est en
// `verify_jwt: true`, mais la clé anon suffit — elle est dans le bundle
// client, donc publique — et c'est VOULU, on doit pouvoir signaler un bug
// depuis un compte cassé. Il n'y avait ensuite ni CAPTCHA, ni throttle client,
// ni compteur serveur, ni plafond par IP.
//
// Une boucle de quelques lignes postait des rapports valides avec 3 Mo de
// pièce jointe chacun. Chaque appel est un e-mail réel expédié par notre
// compte Resend : quota épuisé, boîte de contact noyée, et surtout réputation
// d'expéditeur du domaine abîmée — celle-là met des mois à se reconstruire, et
// c'est le même domaine qui porte les e-mails d'authentification et les avis
// de reconduction (Conso. L215-1).
//
// ❌ Le CAPTCHA n'est PAS un substitut (arbitrage du 2026-09-03) : il ne
//    protège pas d'un appel DIRECT à la fonction, qui est le chemin de l'abus.
//
// ── AUCUNE IP EN CLAIR ──────────────────────────────────────────────
//
// Une adresse IP est une donnée à caractère personnel, et le registre art. 30
// n'en déclare aucune pour cette fonction. On ne stocke qu'un HACHAGE tronqué
// de `<sel secret> || <ip>` : sans le sel, l'espace IPv4 se force en quelques
// secondes, avec lui il ne se force pas du tout. La table `rate_limits` ne
// contient donc qu'un opaque, un compteur et une fenêtre.
//
// ── ÉCHOUER FERMÉ, MAIS PAS AU POINT DE SE COUPER LE BRAS ───────────
//
// 🔴 `RATE_LIMIT_SALT` absent ⇒ la fonction REFUSE. C'est la règle du dépôt,
//    écrite après le `if (SECRET && …)` de `renewal-notice` : on ne se protège
//    pas seulement quand on est déjà protégé. Un secret absent est une erreur
//    de déploiement, elle doit se voir.
//
// ⚠️ En revanche, une PANNE de la base (la RPC ne répond pas) ne doit pas
//    couper le signalement de bugs pour tout le monde : le défaut qu'on
//    corrige est un abus, pas une indisponibilité. On laisse alors passer, et
//    on ALERTE — c'est un arbitrage explicite, et il est dans le sens du
//    service parce que la conséquence d'un faux négatif ici est un e-mail de
//    trop, pas une fuite.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from './alert.ts'

/** Plafonds retenus le 2026-09-03 (arbitrage §0 de `a-faire-code.md`). */
export const REPORT_BUG_LIMITS = {
  /** 3 rapports par heure et par compte. */
  perAccount: { limit: 3, window: '1 hour' },
  /** 10 par jour et par IP — couvre le cas anonyme, et les IP partagées. */
  perIp: { limit: 10, window: '1 day' },
} as const

/**
 * L'adresse de l'appelant, telle que la voit le gateway Supabase.
 *
 * `x-forwarded-for` peut porter une chaîne de relais : la PREMIÈRE entrée est
 * le client d'origine. Elle est falsifiable par le client, mais le gateway la
 * réécrit en amont — et de toute façon, forger cet en-tête ne fait que changer
 * de seau, ce qui reste borné par le plafond global de la fonction.
 */
export function callerIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const first = forwarded.split(',')[0]?.trim()
  return first || req.headers.get('cf-connecting-ip') || 'unknown'
}

/** Hachage salé, tronqué : identifie un seau sans jamais désigner personne. */
async function bucketKey(domain: string, value: string): Promise<string | null> {
  const salt = Deno.env.get('RATE_LIMIT_SALT')
  if (!salt) return null
  const data = new TextEncoder().encode(`${salt}|${domain}|${value}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  // 32 caractères hex = 128 bits : aucune collision réaliste, et la clé reste
  // courte, donc l'index reste petit.
  return `${domain}:${hex.slice(0, 32)}`
}

export interface RateLimitVerdict {
  allowed: boolean
  /** `true` si le refus vient d'une CONFIGURATION absente, pas d'un abus. */
  misconfigured: boolean
}

/**
 * Consomme un jeton dans chacun des seaux demandés.
 *
 * Rend `allowed: false` dès qu'UN seau est plein : les deux plafonds sont des
 * conditions, pas des alternatives.
 */
export async function consumeRateLimits(
  fnName: string,
  buckets: { domain: string; value: string; limit: number; window: string }[],
): Promise<RateLimitVerdict> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  for (const bucket of buckets) {
    const key = await bucketKey(bucket.domain, bucket.value)
    if (!key) {
      // Secret absent : erreur de déploiement, elle doit se VOIR.
      await opsAlert(fnName, 'RATE_LIMIT_SALT absent — le plafond de debit ne peut pas etre applique')
      return { allowed: false, misconfigured: true }
    }

    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: bucket.limit,
      p_window: bucket.window,
    })

    if (error) {
      // ⚠️ Panne de la base : on laisse passer et on alerte. Couper le
      // signalement de bugs pour tout le monde serait pire que l'abus qu'on
      // cherche à borner — et la conséquence d'un faux négatif est un e-mail
      // de trop, pas une fuite.
      await opsAlert(fnName, `plafond de debit non evalue (${error.message}) — appel LAISSE PASSER`)
      continue
    }

    if (data === false) return { allowed: false, misconfigured: false }
  }

  return { allowed: true, misconfigured: false }
}
