> ⚠️ **ARCHIVE : relevés datés de production (tables, policies, advisors) cités en tête de SECURITY.md (2026-08-25 → 2026-10-15), extrait de `docs/SECURITY.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/SECURITY.md`](../SECURITY.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.


> ✅ **2026-10-01** : les douze Edge Functions sont **identiques au dépôt** (`Edge deploy drift`
> vert), mig. `204`, `207`-`210` appliquées, les 23 tables `160`-`207` auditées acteur par acteur
> en prod (`supabase/proofs/a1-tables-160-207.proof.sql`). Une règle en sort : une preuve de
> migration se joue en prod dans un bloc `DO` dont la seule issue est `RAISE EXCEPTION`, avec une
> passe témoin SANS la migration. Détail : `faille.md` (hors dépôt).
>
> 🔎 **Relu le 2026-10-15** : **77** tables dans `public`, toutes sous RLS, **205** policies, ledger
> **170**, advisors **`11 / 82 / 2 / 1`** (égaux à la référence de `Posture`, vert chaque jour depuis
> le 2026-10-08), douze Edge Functions. Les chiffres du corps de ce document restent ceux de leur
> date ; l'état courant et la note sont dans `faille.md` (hors dépôt).
>
> 🔴 **Relu le 2026-09-30 : les chiffres ci-dessous sont PÉRIMÉS.** La base porte **76 tables**
> dans `public` (toutes sous RLS, relevé de la session d'audit du jour) et les advisors rendent
> `11 / 78 / 2 / 1`. Douze Edge Functions, pas huit. Surface nouvelle et findings :
> `faille.md` (hors dépôt) § « Surface entreprise `160`-`207` ».
>
> ✅ **Confronté à la production le 2026-09-14 au soir.** Les affirmations de ce document qui
> portent sur un ÉTAT (par opposition aux règles) ont été vérifiées dans le catalogue Postgres, pas
> relues :
>
> | Affirmation | Mesure en base |
> |---|---|
> | Toute table `public` a RLS activée | **50 tables, 50 avec `relrowsecurity`** · 126 policies |
> | Le client n'a AUCUN chemin d'écriture sur `subscriptions` | **0 policy UPDATE**, 2 policies au total |
> | Le système de jetons n'existe plus (mig. `141`, C-04) | **0** RPC `consume_premium_token` / `credit_premium_token_from_ad` / `bump_win_streak`, **0** colonne `premium_tokens` / `win_streak` |
> | Les journaux scellés sont en deny-all | `payment_records`, `payment_closures`, `renewal_notices` : **aucune policy**. `withdrawal_consents` en porte **une seule**, `SELECT` pour `authenticated`, c'est la lecture de sa propre preuve |
> | `npm run check:rls` | **132 policies dans 106 migrations, 0 violation** |
>
> Les advisors Supabase rendent **9 / 52 / 2 / 1**, à l'unité ce qu'annonce le tableau de gardes de
> `faille.md` (hors dépôt). Détail de la passe : [`archive/README-journal-des-notes-2026-08-25-au-10-25.md`](../README-journal-des-notes-2026-08-25-au-10-25.md) § « Mise à jour du
> 2026-09-14 (soir) ».
