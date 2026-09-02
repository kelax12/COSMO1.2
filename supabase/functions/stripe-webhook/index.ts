import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { tierFromPriceId, FREE_TIER_MAX_MEMBERS } from '../_shared/org-tiers.ts'
import { resolveTierMatch } from '../_shared/org-stripe-prices.ts'

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
  //
  // ⚠️ L'ERREUR DE LECTURE N'EST PAS IGNORABLE (audit Stripe 2026-09-02). Elle
  // l'était : `const { data } = await …` jetait `error`, donc une panne de
  // lecture se lisait « jamais traité » et rejouait les handlers. La plupart
  // sont des upserts, donc idempotents — mais PAS `bump_win_streak`, qui
  // incrémente. Un rejeu y ajoutait une victoire jamais gagnée, et c'est
  // exactement ce que ce pré-contrôle existe pour empêcher. On renvoie 500 :
  // Stripe retente, et la lecture rétablie tranchera.
  const { data: alreadyProcessed, error: dedupReadError } = await supabaseAdmin
    .from('processed_stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()
  if (dedupReadError) {
    console.error('processed_stripe_events read error:', dedupReadError)
    await opsAlert(
      'stripe-webhook',
      `lecture du marqueur d idempotence impossible pour l event ${event.id} — 500 pour forcer un retry plutot que de risquer un rejeu`,
    )
    return new Response('Internal error', { status: 500 })
  }
  if (alreadyProcessed) {
    return new Response(JSON.stringify({ received: true, deduped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Routage : une session portant `org_id` appartient à l'univers
        // entreprise, jamais à l'abonnement particulier (et réciproquement).
        if (session.metadata?.org_id) await handleOrgCheckoutCompleted(session)
        else await handleCheckoutCompleted(session)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.org_id) await handleOrgSubscriptionUpdated(subscription)
        else await handleSubscriptionUpdated(subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.org_id) await handleOrgSubscriptionDeleted(subscription)
        else await handleSubscriptionDeleted(subscription)
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = await orgIdFromInvoice(invoice)
        // Journal AVANT les handlers métier : `org_subscriptions` est muté en
        // place, donc si l'écriture métier échoue à mi-chemin, on veut quand
        // même la trace de l'encaissement. Une ligne journalisée sans état
        // produit à jour se rattrape ; l'inverse, non.
        await recordPayment(event, invoice, orgId)
        if (orgId) await handleOrgInvoicePaid(orgId, invoice)
        else await handleInvoicePaymentSucceeded(invoice)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = await orgIdFromInvoice(invoice)
        // Un échec de paiement est un mouvement, pas un non-événement : il
        // explique un trou dans la séquence des encaissements. Un journal qui
        // ne montre que les succès se lit mal en contrôle.
        await recordPayment(event, invoice, orgId)
        if (orgId) await handleOrgInvoiceFailed(orgId, invoice)
        else await handleInvoicePaymentFailed(invoice)
        break
      }
      default:
        // Ignore unhandled events
        break
    }
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err)
    // Alerting P1 (audit 2026-06-10) : un handler qui échoue déclenche les
    // retries Stripe ; si l'erreur persiste, Stripe finit par abandonner →
    // perte de revenu silencieuse. Résumé générique only (pas d'err brut).
    await opsAlert('stripe-webhook', `handler failed for event type ${event.type} (id ${event.id}) — Stripe will retry`)
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
      await opsAlert('stripe-webhook', `idempotency marker insert failed for event ${event.id} (code ${code ?? 'unknown'}) — forcing Stripe retry`)
      return new Response('Internal error', { status: 500 })
    }
  }

  // Rétention (audit archi 2026-08-07) : `processed_stripe_events` était
  // INSÉRÉE et jamais purgée — croissance linéaire et perpétuelle. Stripe
  // cesse de re-livrer après ~3 jours, donc une ligne de plus de 90 jours ne
  // protège plus de rien. Purge opportuniste, adossée au trafic réel : pas de
  // pg_cron à activer, et fire-and-forget car une purge ratée ne doit
  // évidemment pas faire échouer le traitement d'un paiement.
  void supabaseAdmin.rpc('prune_processed_stripe_events').then(({ error }) => {
    if (error) console.error('prune_processed_stripe_events failed:', error.message)
  })

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

