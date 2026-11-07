# ADR 0009 · Supabase Free, puis Pro au premier client payant

- **Statut** : acceptée
- **Date** : rester en Free décidé le 2026-08-29 ; passage en Pro au premier client payant décidé le
  2026-11-07

## Contexte

Tant que COSMO n'a pas de revenu, chaque dépense fixe pèse. Le plan Pro de Supabase coûte 25 $ par mois,
et le point-in-time recovery (PITR) s'y ajoute à 100 $ par mois (mesuré le 2026-08-29). Le plan Free
n'offre aucune sauvegarde native, plafonne la base à 500 Mo et à deux projets actifs. La base pèse
quelques dizaines de Mo (30 Mo au 2026-11-06, [`docs/SCALABILITY.md`](../SCALABILITY.md)).

## Décision

- **On reste en plan Free tant qu'aucun client payant ne justifie le Pro.** Le PITR n'est pas pris.
- **Le passage en Pro se déclenche au premier client payant**, et se fait en quelques jours. Tout ce
  qui se construit suppose donc que le Pro est imminent, sans l'attendre pour livrer.
- En attendant, la sauvegarde est celle que le dépôt s'est donnée : `db-backup.yml` exporte la base
  chaque jour, chiffrée, hors du fournisseur. La restauration de ce dump a été éprouvée (2026-09-01),
  et `restore-drill.yml` sert à la rejouer vers un projet jetable.

## Conséquences

- **Positives.** Aucun coût fixe d'hébergement de données avant le premier revenu, et la base se
  reconstruit depuis les migrations sur une base vierge ([ADR 0006](./0006-migrations-sql-numerotees-appliquees-a-la-main.md)).
- **Négatives.** Pas de PITR : la perte maximale est celle des dernières 24 heures entre deux dumps.
  Certaines fonctions de Supabase demandent le Pro et ne sont pas disponibles tant qu'on est en Free.
- **Seuil de réouverture.** Le premier client payant, ou une limite du plan Free atteinte (taille de
  la base, projets actifs). Au passage en Pro, on réévalue les sauvegardes gérées et le PITR en option.
- **Ne pas déduire** de l'activation de Stripe live ([ADR 0004](./0004-stripe-redirection-serveur-facturation-entreprise-seule.md))
  qu'il y a déjà des clients payants : ce sont deux événements distincts.
- Le runbook de sauvegarde et de restauration est dans [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md).
