# Stripe — compte LIVE

> **Vivant.** Créé le 2026-08-26. Décrit l'état réel du compte de production.


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> **Pourquoi cette section existe.** Demande d'Axel, après le constat qui a ouvert la journée :
> `CLAUDE.md` a pesé 150 ko sans qu'aucune note ne bouge, parce qu'il était **cité comme source**
> par les audits et **jamais mesuré par eux**. Il était le mètre, jamais l'objet.
>
> 🔴 **Ce document n'a PAS de note, et c'est son premier angle mort.** Les onze documents notés
> entrent dans le tableau de bord de [`README.md`](./README.md) et peuvent donc monter ou baisser.
> Celui-ci ne le peut pas : rien ne le pèse, donc rien ne signale qu'il a vieilli. Les angles morts
> ci-dessous ne sont **pas** des défauts du produit ; ce sont les endroits où **ce document affirme
> sans que rien ne vérifie**.
>
> Chaque ligne est vérifiée par une commande, jamais supposée. Elle se **referme** ou se
> **reconduit avec sa date**, jamais ne se recopie.

| # | Angle mort | Vérifié le 2026-09-16 | Outillable ? |
|---|---|---|---|
| AM-1 | 🔴 **AUCUNE garde ne compare la grille STRIPE au code.** `org-tiers.parity.test.ts` verrouille le Deno sur le TypeScript, donc **deux copies du dépôt l'une contre l'autre** ; rien ne confronte l'une ou l'autre aux prix réellement enregistrés chez Stripe. Or c'est le seul endroit où COSMO **annonce un montant** et où un tiers **en facture un autre** | aucun workflow ne contient `STRIPE_ORG_PRICE` ni d'appel à l'API Stripe | oui : un job planifié qui lit les prix actifs et les compare à `ENTERPRISE_PRICING_TIERS` |
| AM-2 | **Les 8 prix live ont été vérifiés UNE FOIS, le 2026-08-26.** Un prix désactivé ou dupliqué depuis ne serait vu par personne. La dérivation annuelle refuse d'ailleurs de choisir entre deux candidates (`yearly_unavailable`), donc un doublon **coupe l'encaissement annuel en silence** | vérification datée dans ce document, jamais rejouée | oui (AM-1 le couvre) |
| AM-3 | **La liste des events du webhook live ne sera vérifiée par rien après enregistrement.** Ils sont **SIX** ; ce dépôt a écrit « 5 » pendant six jours, et en enregistrer 5 couperait le **remboursement** sans aucun signal | recompté dans le code le 2026-09-12 | oui |
| AM-4 | **Le passage en live n'a pas de répétition à blanc.** La séquence (remettre à zéro les identifiants par la mig. `140`, recréer les prix, réenregistrer le webhook, remplacer trois secrets) n'a jamais été parcourue, et chaque étape manquante échoue **après** encaissement | mig. `140` écrite, **non appliquée**, par construction | partiellement : le compte de test permet la répétition |

---

## Le compte live n'est PAS celui qui sert aujourd'hui

Deux comptes Stripe existent :

| Compte | ID | Rôle |
|---|---|---|
| `COSMO` | `acct_1TQVVnHJLweDSN4F` | **live**, aucun client, aucun encaissement |
| `Environnement de test COSMO` | `acct_1TQVWFHEm0kmXgy9` | test, **c'est lui que la prod utilise** |

`STRIPE_SECRET_KEY` en prod est une clé de **test** : les customers des vrais utilisateurs
vivent dans le compte de test. Le compte live ne contient que la grille tarifaire ci-dessous.

## Grille live — les 8 prix (créés le 2026-08-26)

Tous en EUR, `tax_behavior: inclusive` (prix TTC, cf. plus bas).

| Palier | Produit | Mensuel | Annuel (−30 %) |
|---|---|---|---|
| `t10` Équipe | `prod_V8kusrLcKpPYrC` | `price_1U8TQpHJLweDSN4FLNaWs3Wk` · 20 € | `price_1U8TRFHJLweDSN4FvGOJqLhz` · 168 € |
| `t20` Département | `prod_V8kvSx9WNnuzfk` | `price_1U8TRgHJLweDSN4Fifkbi4q9` · 50 € | `price_1U8TS0HJLweDSN4FCtrBhKv7` · 420 € |
| `t50` Entreprise | `prod_V8kvRAJaEAyuSY` | `price_1U8TSYHJLweDSN4Fqp30vV7b` · 100 € | `price_1U8TSyHJLweDSN4Fgzp7Cf8v` · 840 € |
| `tmax` Illimité | `prod_V8kw1gh0f4HJx4` | `price_1U8TTEHJLweDSN4FZQe2hUfA` · 200 € | `price_1U8TTVHJLweDSN4FXWk53j5e` · 1 680 € |

