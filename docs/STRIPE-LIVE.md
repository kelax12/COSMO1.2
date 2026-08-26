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
