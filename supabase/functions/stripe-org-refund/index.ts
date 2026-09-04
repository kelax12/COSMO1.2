// ═══════════════════════════════════════════════════════════════════
// Résilier ET rembourser, en un seul geste (findings C-65 et C-39)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CETTE FONCTION EXISTE.
//
// Décision d'Axel du 2026-09-03 : « l'utilisateur doit pouvoir se faire
// rembourser le mois en cours à tout moment, mais que le mois en cours. »
// Prise pour ne pas avoir à arbitrer au cas par cas — et c'est le bon calcul :
// sur un abonnement mensuel, rembourser le mois en cours est EXACTEMENT le
// remède que l'art. L215-1 accorde au consommateur qu'on n'a pas prévenu de sa
// reconduction. La règle commerciale RECOUVRE l'obligation légale.
//
// 🔴 **Une règle sans mécanisme est une phrase.** Avant cette fonction, le
// produit n'avait AUCUN chemin de remboursement : `stripe-org-portal` ouvre le
// portail Stripe, qui sait résilier et ne rembourse pas, et rien n'appelait
// `refunds.create`. Tant que la personne devait écrire un e-mail pour obtenir
// ce qu'on lui promettait, on était exactement dans la situation que la
// décision voulait éviter : une discussion, au cas par cas.
//
// C'est aussi la moitié manquante de C-39. L'arbitrage y dit : « la suppression
// résilie et rembourse […] un seul geste, aucun débit orphelin ».
//
// ── L'ORDRE DES DEUX ACTIONS, ET POURQUOI CELUI-LÀ ──────────────────
//
// REMBOURSER D'ABORD, RÉSILIER ENSUITE.
//
// Les deux ordres ont un mode de panne, et ils ne se valent pas :
//   • rembourser puis échouer à résilier → la personne a son argent et garde
//     l'accès quelques heures. À son avantage, et rattrapable.
//   • résilier puis échouer à rembourser → elle a perdu l'accès ET n'a pas son
//     argent. C'est exactement la discussion que la décision supprime.
//
// ── LA BORNE, SINON C'EST UN ROBINET ────────────────────────────────
//
// 🔴 « Ne pas livrer le bouton avant la borne : un remboursement rejouable est
// une perte d'argent, pas un défaut d'UX. » Trois verrous, indépendants :
//
//   1. une clé d'idempotence Stripe dérivée de l'`invoice_id` — deux appels
//      concurrents ne créent qu'un remboursement ;
//   2. un pré-contrôle des remboursements DÉJÀ posés sur ce `payment_intent` ;
//   3. le montant est borné par ce qui a été encaissé
//      (`_shared/refund-amount.ts`, testé).
//
// ⚠️ Le pré-contrôle NE DOIT PAS AVALER SON ERREUR. C'est la règle écrite du
// dépôt après l'audit Stripe du 2026-09-02 : « une lecture qui décide d'un
// routage ne doit jamais avaler son erreur ». Une panne de lecture ici
// signifierait « jamais remboursé », donc un second remboursement. On relance,
// et Stripe fait retenter.
//
// ── CE QUE CETTE FONCTION N'ÉCRIT PAS ───────────────────────────────
//
// ❌ Elle n'écrit AUCUNE ligne dans `payment_records`. Ce journal est scellé
//    par `row_hash` et n'a qu'un seul écrivain, `stripe-webhook`, qui est
//    idempotent par `stripe_event_id`. Le remboursement y entre par
//    l'événement `charge.refunded` que Stripe émet, sous forme de LIGNE
//    COMPENSATOIRE à montant négatif — jamais par une modification de la ligne
//    d'origine, que le trigger refuse de toute façon. Un remboursement s'écrit
//    comme en comptabilité.
//
// Secrets attendus : `STRIPE_SECRET_KEY`, `APP_URL`.
// Déploiement : `supabase functions deploy stripe-org-refund`
//
// ⚠️ NON DÉPLOYÉE et NON ÉPROUVÉE CONTRE STRIPE à l'écriture : la clé du projet
//    est une clé de TEST, il n'existe aucun `org_subscriptions`, et rien n'est
//    encaissé. Seule la logique de MONTANT est réellement testée
//    (`src/modules/billing/refund-amount.test.ts`). Le reste attend un
//    parcours joué contre le compte de test — cf. C-27, qui exige que C-65 ne
//    parte pas sans son parcours E2E.
// ═══════════════════════════════════════════════════════════════════