/**
 * Journal d'encaissement inaltérable (mig. 125, CGI art. 286-I-3° bis).
 *
 * Écrit UNE ligne append-only par mouvement de paiement. La table refuse tout
 * UPDATE et tout DELETE par trigger, y compris venant d'ici : `service_role`
 * contourne la RLS mais pas les triggers. Le hash de chaînage est posé côté
 * base, jamais par ce code — sinon le sceau vaudrait ce que vaut le client.
 *
 * ❌ Ne JAMAIS faire échouer le webhook si le journal échoue. Stripe
 *    rejouerait l'événement, les handlers métier tourneraient une seconde
 *    fois, et l'idempotence de `stripe_event_id` rejetterait le doublon de
 *    journal : on aurait perdu la trace ET rejoué le métier. On alerte, on
 *    continue. Un trou dans le journal est visible ; un webhook en échec
 *    permanent est une perte de revenu silencieuse.
 *
 * ❌ Ne JAMAIS y stocker l'objet Stripe entier : il porte des données de carte.
 */
async function recordPayment(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  orgId: string | null,
) {
  try {
    // Le montant qui compte est celui réellement payé pour un succès, et le
    // montant dû pour un échec : `amount_paid` vaut 0 sur un échec, ce qui
    // rendrait la ligne illisible.
    const succeeded = event.type === 'invoice.payment_succeeded'
    const amount = succeeded
      ? (invoice.amount_paid ?? 0)
      : (invoice.amount_due ?? 0)

    // Un abonnement particulier n'a pas d'org : on remonte l'uid par le
    // customer, en réutilisant la garde qui refuse un customer d'organisation.
    //
    // ⚠️ `getUidFromCustomer` LÈVE désormais sur panne de lecture, et c'est
    // voulu pour les handlers métier. Ici on ne veut PAS ce comportement : une
    // ligne de journal sans `user_id` reste une ligne de journal, alors qu'une
    // ligne absente est un trou dans une pièce fiscale. Le montant, la date et
    // l'identifiant Stripe suffisent au rapprochement comptable.
    let userId: string | null = null
    if (!orgId) {
      try {
        userId = await getUidFromCustomer(invoice.customer as string)
      } catch (err) {
        console.error('recordPayment: uid lookup failed, journaling without user_id:', err)
      }
    }

    const { error } = await supabaseAdmin.from('payment_records').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_invoice_id: invoice.id ?? null,
      stripe_customer_id: (invoice.customer as string) ?? null,
      org_id: orgId,
      user_id: userId,
      amount_cents: amount,
      currency: (invoice.currency ?? 'eur').toLowerCase(),
      occurred_at: new Date(event.created * 1000).toISOString(),
      payload: {
        number: invoice.number ?? null,
        billing_reason: invoice.billing_reason ?? null,
        subscription: (invoice.subscription as string) ?? null,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      },
    })

    // 23505 = rejeu du même event. C'est l'idempotence qui fonctionne, pas
    // une erreur : la ligne d'origine est déjà scellée dans la chaîne.
    const code = (error as { code?: string } | null)?.code
    if (error && code !== '23505') {
      console.error('payment_records insert error:', error)
      await opsAlert(
        'stripe-webhook',
        `journal d encaissement NON ecrit pour l event ${event.id} (code ${code ?? 'inconnu'}) — trou dans le journal fiscal`,
      )
    }
  } catch (err) {
    console.error('recordPayment failed:', err)
    await opsAlert('stripe-webhook', `recordPayment a leve pour l event ${event.id} — trou dans le journal fiscal`)
  }
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
    if (opts.resetWinStreak) payload.win_streak = 1
    // AUD-14 — `incrementWinStreak` n'est PLUS traité ici : il l'était par un
    // read-modify-write (SELECT win_streak puis upsert n+1). Or le marqueur
    // d'idempotence n'est écrit qu'APRÈS le handler (choix délibéré, faille
    // M-5) : deux livraisons concurrentes du même event exécutent toutes deux
    // le handler, lisent la même valeur et écrivent la même — un incrément
    // perdu — ou s'entrelacent en n+2. L'incrément est désormais fait par la
    // RPC atomique `bump_win_streak` après l'upsert (voir plus bas).
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

  // AUD-14 — Incrément atomique (`UPDATE … SET win_streak = win_streak + 1`)
  // exécuté APRÈS l'upsert, pour que la ligne existe forcément. Sûr sous
  // livraison concurrente, contrairement au read-modify-write précédent.
  if (isActive && opts.incrementWinStreak) {
    const { error: bumpError } = await supabaseAdmin.rpc('bump_win_streak', {
      p_user: userId,
    })
    if (bumpError) {
      console.error('bump_win_streak error:', bumpError)
      throw bumpError
    }
  }
}

