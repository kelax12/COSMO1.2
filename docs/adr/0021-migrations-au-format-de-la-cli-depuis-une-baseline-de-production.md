# ADR 0021 · Migrations au format de la CLI, depuis une baseline égale à la production

- **Statut** : acceptée (remplace les points 1 et 5 de l'[ADR 0006](./0006-migrations-sql-numerotees-appliquees-a-la-main.md))
- **Date** : 2026-11-09 (ROB-02, vagues 8.1 et 8.2 du plan de reprise)

## Contexte

L'audit externe du 2026-11-06 (ROB-02) : migrations appliquées à la main, ledger de production
divergent (32 fichiers sans entrée, 17 entrées sans fichier, `164` en prod hors ledger), numérotation
maison que la CLI Supabase ne lit pas. `supabase/schema.sql` disait ce que le DÉPÔT reconstruit ; rien
ne disait que la production était la même chose.

Mesuré le 2026-11-09 (`schema-prod.yml`, lecture seule) : le rejeu de `supabase/migration/` diffère de
la prod sur **102 objets** (6 en prod seulement, 23 dans le dépôt seulement, 73 définitions
différentes), dont les tables cœur créées au Dashboard avant le dépôt, des triggers absents de la prod,
et `238_affiliation_deduction`, appliquée en prod sans jamais avoir existé dans git.

## Décision

1. **Les migrations vivent dans `supabase/migrations/`**, au format de la CLI :
   `<AAAAMMJJHHMMSS>_snake_case.sql`. `supabase/migration/` devient un historique figé (`000` à `247`
   et leurs preuves), plus jamais appliqué ni modifié.
2. **Le premier fichier est une baseline** : `20261109120000_baseline.sql`, le schéma de la production
   du 2026-11-09, schéma seul. Elle part de l'instantané du rejeu et reprend, objet par objet, la
   définition lue en prod pour chaque écart. Les deux lignes de configuration que le schéma suppose
   (`billing_flags`, `affiliate_settings` à ses défauts) y sont amorcées ; aucun secret de prod.
3. **Toute base se construit par la CLI** (`supabase start`), qui inscrit chaque version au ledger
   local ; `scripts/verifier-migrations.mjs` le relit. Plus de chargeur maison.
4. **Une base fraîche doit égaler la prod**, et un job le prouve chaque jour :
   `schema-prod.yml` › `base-egale-prod` compare objet par objet (schéma `public`, triggers sur
   `auth.users`, storage, `pg_cron`, publication Realtime). Les migrations commitées mais pas encore
   appliquées sont retirées de son arbre et nommées.
5. **La preuve avant application et la relecture au catalogue restent** (points 2 à 4 de l'ADR 0006)
   jusqu'à la V8.3, où la CI appliquera elle-même, avec un secret d'application posé par Axel, après
   alignement du ledger de prod (`migration repair`, décrit dans `docs/DEPLOYMENT.md` § 6).

## Conséquences

- **Positives.** Le dépôt reconstruit la production, et un job rouge le dit dès qu'elle s'en écarte.
  `supabase db push` devient possible après la V8.3. Les écarts historiques sont nommés une fois.
- **Négatives.** La baseline suit la prod, défauts compris (`user_id` nullable sur les tables cœur,
  règle de commission de la `238` que les tests du dépôt ne décrivent pas) : les corriger est un
  chantier à part, par migrations postérieures. Le job lit la prod chaque jour avec `SUPABASE_DB_URL`.
- **À retenir.** ❌ Ne jamais éditer la baseline : une correction est une migration postérieure.
  Règles de détail : [`supabase/migration/CLAUDE.md`](../../supabase/migration/CLAUDE.md).
