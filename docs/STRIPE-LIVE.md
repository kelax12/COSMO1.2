# Stripe · compte live

> **Quand lire** : avant un geste dans le tableau de bord Stripe, un prix, un webhook, un secret `STRIPE_*`, ou la recette de paiement.
> **Fait foi** : le compte live, comparé au code par `npm run check:stripe-prices` (`C-106`). Interdits de facturation : [`src/modules/billing/CLAUDE.md`](../src/modules/billing/CLAUDE.md).
> Récits (bascule, désarmement, anciennes grilles) : [`archive/OPS-SECURITE-recits-2026-11-13.md`](./archive/OPS-SECURITE-recits-2026-11-13.md).

## Compte

- Un seul compte : `COSMO` (`acct_1TQVVnHJLweDSN4F`), **live**, servi par la production. Le sandbox de test est clôturé.
- ⚠️ `dashboard.stripe.com/test/...` est le mode test du compte live, vide : rien de ce qui s'y pose ne touche la production. Régler en mode **live**.
- Un connecteur qui ne voit qu'un bac à sable ne voit rien de COSMO.

## Grille

| Palier | Produit | Prix mensuel | Prix annuel |
|---|---|---|---|
| `t10` Équipe | `prod_V8kusrLcKpPYrC` | `price_1UUSv1HJLweDSN4F1cuaFdAy` | `price_1UUSvTHJLweDSN4FAOK6j1ri` |
| `t20` Département | `prod_V8kvSx9WNnuzfk` | `price_1UUSvUHJLweDSN4Fuk2T8ioT` | `price_1UUSvVHJLweDSN4FSTO7V1fH` |
| `t50` Entreprise | `prod_V8kvRAJaEAyuSY` | `price_1UUSvXHJLweDSN4F22MOazIx` | `price_1UUSvZHJLweDSN4FM8RSQbto` |
| `t100` Grande entreprise | `prod_VVTs7gwGuJIojd` | `price_1UUSvaHJLweDSN4FSDuxVniS` | `price_1UUSvcHJLweDSN4F0r3KtHAr` |
| `tmax` Illimité | `prod_V8kw1gh0f4HJx4` | `price_1UUSvdHJLweDSN4FeUJPsa7I` | `price_1UUSvgHJLweDSN4FZVV0sHjZ` |

- Montants : `ENTERPRISE_PRICING_TIERS` et `yearlyTotalEur()` de `src/modules/billing/premium-config.ts`, jamais recopiés ici. EUR.
- Palier porté par `product.metadata.cosmo_tier`.
- 🔴 Un produit porte UN seul prix annuel actif : sinon la dérivation refuse (`yearly_unavailable`) et l'annuel cesse d'encaisser en silence.
- `check:stripe-prices` (planifié, `Grille Stripe` dans `ci-alert.yml`) vérifie grille, doublons, `tax_behavior` et les six events du webhook ; il compare des prix enregistrés, jamais un encaissement.

## `tax_behavior: inclusive`, définitif

- Prix affiché = prix payé (TTC) : un particulier peut acheter l'offre entreprise, tout client est traité en consommateur ([`LEGAL.md`](./LEGAL.md)).
- 🔴 Stripe interdit de modifier `tax_behavior` : en changer = nouveaux prix et migration de tous les abonnements.
- ⚠️ À l'assujettissement à la TVA, le prix affiché ne bouge pas et la marge baisse du montant de TVA ; un professionnel à numéro de TVA valide passe en autoliquidation.
- Factures : mention « TVA non applicable, art. 293 B du CGI » posée par le code (`INVOICE_FOOTER`, `_shared/org-billing-contact.ts`, dans `invoice_settings.footer` de chaque customer d'organisation ; test `org-billing-contact.test.ts`). 🔴 La retirer au premier dépassement du seuil de franchise.
- `tax_code` des produits : vide ; à poser avec l'expert-comptable avant Stripe Tax.
- ❌ Ne pas activer la collecte Stripe Tax tant que la franchise s'applique (`/v1/tax/registrations` vide).
- ⚠️ Stripe Tax ne voit que les ventes : la TVA sur les achats hors France (Supabase, Vercel, Sentry) reste due.

## Webhook

- Endpoint live `we_1USka0HJLweDSN4FyEBTJZ6n` vers `https://ykeugqfgklejcdbrmawy.supabase.co/functions/v1/stripe-webhook`, version d'API = l'`apiVersion` de `supabase/functions/stripe-webhook/index.ts`, six events.
- ❌ Jamais créer un endpoint sans `api_version` explicite : la version par défaut du compte déplace `invoice.subscription` et `current_period_end`.
- 🔴 Six events exactement : en oublier un coupe le remboursement sans signal (`check:stripe-prices` les compte).
- Recréer l'endpoint = nouveau `STRIPE_WEBHOOK_SECRET` : `supabase secrets set`, puis vérifier `check:edge-smoke` (POST sans signature → 400 `Invalid signature`).

## Portail client

Configuration `bpc_1UAv9vHJLweDSN4F4xssO3OQ`, `active` et `is_default` (l'app n'envoie aucun paramètre `configuration` : sans défaut, le portail échoue et personne ne peut résilier, Conso. L215-1).

- `subscription_cancel` : activé, `at_period_end` (rien remboursé au prorata à la résiliation).
- `payment_method_update`, `invoice_history` : activés. `default_return_url` : `https://thecosmo.app/entreprise?tab=billing`.
- `subscription_update` : activé ; prorata des frais et crédits facturé immédiatement ; passage moins cher et période plus courte appliqués immédiatement ; fin des essais à la modification ; codes promotionnels activés.
- ❌ Jamais activer « modifier la quantité » : les sièges viennent du palier (`max_members`), un client paierait trois fois pour zéro siège de plus.
- Liens juridiques posés par l'API : `https://thecosmo.app/cgu`, `https://thecosmo.app/politique-confidentialite` (slugs de `src/i18n/route-slugs.json`). Vérifier à l'œil, bloc « Politiques juridiques » du portail.

## Changer de compte Stripe (procédure)

1. Créer produits et prix avec `tax_behavior` explicite et `metadata.cosmo_tier`.
2. Endpoint webhook à six events, `api_version` du code.
3. Secrets Edge : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, un `STRIPE_ORG_PRICE_<PALIER>` mensuel par palier de `_shared/org-tiers.ts` (les `_YEARLY` sont facultatifs, dérivés) ; comparer les empreintes SHA-256 avec la source.
4. Dans la fenêtre de bascule, jamais avant : `SELECT * FROM public.reset_stripe_identifiers(true);` (mig. `140`, à blanc sans argument). Un identifiant de l'ancien compte présenté à la nouvelle clé rend 404 donc 500 ; la fonction rétrograde au gratuit les orgs payantes dont elle efface les identifiants.
5. Vérifier : `npm run check:stripe-prices` vert, `check:edge-smoke` vert, un checkout ouvert jusqu'à la page Stripe.

## Recette réelle (`M-08`, geste d'Axel)

- Paiement réel d'un petit palier, puis rétractation ou remboursement admin.
- ⚠️ Inclure une montée ET une descente de palier par le portail : le webhook (`customer.subscription.updated`) applique le nouveau quota, la facture de prorata arrive dans `payment_records`, un crédit de descente n'y passe pas pour un encaissement.