/**
 * Customer Stripe → uid COSMO, ou `null` si ce n'est pas un customer particulier.
 *
 * ⚠️ L'ERREUR DE LECTURE EST RELANCÉE (audit Stripe 2026-09-02), pour la même
 * raison qui l'a fait relancer dans `orgIdFromInvoice` : une panne de lecture
 * est indiscernable d'un « pas d'utilisateur ». En l'avalant, tous les
 * appelants faisaient `if (!uid) return` — un succès silencieux, donc le
 * marqueur d'idempotence écrit et Stripe qui ne re-livre jamais. Un paiement
 * encaissé sans que l'abonnement soit appliqué, et personne pour le voir.
 *
 * ⚠️ `maybeSingle()` LÈVE si plusieurs lignes partagent le customer. Côté
 * organisation, une contrainte UNIQUE l'interdit (mig. 101) et le commentaire
 * s'appuie dessus ; côté particulier cette contrainte MANQUE (mesuré en prod le
 * 2026-09-02 : 0 doublon aujourd'hui, aucune garde demain) — cf. mig. 134.
 */
async function getUidFromCustomer(customerId: string): Promise<string | null> {
  // Try subscriptions table first (fastest)
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (error) {
    console.error('getUidFromCustomer lookup error:', error)
    throw error
  }

  if (data?.user_id) return data.user_id

  // Fallback: look up customer metadata in Stripe
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  // Garde-fou entreprise : un customer portant `org_id` appartient à une
  // ORGANISATION et ne doit JAMAIS se résoudre en un uid particulier. Sans ce
  // test, une facture d'organisation dont le routage a échoué retombait sur la
  // branche particulier et écrasait l'abonnement PERSONNEL du propriétaire
  // (plan, status, premium_tokens, win_streak) — le tout en renvoyant un
  // succès, donc sans jamais être re-livrée par Stripe.
  if ((customer as Stripe.Customer).metadata?.org_id) return null
  return (customer as Stripe.Customer).metadata?.supabase_uid ?? null
}

// ─── Univers ENTREPRISE ────────────────────────────────────────────
//
// Écrit exclusivement dans `org_subscriptions`. Aucun jeton premium, aucun
// `win_streak` : ces notions appartiennent à l'abonnement particulier.

const env = (name: string) => Deno.env.get(name)

/**
 * Les invoices ne portent pas nos metadata : on remonte à l'org par le
 * customer Stripe, dont l'unicité est garantie en base (contrainte UNIQUE sur
 * `org_subscriptions.stripe_customer_id`, mig. 101) — c'est ce qui rend ce
 * `maybeSingle()` sûr.
 * `null` = ce n'est pas une facture d'organisation.
 *
 * ⚠️ L'erreur de requête est RELANCÉE, jamais avalée. Une panne de lecture est
 * indiscernable d'un « pas d'org » : en avalant l'erreur, une facture
 * d'organisation partait sur la branche particulier, y écrasait l'abonnement
 * personnel du propriétaire, et le handler renvoyait un succès — donc le
 * marqueur d'idempotence était écrit et Stripe ne re-livrait jamais. Un throw
 * ici produit un 500, et Stripe retente (~3 jours) : c'est exactement l'ordre
 * « marqueur écrit seulement après succès du handler » (faille M-5), auquel
 * cette fonction était la seule à se soustraire.
 */
