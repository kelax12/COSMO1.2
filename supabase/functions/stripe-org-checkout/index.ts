// ═══════════════════════════════════════════════════════════════════
// Checkout Stripe d'une ORGANISATION (abonnement par palier).
//
// Distincte de `stripe-create-checkout` (abonnement particulier, montant fixe,
// clé `user_id`) : ici le sujet payant est l'organisation, le montant dépend
// du palier choisi, et l'état vit dans `org_subscriptions`.
//
// AUTORISATION : seul `organizations.owner_id` peut souscrire. C'est la SEULE
// vérification qui compte — le front ne fait que masquer un bouton.
//
// COUPONS : `allow_promotion_codes: true` fait apparaître le champ « code
// promo » dans la page Stripe. Les codes sont créés et administrés depuis le
// dashboard Stripe ; COSMO n'en valide aucun et n'en recalcule aucun montant,
// donc aucune surface de brute-force n'est ouverte de notre côté.
// ═══════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { priceIdForTier, tierByKey } from '../_shared/org-tiers.ts'

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

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

    const { orgId, tierKey } = await req.json().catch(() => ({}))
    if (typeof orgId !== 'string' || typeof tierKey !== 'string') {
      return json({ error: 'bad_request' }, 400)
    }

    const tier = tierByKey(tierKey)
    if (!tier || tier.key === 'free') {
      return json({ error: 'invalid_tier' }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── Autorisation : propriétaire de l'organisation, et lui seul ──
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id')
      .eq('id', orgId)
      .maybeSingle()

    // Même réponse pour « org inexistante » et « pas le propriétaire » : ne pas
    // confirmer l'existence d'une organisation dont on connaîtrait l'UUID.
    if (!org || org.owner_id !== user.id) {
      return json({ error: 'forbidden' }, 403)
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { data: sub } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (sub?.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      if (existing.status === 'active' || existing.status === 'trialing') {
        // Changement de palier = portail Stripe, pas un second checkout.
        return json({ error: 'already_subscribed' }, 400)
      }
    }

    let customerId = sub?.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          metadata: { org_id: orgId, supabase_uid: user.id },
        },
        { idempotencyKey: `org-customer:${orgId}` },
      )
      customerId = customer.id

      // Upsert AVANT la session : sans ça, un retour d'erreur laisse un
      // customer Stripe orphelin et le prochain appel en recrée un (faille U1).
      await supabaseAdmin.from('org_subscriptions').upsert(
        {
          org_id: orgId,
          tier_key: 'free',
          max_members: 5,
          status: 'active',
          stripe_customer_id: customerId,
        },
        { onConflict: 'org_id' },
      )
    }

    const priceId = priceIdForTier(tier.key, (name) => Deno.env.get(name))
    if (!priceId) {
      // Secret non configuré : échouer bruyamment plutôt que de créer une
      // session vide ou de facturer le mauvais palier.
      await opsAlert('stripe-org-checkout', `price id manquant pour le palier ${tier.key}`)
      return json({ error: 'tier_unavailable' }, 500)
    }

    const dayKey = new Date().toISOString().slice(0, 10)
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${APP_URL}/entreprise?tab=billing&checkout=success`,
        cancel_url: `${APP_URL}/entreprise?tab=billing&checkout=cancelled`,
        metadata: { org_id: orgId, tier_key: tier.key },
        subscription_data: {
          metadata: { org_id: orgId, tier_key: tier.key },
        },
      },
      { idempotencyKey: `org-checkout:${orgId}:${tier.key}:${dayKey}` },
    )

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-org-checkout error:', err)
    await opsAlert('stripe-org-checkout', 'org checkout session creation failed — customer could not subscribe')
    return json({ error: 'Internal server error' }, 500)
  }
})
