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
//
// 🔴 ORDRE DE DÉPLOIEMENT — LIRE AVANT DE DÉPLOYER CETTE FONCTION
//
//   1. appliquer `supabase/migration/135_withdrawal_consents.sql` ;
//   2. seulement ensuite, `supabase functions deploy stripe-org-checkout`.
//
// Cette fonction refuse TOUTE session de paiement tant que la table
// `withdrawal_consents` n'existe pas (finding S-6 : la preuve de renonciation
// s'écrit AVANT la session, et son échec est bloquant). C'est le bon sens de
// l'échec — on n'encaisse pas sans pouvoir prouver — mais déployée dans le
// mauvais ordre, elle coupe l'encaissement en silence côté client : une erreur
// 500 générique, et rien dans l'écran qui dise pourquoi.
//
// L'alerte ops émise dans ce cas NOMME la migration, pour que le diagnostic
// tienne en une lecture de log plutôt qu'en une enquête.
// ═══════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { priceIdForTier, tierByKey, FREE_TIER_MAX_MEMBERS } from '../_shared/org-tiers.ts'
import type { OrgBillingInterval } from '../_shared/org-tiers.ts'
import { resolveYearlyPriceId } from '../_shared/org-stripe-prices.ts'

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

    const { orgId, tierKey, interval, immediateExecution, waivesWithdrawal } =
      await req.json().catch(() => ({}))
    if (typeof orgId !== 'string' || typeof tierKey !== 'string') {
      return json({ error: 'bad_request' }, 400)
    }

    // ── S-6 : la renonciation au droit de rétractation est EXIGÉE ────
    //
    // Art. L221-28, 13° : le délai de quatorze jours ne tombe que si le
    // consommateur a donné DEUX manifestations distinctes — accord exprès à
    // l'exécution immédiate, et reconnaissance de perdre son droit une fois le
    // service pleinement fourni.
    //
    // `OrgBillingTab` les recueillait déjà, mais elles ne quittaient pas le
    // navigateur : elles gardaient un bouton. Un appel direct à cette fonction
    // ouvrait donc une session de paiement sans aucun consentement, alors que
    // les CGU affirment « le paiement ne peut être engagé sans elles ».
    //
    // ⚠️ On exige les DEUX séparément, et strictement `true`. Accepter une
    // valeur « truthy » reviendrait à accepter `"false"`, et fondre les deux en
    // un seul drapeau ferait exactement ce que le texte interdit : un accord
    // global à la place de deux accords distincts.
    if (immediateExecution !== true || waivesWithdrawal !== true) {
      return json({ error: 'withdrawal_consent_required' }, 400)
    }

    // Périodicité : le client n'envoie qu'un mot d'une liste fermée, jamais un
    // montant ni un price ID. Absente = mensuel, pour que les appels écrits
    // avant l'annuel continuent de marcher à l'identique.
    if (interval !== undefined && interval !== 'monthly' && interval !== 'yearly') {
      return json({ error: 'bad_request' }, 400)
    }
    const billingInterval: OrgBillingInterval = interval === 'yearly' ? 'yearly' : 'monthly'

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
          // ⚠️ La clé s'appelle `org_owner_uid`, PAS `supabase_uid`. Ce nom est
          // délibérément évité ici : dans le webhook, `getUidFromCustomer` lit
          // `metadata.supabase_uid` comme MARQUEUR d'un customer PARTICULIER.
          // Poser cette clé sur le customer d'une organisation permettait à une
          // facture d'org mal routée de se résoudre en un uid personnel, et
          // d'écraser l'abonnement privé du propriétaire.
          metadata: { org_id: orgId, org_owner_uid: user.id },
        },
        { idempotencyKey: `org-customer:${orgId}` },
      )
      customerId = customer.id

      // Upsert AVANT la session : sans ça, un retour d'erreur laisse un
      // customer Stripe orphelin et le prochain appel en recrée un (faille U1).
      //
      // ⚠️ L'erreur n'est PAS ignorable. Cette ligne est le SEUL lien
      // customer Stripe → organisation : sans elle, le webhook ne sait pas
      // qu'une facture appartient à une org. Or Stripe livre fréquemment
      // `invoice.payment_succeeded` AVANT `checkout.session.completed`, donc la
      // toute première facture d'un client qui vient de payer serait mal
      // routée. On échoue avant d'envoyer qui que ce soit sur la page de
      // paiement ; l'`idempotencyKey` de `customers.create` garantit qu'un
      // nouvel essai ne créera pas un second customer Stripe.
      const { error: linkError } = await supabaseAdmin.from('org_subscriptions').upsert(
        {
          org_id: orgId,
          tier_key: 'free',
          max_members: FREE_TIER_MAX_MEMBERS,
          status: 'active',
          stripe_customer_id: customerId,
        },
        { onConflict: 'org_id' },
      )
      if (linkError) {
        console.error('org_subscriptions customer link upsert error:', linkError)
        await opsAlert(
          'stripe-org-checkout',
          'could not persist the Stripe customer link before checkout — session aborted to avoid a misrouted first invoice',
        )
        return json({ error: 'Internal server error' }, 500)
      }
    }

    const env = (name: string) => Deno.env.get(name)

    // ── Le price ID à facturer ──
    //
    // Mensuel : désigné par un secret, rien à choisir.
    // Annuel : dérivé du produit Stripe du prix mensuel, avec vérification du
    // montant (`_shared/org-stripe-prices.ts`). Aucun secret à poser.
    let priceId: string | null = null

    if (billingInterval === 'yearly') {
      const resolved = await resolveYearlyPriceId(stripe, tier, env)
      if (resolved.ok) {
        priceId = resolved.priceId
      } else {
        // Erreur DISTINCTE du mensuel : le propriétaire doit pouvoir basculer
        // sur le mensuel, qui lui fonctionne, au lieu de croire que tout le
        // paiement est en panne.
        await opsAlert(
          'stripe-org-checkout',
          `prix annuel introuvable pour le palier ${tier.key} (${resolved.reason}: ${resolved.detail})`,
        )
        return json({ error: 'yearly_unavailable' }, 503)
      }
    } else {
      priceId = priceIdForTier(tier.key, env, 'monthly')
    }

    if (!priceId) {
      // Secret non configuré : échouer bruyamment plutôt que de créer une
      // session vide ou de facturer le mauvais palier.
      await opsAlert(
        'stripe-org-checkout',
        `price id manquant pour le palier ${tier.key} (${billingInterval})`,
      )
      return json({ error: 'tier_unavailable' }, 500)
    }

    // ── S-6 : la preuve s'écrit AVANT le paiement ───────────────────
    //
    // L'ordre EST la preuve : le consentement précède la session, jamais
    // l'inverse. Une ligne sans paiement derrière est inoffensive (un accord
    // donné, un achat abandonné) ; un paiement sans ligne serait le trou qu'on
    // ferme.
    //
    // ⚠️ L'échec est BLOQUANT. C'est le même raisonnement que le lien customer
    // plus haut : ouvrir une page de paiement en sachant qu'on ne pourra rien
    // produire en cas de litige, c'est encaisser sans preuve. `renewal_notices`
    // suit la règle inverse (envoyer d'abord, tracer ensuite) parce qu'un avis
    // parti sans trace vaut mieux qu'un avis jamais parti — ici, rien n'est
    // encore engagé, donc renoncer ne coûte rien.
    const { error: consentError } = await supabaseAdmin.from('withdrawal_consents').insert({
      org_id: orgId,
      user_id: user.id,
      tier_key: tier.key,
      billing_interval: billingInterval,
      immediate_execution: true,
      waives_withdrawal: true,
    })
    if (consentError) {
      console.error('withdrawal_consents insert error:', consentError)
      // Le message NOMME la cause la plus probable : la table n'existe pas
      // parce que la fonction a ete deployee avant la migration 135. Une
      // alerte qui dit seulement « echec » fait recommencer l'enquete.
      const missingTable = (consentError as { code?: string }).code === '42P01'
      await opsAlert(
        'stripe-org-checkout',
        missingTable
          ? 'table withdrawal_consents ABSENTE — appliquer supabase/migration/135_withdrawal_consents.sql, la fonction a ete deployee avant sa migration. Aucun paiement ne peut aboutir d ici la.'
          : 'preuve de renonciation au droit de retractation NON enregistree — session de paiement refusee',
      )
      return json({ error: 'Internal server error' }, 500)
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
        metadata: { org_id: orgId, tier_key: tier.key, billing_interval: billingInterval },
        subscription_data: {
          metadata: { org_id: orgId, tier_key: tier.key, billing_interval: billingInterval },
        },
        // ── Bouton de commande sans ambiguïté (Code de la consommation
        // art. L221-14) ────────────────────────────────────────────────
        //
        // Le consommateur doit comprendre, AU MOMENT DE VALIDER, que le clic
        // l'oblige à payer. La formule de référence est « commande avec
        // obligation de paiement » ; un libellé qui ne la vaut pas rend le
        // contrat inopposable, donc le paiement contestable.
        //
        // Pourquoi `custom_text` et pas `submit_type` : `submit_type` n'existe
        // PAS en `mode: 'subscription'`. Le bouton de Stripe y est figé (« S'abonner »),
        // et il est le seul élément qu'on ne peut pas réécrire. On rend donc
        // l'engagement explicite juste au-dessus, là où le regard se pose avant
        // le clic.
        //
        // La règle ne s'applique ici QUE parce que rien ne vérifie qu'un
        // acheteur est un professionnel : tout acheteur peut être un
        // consommateur. Décision assumée du 2026-08-26, cf. docs/LEGAL.md.
        //
        // ❌ Ne pas traduire ce texte côté COSMO : Stripe rend la page dans la
        // langue du navigateur, et un texte figé en français sur une page
        // anglaise serait pire que pas de texte. Le passage au bilingue suppose
        // de propager la locale de l'appelant, pas de coder une chaîne en dur.
        custom_text: {
          submit: {
            message:
              'En validant, vous passez une commande avec obligation de paiement : '
              + "l'abonnement est payant et reconduit automatiquement jusqu'à sa résiliation, "
              + "possible à tout moment depuis votre espace entreprise.",
          },
        },
      },
      // La périodicité entre dans la clé d'idempotence : sans elle, un
      // propriétaire qui abandonne un checkout mensuel puis en relance un
      // annuel le même jour se verrait resservir la session mensuelle.
      { idempotencyKey: `org-checkout:${orgId}:${tier.key}:${billingInterval}:${dayKey}` },
    )

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-org-checkout error:', err)
    await opsAlert('stripe-org-checkout', 'org checkout session creation failed — customer could not subscribe')
    return json({ error: 'Internal server error' }, 500)
  }
})
