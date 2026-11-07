# ADR 0010 · Un particulier peut acheter l'offre entreprise

- **Statut** : acceptée
- **Date** : 2026-08-26

## Contexte

L'offre entreprise se paie par organisation. Une organisation peut n'avoir qu'un membre : un
indépendant, un étudiant, un particulier. Il aurait été possible d'exiger un numéro SIRET ou de
vérifier une qualité professionnelle avant l'achat. Aucun contrôle de ce genre n'existait dans le
code, et Axel a tranché de ne pas en ajouter.

## Décision

- **Aucune vérification de qualité professionnelle ne bloque un achat.** Un particulier peut acheter
  l'offre entreprise.
- **Tout client est donc traité comme un consommateur.** Le droit de la consommation s'applique à
  l'offre entière : conditions générales de vente, rétractation avec double consentement, médiateur de
  la consommation, résiliation en ligne, information de reconduction tacite.
- **Les prix affichés sont TTC.** Les prix du compte Stripe live sont créés en `tax_behavior: inclusive`,
  une valeur définitive côté Stripe : le prix affiché est le prix payé.
- Un champ SIRET **facultatif** au paiement reste souhaité : il ne bloque personne, il permet à un
  indépendant de sortir du régime consommateur et sert la TVA.

## Conséquences

- **Positives.** Aucune friction à l'achat, et une règle unique pour tous les clients, donc un seul
  jeu de documents contractuels.
- **Négatives.** Les obligations du droit de la consommation sont complètes et coûtent (adhésion à un
  médiateur, parcours de rétractation, informations de reconduction). Le jour où la TVA s'applique,
  un prix TTC fixe donne moins de marge sans que le prix affiché ne change.
- **À ne pas faire.** Ce n'est pas un trou à combler : ne pas ajouter un contrôle de qualité
  professionnelle pour « réparer » l'absence de SIRET obligatoire.
- Le détail juridique est dans [`docs/LEGAL.md`](../LEGAL.md), la grille de prix et la bascule dans
  [`docs/STRIPE-LIVE.md`](../STRIPE-LIVE.md), le code de la facturation dans
  [`src/modules/billing/CLAUDE.md`](../../src/modules/billing/CLAUDE.md).