async function orgIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  if (!invoice.customer) return null
  const { data, error } = await supabaseAdmin
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', invoice.customer as string)
    .maybeSingle()
  if (error) {
    console.error('orgIdFromInvoice lookup error:', error)
    throw error
  }
  return data?.org_id ?? null
}

async function handleOrgCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return

  const orgId = session.metadata?.org_id
  if (!orgId) return

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

  // Code promo réellement appliqué — INFORMATIF. On ne recalcule aucun
  // montant : Stripe fait foi sur ce qui est facturé.
  let discountCode: string | null = null
  try {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['total_details.breakdown.discounts.discount.promotion_code'],
    })
    const discount = full.total_details?.breakdown?.discounts?.[0]?.discount
    const promo = discount?.promotion_code
    discountCode = typeof promo === 'string' ? promo : (promo?.code ?? null)
  } catch (err) {
    // Un code promo non relu ne doit pas faire échouer l'activation payée.
    console.error('org checkout: promotion code read failed:', err)
  }

  await applyOrgSubscription(orgId, subscription, session.customer as string, discountCode)
}

async function handleOrgSubscriptionUpdated(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.org_id
  if (!orgId) return
  await applyOrgSubscription(orgId, subscription, subscription.customer as string, undefined)
}

async function handleOrgSubscriptionDeleted(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.org_id
  if (!orgId) return

  // Retour au palier gratuit. AUCUN membre n'est retiré : seule la croissance
  // de l'organisation redevient contrainte.
  //
  // Le filtre porte AUSSI sur `stripe_subscription_id` : après un cycle
  // « résiliation puis réabonnement », une livraison tardive du
  // `customer.subscription.deleted` de l'ANCIEN abonnement remettrait sinon au
  // gratuit une organisation qui vient de repayer. Aucune ligne mise à jour =
  // l'event concerne un abonnement périmé, il n'y a rien à faire.
  const { error } = await supabaseAdmin
    .from('org_subscriptions')
    .update({
      tier_key: 'free',
      max_members: FREE_TIER_MAX_MEMBERS,
      status: 'cancelled',
      current_period_end: null,
      discount_code: null,
    })
    .eq('org_id', orgId)
    .eq('stripe_subscription_id', subscription.id)
  if (error) throw error
}

async function handleOrgInvoicePaid(orgId: string, invoice: Stripe.Invoice) {
  if (!invoice.subscription) return
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
  await applyOrgSubscription(orgId, subscription, invoice.customer as string, undefined)
}

async function handleOrgInvoiceFailed(orgId: string, invoice: Stripe.Invoice) {
  // Une facture SANS abonnement n'est pas un renouvellement (facture unique,
  // ajustement manuel depuis le dashboard) : elle ne dit rien de l'état de
  // l'abonnement, donc on n'écrit rien. Marquer `past_due` sur la foi d'une
  // facture hors-abonnement couperait le quota d'une org parfaitement à jour.
  if (!invoice.subscription) return

  // `past_due` : le quota retombe au palier gratuit (org_seats_allowed n'accorde
  // le quota payant que sur `status = 'active'`), sans rien supprimer. Le
  // palier (`tier_key` / `max_members`) n'est PAS touché — il doit être restauré
  // tel quel dès le paiement rattrapé.
  //
  // Filtre sur l'abonnement concerné : l'échec d'un ancien abonnement ne doit
  // pas dégrader celui, actif, qui l'a remplacé.
  const { error } = await supabaseAdmin
    .from('org_subscriptions')
    .update({ status: 'past_due' })
    .eq('org_id', orgId)
    .eq('stripe_subscription_id', invoice.subscription as string)
  if (error) throw error
}