Montants conformes à `ENTERPRISE_PRICING_TIERS` et à `yearlyTotalEur()`
(`src/modules/billing/premium-config.ts`). Le palier est porté par
`product.metadata.cosmo_tier`, comme dans le compte de test.

## 🔴 `tax_behavior: inclusive` est DÉFINITIF

Stripe interdit de modifier `tax_behavior` une fois posé. Pour en changer il faut créer un
nouveau prix et archiver l'ancien, donc **migrer tous les abonnements en cours**. C'est pour
cela qu'il a été posé alors que le compte live n'a aucun client : le faire plus tard est un
chantier de migration.

`inclusive` veut dire **prix affiché = prix payé**. Conséquences à connaître :

- Le droit français impose l'affichage TTC aux consommateurs, et un particulier peut acheter
  l'offre entreprise (aucune vérification de qualité professionnelle dans le parcours).
- Le jour de l'assujettissement à la TVA, 20 € TTC deviennent 16,67 € HT encaissés. **La marge
  baisse de 17 % sans que le prix affiché bouge.** À intégrer au modèle économique maintenant.
- Un client professionnel avec numéro de TVA valide passe en autoliquidation et laisse le
  montant entier.
- ❌ **Ne jamais créer un prix live sans `tax_behavior` explicite.** Les 8 prix du compte de
  TEST sont sur `unspecified` : c'est la valeur à ne pas reproduire.

## Portail client · configuré sur les deux comptes (2026-09-01)

Sans configuration de portail, `billingPortal.sessions.create({ customer, return_url })`
échoue : l'application n'envoie **aucun** paramètre `configuration`, donc Stripe cherche la
configuration **par défaut du compte**, et il n'en existait aucune. Conséquence mesurée le
2026-09-01 : le bouton « Gérer mon abonnement » existait, et **un client abonné ne pouvait pas
résilier**. La landing promet « résiliable à tout moment » (Conso. art. L215-1).

| Compte | Configuration | `active` / `is_default` |
|---|---|---|
| `COSMO` (live) | `bpc_1UAv9vHJLweDSN4F4xssO3OQ` | `true` / `true` |
| `Environnement de test COSMO` (sandbox) | `bpc_1UAvS2HEm0kmXgy9XO4s1MM6` | `true` / `true` |

Les deux sont rigoureusement identiques :

- `subscription_cancel` : **activé**, `mode: at_period_end`. On ne résilie pas au milieu d'une
  période payée : le client garde ce qu'il a acheté, et rien n'est remboursé au prorata.
- `payment_method_update` et `invoice_history` : activés.
- `default_return_url` : `https://thecosmo.app/entreprise?tab=billing`.
- `subscription_update` : **désactivé**, volontairement (ci-dessous).

### ❌ Ne jamais activer « modifier la quantité » dans le portail

Le nombre de sièges est porté par le **palier** (`max_members`), jamais par la quantité Stripe.
Un client qui passerait la quantité de 1 à 3 paierait trois fois le prix et n'obtiendrait
**aucun siège de plus**. C'est un bug de facturation en libre-service, et il serait de notre
fait.

Le changement d'offre (`subscription_update`) est légitime sur le fond : `tierFromPriceId`
redérive le palier ET la périodicité depuis le price ID, précisément parce qu'un changement fait
depuis le portail ne repasse pas par notre checkout. Il reste fermé tant qu'il n'a pas été
éprouvé par la recette T-39 : il suppose aussi que le webhook applique le nouveau quota.

### ⚠️ Trois contextes Stripe, pas deux

Piège qui a coûté un aller-retour le 2026-09-01. `dashboard.stripe.com/test/...` n'ouvre **pas**
le sandbox : il ouvre le **mode test du compte live**, un troisième contexte, vide et sans
intérêt. Le sandbox s'atteint par son identifiant de compte :

```
https://dashboard.stripe.com/acct_1TQVWFHEm0kmXgy9/test/settings/billing/portal
```

