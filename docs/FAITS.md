<!-- GENERE par scripts/generer-faits.mjs. NE PAS EDITER A LA MAIN. Regenerer : npm run faits:generer -->

# Faits chiffrés du dépôt

> **Quand lire** : avant d'écrire un nombre de fonctions, migrations, tables, gardes, tests ou lignes. **Fait foi** : `scripts/generer-faits.mjs`, qui le calcule.

❌ Ne jamais recopier un de ces chiffres ailleurs : y renvoyer. Les chiffres de production (tables vivantes, ledger, taille de base) se lisent en base.

| Fait | Valeur | Source |
|---|---|---|
| Edge Functions déployables | **17** | dossiers de `supabase/functions/` portant un `index.ts` (hors `_shared`) |
| Migrations SQL | **228** | fichiers `NNN_*.sql` de `supabase/migration/` |
| Dernière migration | **252** | plus grand préfixe numérique de `supabase/migration/` |
| Workflows GitHub | **36** | fichiers de `.github/workflows/` |
| dont planifiés | **27** | workflows portant un `schedule:` |
| Fichiers de `scripts/` | **179** | fichiers suivis (budget d outillage, `scripts/outillage.reference.json`) |
| Lignes de `scripts/` | **41921** | lignes des fichiers suivis de `scripts/` |
| Tests de garde | **115** | fichiers `*.guard.test.*` du dépôt |
| Modules applicatifs | **23** | dossiers de `src/modules/` |
| Namespaces i18n | **34** | fichiers de `src/locales/fr/` |
| Gardes `check:` / `i18n:` / `validate:` | **45** | scripts de `package.json` |
| ADR | **21** | fichiers `NNNN-*.md` de `docs/adr/` |
| Fonctions Vercel | **1** | fichiers `.ts` de `api/` (hors tests et `_*`) |
| `CLAUDE.md` | **20** | racine et dossiers, hors `node_modules`, `.claude`, `.worktrees` |
| Docs vivantes de `docs/` | **37** | fichiers `.md` de `docs/`, hors `archive/` et `adr/` |
| Tables du schéma `public` | **92** | `CREATE TABLE public.` dans `supabase/schema.sql` |
| dont sous RLS | **92** | `ENABLE ROW LEVEL SECURITY` dans `supabase/schema.sql` |
| Policies RLS | **208** | `CREATE POLICY` dans `supabase/schema.sql` |
| Fonctions SQL de `public` | **249** | `CREATE FUNCTION public.` dans `supabase/schema.sql` |

## Se mesurent, ne s'écrivent pas

Ces chiffres bougent à chaque commit : les écrire ici ferait rougir le noyau à chaque test ajouté. Citer la commande.

| Fait | Commande |
|---|---|
| Fichiers de test Vitest | `git ls-files "*.test.ts" "*.test.tsx" "*.test.mjs" \| wc -l` |
| Cas de test Vitest | `npx vitest list \| wc -l` (lent : toute la collecte) |
| Specs Playwright | `git ls-files "e2e/*.spec.ts" \| wc -l` |
| Lignes et tokens d'un doc vivant | `npm run check:docs -- --mesurer` (tokens ≈ caractères / 4) |
| Fichiers et valeurs du cliquet de complexité | `eslint-rules/complexite.baseline.json` |
| Exceptions du cliquet des docs | `docs/convention-exceptions.json` |
| Taille du bundle | `npm run build && npm run check:bundle` |

Vérifié dans le noyau CI : `npm run check:faits` échoue si ce fichier diffère de la génération.