/**
 * Traduction EXPLICITE d'un `subscription.status` Stripe en intention d'écriture.
 *
 * ⚠️ Un booléen `active | trialing` ne suffit pas : il faisait tomber TOUS les
 * autres statuts dans « résilié / gratuit », avec deux casses réelles.
 *
 * - `incomplete` : état d'un abonnement neuf entre `checkout.session.completed`
 *   et la confirmation du paiement (3-D Secure / SCA). Stripe ne repasse jamais
 *   un abonnement déjà actif dans cet état, donc il signifie toujours « jamais
 *   activé ». Écrire ici marquait un abonnement fraîchement payé comme annulé.
 *   → on n'écrit RIEN, l'event suivant porte la vérité.
 * - `past_due` / `unpaid` : carte refusée au renouvellement. Stripe garde
 *   l'abonnement vivant ~3 semaines de relances. Le palier NE DOIT PAS être
 *   effacé : il doit être restauré tel quel dès le paiement rattrapé. Le quota
 *   retombe déjà au gratuit au niveau SQL (`org_seats_allowed` n'accorde le
 *   quota payant que sur `status = 'active'`), il n'y a donc rien à dégrader
 *   ici. C'est aussi le statut qu'écrit `handleOrgInvoiceFailed` pour le même
 *   échec : les deux handlers convergent enfin au lieu de se contredire.
 * - `incomplete_expired` : le paiement initial a définitivement échoué,
 *   l'abonnement ne s'activera jamais → gratuit, comme une résiliation.
 * - `canceled`, `paused`, et TOUT statut inconnu (défaut) : branche
 *   conservatrice « gratuit ». Un futur statut Stripe atterrit ici plutôt que
 *   de ne rien faire silencieusement.
 */
type OrgSubIntent = 'active' | 'past_due' | 'skip' | 'cancelled'

function orgIntentFromStatus(status: Stripe.Subscription.Status): OrgSubIntent {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'incomplete':
      return 'skip'
    default:
      // canceled, paused, incomplete_expired, et tout statut futur inconnu.
      return 'cancelled'
  }
}

/**
 * Convertit un abonnement Stripe en état de facturation d'organisation.
 *
 * ⚠️ LE POINT CRITIQUE DE TOUT LE SYSTÈME. Le palier est redérivé du PRICE ID
 * porté par l'abonnement, jamais des metadata : un changement de palier fait
 * depuis le Billing Portal ne repasse pas par notre checkout, donc les
 * metadata `tier_key` posées à la souscription sont périmées. Sans cette
 * redérivation, le client paie 100 € et reste bloqué au quota de 20 membres.
 *
 * `discountCode === undefined` = « ne pas toucher au code existant » ; `null`
 * l'efface explicitement.
 */
