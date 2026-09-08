// ═══════════════════════════════════════════════════════════════════
// Portail de facturation Stripe d'une organisation.
//
// Délègue à Stripe tout ce qu'on n'a pas à construire : changement de carte,
// factures, changement de palier, RÉSILIATION. Sans ce portail, un client ne
// peut pas résilier sans nous écrire.
//
// ⚠️ Un changement de palier fait ICI ne passe pas par notre checkout : c'est
// `customer.subscription.updated` qui doit redériver le palier depuis le price
// ID reçu (voir `stripe-webhook`). Sans ça, le client paie le nouveau palier
// et garde l'ancien quota de sièges.
//
// AUTORISATION : propriétaire de l'organisation uniquement, comme le checkout.
// ═══════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { isResourceMissing } from '../_shared/stripe-errors.ts'

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

    const { orgId } = await req.json().catch(() => ({}))
    if (typeof orgId !== 'string') return json({ error: 'bad_request' }, 400)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id')
      .eq('id', orgId)
      .maybeSingle()
    if (!org || org.owner_id !== user.id) return json({ error: 'forbidden' }, 403)

    const { data: sub } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      // Aucun customer Stripe : l'org n'a jamais souscrit, il n'y a rien à gérer.
      return json({ error: 'no_customer' }, 400)
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // ── C-71 : un customer qui ne vit plus dans le compte présenté ──
    //
    // `resource_missing` (404) est le cas de tout `stripe_customer_id` de test
    // le jour du passage en compte live, ou d'un customer supprimé côté
    // Stripe après coup. Il n'y a alors rien à gérer : on le dit clairement,
    // jamais un 500 opaque. Toute AUTRE erreur Stripe continue de relancer.
    let session: Awaited<ReturnType<typeof stripe.billingPortal.sessions.create>>
    try {
      session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${APP_URL}/entreprise?tab=billing`,
      })
    } catch (err) {
      if (!isResourceMissing(err)) throw err
      return json({ error: 'no_customer' }, 400)
    }

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-org-portal error:', err)
    await opsAlert('stripe-org-portal', 'billing portal session creation failed — customer cannot manage or cancel')
    return json({ error: 'Internal server error' }, 500)
  }
})
