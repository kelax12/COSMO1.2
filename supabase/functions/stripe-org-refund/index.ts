// ═══════════════════════════════════════════════════════════════════
// Remboursement MANUEL d'un abonnement d'organisation — ADMIN SEULEMENT
// (REMBOURSEMENT-RESILIATION.md, décision du 2026-11-01)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Aucun utilisateur ne déclenche un remboursement. La rétractation
// (`stripe-org-subscription`, action `withdraw`) arrête l'abonnement et
// enregistre le montant dû ; l'équipe rembourse ensuite depuis cet outil,
// dans les 14 jours (art. L221-24), avec le même moyen de paiement.
//
// Garde : `is_admin()` (allowlist ET session aal2, mig. 131), évaluée avec le
// JWT de l'appelant. ❌ Jamais `admin_allowlisted()`.
//
// Corps : `{ orgId, mode, confirm? }`
//   • `mode: 'withdrawal'` : rembourse la rétractation enregistrée dans
//     `org_withdrawals` (montant calculé à la rétractation, jamais saisi).
//   • `mode: 'conformity' | 'renewal_notice_missed'` : exceptions légales du
//     §3, hors fenêtre. Prorata journalier calculé maintenant, puis arrêt
//     immédiat de l'abonnement. `renewal_notice_missed` exige que
//     l'abonnement soit marqué (`renewal_notice_missed_at`).
//   • sans `confirm: true` : APERÇU, rien n'est écrit. L'admin lit le montant
//     calculé puis valide.
//
// ── LA BORNE ───────────────────────────────────────────────────────
// Trois verrous indépendants, inchangés :
//   1. clé d'idempotence Stripe dérivée de la facture ;
//   2. pré-contrôle des remboursements DÉJÀ posés (`_shared/refund-replay.ts`,
//      qui RETRANCHE le déjà-rendu) ; sa lecture n'avale pas son erreur ;
//   3. montant borné par l'encaissé (`_shared/refund-amount.ts`).
//
// ❌ AUCUNE écriture dans `payment_records` : `stripe-webhook` journalise la
//    ligne COMPENSATOIRE sur `charge.refunded`.
//
// Secrets attendus : `STRIPE_SECRET_KEY`, `APP_URL`, `BILLING_FROM`, `RESEND_API_KEY`.
// ═══════════════════════════════════════════════════════════════════

import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withTrace } from '../_shared/trace.ts'
import { opsAlert } from '../_shared/alert.ts'
import { refundAmount, type RefundException } from '../_shared/refund-amount.ts'
import { remainingRefundableCents } from '../_shared/refund-replay.ts'
import { refundDoneMail } from '../_shared/billing-mail-text.ts'
import { sendBillingMail } from '../_shared/billing-mail.ts'
import { corsHeadersFor, requireEnv } from '../_shared/env.ts'

const APP_URL = requireEnv('APP_URL')
const MODES = new Set<string>(['withdrawal', 'conformity', 'renewal_notice_missed'])

