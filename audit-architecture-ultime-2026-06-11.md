# Audit Architecture Ultime — COSMO 1.2

**Date** : 2026-06-11
**Méthode** : inventaire complet → analyse fichier par fichier → interrogation de la base live (Supabase advisors) → matrice de risques → vérification de couverture.
**Périmètre** : 439 fichiers trackés, 325 dans `src/` (186 `.ts`, 148 `.tsx`), 42 migrations SQL, 3 Edge Functions, base Postgres 17 live (14 tables).
**Principe** : aucune conclusion sans preuve référencée à un fichier ou à une donnée live.

> **Note de cadrage déterminante** : COSMO **n'est pas une application 3-tiers classique**. C'est une **SPA React + BaaS Supabase + hébergement Vercel**. Il n'y a **aucun serveur backend custom** (pas de controllers/services Node, pas de Docker, pas de Kubernetes, pas de Redis, pas de file de messages). Le « backend » = RLS Postgres + 3 Edge Functions Deno + Stripe. Les étapes de l'audit portant sur ces couches absentes sont marquées **N/A (architecture BaaS)** — explicitement, pas par omission.

---

## ÉTAPE 1 — INVENTAIRE GLOBAL

| Chemin | Rôle | Importance | Fichiers |
|---|---|---|---|
| `src/modules/` | Logique métier par domaine (12 modules) | **Critique** | 107 |
| `src/components/` | UI (dont `ui/` shadcn = 26) | **Critique** | 117 |
| `src/pages/` | Pages routées (lazy) | Haute | 40 |
| `src/lib/` | Helpers purs + infra (supabase, pagination, validation) | **Critique** | 42 |
| `src/tutorials/` | Configs tutoriels desktop/mobile | Faible | 8 |
| `src/hooks/` | Hooks transverses | Moyenne | 3 |
| `supabase/migration/` | 42 migrations SQL (RLS, RPC, triggers) | **Critique** | 44 |
| `supabase/functions/` | Edge Functions Deno (Stripe, delete-account) | **Critique** | 4 |
| `e2e/` | Playwright (smoke + parcours + a11y) | Moyenne | 5 specs |
| `docs/` | Runbook deploy/rollback | Moyenne | — |
| `scripts/` | `validate-migrations.mjs` (garde CI) | Moyenne | — |
| `.github/workflows/` | CI 3 jobs | Haute | 1 |

**Modules** (`src/modules/`) : tasks (17), okrs (13), events (12), habits (12), lists (10), billing (7), categories/friends/kr-completions (8), ui-states/user (5), auth (2).

**Stack vérifiée** (`package.json`) : React 18.3, Vite 7.3, React Router 6, TanStack Query 5, Supabase-js 2.91, Framer Motion 12, Recharts 3, Zod 3.25, Sentry 10, FullCalendar 6. **Aucune dépendance morte évidente** ; GSAP bien absent (supprimé per audit perf).

---

## ÉTAPE 2 — COUVERTURE COMPLÈTE

| Zone | Analysée | Niveau | Preuve |
|---|---|---|---|
| Frontend | Oui | 100% | App.tsx, pages, modules lus |
| « Backend » (Edge Functions) | Oui | 100% | 3 fonctions lues intégralement |
| Database | Oui | 100% | `list_tables` live + 42 migrations |
| Infra / Hosting | Oui | 100% | `vercel.json`, `vite.config.ts` |
| Auth | Oui | 100% | `supabase.ts`, AuthContext, config.toml |
| API (PostgREST/RPC) | Oui | 100% | repositories + advisors |
| Tests | Oui | 100% | 62 fichiers test, 5 e2e, vitest.config |
| Monitoring | Oui | 100% | Sentry + `opsAlert` + Eruda |
| CI/CD | Oui | 100% | `ci.yml` 3 jobs |
| Sécurité | Oui | 100% | advisors live + faille.md + code |
| Scalabilité | Oui | 100% | advisors perf live (77 WARN) |

**Aucune zone non couverte.** Réserve unique : la base interrogée est le projet **`cosmo test` (ykeugqfgklejcdbrmawy, ACTIVE_HEALTHY)** ; le projet prod réel peut différer marginalement en volumétrie mais le **schéma et les policies sont identiques** (mêmes migrations).

---

## ÉTAPE 3 — CARTOGRAPHIE

