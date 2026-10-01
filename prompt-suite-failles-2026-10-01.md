# Prompt · finir les failles ouvertes après la passe du 2026-09-30 / 10-01

> **Mode d'emploi.** Copier tout le bloc ci-dessous dans une nouvelle session, à la racine du
> dépôt. Il part de l'état mesuré le 2026-10-01 ; la session doit le **reconfirmer** avant d'agir
> (d'autres sessions écrivent dans ce dépôt et dans la base).

---

````markdown
# Mission : refermer les failles de sécurité restantes de COSMO, en production comprise

Tu reprends une passe de sécurité commencée le 2026-09-30. Une grande partie des correctifs est
déjà écrite dans le dépôt mais **n'agit pas encore en production**. Ton travail : les faire
atterrir en prod quand Axel l'autorise, finir ce qui n'a pas été commencé, et laisser la doc dire
l'état exact. « Corrigé » veut dire corrigé LÀ OÙ LE DÉFAUT AGIT, jamais « commité ».

## 0. Règles (non négociables)

1. **Lire d'abord** : `CLAUDE.md`, `faille.md` (section du 2026-09-30, « Surface entreprise
   `160`-`207` », « Ordre de priorité », « Migrations »), `a-faire-manuel.md` § 8,
   `supabase/migration/CLAUDE.md`, `supabase/functions/CLAUDE.md`, `docs/SECURITY.md`.
2. **Reconfirmer avant d'agir**, en lecture : ledger (`list_migrations`), catalogue
   (`information_schema`, `pg_get_functiondef`), Edge Functions (`list_edge_functions`,
   versions et `verify_jwt`), `git log origin/main`. L'état décrit ici a pu bouger.
3. **Gestes en production** (`apply_migration`, `deploy_edge_function`, `supabase functions
   deploy`, écriture au ledger) : **demander l'accord explicite d'Axel dans le chat, geste par
   geste**, en disant exactement ce qui va s'exécuter. La session précédente s'est vu refuser ces
   gestes par le classifieur de sécurité : si c'est encore le cas, ne pas le contourner, donner à
   Axel la commande exacte et vérifier ensuite par la lecture.
4. **Jamais** : `npm run cosmo:login`, `git reset --hard`, `git push --force`,
   `npm audit fix --force`, `--maxWorkers` à Vitest, écriture de données via le MCP Supabase,
   relèvement d'un plafond ou d'un seuil pour faire passer la CI, réapplication de la mig. `164`.
5. **Prouver avant d'appliquer** : une migration se joue d'abord en transaction annulée
   (`supabase/proofs/*.proof.sql`, sur PGlite en local si besoin, cf. la mémoire
   `audit-failles-correctifs-2026-09-30`), puis se vérifie au catalogue APRÈS application.
   Un message de commit qui dit « appliquée » n'est pas une mesure (mig. `204`, 2026-09-29).
6. Lire `$?` après chaque commande, jamais une ligne de résumé ; jamais `| tail` avant le code
   de sortie. Un témoin ne vaut que si on l'a vu échouer sur un sabotage.
