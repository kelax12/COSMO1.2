import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
  // L-13 — Stripe only POSTs; reject other methods early without parsing.
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    )
  } catch (err) {
    // Log the full error server-side, but never echo it back to anonymous
    // callers — the message reveals webhook secret configuration state and
    // SDK internals. Faille N9.
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  // M-4 / M-5 — Idempotency check happens BEFORE handler (dedup), but the
  // "processed" marker is only written AFTER the handler succeeds. The
  // previous flow marked the event processed first, so a handler crash
  // turned at-least-once delivery into at-most-once and silently dropped
  // the event (Stripe never retries an event marked done).
  //
  // Pre-check ignores 23505 (concurrent delivery) and lets two parallel
  // workers race; the handlers are idempotent (upserts). The post-handler
  // INSERT then becomes the durable "done" marker.
  const { data: alreadyProcessed } = await supabaseAdmin
    .from('processed_stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()
  if (alreadyProcessed) {
    return new Response(JSON.stringify({ received: true, deduped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      default:
        // Ignore unhandled events
        break
    }
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err)
    return new Response('Internal error', { status: 500 })
  }

  // Mark as processed only AFTER the handler succeeded. Race with concurrent
  // delivery → one INSERT wins, the other 23505 (treated as success); both
  // handlers ran but our writes are idempotent. Any other DB error → 500 so
  // Stripe retries the event (the idempotent handler will re-converge).
  const { error: dedupError } = await supabaseAdmin
    .from('processed_stripe_events')
    .insert({
      id: event.id,
      event_type: event.type,
      created_at: new Date(event.created * 1000).toISOString(),
    })
  if (dedupError) {
    const code = (dedupError as { code?: string }).code
    if (code !== '23505') {
      // Persistence failure (schema drift, RLS, network) — without the marker
      // we lose idempotency. Force Stripe to retry. Faille M-5.
      console.error('processed_stripe_events insert error:', dedupError)
      return new Response('Internal error', { status: 500 })
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ─── Event handlers ────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return

  const supabaseUid = session.metadata?.supabase_uid
  if (!supabaseUid) {
    console.error('checkout.session.completed: missing supabase_uid in metadata')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  // Initial subscription: set tokens + reset win_streak to 1.
  await applySubscriptionToDb(supabaseUid, subscription, session.customer as string, {
    resetTokens: true,
    resetWinStreak: true,
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const uid = await getUidFromCustomer(subscription.customer as string)
  if (!uid) return
  // Generic update event (billing address, payment method, etc.). Only sync
  // plan/status/period_end — preserve tokens and win_streak. The previous
  // implementation reset both on every event, destroying ad-earned tokens and
  // clamping win_streak to {0, 1}. Faille B10/W6.
  await applySubscriptionToDb(uid, subscription, subscription.customer as string, {
    resetTokens: false,
    resetWinStreak: false,
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const uid = await getUidFromCustomer(subscription.customer as string)
  if (!uid) return

  await supabaseAdmin
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'cancelled',
      current_period_end: null,
      premium_tokens: 0,
      stripe_subscription_id: subscription.id,
    })
    .eq('user_id', uid)
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const uid = await getUidFromCustomer(invoice.customer as string)
  if (!uid) return
  // Renewal: refresh tokens AND increment win_streak by 1.
  await applySubscriptionToDb(uid, subscription, invoice.customer as string, {
    resetTokens: true,
    incrementWinStreak: true,
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer) return
  const uid = await getUidFromCustomer(invoice.customer as string)
  if (!uid) return

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('user_id', uid)
}

// ─── Persistence ───────────────────────────────────────────────────

type ApplyOpts = {
  resetTokens?: boolean
  resetWinStreak?: boolean
  incrementWinStreak?: boolean
}

async function applySubscriptionToDb(
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string,
  opts: ApplyOpts = {},
) {
  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const periodEnd = new Date(subscription.current_period_end * 1000)
  const daysLeft = isActive
    ? Math.max(1, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  // Always-written subscription state.
  const payload: {
    user_id: string
    plan: string
    status: string
    current_period_end: string | null
    stripe_customer_id: string
    stripe_subscription_id: string
    premium_tokens?: number
    win_streak?: number
  } = {
    user_id: userId,
    plan: isActive ? 'premium' : 'free',
    status: isActive ? 'active' : 'cancelled',
    current_period_end: isActive ? periodEnd.toISOString() : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  }

  // premium_tokens / win_streak are only INCLUDED in the upsert when this event
  // is actually meant to change them. Omitting them means `ON CONFLICT DO UPDATE`
  // leaves the existing values untouched — WITHOUT a read-then-write that could
  // clobber a concurrent `credit_premium_token_from_ad` increment (token race).
  // Previously every event read the row then wrote both fields back, so a
  // subscription.updated firing alongside an ad-credit could erase the credit.
  if (!isActive) {
    // Cancellation / expiry: explicitly zero out.
    payload.premium_tokens = 0
    payload.win_streak = 0
  } else {
    if (opts.resetTokens) payload.premium_tokens = daysLeft
    if (opts.resetWinStreak) {
      payload.win_streak = 1
    } else if (opts.incrementWinStreak) {
      // Renewal (invoice.payment_succeeded): +1. This single read-modify-write
      // path is not concurrent with ad-credits in practice (renewals are not
      // user-triggered), so it stays read-based.
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('win_streak')
        .eq('user_id', userId)
        .maybeSingle()
      payload.win_streak = (existing?.win_streak ?? 0) + 1
    }
    // else: pure preserve (e.g. subscription.updated) → omit both fields.
  }

  // Atomic upsert keyed by user_id — replaces the previous UPDATE-then-INSERT
  // pattern that had a race window producing duplicate-key errors. Faille U2.
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(payload, { onConflict: 'user_id' })
  if (error) {
    console.error('applySubscriptionToDb upsert error:', error)
    throw error
  }
}

async function getUidFromCustomer(customerId: string): Promise<string | null> {
  // Try subscriptions table first (fastest)
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (data?.user_id) return data.user_id

  // Fallback: look up customer metadata in Stripe
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return (customer as Stripe.Customer).metadata?.supabase_uid ?? null
}
