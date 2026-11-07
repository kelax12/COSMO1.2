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
// RÉTRACTATION (décision du 2026-11-01) : aucune renonciation, le client garde
// ses 14 jours. Mais la demande EXPRESSE d'accès immédiat et la version des
// CGV sont exigées et tracées (`billing_acceptances`, mig. 237) : c'est ce
// qui rend opposable le prorata de la période utilisée (L221-25).
// ═══════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14.21.0'
import { withTrace } from '../_shared/trace.ts'
import { CGV_VERSION } from '../_shared/billing-mail-text.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { customerContactFields } from '../_shared/org-billing-contact.ts'
import { priceIdForTier, tierByKey, FREE_TIER_MAX_MEMBERS } from '../_shared/org-tiers.ts'
import type { OrgBillingInterval } from '../_shared/org-tiers.ts'
import { resolveYearlyPriceId } from '../_shared/org-stripe-prices.ts'
import { isResourceMissing } from '../_shared/stripe-errors.ts'
import { checkoutBlockFor } from '../_shared/org-checkout-gate.ts'
import { corsHeadersFor, requireEnv } from '../_shared/env.ts'

const APP_URL = requireEnv('APP_URL')
Deno.serve(withTrace('stripe-org-checkout', async (req) => {
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

    const { orgId, tierKey, interval, immediateAccess, cgvVersion } =
      await req.json().catch(() => ({}))
    if (typeof orgId !== 'string' || typeof tierKey !== 'string') {
      return json({ error: 'bad_request' }, 400)
    }

    // Case non cochée par défaut, obligatoire pour payer (L221-13, L221-25).
    if (immediateAccess !== true) return json({ error: 'immediate_access_required' }, 400)
    // Un onglet resté sur d'anciennes CGV ne paie pas sous une version qu'il
    // n'a pas lue.
    if (cgvVersion !== CGV_VERSION) return json({ error: 'cgv_outdated' }, 409)

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
    // SV-8 : l'erreur est LUE, comme dans `stripe-org-refund`. « Pas
    // d'organisation » et « je n'ai pas pu lire » ne sont pas la même chose.
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id')
      .eq('id', orgId)
      .maybeSingle()
    if (orgError) throw orgError

    // Même réponse pour « org inexistante » et « pas le propriétaire » : ne pas
    // confirmer l'existence d'une organisation dont on connaîtrait l'UUID.
    if (!org || org.owner_id !== user.id) {
      return json({ error: 'forbidden' }, 403)
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // 🔴 SV-8 : cette lecture décide de « déjà abonné » et du customer
    // réutilisé. Avalée, une panne envoyait un abonné actif sur un SECOND
    // checkout (double prélèvement), avec un nouveau customer qui écrasait le
    // lien du premier : ses factures n'auraient plus trouvé leur organisation.
    const { data: sub, error: subError } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('org_id', orgId)
      .maybeSingle()
    if (subError) throw subError

    if (sub?.stripe_subscription_id) {
      // ── C-71 : un identifiant qui ne vit plus dans le compte présenté ──
      //
      // `resource_missing` (404) est le cas de TOUS les abonnements de test le
      // jour du passage en compte live (mig. 140 non encore jouée), ou d'un
      // abonnement supprimé côté Stripe après coup. On ne bloque alors
      // personne derrière un identifiant mort : on repart sur une souscription
      // neuve, exactement comme si `org_subscriptions` n'en portait aucun.
      //
      // Toute AUTRE erreur Stripe continue de relancer — « en cas de doute,
      // faire retenter Stripe, jamais deviner ».
      let existing: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>> | null = null
      try {
        existing = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      } catch (err) {
        if (!isResourceMissing(err)) throw err
      }
      // Changement de palier = portail Stripe, pas un second checkout. Un
      // impayé (`past_due`, `unpaid`) aussi : Stripe retente encore le premier
      // abonnement, un second ferait prélever deux fois.
      const blocked = checkoutBlockFor(existing?.status)
      if (blocked) return json({ error: blocked }, 400)
    }

    // ── Contact de facturation (mig. 180) ──
    //
    // Stripe envoie factures et reçus à `customer.email`. Un contact posé par
    // le propriétaire (un service comptable) prend cette place ; sans contact,
    // c'est l'adresse du propriétaire, comme avant. L'erreur de lecture n'est
    // PAS avalée : elle déciderait en silence du destinataire des factures.
    const { data: billingContact, error: contactError } = await supabaseAdmin
      .from('org_billing_contacts')
      .select('name, email')
      .eq('org_id', orgId)
      .maybeSingle()
    if (contactError) throw contactError
    const contactFields = customerContactFields(billingContact ?? null, user.email)

    let customerId = sub?.stripe_customer_id ?? null

    if (customerId) {
      // Customer déjà créé (souscription précédente, résiliée) : on lui
      // reporte le contact actuel ET la mention 293 B avant de le renvoyer au
      // paiement. Sans contact, l'adresse reste celle du propriétaire, qui est
      // l'appelant (seul le propriétaire atteint cette ligne).
      await stripe.customers.update(customerId, contactFields)
    }

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          ...contactFields,
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

    // Preuve AVANT la session : sans trace de la demande d'accès immédiat, le
    // prorata serait inopposable (remboursement intégral).
    const { error: accError } = await supabaseAdmin.from('billing_acceptances').insert({
      org_id: orgId,
      user_id: user.id,
      cgv_version: CGV_VERSION,
      immediate_access_at: new Date().toISOString(),
      tier_key: tier.key,
      billing_interval: billingInterval,
    })
    if (accError) throw accError

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
        metadata: { org_id: orgId, tier_key: tier.key, billing_interval: billingInterval, payer_uid: user.id },
        subscription_data: {
          metadata: { org_id: orgId, tier_key: tier.key, billing_interval: billingInterval, payer_uid: user.id },
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
              + 'possible à tout moment depuis votre espace entreprise. '
              + 'Droit de rétractation de 14 jours : ayant demandé l’accès immédiat, '
              + 'la période déjà utilisée vous serait facturée au prorata. '
              + `Conditions générales de vente : ${APP_URL}/cgu`,
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
}))