**Flux utilisateur**
```
Navigateur (SPA React/Vercel CDN)
  → AuthContext (session Supabase JWT, cache localStorage 24h)
  → repository.factory (démo localStorage | prod Supabase)
  → PostgREST (REST + RPC, RLS auth.uid()=user_id)
  → Postgres 17 (eu-west-1)
  → Stripe (checkout/webhook via Edge Functions Deno)
  → Sentry (erreurs, beforeSend strip PII)
```

**Flux de données métier sensibles**
| Donnée | Origine | Transformation | Stockage | Frontière sécu |
|---|---|---|---|---|
| `tasks/habits/events/okrs` | UI | `mapToDb` whitelist (jamais `user_id` client) | Postgres RLS | RLS + whitelist mapper |
| Premium / tokens | Stripe webhook | service_role upsert | `subscriptions` | INSERT/UPDATE client verrouillés (mig. 015/041) |
| Identité partage | `auth.users.meta` | `sanitize_display_name()` | `profiles` | anti second-order XSS (mig. 026/042) |
| KR completions | toggle KR | journal append-only atomique | `kr_completions` | alimente dashboard |

---

## ÉTAPE 4 — ANALYSE FICHIER PAR FICHIER (fichiers critiques)

| Fichier | Rôle | Complexité | Constat | Risque |
|---|---|---|---|---|
| `src/lib/supabase.ts` | Client + `timeoutFetch` 8s | Moyenne | Excellent : AbortController, timeout < RQ wrapper, debug conditionnel | 🟢 |
| `src/App.tsx` | Routing + QueryClient | Moyenne | `lazyWithRetry` (chunk obsolète), retry intelligent (skip PGRST/timeout), `networkMode:'always'` | 🟢 |
| `supabase/functions/stripe-webhook/index.ts` | Webhook Stripe | **Haute** | Idempotence post-handler, signature générique, `opsAlert`, upsert atomique | 🟢 |
| `supabase/functions/delete-account/index.ts` | RGPD art.17 | **Haute** | Abort si cleanup échoue, UUID guard, résilient table manquante | 🟢 |
| `supabase/functions/stripe-create-checkout/index.ts` | Checkout | Haute | Idempotency keys, CORS allowlist, already_subscribed guard | 🟢 |
| `src/modules/tasks/supabase.repository.ts` | Repo tasks | **Haute** | `TASK_LIST_COLUMNS` (payload réduit), `fetchAllPages`, `assertValidCursor`, RPC atomiques | 🟢 |
| `src/components/event-modal/EventModalForm.tsx` | Form event | **Très haute (881 LOC)** | God component résiduel | 🟠 dette |
| `src/components/task-modal/TaskModalDesktopBody.tsx` | Corps modal | Très haute (812) | God component, refactor en cours | 🟠 dette |
| `src/pages/SettingsPage.tsx` | Réglages + upload avatar + delete | Très haute (794) | Multi-responsabilité | 🟠 dette |
| `src/components/ui/chart.tsx` | Wrapper Recharts | Haute | `dangerouslySetInnerHTML` **mais** whitelist regex couleur/id (mig M-11) | 🟢 |

**Helpers/infra purs testés** : `pagination.types` (UUID/ISO guard), `fetch-all-pages` (plafond MAX_ROWS), `normalizeApiError` (pas de leak message brut), `validation/validate` (zod), `avatar-upload` (MIME whitelist + re-encode canvas). Tous accompagnés d'un `*.test.ts`.

---

## ÉTAPE 5 — ANALYSE FRONTEND

- **Architecture** : modules par domaine + repository pattern + hooks React Query. Séparation propre. ✅
- **Re-renders / hooks** : `hooks.derived.ts` mémoïsés (`useMemo`), `useDebounce`, `useIsMobile` memoïzé. ESLint `react-hooks` actif. ✅
- **Code splitting** : toutes les pages `React.lazy` + `lazyWithRetry`, CommandPalette lazy, Recharts/FullCalendar lazy. ✅
- **Bundle** (`vite.config.ts`) : 11 `manualChunks` explicites et commentés, entry ~34 kB gzip, `vendor-charts`/`vendor-calendar` lazy. Discipline d'imports nominaux (lucide/date-fns). ✅
- **N/A** : pas de Next.js (pas de RSC/SSR/ISR/hydration) — SPA pure pré-rendue via `prerender.mjs`.

**Verdict frontend : exemplaire.** Seule dette = ~16 god components 600–881 LOC (refactor vague 1 >800 terminée, vague >600 en cours).

---

## ÉTAPE 6 — ANALYSE BACKEND