7. Commit + push sur `main` après chaque lot vérifié (préférence d'Axel), en n'indexant QUE ses
   propres fichiers (d'autres sessions travaillent en parallèle).

## 1. État de départ (2026-10-01)

Commits poussés : `c9791d8f` (correctifs W-1 à W-4, docs, gardes), `1a4bece9` (autre session).
⚠️ Le lot « budget de bundle » (découpage de `org` / `legal`, dépôts de démo différés, plafonds
abaissés) devait être commité juste après la suite de tests : **vérifier qu'il est sur
`origin/main`** (`git log --oneline -5`, `npm run build && npm run check:bundle` vert). S'il ne
l'est pas, ne rien perdre : relire `git status` et demander à Axel.

| Faille | État au 2026-10-01 | Où c'est écrit |
|---|---|---|
| **Mig. `204`** `team_tasks.health` | 🔴 absente de la prod, le front l'écrit : menu « État » des tâches pro cassé | `faille.md` § Ordre de priorité 3bis |
| **A-3 / W-1** webhooks jamais délivrés (401) | 🟡 `config.toml` corrigé, fonction **non redéployée** | `faille.md` § W-1 |
| **A-6 / W-2** SSRF webhooks | 🟡 mig. `207` + code écrits, preuve PGlite 10/10, **non appliqués** | § W-2, `supabase/proofs/207.proof.sql` |
| **W-3** enfilement de webhook forgeable | 🟡 dans la mig. `207`, non appliquée | § W-3 |
| **A-4** code facturation prod ≠ dépôt | 🔴 `stripe-org-checkout` v15, `stripe-org-portal` v12, `report-bug` v12 à redéployer | § Ordre 3quater |
| **A-10 / W-4** `send-org-invite` sans plafond | 🟡 plafond codé, **non déployé** | § W-4 |
| **A-5** onze migrations hors ledger | 🟡 vérifiées objet par objet, **pas inscrites** : `164`, `181`, `190`-`195`, `197`-`199` | § Migrations |
| **A-1** surface entreprise non auditée | 🟡 relecture partielle (fonctions nommées, 4 Edge Functions) | § Surface entreprise |
| **A-8** CodeQL | 🟡 5 alertes `high` dans `scripts/` non triées (`M-60`) | `faille.md` AM-4 |
| **E-1** `insert_kr_checkin_row` | 🔴 point d'étape écrit sans changer la valeur du KR | § Surface entreprise |
| **E-2** `get_org_member_last_activity` | 🔴 ignore `suspended_at` / `access_expires_at` | § Surface entreprise |
| **G-3** `invite_domain_only` | 🔴 ne couvre pas les liens ouverts (`email IS NULL`), et G-2 rend `auth.email()` déclaratif | § G-3 |
| `Visual` rouge | 🔴 `/settings` diffère dans les 4 thèmes depuis le 2026-09-30 | `docs/README.md` § 2026-09-30 |
| `Migration coverage` rouge | suit A-5 et la `204` | — |

## 2. Travail, dans CET ordre

### Lot 1 · production (accord d'Axel requis à chaque geste)

1. **Appliquer la mig. `204`** (une colonne nullable + un `CHECK`). Vérifier :
   `information_schema.columns` porte `team_tasks.health`, et le menu « État » d'une tâche pro
   enregistre (test en démo ou sur un compte de test, jamais sur des données d'Axel sans accord).
2. **Mig. `207`** : jouer `supabase/proofs/207.proof.sql` en prod dans une transaction annulée
   (adapter les identifiants, jamais commités), puis appliquer, puis vérifier
   `pg_get_constraintdef` de `org_webhooks_url` (doit citer `[a-z]{2,63}` et `NOT VALID`) et
   `pg_get_functiondef(enqueue_team_task_webhook)` (doit commencer par `pg_trigger_depth() = 0`).
3. **Puis seulement** redéployer `org-webhook-dispatch` depuis la racine, sur `main` (il lit
   `verify_jwt = false` dans `supabase/config.toml`). ❌ Jamais avant l'étape 2.
4. Redéployer `stripe-org-checkout`, `stripe-org-portal`, `report-bug`, `send-org-invite`.
5. Relancer le workflow `Edge deploy drift` : attendu **12 fonctions identiques au dépôt,
   12 sondes vertes** (`npm run check:edge` et `check:edge-smoke`). Lancer aussi
   `org-webhook-dispatch.yml` en `workflow_dispatch` : attendu HTTP 200.
6. Inscrire au ledger les onze migrations déjà appliquées (procédure :
   `supabase/migration/README.md`, réconciliation du ledger), sans rien réexécuter. Vérifier que
   `Migration coverage` passe au vert.

### Lot 2 · correctifs encore jamais écrits

7. **E-2** : nouvelle migration (numéro libre au ledger ET au dépôt, relire avant de choisir)
   qui fait respecter la suspension et l'expiration dans `get_org_member_last_activity`
   (s'aligner sur `is_org_member`, mig. `161`). Preuve en transaction annulée : un admin
   suspendu reçoit 0 ligne, un admin actif voit tout, un manager son sous-arbre.
8. **E-1** : décider avec Axel. Soit `insert_kr_checkin_row` n'est plus appelable que depuis
   `post_kr_checkin` (même motif que W-3 : la rendre non exécutable par `authenticated` et faire
   passer l'écriture par une fonction unique qui fait l'UPDATE ET l'INSERT), soit c'est accepté et
   documenté comme tel. Pas d'élévation de droits dans les deux cas.
9. **G-3** : arbitrage produit à demander à Axel. Proposition : quand `invite_domain_only` est
   actif, refuser la création et la réclamation des liens ouverts. Si accepté : migration +
   texte d'écran + test.
10. **A-8 / M-60** : trier les 5 alertes CodeQL `high` (`js/file-system-race` ×4,
    `js/bad-tag-filter`) : corriger ou rejeter avec motif écrit, et dater la décision dans
    `faille.md` AM-4.

### Lot 3 · audit de ce qui n'a jamais été relu (A-1)

11. Pour chacune des tables créées par les migrations `160`-`207` : RLS active, policies par
    commande, `column_privileges`, et une preuve acteur par acteur en transaction annulée
    (membre, manager, admin, membre suspendu, membre d'une AUTRE organisation). Même chose pour
    les fonctions `SECURITY DEFINER` exécutables par `authenticated` qui n'ont pas encore été
    relues (lister par `pg_proc` / `has_function_privilege`, retirer celles du tableau « Surface
    entreprise » de `faille.md`). Chaque défaut devient un finding avec preuve, sinon « rien
    trouvé » avec ce qui a été joué.
12. Relire une par une les 13 fonctions de trigger `SECURITY DEFINER` signalées par
    `npm run validate:migrations` (19 avertissements, 6 au 2026-09-14).

### Lot 4 · CI et doc

13. **`Visual`** : télécharger l'artefact `visual-report` du dernier run (demander à Axel avant
    le téléchargement), comparer attendu / obtenu / diff sur `/settings`. Si c'est un changement
    voulu par une autre session, régénérer les références par le chemin prévu dans
    `e2e/CLAUDE.md` ; sinon, corriger la régression. Ne jamais régénérer à l'aveugle.
14. Mettre à jour `faille.md` (statut de chaque faille, avec version déployée et entrée de
    ledger), la note de sécurité selon le barème (un défaut rembourse son point **quand il est
    corrigé en prod et vérifié**), `docs/README.md`, `docs/SECURITY.md`,
    `supabase/migration/CLAUDE.md`, `a-faire-manuel.md` § 8. Relancer `npm run check:docs`.

## 3. Avant chaque push

`npm run typecheck`, `npm run lint` (0 erreur, ne pas ajouter d'avertissement),
`npx vitest run` complet (lire le compte de fichiers ET le code de sortie),
`npm run build && npm run check:bundle`, `npm run validate:migrations`, `npm run check:rls`,
`npm run i18n:check`, `node scripts/i18n-identical.mjs`.

## 4. Rendu attendu

Un tableau final faille par faille : **corrigée** (où, quelle version, quelle entrée de
ledger, comment vérifié), **corrigée en partie** (ce qui manque, qui doit le faire), ou **non
commencée** (pourquoi). Aucun « corrigé » sans preuve lue en production.
````
