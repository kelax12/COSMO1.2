<!-- GENERE par scripts/generer-faits.mjs. NE PAS EDITER A LA MAIN. Regenerer : npm run faits:generer -->

# Faits chiffrés du dépôt

Un chiffre se calcule, il ne se recopie pas. Les autres documents renvoient ici au lieu de le répéter.
Les chiffres de production (tables vivantes, ledger, taille de base) ne sont pas ici : ils se lisent en base.

| Fait | Valeur | Source |
|---|---|---|
| Edge Functions déployables | **16** | dossiers de `supabase/functions/` portant un `index.ts` (hors `_shared`) |
| Migrations SQL | **219** | fichiers `NNN_*.sql` de `supabase/migration/` (historique figé le 2026-11-09) |
| Dernière migration | **247** | plus grand préfixe numérique de `supabase/migration/` |
| Migrations de la CLI | **5** | fichiers `<horodatage>_*.sql` de `supabase/migrations/`, baseline comprise |
| Dernière migration de la CLI | **20261109120400_248_habit_completions** | dernier fichier de `supabase/migrations/`, dans l ordre de la CLI |
| Workflows GitHub | **36** | fichiers de `.github/workflows/` |
| dont planifiés | **27** | workflows portant un `schedule:` |
| Modules applicatifs | **23** | dossiers de `src/modules/` |
| Namespaces i18n | **34** | fichiers de `src/locales/fr/` |
| Gardes `check:` / `i18n:` / `validate:` | **45** | scripts de `package.json` |
| ADR | **21** | fichiers `NNNN-*.md` de `docs/adr/` |
| Tables du schéma `public` | **92** | `CREATE TABLE public.` dans `supabase/schema.sql` |
| dont sous RLS | **92** | `ENABLE ROW LEVEL SECURITY` dans `supabase/schema.sql` |
| Policies RLS | **208** | `CREATE POLICY` dans `supabase/schema.sql` |
| Fonctions SQL de `public` | **245** | `CREATE FUNCTION public.` dans `supabase/schema.sql` |

Vérifié dans le noyau CI : `npm run check:faits` échoue si ce fichier diffère de la génération.