Rien n'est partagé entre ces contextes : une configuration de portail se pose **une fois par
contexte**, et une configuration posée au mauvais endroit ne se voit nulle part.

### ⚠️ Les deux liens juridiques ne sont pas confirmés

`business_profile.terms_of_service_url` et `privacy_policy_url` remontent `null` par l'API sur les
deux comptes, alors que les informations publiques ont été saisies. Deux explications possibles,
**non départagées** : soit Stripe rattache ces liens à l'affichage sans les recopier dans l'objet
`billing_portal.configuration`, soit l'enregistrement n'a pas pris. Aucune opération de lecture du
profil de compte n'est exposée pour trancher par API.

Ça se vérifie à l'œil, bloc « Politiques juridiques » de la page du portail. Les URL attendues,
vérifiées contre `src/i18n/route-slugs.json` plutôt que de mémoire : `https://thecosmo.app/cgu`
(`terms` → `cgu`) et `https://thecosmo.app/politique-confidentialite` (`privacy`). Ce n'est pas
bloquant pour la résiliation, c'est un point de conformité.

## Ce qui reste à faire avant d'encaisser

1. **Créer la structure juridique.** Aucune micro-entreprise n'existe au 2026-08-26 : encaisser
   sans immatriculation est du travail dissimulé. C'est le bloquant, pas la technique.
2. Poser les 8 secrets `STRIPE_ORG_PRICE_*` sur les IDs ci-dessus, et remplacer
   `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` par ceux du compte live.
