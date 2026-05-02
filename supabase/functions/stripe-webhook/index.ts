import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
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
    console.error('Webhook signature verification failed:', err)
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
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

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return

  const supabaseUid = session.metadata?.supabase_uid
  if (!supabaseUid) {
    console.error('checkout.session.completed: missing supabase_uid in metadata')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  await applySubscriptionToDb(supabaseUid, subscription, session.customer as string)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const uid = await getUidFromCustomer(subscription.customer as string)
  if (!uid) return
  await applySubscriptionToDb(uid, subscription, subscription.customer as string)
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
  await applySubscriptionToDb(uid, subscription, invoice.customer as string)
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

async function applySubscriptionToDb(
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string,
) {
  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const periodEnd = new Date(subscription.current_period_end * 1000)
  const daysLeft = isActive
    ? Math.max(1, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan: isActive ? 'premium' : 'free',
        status: isActive ? 'active' : 'cancelled',
        current_period_end: isActive ? periodEnd.toISOString() : null,
        premium_tokens: daysLeft,
        win_streak: isActive ? 1 : 0,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('applySubscriptionToDb error:', error)
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
