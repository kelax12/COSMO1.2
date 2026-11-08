# ADR 0006 · Migrations SQL numérotées, appliquées à la main, avec preuve

- **Statut** : acceptée
- **Date** : pratique en vigueur depuis les premières migrations, formalisée le 2026-11-07

## Contexte

Le schéma est le cœur du produit (voir [ADR 0001](./0001-supabase-assume-rls-frontiere.md)) : 221
fichiers de migration et 33 579 lignes de SQL au 2026-11-07. Une migration qui touche une politique ou
une fonction peut casser la production sans que le build ni les tests unitaires ne le voient. Le
dépôt en a payé le prix : une ligne au ledger de Supabase prouve qu'un **nom** est passé, pas qu'un
`CREATE OR REPLACE` a remplacé le corps vivant d'une fonction.

## Décision

1. **Les migrations sont des fichiers `NNN_feature.sql`** dans `supabase/migration/` (au singulier).
   Ce dossier n'est **pas** géré par la CLI Supabase, qui lit `supabase/migrations/` : on n'y lance
   jamais `supabase db push`. Le numéro suivant se choisit en relisant le ledger **et** le dossier,
   parce que plusieurs sessions peuvent écrire en parallèle.
2. **Elles s'appliquent à la main** en production (éditeur SQL ou `apply_migration`), jamais par un
   `git push`. Pousser sur `main` ne touche jamais la base.
3. **Une migration se prouve avant d'être appliquée** : un script de preuve (`supabase/proofs/`) la
   joue sur la base de production dans une transaction qui ne peut que s'annuler, acteur par acteur,
   et rend son verdict par un texte d'exception. La forme à reprendre est un bloc `DO` unique terminé
   par `RAISE EXCEPTION`, de façon que l'annulation soit la seule issue et ne puisse pas s'oublier.
4. **Après application, on relit le catalogue** (`pg_get_functiondef`, `information_schema`), pas le
   ledger : c'est le catalogue qui dit ce qui existe.
5. **Des gardes statiques et un rejeu complet bloquent la CI** : `validate:migrations` (analyse des
   fichiers), `check:rls`, `check:migration-coverage` (fichiers contre ledger de production), et sur une
   base vierge, `scripts/apply-migrations.mjs` rejoue toutes les migrations avant `test:rls` et
   `check:contrat` (`supabase/schema.sql`, `supabase/rpc-inventory.md` et les types générés comparés aux
   migrations).

## Conséquences

- **Positives.** Un changement de base est toujours un geste volontaire, relu, prouvé. Le dépôt peut
  reconstruire un schéma complet sur une base vierge, ce qui sert aussi la restauration.
- **Négatives.** Un risque de dérive entre dépôt et production (une migration écrite mais pas
  appliquée, ou l'inverse), que `check:migration-coverage` mesure chaque jour mais ne
  supprime pas. Un geste manuel de plus à chaque déploiement qui touche la base.
- **À retenir.** Une présence ou une absence au ledger ne prouve rien seule. Les règles de détail, la
  forme de preuve et le journal des applications sont dans
  [`supabase/migration/CLAUDE.md`](../../supabase/migration/CLAUDE.md) et
  [`docs/SECURITY.md`](../SECURITY.md).