3. Réenregistrer l'endpoint webhook sur le compte live. 🔴 **SIX events, pas cinq** — recomptés
   dans `supabase/functions/stripe-webhook/index.ts` le 2026-09-12 :
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`,
   `charge.refunded`. Cette ligne disait « mêmes 5 events » : le chiffre est devenu faux le
   2026-09-06, quand la v27 du webhook a ajouté la branche de remboursement. En réenregistrer
   cinq laisserait `charge.refunded` non souscrit, donc **aucune ligne compensatoire au journal
   d'encaissement** : un remboursement réellement versé, et un journal qui ne montre que
   l'encaissement. C'est ce qu'on produit en contrôle fiscal.
   ⚠️ **Le même doute porte sur l'endpoint de TEST**, et il n'est pas refermé : rien ne dit que
   `charge.refunded` y a été ajouté avec la v27. À vérifier au tableau de bord avant de conclure
   d'un test de remboursement qu'il a marché (geste M-37c).
3bis. **Effacer les identifiants Stripe du compte de TEST restés en base**, JUSTE APRÈS le
   remplacement des secrets et AVANT de rebasculer les drapeaux de facturation :

   ```sql
   SELECT * FROM public.reset_stripe_identifiers();      -- essai à blanc, ne compte que
   SELECT * FROM public.reset_stripe_identifiers(true);  -- applique
   ```

   Sans ce geste, `stripe-org-checkout` et `stripe-org-portal` présentent un `cus_…` / `sub_…`
   de test à une clé live : Stripe répond 404, les deux fonctions rendent 500, et un client
   n'a plus ni bouton pour payer ni bouton pour résilier. Mesuré en base le 2026-09-04 :
   `org_subscriptions` est vide, mais `subscriptions` porte 5 customers et 2 subscriptions du
   compte de test. La fonction est installée par la mig. `140`, qui documente ce qu'elle
   n'efface JAMAIS (journal fiscal, preuves de renonciation, marqueurs d'idempotence).

   ✅ **Remesuré le 2026-09-14 au soir, inchangé** : toujours **5 `stripe_customer_id`** et
   **2 `stripe_subscription_id`** sur 54 lignes de `subscriptions`, `org_subscriptions` toujours à
   **0 ligne**, `payment_records` à **0**, et **8** events dans `processed_stripe_events`. La
   fonction `reset_stripe_identifiers` est bien **absente de la base** (mig. `140` non appliquée),
   ce qui est l'état voulu : elle se pose dans la fenêtre de bascule. ⚠️ Ce geste a donc un objet
   réel et il n'a pas disparu avec le temps.

   ⚠️ Ce geste ne s'anticipe pas : tant que la clé est une clé de test, chaque checkout
   réécrit un identifiant de test. Il se joue DANS la fenêtre de bascule, pas avant.
4. Mention « TVA non applicable, art. 293 B du CGI » sur les factures tant que la franchise
   en base s'applique.
5. `tax_code` des produits : non renseigné (comme en test). À poser avec l'expert-comptable
   avant d'activer Stripe Tax ; il détermine le taux appliqué par pays.
6. **Ne pas activer la collecte Stripe Tax** tant que la franchise en base s'applique : aucun
   enregistrement fiscal n'existe (`/v1/tax/registrations` est vide), il n'y a rien à collecter.

> Stripe Tax ne connaît que les VENTES. La TVA sur les ACHATS (autoliquidation sur Supabase,
> Vercel, Sentry, prestataires hors France) est entièrement hors de son champ et reste due.

---

## Règles et récits repris de `CLAUDE.md` (déplacés le 2026-09-16)

> Ce bloc vivait dans `CLAUDE.md`, donc chargé à chaque session. Il est déplacé ici
> **sans une coupe**, dans le doc qui fait foi sur Stripe. La version courte, celle des
> interdits, vit dans [`src/modules/billing/CLAUDE.md`](../src/modules/billing/CLAUDE.md),
> chargée automatiquement dès que le code de facturation est touché.

### Billing — vérification premium

```typescript
import { useBilling } from '@/modules/billing/billing.context';
const { isPremium, subscription, stats, isLoading } = useBilling();
// isPremium est une FONCTION : isPremium() retourne boolean
```

#### Modèle Premium

> 🟢 **Premium NON APPLIQUÉ** — kill-switch `PREMIUM_ENFORCED = false` dans
> `src/modules/billing/premium-config.ts` (vérifié 2026-08-14). Tant qu'il vaut `false` :
> `isPremium()` renvoie `true` pour tous et la route `/premium` **redirige vers `/`**.
> Le code de gating reste dormant, il n'est pas supprimé.
> Réactivation : passer le flag à `true`, puis finaliser Stripe (`docs/POST-AUDIT-GUIDE.md`).

Comportement **quand `PREMIUM_ENFORCED = true`** :

- **Partage de tâches → 100 % gratuit** (acquisition virale). Aucun gate `isPremium()` sur la
  collaboration. **Ne PAS réintroduire** ces gates.
- **Statistiques → premium** (`StatisticsPage`).
- **Habitudes → gratuites pour tout le monde**, sans condition.
- 🗑️ **Le système de jetons premium et le mur-pub Habitudes N'EXISTENT PLUS** (C-04, supprimés le
  2026-09-04 sur décision d'Axel du 09-03). Sont partis ensemble : `HabitsAdGate`, `AdModal` et
  tout AdSense (y compris ses origines dans la CSP), `useDailyAdGate` et la clé
  `cosmo_adwall_habits`, `addTokens`, les RPC `consume_premium_token` /
  `credit_premium_token_from_ad` / `bump_win_streak`, et les colonnes `premium_tokens` /
  `win_streak` / `ad_credits_*` de `subscriptions` (mig. **141**).
  ❌ **Ne jamais réintroduire une monnaie interne** : elle n'a jamais été câblée, un jeton crédité
  ne servait à rien, et le mur qu'elle prétendait garder était piloté par un flag `localStorage`,
  donc contournable en une manipulation le jour où `PREMIUM_ENFORCED` passerait à `true`.
- ⚠️ **La définition de « premium » a changé avec** : c'est désormais `plan='premium'` +
  `status='active'` + période non dépassée (`subscription.logic.ts`), les jetons n'y entrent plus.
  Vérifiée ligne par ligne contre les 54 lignes de prod avant la bascule : **même verdict pour
  chacune**. ⚠️ **7** comptes portent un `premium` sans fin de période, hérité des jetons gagnés par
  pub, et non 8 : recompté en base le 2026-09-14 au soir (`plan='premium'`, `status='active'`,
  `current_period_end IS NULL`), contre 3 qui portent bien une fin de période, sur **54** lignes ;
  ils restent premium, et aucune écriture ne produit plus cette forme.
- Le client ne peut pas écrire `subscriptions` : aucune policy UPDATE, et l'INSERT ne permet
  qu'une ligne gratuite sans identifiant Stripe.

#### Facturation entreprise — plomberie Stripe COMPLÈTE, facturation DÉSACTIVÉE (2026-08-24)

`org_subscriptions` (mig. 101) porte l'abonnement d'une **organisation** : un palier
(`ENTERPRISE_PRICING_TIERS`), un quota de sièges (`max_members`), un statut. Ne jamais la
confondre avec `subscriptions`, qui porte l'abonnement **particulier** (plan, statut, période) —
les deux ne partagent aucune colonne.

- La table n'a **aucune policy d'écriture**. Seul le webhook Stripe (`service_role`) écrit ;
  la lecture est réservée aux membres. Pas de trigger-guard : rien n'est écrivable, il n'y a
  rien à garder.
- Souscription et gestion : **propriétaire de l'org uniquement**, vérifié dans
  `stripe-org-checkout` / `stripe-org-portal`. Le front ne fait que masquer un onglet.
- Coupons : **promotion codes Stripe natifs** (`allow_promotion_codes`). COSMO ne valide aucun
  code et ne recalcule aucun montant — donc aucune surface de brute-force côté COSMO.
- **Périodicité mensuelle ou annuelle** (2026-08-25), sélecteur dans `/entreprise?tab=billing`.
  L'annuel vaut le mensuel **moins 30 %** (`ENTERPRISE_YEARLY_DISCOUNT`) : 14/35/70/140 € par mois
  en équivalent, débités 168/420/840/1 680 € une fois par an. Huit price IDs Stripe au total
  (`STRIPE_ORG_PRICE_*` et `STRIPE_ORG_PRICE_*_YEARLY`). La colonne descriptive
  `org_subscriptions.billing_interval` (mig. **123**) dit laquelle est facturée.
- Le quota réel est `org_seats_allowed()` (mig. 101), déjà appelé par `claim_org_invite` et
  `respond_join_request`. Un abonnement `past_due` ou `cancelled` retombe au palier gratuit
  **sans jamais retirer de membre** : on bloque la croissance, on ne retire rien.
- UI : vue `/entreprise?tab=billing` (`OrgBillingTab`), grille `EnterpriseTierGrid`. **Ce n'est
  pas un onglet** — la barre d'onglets est lue par toute l'organisation alors qu'un seul compte
  peut payer. L'entrée est la pastille de forfait de l'en-tête (`OrgPlanChip`), montée pour le
  seul propriétaire ; `?tab=billing` reste une valeur d'URL valide (les Edge Functions Stripe y
  renvoient) et un non-propriétaire qui l'ouvre retombe sur l'aperçu.
  Le CTA de paiement n'est monté que si `ENTERPRISE_BILLING_ENFORCED === true` — le flag est la
  **seule** condition, jamais « actif si les variables d'environnement existent ».

Garde-fous propres à cette zone :

- 🟢 **Le price ID ANNUEL se dérive, il ne se configure pas** (`_shared/org-stripe-prices.ts`) :
  c'est le prix récurrent `year`, actif, de la devise du mensuel et **du montant exact annoncé**,
  porté par le MÊME produit Stripe que le prix mensuel. Zéro candidate ou plusieurs → on n'ouvre
  aucune session de paiement (`yearly_unavailable`). Conséquence directe : les 4
  `STRIPE_ORG_PRICE_*_YEARLY` ne sont **pas** nécessaires, et le jour du passage en compte live il
  n'y a que les 4 mensuels à re-poser. Le secret annuel reste lu en premier, comme porte de sortie
  pour épingler un prix qui vivrait ailleurs.
- ❌ **Ne jamais faire deviner un prix à la résolution annuelle.** Le montant est vérifié contre
  `yearlyTotalEur` AVANT toute session, dans les deux sens (checkout et webhook). C'est le seul
  endroit où COSMO choisit un prix au lieu de se le faire désigner, donc le seul endroit où il
  peut se tromper de montant.
- ❌ **Ne jamais écrire une grille de tarifs annuels à la main.** Le montant annuel est DÉRIVÉ du
  mensuel, front et Deno, par la même formule. Deux grilles, c'est une seconde occasion d'annoncer
  un prix et d'en facturer un autre, le risque qui a déjà imposé `org-tiers.parity.test.ts`.
- ❌ **Ne jamais faire dépendre le quota de sièges de la périodicité.** `max_members` est porté par
  le palier SEUL : un client annuel achète le même palier moins cher, pas plus de sièges. Un
  « palier annuel » distinct côté Stripe casserait `tierFromPriceId`, donc le portail.
- ❌ **Ne jamais dériver le palier des metadata Stripe.** Un changement de palier OU DE PÉRIODICITÉ
  fait depuis le Billing Portal ne repasse pas par notre checkout : les deux se redérivent du
  **price ID** (`tierFromPriceId`, `supabase/functions/_shared/org-tiers.ts`, qui rend le palier ET
  la périodicité). Sans ça, un client paie 100 € et reste bloqué au quota de 20 sièges.
- ❌ **Ne jamais avaler l'erreur d'une lecture qui décide d'un routage** (audit Stripe 2026-09-02).
  `getUidFromCustomer` et le pré-contrôle d'idempotence jetaient tous deux leur `error`. Une panne
  de lecture devenait « pas d'utilisateur » ou « jamais traité » : dans le premier cas un paiement
  encaissé sans abonnement appliqué et un marqueur d'idempotence écrit, donc aucune re-livraison ;
  dans le second le rejeu d'un handler non idempotent (à l'époque `bump_win_streak`, qui
  incrémentait ; supprimé depuis par C-04). Les deux relancent maintenant, comme `orgIdFromInvoice`
  le faisait déjà. **En cas de doute, faire retenter Stripe, jamais deviner.**
- ❌ **Un event Stripe qui DÉGRADE ne s'applique qu'à l'abonnement enregistré** (finding S-5).
  La garde d'`applyOrgSubscription` est asymétrique, et c'est voulu : un event qui **active** fait
  autorité d'où qu'il vienne (une nouvelle souscription supersède la précédente) ; un event
  `cancelled` ou `past_due` venant d'un AUTRE abonnement que celui en base parle d'un abonnement
  abandonné, et remettrait au gratuit une organisation qui vient de repayer. Ne pas remplacer par
  un `.eq()` sur l'upsert : il empêcherait la toute première écriture.
- ❌ **AUCUN REJEU AUTOMATIQUE sur une mutation qui déplace de l'argent.** Le `QueryClient` de
  l'app pose `mutations: { retry: 1 }` pour tout le monde : un `refund_failed` faisait donc repartir
  un **second** appel à `stripe-org-refund`, sans que personne ne clique et sans que rien ne le dise
  (mesuré le 2026-09-08 par `e2e/stubbed/refund.spec.ts` : deux appels pour un clic).
  `useCancelAndRefundOrg` pose `retry: 0`. Ce que la borne serveur absorbe (clé d'idempotence sur
  l'`invoice_id`, pré-contrôle qui retranche) ne rend pas ce rejeu anodin : l'échec arrive **après**
  le point de non-retour, donc le second appel peut trouver le remboursement déjà posé et résilier
  un abonnement dont l'écran vient d'annoncer que rien n'avait été résilié. **On fait retenter la
  PERSONNE, jamais le navigateur.**
- 🔴 **Les deux verrous anti-rejeu du remboursement ne se remplacent PAS, et c'est contre-intuitif.**
  La clé d'idempotence Stripe dérivée de l'`invoice_id` (verrou 1) **expire** : elle n'arrête que
  deux appels **concurrents**. Un rejeu à quelques minutes n'est arrêté que par le pré-contrôle qui
  RETRANCHE le déjà-rendu (verrou 2), dont l'arithmétique vit dans
  `supabase/functions/_shared/refund-replay.ts`.
  ❌ **Ne jamais remettre cette arithmétique dans l'entrypoint Deno.** Mélangée aux appels Stripe,
  elle n'est exécutable par aucun test — et elle ne l'a été par aucun jusqu'au 2026-09-14, pendant
  tout le temps où le dépôt déclarait « une borne ». C'est un module TS pur, couvert par 10 cas
  (`src/modules/billing/refund-replay.test.ts`), et `src/refund.guard.test.ts` **interdit** de le
  recopier sur place. Déployée en **v6** le 2026-09-14, identique au dépôt (`check:edge` vert).
  ⚠️ **Deux erreurs symétriques y sont couvertes nommément** : un remboursement `pending` compte
  comme rendu (sinon on rembourse par-dessus un virement en vol), un `failed` ou `canceled` ne
  compte pas (sinon on prive la personne de son argent après un échec bancaire). ❌ Ne jamais
  l'écrire « par exclusion » (`status !== 'succeeded'`) : `pending` serait alors ignoré.
- ⚠️ **Après un remboursement, l'abonnement se RELIT.** Sans invalidation, l'écran continuait
  d'afficher le forfait payant *et* son bouton de remboursement : il invitait exactement le rejeu
  que la borne serveur existe pour absorber. Le bloc est par ailleurs conditionné à
  `effectiveTierKey(subscription)`, pas à `subscription.tierKey` — un abonnement résilié retombe à
  « Gratuit », il n'y a plus rien à y résilier.
- ❌ **Ne JAMAIS ouvrir une session de paiement sans la preuve de renonciation** (finding S-6).
  `stripe-org-checkout` exige `immediateExecution` ET `waivesWithdrawal` strictement à `true`, puis
  écrit une ligne dans `withdrawal_consents` (mig. `135`) **avant** de créer la session : l'ordre
  est la preuve. Les deux drapeaux sont exigés SÉPARÉMENT — l'art. L221-28, 13° demande deux
  manifestations distinctes, pas un accord global. La table est append-only, immuable par trigger,
  et se lit comme `renewal_notices` : **c'est une pièce à produire, jamais un cache.**
- 🔴 **Le passage en compte live doit remettre à zéro les identifiants Stripe en base.**
  `stripe-org-checkout` et `stripe-org-portal` réutilisent `stripe_customer_id` et
  `stripe_subscription_id` tels quels ; un identifiant du compte de TEST présenté à une clé live
  répond 404, donc 500. Outillé par la mig. `140` (NON APPLIQUÉE) :
  `SELECT * FROM public.reset_stripe_identifiers(true);`, à jouer **dans** la fenêtre de bascule,
  jamais avant : tant que la clé est une clé de test, chaque checkout réécrit un identifiant de
  test. À blanc sans argument.
  ⚠️ **« Les tables sont vides » était faux d'une table sur deux.** Mesuré le 2026-09-04 :
  `org_subscriptions` = 0 ligne, mais `subscriptions` porte **5 `cus_…` et 2 `sub_…`** du compte
  de test. Le geste a donc un objet réel dès aujourd'hui.
  ⚠️ Effacer les deux colonnes d'une org PAYANTE sans la redescendre au palier gratuit
  créerait un état sans issue : quota conservé, plus rien pour le payer, et un portail qui répond
  `no_subscription` faute de customer. La fonction rétrograde ces lignes-là, et elles seules.
- ❌ **Ne jamais laisser un event d'organisation retomber sur la branche particulier.** Le
  customer Stripe d'une org porte `org_owner_uid` (jamais `supabase_uid`) et
  `getUidFromCustomer` refuse tout customer portant `org_id` — sinon la facture d'une entreprise
  écrit dans l'abonnement personnel de son propriétaire, et le marqueur d'idempotence empêche
  Stripe de réessayer.
- ❌ **Ne jamais écrire un montant en dur** côté Deno : `_shared/org-tiers.ts` est verrouillé sur
  `ENTERPRISE_PRICING_TIERS` par `src/modules/billing/org-tiers.parity.test.ts`.
- Les **noms** des paliers (Gratuit · Équipe · Département · Entreprise · Illimité) vivent dans le
  namespace `common` (`orgTier.*`), pas dans `org` ni `landing` : la landing et le produit doivent
  dire le même mot pour le même palier, comme ils annoncent déjà le même montant. Le mapping
  palier → clé est `src/modules/billing/org-tier-labels.ts` (`Record<OrgTierKey, …>`, donc un
  palier ajouté sans nom ne compile pas).
- 🔴 **DÉSARMÉ le 2026-08-26** (mig. `124` appliquée en prod). `ENTERPRISE_BILLING_ENFORCED = false`
  **et** `billing_flags.enterprise_seat_limit = false`, rebasculés ensemble. **Pourquoi** : les
  deux étaient à `true` avec une clé Stripe de TEST, et une organisation sur quatre était déjà au
  plafond. Son parcours : invitation refusée, écran qui propose de payer, clic, checkout en mode
  test, vraie carte refusée. Ni grandir, ni payer, ni résilier. Impasse produit, pas risque
  juridique — aucun euro n'étant encaissé, ni travail dissimulé ni TVA due.
  Réarmement : les deux drapeaux, **après** immatriculation et passage de Stripe en compte live.
  Contexte du 2026-08-25 conservé ci-dessous pour mémoire, il décrivait l'état activé où
  `org_seats_allowed()` renvoyait `false` pour la seule
  organisation qui dépasse le palier gratuit. Aucun membre n'est retiré, c'est la croissance qui
  est bloquée.
- 🔴 **Deux réserves restent ouvertes à cette date :**
  1. `STRIPE_SECRET_KEY` est une clé de TEST, donc le checkout n'accepte que des cartes de test.
     **Le quota est réel, l'encaissement ne l'est pas.**
  2. Les 4 prix ANNUELS n'existent pas encore côté Stripe. Il n'y a **aucun secret à poser** (cf.
     règle de dérivation ci-dessous) : il suffit d'ajouter, sur chacun des 4 produits qui portent
     déjà un prix mensuel, un prix récurrent `year` de 168 / 420 / 840 / 1 680 €. Le checkout
     annuel répond `yearly_unavailable` d'ici là, la grille rebascule seule sur le mensuel, et
     l'annuel se met à marcher tout seul dès que les prix existent.
- **La plomberie reste entière et déployée** : `stripe-org-checkout` / `stripe-org-portal`, les
  `org_subscriptions` (mig. 101 + 123), `org_seats_allowed()`, et `stripe-webhook`. Les deux
  fonctions qui portent la périodicité, `stripe-org-checkout` (v2) et `stripe-webhook` (v17), ont
  été **redéployées en prod le 2026-08-25** et fument-testées (webhook : 400 « Invalid
  signature » ; checkout : 401 JSON de la fonction elle-même, donc les modules `_shared` se
  chargent). Réactiver = rebasculer les deux drapeaux, rien à reconstruire.
- ⚠️ **Corrigé le 2026-08-26 : les 4 prix ANNUELS existent bel et bien** dans le compte de test
  (168 / 420 / 840 / 1 680 €), contrairement à ce que ce fichier affirmait depuis le 2026-08-25.
  Vérifié par API, pas déduit. La dérivation `resolveYearlyPriceId` n'a donc pas besoin des
  secrets `STRIPE_ORG_PRICE_*_YEARLY`.
- 🔴 **Le compte Stripe LIVE est désormais équipé** (2026-08-26) : 4 produits et 8 prix créés,
  tous en `tax_behavior: inclusive`, réglage **DÉFINITIF** chez Stripe. Les 8 prix du compte de
  TEST restent sur `unspecified`, valeur à ne jamais reproduire. Détail et identifiants :
  ce document.
  ❌ **Ne jamais créer un prix Stripe sans `tax_behavior` explicite** : il ne se modifie plus, il
  faut créer un nouveau prix et migrer les abonnements.
- 🔴 **Les deux drapeaux se déplacent ensemble.** Le flag TS ne masque que les CTA ; le blocage
  réel est `billing_flags.enterprise_seat_limit`. Serveur `true` + client `false` = un
  propriétaire se voit refuser une invitation (`seat_limit_reached`) sans qu'aucun écran ne lui
  propose de payer : impasse. Client `true` + serveur `false` = on encaisse sans rien débloquer.
- 🔴 **La grille branchée est celle du SANDBOX DE TEST.** `STRIPE_SECRET_KEY` en prod est une
  clé de test — les customers des vrais utilisateurs vivent dans le compte « Environnement de
  test COSMO », le compte live est vide. Un checkout n'accepte donc que des **cartes de test**
  : le quota de sièges est réel, l'encaissement ne l'est pas. Passage en live = recréer les 8
  prix sur le compte live (4 mensuels + 4 annuels), réenregistrer un endpoint webhook live (**SIX** events, recomptés dans le code le
  2026-09-12 : `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` et
  `charge.refunded` — ce fichier a écrit « 5 » jusqu'à cette date, chiffre devenu faux avec la
  v27 du webhook le 2026-09-06 ; en réenregistrer 5 couperait le remboursement en silence), puis
  remplacer `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et les 8 `STRIPE_ORG_PRICE_*`.
- ⚠️ `APP_URL` vaut `https://thecosmo.app` et **est la seule origine CORS autorisée** par les
  deux Edge Functions org : le checkout entreprise **ne peut pas être testé depuis
  `localhost:5173`**. Tester depuis la prod, ou changer `APP_URL` le temps du test.
- Réactivation (immédiate, réversible) : `ENTERPRISE_BILLING_ENFORCED = true` +
  `UPDATE billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit'` — **après** la
  création de la micro-entreprise et le passage du compte Stripe en live.
  Contexte historique : [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md).