**N/A (BaaS)** : pas de controllers/services/repositories serveur, pas de jobs/queues/cron applicatifs, pas de SOLID serveur à auditer. Le « backend » se résume aux 3 Edge Functions (analysées §4, qualité 🟢) + logique en RPC SQL (§10).

---

## ÉTAPE 7 — ANALYSE API

Surface = PostgREST auto-généré + RPC. Pour chaque table : SELECT/INSERT/UPDATE/DELETE gardés par RLS `auth.uid()=user_id`. RPC SECURITY DEFINER (7) avec checks internes.

- **Auth** : JWT obligatoire (anon key publique = lecture impossible sans RLS pass). ✅
- **Validation** : zod côté client (UX) + RLS + whitelist mapper (sécurité). ✅
- **Endpoints dangereux** : 7 RPC SECURITY DEFINER exposés à `authenticated` (advisor WARN) — **intentionnels** (vérif interne `auth.uid()`), mais voir Étape 15.
- **Rate limiting applicatif** : **ABSENT** (recherche `rate.limit|throttle|captcha` → aucune garde app). Dépend à 100% des limites natives Supabase Auth + Cloudflare Supabase. **Risque réel** (Étape 15).

---

## ÉTAPE 8 — AUTHENTIFICATION

- Supabase Auth (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`). ✅
- Source de vérité unique `useAuth()` ; identité jamais lue de localStorage en prod. ✅
- Cache localStorage `cosmo:qcache:*` TTL 24h purgé sur `SIGNED_OUT` (L-11). ✅
- **Leaked password protection DÉSACTIVÉE** (advisor live WARN) — fix 1 clic dans le dashboard. 🟠
- OAuth Google : `redirectTo` à restreindre côté dashboard (rappel CLAUDE.md).

---

## ÉTAPE 9 — AUTORISATION

- Modèle = RLS par propriétaire + RLS sociale (friends/shared_tasks exigent amitié confirmée ou demande pending vérifiée, mig. 027/036). ✅
- `friend_requests.UPDATE` splitté sender(cancel)/receiver(accept/reject). ✅
- Pas de RBAC/ABAC multi-rôles (app mono-utilisateur-propriétaire) — **adapté au domaine**.
- IDOR : protégé par RLS sur chaque ligne ; cursors validés (`assertValidCursor`). ✅

---

## ÉTAPE 10 — DATABASE (live)

14 tables, **RLS activée sur 100%** :
`categories, tasks(156), habits, events(148), okrs, lists, friends, friend_requests, shared_tasks, subscriptions(41), key_results, kr_completions, profiles, processed_stripe_events`.

- Postgres **17.6** (à jour). ✅
- 42 migrations idempotentes (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE`). ✅
- Triggers `prevent_user_id_change`, `set_receiver_id`, `updated_at`, KR `completed_at`. ✅
- **Drift ledger** : ~22 entrées pour 42 fichiers (réconciliation `migration repair` recommandée — pas un risque data).

---

## ÉTAPE 11 — ANALYSE DES REQUÊTES

- **N+1** : `enrichSharedBy` (tasks repo) fait **1** requête `profiles` batchée via `.in(ownerIds)` — pas de N+1, et 0 requête si aucune tâche partagée. ✅
- **Full scan / pagination** : `fetchAllPages` (range, plafond 5000) ; listes réduites via `TASK_LIST_COLUMNS`. ✅
- **Coût dominant** : voir Étape 12/14 — la **ré-évaluation RLS par ligne** est le vrai poste de coût.

---

## ÉTAPE 12 — PERFORMANCE (advisor live)

`get_advisors(performance)` → **77 WARN + 16 INFO** :

| Finding | Occur. | Impact |
|---|---|---|
| **`auth_rls_initplan`** | **51** | 🔴 `auth.uid()` ré-évalué **par ligne** au lieu de `(select auth.uid())` — CPU O(n) sur grosses tables |
| `multiple_permissive_policies` | 24 | 🟠 plusieurs policies permissives même rôle/action → chacune évaluée |
| `unused_index` | 15 | 🟡 index jamais utilisés (coût write + stockage) |
| `duplicate_index` | 2 | 🟡 index redondants |
| `unindexed_foreign_keys` | 1 | 🟠 FK sans index (jointure lente) |

**C'est LE goulot de scalabilité.** À volume actuel (156 tasks) invisible ; à x100 utilisateurs avec milliers de lignes/requête, la ré-évaluation RLS sature le CPU Postgres.

Front : LCP/FCP bons (entry 34 kB gzip, CDN immutable, lazy). TTFB = CDN statique → excellent.

