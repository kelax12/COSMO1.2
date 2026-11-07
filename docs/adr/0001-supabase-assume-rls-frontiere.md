# ADR 0001 · Supabase est assumé, et la RLS est la frontière de sécurité

- **Statut** : acceptée
- **Date** : décision prise dès l'origine du dépôt, écrite le 2026-11-07
- **Remplace** : une phrase de `src/architecture.guard.test.ts` qui promettait qu'une sortie de
  Supabase serait « envisageable en jours plutôt qu'en mois » (retirée le 2026-11-07)

## Contexte

COSMO a un seul mainteneur. Le dépôt est construit autour de Supabase : Postgres, authentification
(GoTrue), Realtime, Edge Functions, `pg_cron`. Un module de données passe par un `repository.ts`, et
une garde d'architecture (`src/architecture.guard.test.ts`) interdit `supabase.from()` hors d'un
repository.

Cette garde a longtemps été présentée comme ce qui rendrait une sortie de Supabase faisable en
quelques jours. C'est faux, et l'écrire laissait croire à un plan de sortie qui n'existe pas. Mesuré le
2026-11-07 : `supabase/migration/` pèse **33 579 lignes de SQL** dans 221 fichiers, et
`supabase/schema.sql` 21 109 lignes. Ce SQL porte l'autorisation (politiques RLS sur toutes les
tables), les agrégats (RPC de lecture, statistiques), les triggers, les traitements planifiés
(`pg_cron`) et la journalisation fiscale. L'authentification, y compris le second facteur de la
console admin, est celle de GoTrue.

## Décision

1. **Supabase est assumé comme plateforme**, pas comme un détail d'implémentation remplaçable. Le
   produit en dépend.
2. **La RLS est la vraie frontière de sécurité.** Le client est considéré comme hostile : la
   validation zod, les gardes d'interface et les `isPremium()` ne protègent rien. Toute règle
   d'accès vit dans une politique ou dans une fonction SQL.
3. **Le pattern repository reste, pour ce qu'il fait réellement** : un seul endroit côté client où une
   table est lue ou écrite, donc un seul endroit à relire quand une requête ou un nom de colonne
   change, et deux implémentations interchangeables (Supabase et `localStorage`, voir
   [`docs/MODULES.md`](../MODULES.md)). Il ne rend pas Supabase remplaçable.

## Conséquences

- **Positives.** Un contrôle d'accès écrit une fois, au plus près de la donnée, et testé sur base
  vierge en CI (`rls-integration`, `test:rls`). Peu de code serveur à maintenir pour une personne
  seule.
- **Négatives.** Une dépendance forte à un fournisseur : changer de plateforme serait une réécriture
  du SQL, de l'auth, du temps réel et du cron, mesurée en mois. Les limites du plan Supabase
  deviennent des limites du produit (voir [ADR 0009](./0009-supabase-free-puis-pro-au-premier-client-payant.md)).
- **À maintenir.** Toute nouvelle table naît avec sa RLS, et une migration qui touche une policy se
  prouve avant application ([ADR 0006](./0006-migrations-sql-numerotees-appliquees-a-la-main.md)).
  Les règles détaillées sont dans [`docs/SECURITY.md`](../SECURITY.md).
- Le commentaire de la garde d'architecture dit désormais ce qu'elle garantit (un seul point d'accès
  aux tables côté client) et renvoie ici pour ce qu'elle ne garantit pas.
