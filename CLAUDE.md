# CLAUDE.md · COSMO 1.2

> **Quand lire** : chargé à chaque session ; règles valables partout et carte des `CLAUDE.md` de zone.
> **Fait foi** : le code ; la convention de rédaction est [`docs/README.md`](./docs/README.md) § Convention (ADR 0021), gardée par `npm run check:docs`.

❌ Jamais un récit d'incident ici : il s'écrit une fois dans `docs/archive/` ou le doc de son domaine ; ici, l'interdit en une ligne.

## Produit

- App de productivité (tâches, habitudes, agenda, OKR, statistiques), fr/en, en deux mondes.
- **Perso** : un utilisateur, ses données, partage entre amis gratuit. Premium perso coupé (`PREMIUM_ENFORCED = false`).
- **Entreprise** (`/entreprise/…`, `pages/organization/`) : organisation, équipes hiérarchiques, permissions par membre, facturation par paliers active (`ENTERPRISE_BILLING_ENFORCED = true`). Modules `organizations`, `org-*`, `team-*` : leurs propres tables (`team_tasks`, `team_okrs`…), **jamais** les modules perso réutilisés (ADR 0005).
- **Deux backends, une interface** : sans `VITE_SUPABASE_*` (ou via `loginDemo()`), mode **démo** sur `localStorage`. Chaque module expose un `repository.ts` servi par `supabase.repository.ts` ou `local.repository.ts` (`src/lib/repository.factory.ts`). 🔴 Une fonctionnalité qui ne marche que dans un des deux modes n'est pas finie.
- **Chemin d'une donnée** : page (`src/pages/`) → hook React Query (`modules/x/hooks.ts`) → repository → Supabase, où **la RLS est la vraie frontière** (ADR 0001), ou `localStorage`. Serveur : `supabase/migration/` (SQL numéroté, appliqué à la main, ADR 0006), `supabase/functions/` (Edge), `api/` (Vercel).
- **Zone inconnue** : [`docs/MODULES.md`](./docs/MODULES.md) → `index.ts` du module → son `CLAUDE.md` → le code, qui fait foi. Pourquoi d'une décision : [`docs/adr/`](./docs/adr/README.md). Quel doc lire : [`docs/README.md`](./docs/README.md) § Routeur. Chiffres : [`docs/FAITS.md`](./docs/FAITS.md).

## CLAUDE.md de zone (chargés seuls quand on touche la zone : ne pas les recopier ici)

| Zone | Fichier |
|---|---|
| Providers, routing, type `User`, canaux Realtime | [`src/CLAUDE.md`](./src/CLAUDE.md) |
| Tout module (double mode, repositories, RPC indexables) | [`src/modules/CLAUDE.md`](./src/modules/CLAUDE.md) |
| Premium, Stripe, facturation entreprise, remboursement | [`src/modules/billing/CLAUDE.md`](./src/modules/billing/CLAUDE.md) |
| Tâches, récurrence | [`src/modules/tasks/CLAUDE.md`](./src/modules/tasks/CLAUDE.md) |
| Habitudes, `completions`, fuseaux gelés | [`src/modules/habits/CLAUDE.md`](./src/modules/habits/CLAUDE.md) |
| OKR, journal `kr_completions` | [`src/modules/okrs/CLAUDE.md`](./src/modules/okrs/CLAUDE.md) |
| Catégories, arbre, impact de suppression | [`src/modules/categories/CLAUDE.md`](./src/modules/categories/CLAUDE.md) |
| Catégories d'entreprise (table unique, mig. `148`) | [`src/modules/team-categories/CLAUDE.md`](./src/modules/team-categories/CLAUDE.md) |
| Mode entreprise, permissions, boîte de réception | [`src/modules/organizations/CLAUDE.md`](./src/modules/organizations/CLAUDE.md) |
| Projets et tâches d'entreprise, corbeille, lecture par RPC | [`src/modules/team-projects/CLAUDE.md`](./src/modules/team-projects/CLAUDE.md) |
| Modales a11y, animations, design system mobile, onboarding | [`src/components/CLAUDE.md`](./src/components/CLAUDE.md) |
| Landing, deux parcours, GSAP, shader | [`src/pages/landing/CLAUDE.md`](./src/pages/landing/CLAUDE.md) |
| Toasts, échéances, fuseau horaire, `safeParse` | [`src/lib/CLAUDE.md`](./src/lib/CLAUDE.md) |
| i18n, slugs localisés, locales indexables | [`src/i18n/CLAUDE.md`](./src/i18n/CLAUDE.md) |
| Migrations SQL, RLS, ledger | [`supabase/migration/CLAUDE.md`](./supabase/migration/CLAUDE.md) |
| Edge Functions, drift déployé | [`supabase/functions/CLAUDE.md`](./supabase/functions/CLAUDE.md) |
| Fonctions Vercel (`api/`), collecteur d'audience, clé secrète | [`api/CLAUDE.md`](./api/CLAUDE.md) |
| Playwright | [`e2e/CLAUDE.md`](./e2e/CLAUDE.md) |
| Gardes CI, témoins, alerting, inventaire des `check:*` | [`scripts/CLAUDE.md`](./scripts/CLAUDE.md) |