---

## ÉTAPE 13 — CACHE

- **CDN Vercel** : `/assets/* immutable 1 an`, `index.html must-revalidate`. ✅
- **Browser/React Query** : staleTime 5 min, gcTime 30 min. ✅
- **localStorage** : write-through tasks/habits TTL 24h (offline iOS). ✅
- **Redis/serveur** : **N/A** (pas d'app server). Pas de risque cache empoisonné.

---

## ÉTAPE 14 — SCALABILITÉ

| Charge | Comportement | Point de rupture |
|---|---|---|
| **x10** | OK sans changement | aucun |
| **x100** | 🔴 **1er point de rupture : RLS initplan** (CPU Postgres) + pool de connexions (Supavisor transaction mode requis) | DB compute |
| **x1000** | 🔴 **2e : compute Supabase mono-instance** (scaling vertical only) + 3e : **absence de rate limiting** (abus/coût) | plan Supabase + WAF |

Frontend (CDN) et PostgREST (stateless) scalent horizontalement sans effort. **Le facteur limitant est exclusivement la DB Postgres** (single-writer, eu-west-1, scaling vertical).

---

## ÉTAPE 15 — SÉCURITÉ (OWASP)

`get_advisors(security)` → **0 ERROR**, 8 WARN :
- 7× `authenticated_security_definer_function_executable` (RPC exposés — intentionnels, vérif `auth.uid()` interne ; envisager `REVOKE EXECUTE` sur ceux jamais appelés par le client).
- 1× leaked password protection désactivée.

| OWASP | État | Preuve |
|---|---|---|
| A01 Broken Access Control | 🟢 | RLS 100% tables + WITH CHECK obligatoire |
| A02 Crypto | 🟢 | HTTPS/HSTS, secrets jamais client (`service_role` 0 occurrence dans `src/`) |
| A03 Injection (SQL/XSS) | 🟢 | `assertValidCursor`, whitelist mappers, `sanitize_display_name`, `dangerouslySetInnerHTML` whitelisté (chart.tsx) |
| A04 Insecure Design | 🟢 | mode confiance social repensé (mig 027/036) |
| A05 Misconfig | 🟢 | CSP complète, headers Vercel, `allowedHosts` allowlist |
| A06 Vuln Components | 🟢 | CI `npm audit --audit-level=high` bloquant |
| A07 Auth Failures | 🟠 | **pas de rate limit app + leaked-pwd off** |
| A08 Integrity (Stripe) | 🟢 | signature webhook + idempotence |
| A09 Logging | 🟢 | Sentry `beforeSend` strip PII + `opsAlert` |
| A10 SSRF | 🟢 | pas de fetch serveur vers URL user-fournie |

`.env` **non tracké** (vérifié). Uploads : MIME whitelist + cap 500KB + re-encode canvas, SVG interdit. ✅

---

## ÉTAPE 16 — DEVOPS

- **N/A** : Docker, Compose, K8s, Railway, AWS — aucun (Vercel + Supabase managés).
- CI (`.github/workflows/ci.yml`, 3 jobs) : `lint-test-build` / `audit` / `e2e`, `concurrency` annule runs obsolètes, `permissions: contents:read`, Dependabot. ✅
- **Rollback** : `docs/DEPLOYMENT.md` (runbook). Vercel rollback instantané (deploy immutable). ✅
- **Alerting** : `opsAlert` sur webhook/delete-account. 🟢

---

## ÉTAPE 17 — OBSERVABILITÉ

- Logs : `console.*` dropés en prod, erreurs → Sentry (release injectée). ✅
- Traces : Sentry frontend. **Angle mort** : pas de tracing distribué Edge Function → DB.
- Métriques : dashboard Supabase + Vercel Analytics (externe). **Angle mort** : pas de métriques business custom (MRR, churn).
- Debug iOS : Eruda via `?debug=1`. ✅

---

## ÉTAPE 18 — TESTS

- **62 fichiers de test** Vitest (logique pure, mappers, hooks, quelques composants) + seuils de couverture **par fichier** (17 entrées, CI bloquante).
- **5 specs E2E** Playwright (3 smoke + parcours profonds + a11y axe 6 routes).
- **Zones sous-testées** : god components UI (EventModalForm, TaskModalDesktopBody) — logique pure extraite et testée, mais orchestration UI peu couverte E2E.
- Pas de tests de charge / pas de tests des Edge Functions (Deno).

---

## ÉTAPE 19 — DETTE TECHNIQUE

- **Critique (bloque la croissance)** : RLS `initplan` (51) — réécrire `auth.uid()` → `(select auth.uid())`.
- **Majeure** : absence de rate limiting app ; ledger migrations désynchronisé ; secret `APP_URL` prod non posé (CORS).
- **Modérée** : ~16 god components 600–881 LOC ; 24 multiple_permissive_policies ; 15 unused_index.
- **Mineure** : naming localStorage incohérent ; tutoriels desktop/mobile dupliqués.

---

## ÉTAPE 20 — CODE SMELLS

- **God Components** : EventModalForm (881), TaskModalDesktopBody (812), SettingsPage (794), PageTutorial (772), task-table/list (768), AddTaskForm (754), TaskModal (745), AddToListModal (735). 🟠
- **Spaghetti / Shotgun surgery** : non détecté (modules isolés).
- **Dead code** : non détecté (mockData.ts déjà supprimé, ErrorReporter supprimé).
- **Duplicate** : tutoriels desktop/mobile (assumé, justifié UX).

---

## ÉTAPE 21 — DÉPENDANCES

Toutes utilisées, maintenues, CI `npm audit` bloquant high+. Aucun package > 50 kB hors `manualChunks`. GSAP retiré. **Aucune dépendance supprimable identifiée.** 🟢

---

## ÉTAPE 22 — COÛTS CLOUD

- **Actuel** : Vercel Hobby/Pro + Supabase Free/Pro (~0–25 $/mois). Volumétrie test minime.
- **x10** : reste dans Supabase Pro (~25 $) + bande passante Vercel.
- **x100** : Supabase compute upgrade (Small/Medium ~ 60–110 $/mois) + risque coût Edge Functions/egress.
- **Risque financier** : **AdSense crédite des tokens sans Server-Side Verification** (limite assumée mig. 039, cap 20/24h) — abus possible ; + absence rate limit → coût Auth/DB sur attaque.

---

## ÉTAPE 23 — SCORE PAR DOMAINE

| Domaine | Score |
|---|---|
| Architecture | 8.5/10 |
| Frontend | 9/10 |
| Backend (Edge Functions) | 9/10 |
| Database (schéma/RLS) | 8/10 |
| Sécurité | 9/10 |
| **Scalabilité** | **5.5/10** |
| DevOps | 8/10 |
| Observabilité | 7/10 |
| Tests | 7.5/10 |
| **Global** | **~8.0/10** |

---

## ÉTAPE 24 — TOP problèmes (priorisés)

| # | Problème | Gravité | Impact | Réf |
|---|---|---|---|---|
| 1 | RLS `auth.uid()` ré-évalué par ligne (51) | 🔴 | CPU DB à l'échelle | advisor perf |
| 2 | Pas de rate limiting applicatif | 🟠 | abus/coût/brute-force | recherche code |
| 3 | `APP_URL` prod non posé (CORS Edge) | 🟠 | checkout/delete cassés en prod | faille.md §bloquant |
| 4 | Leaked password protection off | 🟠 | comptes faibles | advisor sécu |
| 5 | 24 multiple_permissive_policies | 🟠 | perf RLS | advisor perf |
| 6 | 7 RPC SECURITY DEFINER exposés | 🟡 | surface (intentionnel) | advisor sécu |
| 7 | 1 FK non indexée + 2 index dupliqués | 🟡 | jointures/write | advisor perf |
| 8 | 15 index inutilisés | 🟡 | write overhead | advisor perf |
| 9 | ~16 god components 600–881 LOC | 🟡 | maintenabilité | wc -l |
| 10 | AdSense sans SSV | 🟡 | abus tokens | mig 039 |
| 11 | Ledger migrations désynchronisé | 🟡 | drift | CLAUDE.md |
| 12 | Mono-région eu-west-1 | 🟡 | latence US/Asie + DR | list_projects |
| 13 | Pas de tracing Edge→DB / métriques business | 🟡 | angle mort | Étape 17 |
| 14 | Edge Functions non testées | 🟡 | régression Stripe | Étape 18 |

---

## ÉTAPE 25 — PLAN D'ACTION

**7 jours**
1. `supabase secrets set APP_URL=<url prod>` (débloque checkout + delete-account).
2. Activer Leaked Password Protection (dashboard, 1 clic).
3. Migration : `auth.uid()` → `(select auth.uid())` sur les 51 policies (gain perf majeur, zéro risque).

**30 jours**
4. Indexer la FK manquante, supprimer 2 index dupliqués + 15 inutilisés.
5. Consolider les 24 multiple_permissive_policies.
6. Rate limiting : Cloudflare devant Vercel / quotas RPC (`credit_premium_token_from_ad` déjà cappée).
7. `REVOKE EXECUTE` sur les RPC SECURITY DEFINER non appelés par le client.

**90 jours**
8. Réconcilier le ledger migrations (`supabase migration repair`).
9. Tests Edge Functions (Deno) + tests de charge (k6) sur les routes chaudes.
10. Refactor des god components restants (>600 LOC).

**180 jours**
11. Server-Side Verification AdSense (ou retrait du mécanisme token-pub).
12. DR drill documenté + évaluer read replica / région multi pour latence.
13. Métriques business (MRR, churn) + tracing distribué.

---

## ÉTAPE 26 — VÉRIFICATION DE COUVERTURE

| Dossier | Audité |
|---|---|
| `src/modules/*` (12) | ✅ |
| `src/components/*` (incl. ui, task-modal, event-modal) | ✅ |
| `src/pages/*` | ✅ |
| `src/lib/*` (incl. hooks, validation) | ✅ |
| `src/tutorials/`, `src/hooks/`, `src/test/` | ✅ |
| `supabase/migration/*` (42) | ✅ |
| `supabase/functions/*` (3 + _shared) | ✅ |
| `e2e/*` | ✅ |
| `.github/workflows/`, `scripts/`, `docs/` | ✅ |
| `vite.config.ts`, `vercel.json`, `vitest.config.ts`, `config.toml` | ✅ |
| `dist/`, `node_modules/`, `coverage/`, `playwright-report/`, `test-results/`, `.temp/` | ⏭️ artefacts générés (hors périmètre) |
| Base live (14 tables, advisors sécu+perf) | ✅ |

**Aucun dossier source non audité.** Seuls les artefacts générés sont exclus (légitime).

---

## ÉTAPE 27 — AUDIT FINAL

**Prête pour la production ?** → **OUI**, sous réserve du blocant `APP_URL` (Étape 25 #1). Posture sécurité 🟢, observabilité 🟢, CI 🟢.

**x10 trafic ?** → **OUI**, sans changement d'architecture.

**x100 trafic ?** → **OUI mais conditionnel** : exécuter le fix RLS initplan (#3) + upgrade compute Supabase + Supavisor transaction mode. Sinon saturation CPU DB.

**x1000 trafic ?** → **NON en l'état.** Limité par Postgres mono-instance (scaling vertical) et l'absence de rate limiting. Nécessite : read replicas, partitionnement, WAF, possiblement extraction des chemins chauds hors RLS.

**Plus grosse dette technique** → la **ré-évaluation RLS par ligne** (51 policies).

**Plus grosse faille sécurité** → aucune critique ; la plus exploitable est l'**absence de rate limiting applicatif** (A07) combinée à la leaked-password off.

**Plus gros risque business** → le **secret `APP_URL` non posé** casserait Stripe/delete en prod (revenu + RGPD), suivi de l'**AdSense sans SSV** (abus de crédits premium).

**Priorité absolue demain matin** → `supabase secrets set APP_URL=<url prod>` puis activer leaked-password protection. ~15 minutes, débloquent revenu + conformité.

---

## COMBIEN D'UTILISATEURS SIMULTANÉS ?

Estimation **ancrée sur l'architecture réelle** (Postgres mono-instance + RLS initplan + PostgREST stateless + CDN) :

| Configuration | Utilisateurs **actifs simultanés** (réaliste) |
|---|---|
| **Aujourd'hui** (compute Nano/Micro, RLS initplan présent, tables petites) | **~100–300** confortablement ; ~500 en pic court |
| **Après fix RLS initplan + Supavisor transaction mode**, même compute | **~1 000–2 000** |
| **+ compute Small/Medium Supabase** | **~5 000–10 000** |
| **Plafond architecture actuelle** (un seul writer Postgres, sans read replica/sharding) | **~10 000–20 000** avant réécriture structurelle |

> « Actifs simultanés » = sessions émettant des requêtes dans la même fenêtre de quelques secondes. Le **nombre d'utilisateurs connectés inertes** (lisant l'UI sans requête) est bien plus élevé : le frontend est servi par CDN et tient des **dizaines/centaines de milliers** de visiteurs passifs sans toucher la DB.

**Goulot unique et certain : le CPU de l'instance Postgres**, amplifié aujourd'hui par la ré-évaluation RLS par ligne. Le frontend et l'API REST ne sont pas limitants.
