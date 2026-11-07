// ═══════════════════════════════════════════════════════════════════
// Rétractation et résiliation d'un abonnement d'organisation
// (REMBOURSEMENT-RESILIATION.md, décision du 2026-11-01)
// ═══════════════════════════════════════════════════════════════════
//
// Actions, toutes réservées au PROPRIÉTAIRE de l'organisation :
//
//   • `withdrawal_preview` : le récapitulatif de l'écran de rétractation
//     (montant qui sera remboursé, fin du délai). N'écrit rien.
//   • `withdraw` : rétractation (art. L221-21). Dans les 14 jours suivant la
//     conclusion du contrat seulement. Arrête l'abonnement IMMÉDIATEMENT,
//     enregistre la rétractation (`org_withdrawals`), envoie l'accusé de
//     réception et alerte l'équipe.
//     ❌ AUCUN REMBOURSEMENT ICI. Il est fait à la main par l'admin
//     (`stripe-org-refund`), dans les 14 jours (art. L221-24).
//   • `cancel` : résiliation, `cancel_at_period_end = true`. Accès jusqu'à la
//     fin de la période payée. ❌ Jamais de remboursement.
//   • `resume` : annule la résiliation tant que la période court.
//   • `cancel_now` : arrêt immédiat, sans remboursement. Utilisé seulement
//     par la suppression de l'organisation (`useDeleteOrgFlow`), qui emporte
//     `org_subscriptions` en cascade : sans lui, un débit orphelin.
//
// Secrets : `STRIPE_SECRET_KEY`, `APP_URL`, `BILLING_FROM`, `RESEND_API_KEY`.
// Déploiement : `supabase functions deploy stripe-org-subscription --use-api`
// ═══════════════════════════════════════════════════════════════════

import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withTrace } from '../_shared/trace.ts'
import { opsAlert } from '../_shared/alert.ts'
import { refundAmount, withinWithdrawalWindow, withdrawalDeadline } from '../_shared/refund-amount.ts'
import { cancellationMail, withdrawalAckMail } from '../_shared/billing-mail-text.ts'
import { sendBillingMail } from '../_shared/billing-mail.ts'
import { corsHeadersFor, requireEnv } from '../_shared/env.ts'

const APP_URL = requireEnv('APP_URL')
const ACTIONS = new Set(['withdrawal_preview', 'withdraw', 'cancel', 'resume', 'cancel_now'])

