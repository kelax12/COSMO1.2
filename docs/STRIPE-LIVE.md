# Stripe — compte LIVE

> **Vivant.** Créé le 2026-08-26. Décrit l'état réel du compte de production.

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
3. Réenregistrer l'endpoint webhook sur le compte live (mêmes 5 events).
4. Mention « TVA non applicable, art. 293 B du CGI » sur les factures tant que la franchise
   en base s'applique.
5. `tax_code` des produits : non renseigné (comme en test). À poser avec l'expert-comptable
   avant d'activer Stripe Tax ; il détermine le taux appliqué par pays.
6. **Ne pas activer la collecte Stripe Tax** tant que la franchise en base s'applique : aucun
   enregistrement fiscal n'existe (`/v1/tax/registrations` est vide), il n'y a rien à collecter.

> Stripe Tax ne connaît que les VENTES. La TVA sur les ACHATS (autoliquidation sur Supabase,
> Vercel, Sentry, prestataires hors France) est entièrement hors de son champ et reste due.