## Documentation et hors dépôt

- 🔴 Avant de toucher `supabase/`, le billing ou un repository : [`docs/SECURITY.md`](./docs/SECURITY.md).
- ❌ Ne jamais lire `docs/archive/**` comme l'état courant : instantanés datés, non maintenus ; le code fait foi contre une archive.
- 🔒 `faille.md` (source de vérité sécurité, findings ouverts), `a-faire-manuel.md` et `RGPD-VIOLATION.md` vivent hors dépôt, dans `C:\Users\Axel\Documents\COSMO1.1\prive\` (dépôt PUBLIC, ADR 0008). ❌ Jamais un lien vers eux, jamais leur contenu dans le dépôt. Sécurité : `faille.md` fait foi, ce fichier ne recopie aucun statut de faille.
- 🔴 Avant tout déploiement prod : `faille.md` § « Ordre de priorité avant déploiement prod ».
- ⚠️ Le hook `pre-commit` refuse `prive/**`, csv, pdf, docx… : liste unique dans `scripts/check-fichiers-sensibles.mjs`.
- ⚠️ Le dépôt est PUBLIC : retirer un fichier du suivi n'efface pas l'historique.
- ⚠️ Droit : tout client est un consommateur (ADR 0010) → [`docs/LEGAL.md`](./docs/LEGAL.md).

## Données réelles d'Axel : CLI `scripts/cosmo/`

- ✅ Lecture tâches, habitudes, agenda, OKR ; écriture complète sur les tâches. Session d'Axel, filtrée par la RLS, jamais de `service_role`. Détail : [`docs/AGENT-AJOUTER-TACHE.md`](./docs/AGENT-AJOUTER-TACHE.md), [`docs/COSMO-CLI.md`](./docs/COSMO-CLI.md).
- Domaines : `tasks` (list / show / add / update / done / reopen / delete), `categories`, `habits today|done`, `agenda --days N`, `okr` (lecture seule).
- 🔴 Quoter toute valeur contenant des espaces, ou passer `--input '<json>'` (forme à préférer) : sans guillemets, la valeur est tronquée au premier mot.
- 🔴 `tasks list` ne renvoie pas `description` (liste allégée) : relire avec `tasks show <id>`, ce n'est pas un échec d'écriture.
- 🔴 Ne jamais lancer `npm run cosmo:login` (interactif, code par email) : session expirée → demander à Axel.
- 🔴 Ne jamais écrire via le MCP Supabase (`execute_sql` contourne la RLS) : le CLI est le seul chemin d'écriture.
- 🔴 Confirmer avant toute suppression qu'Axel n'a pas explicitement demandée.

```bash
npm run cosmo -- tasks add --input '{"name":"Ma tache","description":"Contexte detaille.","category":"SEO","priority":4}'
```

## Stack

React 19 · TypeScript 6 strict (pas 7 : ADR 0015) · Vite 8 (Rolldown) · React Router 8 (imports depuis `react-router`) · TanStack Query 5 · Supabase 2 · shadcn/ui (Radix + Tailwind 3) · Framer Motion · recharts · FullCalendar · date-fns 4 · zod · Vitest (`*.test.ts` à côté du code) · Playwright (`e2e/`) · Sentry · Vercel. Versions : `package.json`.

- `npm run build` = `vite build` + prérendu `prerender/main.ts` (TypeScript lancé par Node, sans transpileur).
- i18n : catalogues JSON maison (`src/i18n/`, `src/locales/{fr,en}/`), pas d'i18next (ADR 0003).
- jsPDF (`vendor-pdf`) : `import()` au clic sur « Exporter en PDF » seulement.
- Stripe live, facturation entreprise seule : checkout par redirection serveur (Edge Function), aucun SDK Stripe côté client (ADR 0004).
- Imports nominaux : lucide-react, locale `fr` de date-fns. `@tanstack/react-virtual` : TaskList mobile au-delà de 50 items.
- Sentry : `beforeSend` retire emails et UUIDs. Le build prod drope `console.*` et `debugger` (`vite.config.ts` → `minify.compress`, Oxc) : les erreurs remontent par Sentry (`VITE_SENTRY_DSN`).
- Audience maison : `src/lib/traffic.ts` → `api/collect.ts` → `traffic_hits` ; Vercel Analytics sous consentement ; aucun script tiers de mesure (ADR 0007).

## Commandes

`dev` (5173) · `start` (3000, celui de Playwright) · `build` · `preview` · `lint` et `typecheck` (`tsc -b`), **0 erreur** chacun · `test` (une passe) · `test:changed` (diff contre `origin/main`) · `test:coverage` · `test:rls` (stack locale) · `test:e2e` (→ `e2e/CLAUDE.md`). Gardes `check:*`, `i18n:*`, `validate:*` : `scripts/CLAUDE.md` § Inventaire.

- ✅ Boucle locale : `lint` + `typecheck` + `test:changed`. Le verdict est le noyau CI (`ci-noyau.yml`), qui joue tout après le push.
- ❌ Ne jamais conclure d'une ligne de résumé : lire `$?`, puis comparer le nombre de fichiers annoncé au périmètre du glob (une suite a déjà rendu « passed » et exit 1, des fichiers n'ayant jamais démarré).
- 🔴 Ne jamais passer `--maxWorkers` en ligne de commande : `vitest.config.ts` fixe `maxWorkers: 2` (C-47) ; l'écraser sature la machine et compte comme échec un worker vide.
- ❌ Ne jamais relever un seuil, un plafond ni ajouter une entrée d'allowlist pour faire passer la CI : un dépassement dit qu'un contenu doit bouger.

## Git : poussée directe sur `main` (ADR 0002)

- 🔴 Commit + push sur `main`. ❌ Pas de branche ni de PR, sauf demande explicite d'Axel dans la session.
- 🔴 Une session = un worktree = une branche locale. ❌ Jamais deux écrivains dans le même arbre (ni le checkout principal partagé). Pousser : `git fetch origin && git rebase origin/main && git push origin HEAD:main`.
- ❌ Pas de `npm run test:e2e` en local pour une retouche d'UI : `lint`, `typecheck`, `test:changed` et un coup d'œil au preview. Exceptions : une spec `e2e/` modifiée (ne lancer qu'elle), ou une demande d'Axel.
- 🔴 Le hook `pre-push` refuse un noyau (`CI noyau`) rouge sur `main`. ❌ Aucun contournement : ni `--no-verify`, ni PR d'office. Réparer : pousser le correctif sur `noyau/<nom>`, puis ce même SHA sur `main` une fois son noyau vert → `docs/DEPLOYMENT.md` § Hook `pre-push`.
- 🔴 Ne jamais rebaser sur `origin/main` une branche antérieure à la purge d'historique (`.githooks/garde-historique.sh` refuse la poussée) : worktree neuf, puis `git cherry-pick`.

## Environnement

- `.env` non versionné (copier `.env.example`). Sans `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` : mode démo automatique.
- Toute variable exposée au navigateur est préfixée `VITE_`. `VITE_SENTRY_DSN` est public (write-only) ; absent, le monitoring est coupé. `VITE_STRIPE_PUBLISHABLE_KEY` n'est lue nulle part.
- `.env.cosmo-cli` (gitignored) : config du CLI agent, distincte de `.env`.
- 🔴 `SUPABASE_SECRET_KEY` : serveur seulement, lue par `api/collect.ts`, posée sur Vercel par l'intégration Supabase. ❌ Jamais préfixée `VITE_` → [`api/CLAUDE.md`](./api/CLAUDE.md).
- Vercel : `vercel.json` (SPA rewrite, HSTS, X-Frame-Options, CSP, cache immuable `/assets/*`), fonctions `api/` en runtime edge → [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Conventions de code

- ✅ Imports par l'alias `@/` ; ❌ jamais `../../lib/…`. Seule exception : `api/` (NodeNext) → [`api/CLAUDE.md`](./api/CLAUDE.md).
- ❌ `gsap` ailleurs que depuis `@/lib/gsap`, et ailleurs que dans la landing : le reste de l'app est sur Framer Motion.
- ❌ `toast` ailleurs que depuis `@/lib/toast` (façade différée), jamais depuis `sonner`, même dans une page lazy ; jamais depuis un repository ni `normalizeApiError` → [`src/lib/CLAUDE.md`](./src/lib/CLAUDE.md).
- ✅ TypeScript strict (`noUnusedLocals`, `noUnusedParameters`) ; ❌ pas de `as any` ; `interface` pour les objets, `type` pour les unions ; inutilisé intentionnel préfixé `_`.
- ⚠️ Validation zod (`src/lib/validation/validate.ts` : `validateOrThrow`, `safeValidate`, `ValidationError`), câblée dans les `mutationFn` create/update : ce n'est PAS la frontière de sécurité (RLS + whitelist `mapToDb`).
- ✅ ESLint : `eslint.config.js` fait foi pour les ignorés ; 0 erreur avant chaque commit ; `e2e/**`, `src/components/showcase/**` et `supabase/functions/**` sont lintés (C-102). Warnings tolérés : Fast refresh sur les contextes et les fichiers ui shadcn.

## Garde-fous transversaux (pourquoi de chaque ligne : `docs/SECURITY.md` § Garde-fous transversaux)

- ❌ Importer `src/context/TaskContext` (supprimé) · recréer un contexte global qui agrège plusieurs modules · importer `useAuth` depuis `@/modules/user`.
- ❌ Appeler `repository.getFriends()` depuis un hook : l'interface expose `getAll()` (B3).
- ❌ Modifier `recordKRCompletion()` sans vérifier le graphique dashboard, en démo ET en prod.
- ❌ `kr.currentValue / kr.targetValue` sans garde `targetValue > 0` (B17).
- ❌ Insérer N lignes dans `kr_completions` depuis un `count` client non clampé : cap 100 par écriture (B18).
- ❌ `JSON.parse(localStorage.getItem(...))` sans `try/catch` : utiliser `safeParse<T>` (B14).
- ❌ Réintroduire des gates `isPremium()` sur le partage de tâches ou la collaboration.
- ❌ Une policy UPDATE/DELETE ou une purge sur `payment_records` / `payment_closures` (journal inaltérable, mig. `125`, trigger) ; ❌ anonymiser leur `user_id` (`row_hash` le scelle). Une erreur se corrige par une ligne compensatoire.
- ⚠️ `renewal_notices` est une preuve (L215-1) : ne jamais la purger.
- ❌ Lire `cosmo_cookie_consent` ailleurs que par `src/lib/cookie-consent.ts` / `useCookieConsent()`. Tout traceur est conditionné : `null` n'est pas une acceptation.
- ❌ Une garde conditionnelle à la présence de son propre secret (`if (SECRET && …)`).
- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client · committer sans vérifier que `.env` reste ignoré · écrire en base via le MCP Supabase.
- ❌ Appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy (`EXECUTE` révoqué, mig. `100`) : utiliser `is_above()` ou `i_have_subordinates()`.
- ❌ Garder une surface admin par `admin_allowlisted()` (affichage) : la garde est `is_admin()` (allowlist ET session `aal2`, mig. `131`).
- ❌ Une fonction de trigger en `SECURITY DEFINER` : `INVOKER` + `REVOKE` pour `anon` (mig. `108`).
- 🔴 En CSP, `https:` ne couvre PAS `wss:` (garde : `src/csp.guard.test.ts`).
- 🔴 Une migration qui crée une dépendance à un chemin de récupération : parcourir ce chemin avant.
- ❌ Citer un numéro de ligne d'un autre `.md` · recopier un « avant » (il se reconstruit à un commit nommé) · chercher le symptôme cité par la doc plutôt que la chose décrite.
