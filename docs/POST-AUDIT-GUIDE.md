# Guide opérationnel — 4 chantiers post-audit COSMO

> Issu de l'audit technique du 2026-06-21. Guide pas-à-pas pour exécuter les 4
> actions prioritaires identifiées comme **hors du périmètre d'un fix automatique**.
> Voir aussi : `docs/DEPLOYMENT.md`, `faille.md`, `CLAUDE.md → Modèle Premium`.

## Deux corrections importantes (lire en premier)

1. **`supabase db push` ne fonctionne PAS sur ce repo.** Le layout est
   `supabase/migration/` (singulier, préfixes `NNN_`), non reconnu par la CLI
   Supabase (qui attend `supabase/migrations/<timestamp>_*.sql`). Le workflow
   réel = `apply_migration` (MCP) ou SQL editor. (`DEPLOYMENT.md §6`.)
2. **Le projet `ykeugqfgklejcdbrmawy` (« cosmo test ») EST la prod** (le 2ᵉ projet
   est inactif — `DEPLOYMENT.md §2`). La migration 048 y a déjà été appliquée et
   **vérifiée** : `idx_share_links_owner_id` existe en prod. **Point #1 = déjà fait.**

Chaque section est autonome.

---

## Point 1 — Index 048 en prod ✅ DÉJÀ FAIT (guide de vérification)

**Statut : appliqué + vérifié le 2026-06-21.** Aucune action requise. Ce qui suit
documente *pourquoi* et *comment re-vérifier*, car la procédure diffère de ce qui
était initialement annoncé.

### Ne PAS faire
- ❌ `supabase db push` — échoue/ne voit pas les migrations (layout `migration/`
  singulier non reconnu). Documenté dans `DEPLOYMENT.md §6`.

### La bonne procédure (déjà exécutée) pour TOUTE future migration `NNN_*.sql`
1. Écrire le fichier idempotent dans `supabase/migration/` (respecter
   `NNN_snake_case.sql`, gardé par `npm run validate:migrations`).
2. Appliquer via MCP : `apply_migration(project_id="ykeugqfgklejcdbrmawy",
   name="NNN_xxx", query=<contenu>)` — enregistre une entrée de ledger.
   Alternative : SQL editor du dashboard, coller le fichier versionné.
3. Re-lancer `get_advisors(security)` ET `(performance)` → aucun **nouveau** warning.
4. Lancer `node scripts/check-prod-drift.mjs` (cf. `DEPLOYMENT.md §6`) après application.

### Re-vérification de l'index (lecture seule)
```sql
select indexname, indexdef from pg_indexes
where tablename='share_links' and indexname='idx_share_links_owner_id';
-- attendu : 1 ligne, USING btree (owner_id)
```
Résultat obtenu le 2026-06-21 : présent. ✔

---

## Point 2 — Activer « Leaked Password Protection » (≈ 2 min, dashboard)

**Pourquoi** : advisor sécurité `auth_leaked_password_protection` (WARN). Supabase
Auth peut refuser les mots de passe compromis (vérif HaveIBeenPwned, k-anonymity —
seul un préfixe de hash SHA-1 est envoyé, jamais le mot de passe). C'est un toggle
de config Auth, **pas du code** → rien à committer.

### Étapes
1. Supabase Dashboard → projet **cosmo (`ykeugqfgklejcdbrmawy`)**.
2. **Authentication → Sign In / Providers → Password** (selon version :
   *Authentication → Policies* ou *Auth → Settings → Password security*).