Deno.serve(withTrace('stripe-org-refund', async (req) => {
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

    // ADMIN SEULEMENT. La lecture est LUE : une panne n'est pas un « oui ».
    const { data: isAdmin, error: adminError } = await supabaseUser.rpc('is_admin')
    if (adminError) throw adminError
    if (isAdmin !== true) return json({ error: 'forbidden' }, 403)

    const { orgId, mode, confirm } = await req.json().catch(() => ({}))
    if (typeof orgId !== 'string' || typeof mode !== 'string' || !MODES.has(mode)) {
      return json({ error: 'bad_request' }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', orgId)
      .maybeSingle()
    if (orgError) throw orgError

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let invoiceId: string | null = null
    let decidedCents = 0
    let rule = ''
    let recipient = ''
    let withdrawalSubId: string | null = null
    let liveSubscriptionId: string | null = null

    if (mode === 'withdrawal') {
      const { data: w, error: wError } = await supabaseAdmin
        .from('org_withdrawals')
        .select('stripe_subscription_id, stripe_invoice_id, amount_due_cents, rule, recipient, refunded_at')
        .eq('org_id', orgId)
        .order('withdrawn_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (wError) throw wError
      if (!w) return json({ error: 'no_withdrawal' }, 400)
      if (w.refunded_at) return json({ error: 'already_refunded' }, 409)
      invoiceId = w.stripe_invoice_id
      decidedCents = w.amount_due_cents
      rule = w.rule
      recipient = w.recipient
      withdrawalSubId = w.stripe_subscription_id
    } else {
      // Exceptions légales (§3), hors fenêtre de 14 jours.
      const { data: sub, error: subError } = await supabaseAdmin
        .from('org_subscriptions')
        .select('stripe_customer_id, stripe_subscription_id, renewal_notice_missed_at')
        .eq('org_id', orgId)
        .maybeSingle()
      if (subError) throw subError
      if (!sub?.stripe_subscription_id) return json({ error: 'no_subscription' }, 400)
      if ((mode as RefundException) === 'renewal_notice_missed' && !sub.renewal_notice_missed_at) {
        return json({ error: 'renewal_notice_not_missed' }, 400)
      }
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      const invoices = await stripe.invoices.list({
        customer: sub.stripe_customer_id ?? undefined,
        subscription: sub.stripe_subscription_id,
        status: 'paid',
        limit: 1,
      })
      const invoice = invoices.data[0]
      const decision = refundAmount({
        amountPaidCents: invoice?.amount_paid ?? 0,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        now: Math.floor(Date.now() / 1000),
        // Hors rétractation, seul le temps non écoulé est dû.
        immediateAccessRequested: true,
      })
      invoiceId = invoice?.id ?? null
      decidedCents = decision.amountCents
      rule = `${mode}:${decision.reason}`
      liveSubscriptionId = subscription.status === 'canceled' ? null : sub.stripe_subscription_id
      if (org?.owner_id) {
        const { data: owner } = await supabaseAdmin.auth.admin.getUserById(org.owner_id)
        recipient = owner?.user?.email ?? ''
      }
    }

    if (!invoiceId) return json({ error: 'no_paid_invoice' }, 400)
    const invoice = await stripe.invoices.retrieve(invoiceId)
    if (!invoice.payment_intent) return json({ error: 'no_paid_invoice' }, 400)

    // VERROU 2 — ce qui a DÉJÀ été rendu sur ce paiement. La lecture LÈVE.
    const existing = await stripe.refunds.list({
      payment_intent: invoice.payment_intent as string,
      limit: 100,
    })
    const toRefund = remainingRefundableCents({
      decidedCents,
      amountPaidCents: invoice.amount_paid ?? 0,
      priorRefunds: existing.data,
    })

    if (confirm !== true) {
      return json({ preview: true, amountCents: toRefund, rule })
    }

    if (toRefund > 0) {
      await stripe.refunds.create(
        {
          payment_intent: invoice.payment_intent as string,
          amount: toRefund,
          reason: 'requested_by_customer',
          metadata: { org_id: orgId, invoice_id: invoice.id ?? '', rule, refunded_by: user.id },
        },
        // VERROU 1 — idempotence Stripe dérivée de la facture.
        { idempotencyKey: `org-refund:${invoice.id}` },
      )
    }

    // Exception légale : le contrat prend fin.
    if (liveSubscriptionId) await stripe.subscriptions.cancel(liveSubscriptionId)

    const refundedAt = new Date().toISOString()
    if (withdrawalSubId) {
      const { error: markError } = await supabaseAdmin
        .from('org_withdrawals')
        .update({ refunded_at: refundedAt, refunded_cents: toRefund })
        .eq('stripe_subscription_id', withdrawalSubId)
      if (markError) {
        await opsAlert('stripe-org-refund', `remboursement fait mais retractation NON marquee (org ${orgId})`)
      }
    }

    if (recipient && toRefund > 0) {
      await sendBillingMail(
        'stripe-org-refund',
        recipient,
        refundDoneMail({ orgName: org?.name ?? '', amountCents: toRefund, refundedAt, appUrl: APP_URL }),
      )
    }

    return json({ ok: true, refundedCents: toRefund })
  } catch (err) {
    console.error('stripe-org-refund error:', err)
    await opsAlert('stripe-org-refund', 'remboursement admin ECHOUE — a reprendre depuis le tableau de bord Stripe')
    return json({ error: 'refund_failed' }, 500)
  }
}))
