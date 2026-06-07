# `supabase/migration/` — convention & drift (faille D-1)

> ⚠️ **Lis ceci avant de lancer `supabase db push` ou `supabase migration …`.**

## Ce dossier n'est PAS géré par la CLI Supabase

- La CLI Supabase lit `supabase/**migrations**/` (pluriel). Ce dossier est
  `supabase/**migration**/` (singulier) et contient un **changelog SQL manuel**,
  appliqué **à la main via le SQL editor** du dashboard (ou via `apply_migration`
  MCP), pas via `supabase db push`.
- Les fichiers sont numérotés `NNN_feature.sql` (001…038). Ce ne sont **pas** des
  versions horodatées (`<timestamp>_name.sql`) attendues par la CLI.

## Le drift (D-1)

Le ledger réel (`supabase_migrations.schema_migrations`, vu via
`mcp list_migrations`) ne contient qu'un **sous-ensemble** horodaté de ces
changements (créés tôt au dashboard, + 008/021/022…/036). Beaucoup de fichiers
(`001`–`007`, `009`–`020`, `026`, `029`, `030`, `037`, `038`) ne sont **pas**
dans le ledger.

**Conséquence — le footgun :** si quelqu'un copie ces fichiers dans
`supabase/migrations/` (pluriel) puis lance `supabase db push`, la CLI tentera de
ré-appliquer 001–020 → `relation already exists` (au mieux un échec, au pire un
état incohérent).

## Règle opérationnelle (court terme, zéro risque)

1. **Ne PAS lancer `supabase db push`** contre ce dossier.
2. Pour appliquer un nouveau fichier (ex. `037`, `038`) : l'exécuter **tel quel**
   dans le **SQL editor** du dashboard (ou `apply_migration` MCP). Tous les
   fichiers livrés ici sont idempotents / re-jouables.
3. Tout nouveau DDL passe par **un fichier numéroté ici** (jamais de DDL au
   dashboard sans fichier correspondant committé).

## Si tu veux passer à la gestion CLI (moyen terme, à faire une fois)

Opération humaine, accès DB requis — **ne pas automatiser à l'aveugle** :

```bash
# 1. Voir l'écart local <-> remote
supabase migration list

# 2. Marquer "appliqué" (sans ré-exécuter) chaque migration déjà en base.
#    À faire pour TOUTES les versions déjà présentes dans le ledger ET pour les
#    fichiers déjà appliqués manuellement. Récupère les <version> via la liste.
supabase migration repair --status applied <version>

# 3. Capturer une baseline du schéma réel comme point de référence
supabase db dump --schema public > supabase/migrations/00000000000000_baseline.sql

# 4. Désormais : nouveaux changements via `supabase migration new <name>` +
#    `supabase db push`, et on gèle ce dossier `migration/` (singulier).
```

## Ordre d'application manuel des derniers fichiers

```sql
-- (déjà appliqués jusqu'à 036 — cf. faille.md)
\i supabase/migration/037_kr_completions_kr_cascade.sql   -- FK cascade kr_id
\i supabase/migration/038_backfill_okr_key_results.sql    -- backfill JSONB -> table
```

> Les deux ont été validés par dry-run transactionnel (`BEGIN … ROLLBACK`) contre
> la prod avant commit. `038` est idempotent (garde `NOT EXISTS`).