Deno.serve(withTrace('stripe-org-subscription', async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let action = ''
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

    const body = await req.json().catch(() => ({}))
    const orgId = body?.orgId
    action = body?.action
    if (typeof orgId !== 'string' || typeof action !== 'string' || !ACTIONS.has(action)) {
      return json({ error: 'bad_request' }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // PROPRIÉTAIRE UNIQUEMENT. L'erreur de lecture est LUE.
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id, name')
      .eq('id', orgId)
      .maybeSingle()
    if (orgError) throw orgError
    if (!org || org.owner_id !== user.id) return json({ error: 'forbidden' }, 403)

    const { data: sub, error: subError } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('org_id', orgId)
      .maybeSingle()
    if (subError) throw subError
    if (!sub?.stripe_subscription_id) return json({ error: 'no_subscription' }, 400)

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    if (subscription.status === 'canceled') return json({ error: 'no_subscription' }, 400)

    const now = Math.floor(Date.now() / 1000)

    // ── Résiliation et son annulation ────────────────────────────────
    if (action === 'cancel' || action === 'resume') {
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: action === 'cancel',
      })
      // Le webhook réécrit la même valeur ; on la pose tout de suite pour que
      // l'écran relu après coup dise juste.
      const { error: upError } = await supabaseAdmin
        .from('org_subscriptions')
        .update({ cancel_at_period_end: action === 'cancel' })
        .eq('org_id', orgId)
      if (upError) console.error('cancel_at_period_end write failed:', upError)

      const accessUntil = new Date(updated.current_period_end * 1000).toISOString()
      if (action === 'cancel' && user.email) {
        await sendBillingMail(
          'stripe-org-subscription',
          user.email,
          cancellationMail({ orgName: org.name ?? '', accessUntil, appUrl: APP_URL }),
        )
      }
      return json({ ok: true, cancelAtPeriodEnd: action === 'cancel', accessUntil })
    }

    if (action === 'cancel_now') {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
      return json({ ok: true })
    }

    // ── Rétractation ─────────────────────────────────────────────────
    // Délai : 14 jours à compter de la CONCLUSION du contrat, c'est-à-dire du
    // début de l'abonnement Stripe. Un renouvellement ne le rouvre pas.
    const contractStart = subscription.start_date
    if (!withinWithdrawalWindow(contractStart, now)) {
      return json({ error: 'withdrawal_window_closed' }, 400)
    }

    const { data: already, error: alreadyError } = await supabaseAdmin
      .from('org_withdrawals')
      .select('withdrawn_at, amount_due_cents')
      .eq('stripe_subscription_id', sub.stripe_subscription_id)
      .maybeSingle()
    if (alreadyError) throw alreadyError
    if (already) {
      return json({ ok: true, withdrawnAt: already.withdrawn_at, amountCents: already.amount_due_cents })
    }

    const invoices = await stripe.invoices.list({
      customer: sub.stripe_customer_id ?? undefined,
      subscription: sub.stripe_subscription_id,
      status: 'paid',
      limit: 1,
    })
    const invoice = invoices.data[0]

    // Demande expresse d'accès immédiat, recueillie au checkout. Sans elle,
    // remboursement intégral.
    const { data: acceptance, error: accError } = await supabaseAdmin
      .from('billing_acceptances')
      .select('immediate_access_at')
      .eq('org_id', orgId)
      .lte('created_at', new Date((contractStart + 3600) * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (accError) throw accError

    const decision = refundAmount({
      amountPaidCents: invoice?.amount_paid ?? 0,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
      now,
      immediateAccessRequested: !!acceptance?.immediate_access_at,
    })

    if (action === 'withdrawal_preview') {
      return json({
        eligible: true,
        amountCents: decision.amountCents,
        deadline: new Date(withdrawalDeadline(contractStart) * 1000).toISOString(),
        recipient: user.email ?? '',
      })
    }

    // 1. Arrêt IMMÉDIAT de l'abonnement, sans prorata ni remboursement Stripe.
    await stripe.subscriptions.cancel(sub.stripe_subscription_id, { prorate: false, invoice_now: false })

    // 2. Trace de la rétractation (preuve, alerte J+10, outil admin).
    const withdrawnAt = new Date(now * 1000).toISOString()
    const { error: insError } = await supabaseAdmin.from('org_withdrawals').insert({
      org_id: orgId,
      user_id: user.id,
      recipient: user.email ?? '',
      stripe_subscription_id: sub.stripe_subscription_id,
      stripe_invoice_id: invoice?.id ?? null,
      withdrawn_at: withdrawnAt,
      amount_due_cents: decision.amountCents,
      rule: decision.reason,
    })
    if (insError) {
      await opsAlert('stripe-org-subscription', `retractation faite chez Stripe mais NON enregistree (org ${orgId}) : rembourser a la main`)
      throw insError
    }

    // 3. Accusé de réception sur support durable.
    let ackId: string | null = null
    if (user.email) {
      ackId = await sendBillingMail(
        'stripe-org-subscription',
        user.email,
        withdrawalAckMail({ orgName: org.name ?? '', withdrawnAt, amountCents: decision.amountCents, appUrl: APP_URL }),
      )
      if (ackId) {
        await supabaseAdmin.from('org_withdrawals').update({ ack_message_id: ackId })
          .eq('stripe_subscription_id', sub.stripe_subscription_id)
      }
    }

    // 4. L'équipe rembourse à la main sous 14 jours.
    await opsAlert(
      'stripe-org-subscription',
      `RETRACTATION org ${orgId} : ${(decision.amountCents / 100).toFixed(2)} EUR a rembourser avant 14 jours (outil admin)`,
    )

    return json({ ok: true, withdrawnAt, amountCents: decision.amountCents })
  } catch (err) {
    console.error('stripe-org-subscription error:', err)
    await opsAlert('stripe-org-subscription', `action ${action || '?'} ECHOUEE sur un abonnement d organisation`)
    return json({ error: 'subscription_action_failed' }, 500)
  }
}))