import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { refundAmount, type BillingInterval } from '../_shared/refund-amount.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const ALLOWED_ORIGINS = new Set([APP_URL])

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { orgId } = await req.json().catch(() => ({}))
    if (typeof orgId !== 'string') return json({ error: 'bad_request' }, 400)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // PROPRIÉTAIRE UNIQUEMENT, comme le checkout et le portail. Un admin qui
    // ne paie pas ne décide pas d'un remboursement — c'est le pendant exact de
    // la garde de C-39 sur `delete_organization`.
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id')
      .eq('id', orgId)
      .maybeSingle()
    // ⚠️ L'erreur de lecture est LUE : « pas d'organisation » et « je n'ai pas
    // pu lire » ne sont pas la même chose, et confondre les deux répondrait
    // 403 à un propriétaire légitime pendant une panne PostgREST.
    if (orgError) throw orgError
    if (!org || org.owner_id !== user.id) return json({ error: 'forbidden' }, 403)

    const { data: sub, error: subError } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, billing_interval, status')
      .eq('org_id', orgId)
      .maybeSingle()
    if (subError) throw subError
    if (!sub?.stripe_subscription_id) return json({ error: 'no_subscription' }, 400)

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)

    // La DERNIÈRE facture PAYÉE de cet abonnement. C'est elle, et elle seule,
    // qui est remboursable : « une seule période remboursable, la dernière
    // payée, une seule fois ».
    const invoices = await stripe.invoices.list({
      customer: sub.stripe_customer_id ?? undefined,
      subscription: sub.stripe_subscription_id,
      status: 'paid',
      limit: 1,
    })
    const invoice = invoices.data[0]

    let refunded = 0
    if (invoice?.payment_intent) {
      const decision = refundAmount({
        amountPaidCents: invoice.amount_paid ?? 0,
        // La périodicité vient de la colonne DESCRIPTIVE posée par le webhook
        // (mig. 123), pas d'une déduction sur le montant.
        interval: (sub.billing_interval as BillingInterval) ?? 'monthly',
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        now: Math.floor(Date.now() / 1000),
      })

      if (decision.amountCents > 0) {
        // VERROU 2 — un remboursement déjà posé sur ce paiement ? La lecture
        // LÈVE si elle échoue : deviner « jamais remboursé » créerait un
        // second remboursement.
        const existing = await stripe.refunds.list({
          payment_intent: invoice.payment_intent as string,
          limit: 100,
        })
        const already = existing.data.reduce(
          (sum, r) => sum + (r.status === 'failed' || r.status === 'canceled' ? 0 : r.amount),
          0,
        )
        // Ce qu'il RESTE à rendre. Un rejeu trouve `already` égal au montant et
        // ne rembourse rien de plus.
        const toRefund = Math.max(0, Math.min(decision.amountCents, (invoice.amount_paid ?? 0) - already))

        if (toRefund > 0) {
          await stripe.refunds.create(
            {
              payment_intent: invoice.payment_intent as string,
              amount: toRefund,
              // La raison est lisible dans le tableau de bord Stripe : un
              // remboursement sans motif est illisible six mois plus tard.
              reason: 'requested_by_customer',
              metadata: {
                org_id: orgId,
                invoice_id: invoice.id ?? '',
                rule: decision.reason,
                months_remaining: String(decision.monthsRemaining),
              },
            },
            // VERROU 1 — idempotence Stripe, dérivée de la FACTURE et non d'un
            // booléen en base : deux appels concurrents ne créent qu'un
            // remboursement, même si notre pré-contrôle les a tous deux vus
            // « pas encore remboursés ».
            { idempotencyKey: `org-refund:${invoice.id}` },
          )
          refunded = toRefund
        }
      }
    }

    // RÉSILIATION IMMÉDIATE, et pas `cancel_at_period_end` : on rembourse la
    // période, donc l'accès s'arrête avec elle. Laisser courir reviendrait à
    // offrir la période remboursée.
    if (subscription.status !== 'canceled') {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
    }

    // ❌ AUCUNE écriture dans `payment_records` ici : c'est `stripe-webhook`
    //    qui journalise, sur l'événement `charge.refunded`, en ligne
    //    COMPENSATOIRE. Un journal scellé n'a qu'un écrivain.
    return json({ ok: true, refundedCents: refunded })
  } catch (err) {
    console.error('stripe-org-refund error:', err)
    await opsAlert(
      'stripe-org-refund',
      'resiliation avec remboursement ECHOUEE — le client a demande son argent et ne l a pas recu',
    )
    return json({ error: 'refund_failed' }, 500)
  }
})