3. Activer **« Prevent use of leaked passwords »** (Leaked password protection).
4. (Recommandé pendant qu'on y est) **Minimum password length ≥ 8** et
   **Password requirements** = au moins lettres+chiffres, si pas déjà fait.
5. Sauvegarder.

### Vérification
- Re-lancer `get_advisors(security)` → le warning `auth_leaked_password_protection`
  doit avoir disparu.
- Test fonctionnel : tenter une inscription avec un mot de passe notoire
  (`password123`) sur `/signup` → doit être refusé par Supabase.
- ⚠️ Impact UX : ne s'applique qu'aux **nouveaux** mots de passe (signup + reset),
  pas aux comptes existants. Vérifier que le message d'erreur GoTrue est bien capté
  par `normalizeApiError` côté `SignupPage`/`SettingsPage` (changement de mdp) et
  affiché en FR lisible — sinon ajouter le mapping du code d'erreur.

---

## Point 3 — Trancher la décision produit Premium

**Problème** : le revenu est aujourd'hui structurellement nul. Cause technique
(documentée, assumée) : `consume_premium_token` n'est **pas câblé** côté client
(`incrementTokenUsage` est un no-op), et le mur-pub Habitudes est piloté par un
flag `localStorage` daté (`useDailyAdGate('habits')`), pas par `isPremium()`.
Conséquence : un gratuit qui regarde **une** pub gagne un token **permanent** →
débloque aussi les **stats** à vie. Le seul vrai différenciateur payant actuel est
« sans pub ». Réf. : `CLAUDE.md → Modèle Premium`, `premium-model-refonte.md`.

⚠️ Ce point est une **décision de produit**, pas un bug à patcher. Ce guide structure
la décision ; il ne tranche pas à ta place.

### Fichiers concernés (pour situer l'impact de chaque option)
- `src/modules/billing/billing.context.tsx` — `isPremium()`, `addTokens`.
- `src/components/HabitsAdGate.tsx` — mur-pub quotidien, appelle `addTokens(1)`.
- `src/lib/hooks/useDailyAdGate.ts` (clé `cosmo_adwall_habits`) — le flag daté.
- `src/modules/billing/subscription.logic.ts` — logique premium pure (testée 100 %).
- RPC SQL : `consume_premium_token` / `credit_premium_token_from_ad` (mig. 015/016/039).
- `src/pages/StatisticsPage.tsx` — gate `isPremium()` (stats).

### Trois options (choisir UNE)

**Option A — « Sans pub » assumé (le moins de travail, cohérent avec l'existant)**
- On accepte que les stats soient gratuites après 1 pub ; le payant = *aucune pub*.
- Action : **retirer l'appel `addTokens(1)` dans `HabitsAdGate`** pour que la pub ne
  crédite plus un token permanent (sinon « gratuit » = « premium » après 1 pub).
  Le mur reste piloté par le flag daté (1×/jour). Les stats redeviennent réellement
  premium (gate `isPremium()` non franchi par la pub).
- Risque : faible. Pas de SQL. Bien tester `StatisticsPage` gate + abonnés payants
  (Stripe `current_period_end` futur) qui ne voient jamais le mur.

**Option B — Tokens consommables réels (modèle « freemium à crédits »)**
- Câbler `consume_premium_token` côté client (aujourd'hui no-op) + repenser la
  péremption. ⚠️ CLAUDE.md avertit : le premium des abonnés payants dépend AUSSI de
  `tokens > 0` → brancher la consommation peut casser leur accès. **Ne pas faire
  sans** dissocier « premium par abonnement » (Stripe) de « premium par tokens ».
- Action : refonte de `subscription.logic.ts` pour séparer les deux sources de
  vérité, migration SQL pour le décompte atomique, tests unitaires + intégration.
- Risque : élevé. Effort : 2–4 j. À ne lancer qu'après le harnais RLS (point 4).

**Option C — Stripe d'abord (monétisation directe)**
- Finaliser le flux Stripe (Edge Functions déjà solides : checkout + webhook +
  idempotence) et faire du **paiement** le seul différenciateur ; la pub disparaît.
- Action : configurer `VITE_STRIPE_PUBLISHABLE_KEY` (Vercel) + secrets Edge
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`), déployer les 3 Edge
  Functions (avec `supabase/config.toml`), tester un checkout réel en mode test
  Stripe, puis retirer le mur-pub + le crédit token.
- Risque : moyen (paiement réel). Prérequis fort : **tests sur les Edge Functions**
  (gap actuel = 0 test sur le code financier).

### Recommandation de séquencement
A (quick win cohérent) **maintenant** → puis C (Stripe) quand on veut encaisser →
B seulement si le modèle à crédits devient un vrai besoin. **Ne pas** câbler les
tokens (B) tant que premium-abonnement et premium-token ne sont pas dissociés.

### Décision à acter
Écrire le choix retenu dans `premium-model-refonte.md` + `CLAUDE.md → Modèle Premium`
avec la date, pour que la dette « assumée » devienne une décision tracée.

---

## Point 4 — Harnais de tests RLS d'intégration en CI (filet manquant n°1)

**Pourquoi** : toute la sécurité d'accès repose sur RLS + RPC `SECURITY DEFINER`.
Ces policies ont déjà cassé la prod (récursion 42P17, mig. 045) et sont **non
testées en intégration**. Avant toute optim RLS (ex. consolider les
`multiple_permissive_policies` sur `tasks`) ou refactor touchant les accès, il faut
un filet qui prouve : *A ne lit jamais les données de B*, *un collaborateur lit bien
une tâche partagée*, *un cursor forgé est rejeté*.

### Contrainte clé
Les policies utilisent `auth.uid()`, les rôles `authenticated`/`anon`, le schéma
`auth` → un Postgres nu **ne suffit pas**. Il faut la stack Supabase (GoTrue +
PostgREST + rôles). Et les migrations sont en `supabase/migration/` (singulier) →
non chargées automatiquement par `supabase start`. Donc : **stack locale + loader
de migrations custom**.

### Architecture proposée

**a. Loader de migrations** — `scripts/apply-migrations.mjs`
- Réutiliser le tri de `scripts/validate-migrations.mjs` (lecture `supabase/migration`,
  filtre `.sql`, `sort()`).
- Pour chaque fichier dans l'ordre, exécuter le SQL contre une `DATABASE_URL`
  fournie (via `pg` ou `psql`). Idempotent (les fichiers le sont déjà).
- Cible = l'URL Postgres de la stack locale Supabase.

**b. Config Vitest séparée** — `vitest.integration.config.ts`
- `environment: 'node'`, `include: ['e2e/rls/**/*.test.ts']` (ou
  `src/**/*.integration.test.ts`), **pas de coverage thresholds** (sinon entrelacé
  avec la suite unitaire). Ne PAS l'inclure dans `vitest.config.ts` (la suite
  unitaire CI doit rester rapide et sans réseau).
- Nouveau script : `"test:rls": "vitest run --config vitest.integration.config.ts"`.

**c. Helper clients** — `e2e/rls/helpers.ts`
- Un client `service_role` (admin) pour : créer 2 users via
  `supabase.auth.admin.createUser({ email, password, email_confirm: true })`,
  seed des lignes, cleanup.
- Deux clients utilisateur : `createClient(url, anonKey)` puis
  `signInWithPassword` → chacun porte le JWT de A / B. Toutes les assertions de
  lecture passent par CES clients (jamais le service_role) pour exercer la RLS.

**d. Fichiers de test** — `e2e/rls/*.test.ts`. Cas minimaux :
- `tasks.test.ts` : A crée une tâche → client B `select` ne la voit pas (0 ligne) ;
  client A la voit ; B ne peut pas `update`/`delete` (erreur/0 ligne).
- `sharing.test.ts` : amitié confirmée (RPC `accept_friend_request_v2`) + partage
  (`shared_tasks` insert) → B (collaborateur) lit la tâche via la policy
  « Collaborators can read shared tasks » ; un tiers C ne la lit pas. Couvre le
  chemin qui a causé la 42P17.
- `cursor.test.ts` : appel paginé avec `cursor`/`cursorDate` forgés → rejeté
  (complète le test unitaire `assertValidCursor`).

**e. Job CI** — nouveau job `rls-integration` dans `.github/workflows/ci.yml`
```yaml
  rls-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - uses: supabase/setup-cli@v1        # CLI Supabase
        with: { version: latest }
      - run: supabase start                # Docker dispo sur ubuntu-latest
      - run: npm ci
      - run: node scripts/apply-migrations.mjs "$(supabase status -o env | grep DB_URL ...)"
      - run: npm run test:rls
        env:
          SUPABASE_URL: http://127.0.0.1:54321
          SUPABASE_ANON_KEY: <depuis `supabase status`>
          SUPABASE_SERVICE_ROLE_KEY: <depuis `supabase status`>
      - run: supabase stop
```
(Les clés/URL locales sont déterministes ou lues via `supabase status -o env` ;
les injecter dans l'env du step `test:rls`.)

### Dépendances à ajouter (devDependencies)
- `pg` (ou utiliser `psql` du runner) pour le loader.
- `supabase` CLI via `supabase/setup-cli` (pas de dep npm).
- `@supabase/supabase-js` est déjà présent (prod dep) → réutilisable côté test.

### Effort & risque
- Effort : 1–2 j (le plus dur = stack locale + loader fiable en CI).
- Risque : faible (additif, isolé dans un nouveau job + nouvelle config Vitest ;
  n'altère ni le code prod ni la suite unitaire existante).
- Une fois en place : débloque en sécurité la consolidation des RLS
  `multiple_permissive_policies` et tout refactor d'accès.

---

## Vérification (par point)

| Point | Comment vérifier |
|---|---|
| 1 | `pg_indexes` montre `idx_share_links_owner_id` (✔ déjà fait) ; `get_advisors(performance)` sans le finding FK |
| 2 | `get_advisors(security)` sans `auth_leaked_password_protection` ; signup avec mdp compromis refusé |
| 3 | Décision écrite dans `premium-model-refonte.md` + `CLAUDE.md` ; si Option A : `StatisticsPage` reste gated après une pub, abonné Stripe ne voit pas le mur |
| 4 | `npm run test:rls` vert en local + job CI `rls-integration` vert ; un test qui retire une policy doit faire échouer le harnais (test du filet) |

## Notes
- Points **1 et 2** sont des opérations (dashboard/MCP), zéro commit de code.
- Point **3** = décision + petit code (Option A) ou chantier (B/C).
- Point **4** = le seul vrai développement ; à faire **avant** toute optim RLS.
- Aucune de ces actions ne doit passer par `supabase db push` (layout non supporté).