async function applyOrgSubscription(
  orgId: string,
  subscription: Stripe.Subscription,
  customerId: string,
  discountCode: string | null | undefined,
) {
  const intent = orgIntentFromStatus(subscription.status)

  // État transitoire (`incomplete`, en attente de 3-D Secure) : ne rien écrire.
  if (intent === 'skip') return

  // ── S-5 : un event TARDIF d'un ANCIEN abonnement ne dégrade rien ──
  //
  // `handleOrgSubscriptionDeleted` filtrait déjà sur `stripe_subscription_id`,
  // avec le scénario écrit en toutes lettres : après un cycle « résiliation
  // puis réabonnement », la livraison tardive du `deleted` de l'ANCIEN
  // abonnement remettrait au gratuit une organisation qui vient de repayer.
  // Cette fonction-ci n'avait pas la garde : elle fait un `upsert` sur `org_id`
  // seul, donc un `customer.subscription.updated` tardif portant `canceled`
  // écrivait `tier_key = 'free'` sur le client qui paie. La garde avait été
  // posée sur une porte et pas sur l'autre.
  //
  // La règle est asymétrique, et c'est ce qui la rend juste :
  //   - un event qui ACTIVE fait autorité, d'où qu'il vienne. Un nouvel
  //     abonnement actif supersède le précédent, c'est la souscription elle-même.
  //   - un event qui DÉGRADE (`cancelled`, `past_due`) n'est appliqué que s'il
  //     concerne l'abonnement ACTUELLEMENT enregistré. Venant d'un autre, il
  //     parle par définition d'un abonnement abandonné.
  //
  // Un simple `.eq()` sur l'upsert ne convient pas : il empêcherait la toute
  // première écriture, quand la ligne n'a encore aucun `stripe_subscription_id`.
  //
  // ⚠️ Lecture puis écriture, donc fenêtre de concurrence théorique : deux
  // livraisons simultanées peuvent lire la même valeur. L'état converge quand
  // même — l'event actif finit toujours par être appliqué, et un event de
  // dégradation appliqué à tort est corrigé par le suivant. Verrouiller la
  // ligne coûterait plus cher que ce que ça protège.
  if (intent !== 'active') {
    const { data: current, error: readError } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_subscription_id')
      .eq('org_id', orgId)
      .maybeSingle()
    if (readError) {
      // Même règle que partout ailleurs dans ce fichier : une panne de lecture
      // n'est pas un « pas de ligne ». On fait retenter Stripe.
      console.error('applyOrgSubscription: current subscription read error:', readError)
      throw readError
    }
    const known = current?.stripe_subscription_id
    if (known && known !== subscription.id) {
      console.warn(
        `applyOrgSubscription: ignoring ${subscription.status} event for stale subscription on org ${orgId}`,
      )
      return
    }
  }

  const priceId = subscription.items.data[0]?.price?.id ?? ''
  // Rend le palier ET la périodicité : les deux se changent depuis le Billing
  // Portal sans repasser par notre checkout, donc les deux se redérivent du
  // price ID et jamais des metadata.
  //
  // `tierFromPriceId` est passé en court-circuit : c'est une comparaison de
  // chaînes contre les secrets, elle couvre tout le mensuel sans un seul appel
  // réseau. Ce n'est que pour un prix ANNUEL dérivé qu'on remonte au produit
  // Stripe, et l'index produit → palier est mis en cache par isolate.
  const match = await resolveTierMatch(stripe, priceId, env, tierFromPriceId)
  const tier = match?.tier

  if (intent === 'active' && !tier) {
    // Price inconnu (palier retiré côté Stripe, secret `STRIPE_ORG_PRICE_*`
    // absent ou pointant sur le mauvais projet Stripe). Écrire ici dégraderait
    // l'organisation au palier gratuit ALORS QU'ELLE PAIE.
    //
    // On THROW : un `return` comptait comme un succès du handler, donc le
    // marqueur d'idempotence était écrit et Stripe cessait de re-livrer — la
    // seule issue devenait une réparation manuelle. Le throw produit un 500 et
    // ouvre ~3 jours de retries, la fenêtre nécessaire pour corriger le secret
    // et laisser l'état se rétablir tout seul.
    //
    // L'org id et le price id sont interpolés : ni l'un ni l'autre n'est une
    // PII au sens de `_shared/alert.ts` (pas d'email, pas d'user_id), et sans
    // eux l'alerte n'est pas actionnable.
    await opsAlert(
      'stripe-webhook',
      `org ${orgId} subscription references an unknown price ${priceId || '(none)'} — tier not applied, seat quota left untouched, forcing Stripe retry`,
    )
    throw new Error(`unknown org price id: ${priceId || '(none)'}`)
  }

  const payload: Record<string, unknown> = {
    org_id: orgId,
    status: intent,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  }

  // Omis = `ON CONFLICT DO UPDATE` laisse la valeur existante intacte (même
  // technique que `premium_tokens` côté particulier). C'est le cœur du cas
  // `past_due` : palier, quota et fin de période sont PRÉSERVÉS pendant les
  // relances, pour être restaurés intacts au paiement rattrapé.
  if (intent === 'active' && match) {
    payload.tier_key = match.tier.key
    payload.max_members = match.tier.maxMembers
    payload.billing_interval = match.interval
    payload.current_period_end = new Date(subscription.current_period_end * 1000).toISOString()
  } else if (intent === 'cancelled') {
    payload.tier_key = 'free'
    payload.max_members = FREE_TIER_MAX_MEMBERS
    // La périodicité N'EST PAS remise à 'monthly' : le palier gratuit n'est pas
    // facturé, donc écrire une périodicité dessus serait inventer une
    // information. On laisse la dernière connue, comme pour `past_due`.
    payload.current_period_end = null
  }

  // Omis = `ON CONFLICT DO UPDATE` laisse la valeur existante intacte.
  if (discountCode !== undefined) payload.discount_code = discountCode

  const { error } = await supabaseAdmin
    .from('org_subscriptions')
    .upsert(payload, { onConflict: 'org_id' })
  if (error) {
    console.error('applyOrgSubscription upsert error:', error)
    throw error
  }
}
