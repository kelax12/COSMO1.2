# CLAUDE.md — COSMO 1.2

Guide de travail dans ce dépôt. **Ce fichier est chargé à CHAQUE session : il reste court.**
Le contenu de niche vit un cran plus bas (table ci-dessous). Plafond tenu par `npm run check:docs`.

❌ **Ne jamais réécrire un récit d'incident ici.** Un incident s'écrit **une fois**, dans le doc de
son domaine ; le `CLAUDE.md` concerné n'en garde que l'interdit, en une ligne. Pourquoi :
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) § AM-1.

---

## 🪐 COSMO en 30 secondes

**Produit** : app de productivité (tâches, habitudes, agenda, OKR, statistiques), fr/en, en deux mondes :

- **Perso** : un utilisateur, ses données, partage entre amis gratuit. Premium perso coupé
  (`PREMIUM_ENFORCED = false`).
- **Entreprise** (`/entreprise/…`, `pages/organization/`) : une organisation, des équipes
  hiérarchiques, des permissions par membre, facturation par paliers active
  (`ENTERPRISE_BILLING_ENFORCED = true`). Modules `organizations`, `org-*`, `team-*` : leurs propres
  tables (`team_tasks`, `team_okrs`…), **jamais** les modules perso réutilisés.

**Deux backends, une interface.** Sans `VITE_SUPABASE_*` (ou via `loginDemo()`), tout tourne en
**démo** sur `localStorage`. Chaque module expose un `repository.ts` servi par
`supabase.repository.ts` ou `local.repository.ts` (`src/lib/repository.factory.ts`).
Une fonctionnalité qui ne marche que dans un des deux modes n'est pas finie.

**Le chemin d'une donnée** : page (`src/pages/`) → hook React Query (`modules/x/hooks.ts`) →
repository → Supabase, où **la RLS est la vraie frontière**, ou `localStorage`. Côté serveur :
`supabase/migration/` (SQL numéroté, appliqué à la main en prod), `supabase/functions/` (Edge),
`api/` (fonctions Vercel).

**Face à une zone inconnue** : [`docs/MODULES.md`](./docs/MODULES.md) (module → fichiers, tables,
RPC, écran) → `index.ts` du module → son `CLAUDE.md` s'il existe → le code, qui fait foi.

---

## 🗺️ Où est écrit le reste

**Avant de toucher à ce code, ce `CLAUDE.md` se charge tout seul.** Ne pas le recopier ici.

| Zone | Fichier |
|---|---|
| Providers, routing, type `User` | [`src/CLAUDE.md`](./src/CLAUDE.md) |
| Tout module (double mode, repositories, RPC indexables, Realtime) | [`src/modules/CLAUDE.md`](./src/modules/CLAUDE.md) |
| Premium, Stripe, facturation entreprise, remboursement | [`src/modules/billing/CLAUDE.md`](./src/modules/billing/CLAUDE.md) |
| Tâches, récurrence | [`src/modules/tasks/CLAUDE.md`](./src/modules/tasks/CLAUDE.md) |
| Habitudes, `completions`, fuseaux gelés | [`src/modules/habits/CLAUDE.md`](./src/modules/habits/CLAUDE.md) |
| OKR, journal `kr_completions` | [`src/modules/okrs/CLAUDE.md`](./src/modules/okrs/CLAUDE.md) |
| Catégories, arbre, impact de suppression | [`src/modules/categories/CLAUDE.md`](./src/modules/categories/CLAUDE.md) |
| Catégories d'ENTREPRISE (table unique, mig. `148`) | [`src/modules/team-categories/CLAUDE.md`](./src/modules/team-categories/CLAUDE.md) |
| Mode entreprise, permissions, boîte de réception | [`src/modules/organizations/CLAUDE.md`](./src/modules/organizations/CLAUDE.md) |
| Projets et tâches d'ENTREPRISE, corbeille, lecture par RPC | [`src/modules/team-projects/CLAUDE.md`](./src/modules/team-projects/CLAUDE.md) |
| Modales a11y, animations, design system mobile, onboarding | [`src/components/CLAUDE.md`](./src/components/CLAUDE.md) |
| Landing, deux parcours, GSAP, shader | [`src/pages/landing/CLAUDE.md`](./src/pages/landing/CLAUDE.md) |
| Toasts, échéances, fuseau horaire, `safeParse` | [`src/lib/CLAUDE.md`](./src/lib/CLAUDE.md) |
| i18n, slugs localisés, locales indexables | [`src/i18n/CLAUDE.md`](./src/i18n/CLAUDE.md) |
| Migrations SQL, RLS, ledger | [`supabase/migration/CLAUDE.md`](./supabase/migration/CLAUDE.md) |
| Edge Functions, drift déployé | [`supabase/functions/CLAUDE.md`](./supabase/functions/CLAUDE.md) |
| Fonctions Vercel (`api/`), collecteur d'audience, clé secrète | [`api/CLAUDE.md`](./api/CLAUDE.md) |
| Playwright | [`e2e/CLAUDE.md`](./e2e/CLAUDE.md) |
| Gardes CI, témoins, alerting | [`scripts/CLAUDE.md`](./scripts/CLAUDE.md) |

## 📚 Carte de la documentation

**Deux statuts, ne jamais les confondre :**

- **Vivant** — maintenu, décrit l'état courant. Ce fichier, `faille.md`, et `docs/*.md`.
- **Archive** — `docs/archive/**` : instantanés datés (audits, rapports, plans exécutés),
  **non maintenus**, chacun coiffé d'un bandeau ⚠️. À lire pour le *pourquoi* d'une décision
  passée, **jamais** comme état courant. Le code fait foi contre une archive.

**À lire AVANT de toucher la zone :**

| Doc vivant | Déclencheur |
|---|---|
| [`docs/README.md`](./docs/README.md) | Carte complète (une ligne par doc) + **tableau de bord des notes d'audit** |
| [`docs/MODULES.md`](./docs/MODULES.md) | **Carte** : module → fichiers, tables, RPC, écran |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Invariants du projet et leur état vérifié |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | RLS, migrations SQL, repositories Supabase, Edge Functions, Stripe, CSP, secrets |
| [`docs/MOBILE.md`](./docs/MOBILE.md) | Toute page/composant mobile, bottom-sheets, bug iOS Safari WebKit |
| [`docs/UI-PATTERNS.md`](./docs/UI-PATTERNS.md) | Listes/SmartListMenu, EventModal, tutoriels, onboarding, shadcn, thèmes |
| [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) | `manualChunks`, lazy loading, pagination, budget bundle |
| [`docs/TESTING.md`](./docs/TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Runbook deploy/rollback Vercel + Supabase |
| [`docs/LEGAL.md`](./docs/LEGAL.md) | Statut, TVA, conso, marque, sous-traitants. **Tout client est un consommateur** (2026-08-26) |
| [`faille.md`](./faille.md) | Sécurité : **source de vérité**, findings ouverts + ordre de priorité avant prod |

Autres docs vivantes, décrites dans `docs/README.md` : `SEO`, `ACQUISITION-BACKLINKS`, `I18N`,
`RGPD`, `RGPD-REGISTRE` (art. 30), `RGPD-VIOLATION` (procédure 72 h), `STRIPE-LIVE`,
`ACCESSIBILITY`, `SCALABILITY`, `POST-AUDIT-GUIDE` (`PREMIUM_ENFORCED`), `MIGRATION-REACT19`.

> **Sécurité : `faille.md` fait foi.** CLAUDE.md ne duplique pas les statuts de failles.
> Avant tout déploiement : `faille.md` → « Ordre de priorité avant déploiement prod ».

---

## ✅ Tu peux écrire dans le vrai compte COSMO d'Axel

Le CLI `scripts/cosmo/` donne accès à ses **données de production** : lecture tâches /
habitudes / agenda / OKR, **écriture complète sur les tâches**. Authentifié par sa session,
filtré par la RLS — jamais de `service_role`.

```bash
npm run cosmo -- tasks add --input '{"name":"Ma tache","description":"Contexte detaille.","category":"SEO","priority":4}'
```

Domaines : `tasks` (list / show / add / update / done / reopen / delete), `categories`,
`habits today|done`, `agenda --days N`, `okr` (lecture seule).
Détail des options : [`docs/AGENT-AJOUTER-TACHE.md`](./docs/AGENT-AJOUTER-TACHE.md) (mémo) ·
[`docs/COSMO-CLI.md`](./docs/COSMO-CLI.md) (complet).

**Règles non négociables :**

- 🔴 **Toujours quoter une valeur contenant des espaces**, ou passer par `--input '<json>'` —
  forme à préférer. Sans guillemets, la valeur est tronquée au premier mot.
- 🔴 **`tasks list` ne renvoie pas `description`** (liste allégée, parité avec l'app).
  Ce n'est pas un échec d'écriture : relire avec `tasks show <id>`.
- 🔴 **Ne jamais lancer `npm run cosmo:login`** — interactif, attend un code reçu par email.
  Session expirée → demander à Axel de le lancer.
- 🔴 **Ne jamais écrire via le MCP Supabase** (`execute_sql` contourne la RLS, et est bloqué).
  Le CLI est le seul chemin d'écriture.
- 🔴 **Confirmer avant toute suppression** qu'Axel n'a pas explicitement demandée.

---

## Stack technique

React 19 + TypeScript 5.5 strict · Vite 7 · React Router 8 (imports depuis `react-router`) ·
TanStack Query 5 · Supabase 2 · shadcn/ui (Radix + Tailwind 3) · Framer Motion · recharts ·
FullCalendar · date-fns 3 · zod · Vitest (`*.test.ts` à côté du code) + Playwright (`e2e/`) ·
Sentry · Vercel. Versions : `package.json`. Ce qu'il ne dit pas :

- `npm run build` = `vite build` + prérendu `prerender.mjs`.
- i18n : **catalogues JSON maison** (`src/i18n/` + `src/locales/{fr,en}/`), pas d'i18next.
- jsPDF (`vendor-pdf`) : `import()` au clic sur « Exporter en PDF » seulement.
- Stripe **live** depuis le 2026-10-20, facturation entreprise seule : checkout par redirection
  serveur (Edge Function), aucun SDK Stripe côté client.
- Imports **nominaux** : lucide-react, locale `fr` de date-fns.
- `@tanstack/react-virtual` : TaskList mobile au-delà de 50 items.
- Sentry : `beforeSend` retire emails et UUIDs.
- Audience maison : `src/lib/traffic.ts` → `api/collect.ts` → `traffic_hits` ; Vercel Analytics
  sous consentement. Aucun script tiers de mesure.

---

## Scripts

> ⚠️ **Commandes du QUOTIDIEN seulement.** Les gardes (`check:*`, `i18n:*`, `validate:*`) sont
> dans [`scripts/CLAUDE.md`](./scripts/CLAUDE.md) § Inventaire, une ligne chacune.

`dev` (port 5173) · `start` (port 3000, celui de Playwright) · `build` · `preview` ·
`lint` et `typecheck` (`tsc -b`), **0 erreur** chacun · `test` (Vitest, une passe) ·
`test:coverage` (seuils par fichier) · `test:rls` (stack locale) · `test:e2e` (→ `e2e/CLAUDE.md`).
Détail : `docs/TESTING.md`.

> Le build prod **drope** `console.*` et `debugger` (`vite.config.ts → esbuild.pure/drop`).
> Les erreurs remontent via Sentry (`VITE_SENTRY_DSN`).

🔴 **Trois règles de lecture, chacune payée d'une erreur réelle :**

1. ❌ **Ne JAMAIS conclure d'une ligne de résumé.** Lire `$?`, **puis** comparer le nombre de
   fichiers annoncé au périmètre du glob. Le 2026-09-15, une suite a rendu « 225 passed (225) »
   et **exit 1**, quatre fichiers n'ayant jamais démarré, dont un qui porte trois témoins.
2. 🔴 **Ne JAMAIS passer `--maxWorkers` en ligne de commande.** `vitest.config.ts` fixe
   `maxWorkers: 2` exprès (C-47) ; l'écraser sature la machine et compte comme échec un worker
   qui n'a exécuté aucun cas. Ce conseil a vécu dans ce fichier et a désarmé sa propre garde.
3. ❌ **Ne JAMAIS relever un seuil ou un plafond pour faire passer la CI**, ni ajouter une entrée
   d'allowlist pour la même raison. Un dépassement dit qu'un contenu doit bouger, pas que la borne
   est trop basse.

## Environnement et déploiement

- `.env` (non versionné, copier `.env.example`). Sans `VITE_SUPABASE_URL` ou
  `VITE_SUPABASE_ANON_KEY` → **mode démo automatique** (localStorage).
- Toute variable exposée au navigateur est préfixée `VITE_`. `VITE_SENTRY_DSN` est public
  (write-only) ; absent, le monitoring est coupé. `VITE_STRIPE_PUBLISHABLE_KEY` n'est lue nulle part.
- `.env.cosmo-cli` (gitignored) : config du CLI agent, distincte de `.env`.
- `SUPABASE_SECRET_KEY` : **serveur seulement**, lue par `api/collect.ts`, posée sur Vercel par
  l'intégration Supabase (production). ❌ Jamais préfixée `VITE_` → [`api/CLAUDE.md`](./api/CLAUDE.md).
- Vercel : `vercel.json` (SPA rewrite, HSTS, X-Frame-Options, CSP, cache immuable `/assets/*`),
  fonctions `api/` en runtime edge. Runbook : [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

---

## Conventions de code
### Imports — toujours l'alias `@/`

```typescript
import { supabase } from '@/lib/supabase';      // ✅
import { supabase } from '../../lib/supabase';   // ❌
```

⚠️ Seule exception : `api/` (NodeNext), où l'alias ne résout pas → [`api/CLAUDE.md`](./api/CLAUDE.md).


### GSAP, toasts

- `gsap` s'importe **uniquement** depuis `@/lib/gsap`, et **uniquement** dans la landing.
  Le reste de l'app est sur Framer Motion. → [`src/pages/landing/CLAUDE.md`](./src/pages/landing/CLAUDE.md)
- `toast` s'importe **uniquement** depuis `@/lib/toast` (façade différée), jamais depuis `sonner`,
  y compris dans une page lazy. Jamais depuis un repository ni depuis `normalizeApiError`.
  → [`src/lib/CLAUDE.md`](./src/lib/CLAUDE.md)
### TypeScript

- Strict (`noUnusedLocals`, `noUnusedParameters`) · **pas de `as any`**
- `interface` pour les objets, `type` pour les unions
- Variables/args/catch inutilisés intentionnellement → préfixer par `_`

### Validation zod

`src/lib/validation/validate.ts` (`validateOrThrow` / `safeValidate` + `ValidationError`) +
schémas par module. Câblé dans les `mutationFn` create/update.

- ⚠️ **Ce n'est PAS la frontière de sécurité** — celle-ci reste RLS + whitelist `mapToDb`.

### ESLint

- Config `eslint.config.js` (fait foi pour les ignorés). **0 erreur** avant chaque commit.
  `e2e/**`, `src/components/showcase/**` et `supabase/functions/**` **sont** lintés (`C-102`).
- Warnings tolérés : Fast refresh sur les contextes + fichiers ui shadcn (préexistants)

---

## 🚫 Garde-fous transversaux

> Les garde-fous propres à une zone vivent dans le `CLAUDE.md` de cette zone (table plus haut).
> Ceux-ci valent partout.
### Architecture & imports

- ❌ Importer depuis `src/context/TaskContext` — **fichier supprimé**
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
- ❌ Importer `useAuth` depuis `@/modules/user`
- ❌ Appeler `repository.getFriends()` depuis un hook — l'interface expose `getAll()` (B3)
- ❌ `gsap` et `toast` hors de leur façade : règles en § Conventions de code

### Logique métier

- ❌ Modifier `recordKRCompletion()` sans vérifier le graphique dashboard (démo ET prod)
- ❌ `kr.currentValue / kr.targetValue` sans guard `targetValue > 0` (B17)
- ❌ Insérer N lignes dans `kr_completions` depuis un `count` client non clampé — cap 100/write (B18)
- ❌ `JSON.parse(localStorage.getItem(...))` sans `try/catch` — utiliser `safeParse<T>` (B14)
- ❌ Réintroduire des gates `isPremium()` sur le partage de tâches / la collaboration

### Journal fiscal et consentement

- ❌ **Jamais de policy UPDATE/DELETE ni de purge sur `payment_records` / `payment_closures`**
  (journal inaltérable, mig. `125`, trigger). **Jamais anonymiser `user_id`** : `row_hash` le
  scelle. Une erreur se corrige par une ligne compensatoire.
- ❌ Lire `cosmo_cookie_consent` ailleurs que par `src/lib/cookie-consent.ts` / `useCookieConsent()`.
  Tout nouveau traceur est conditionné : `null` n'est pas une acceptation.
- ❌ Une garde conditionnelle à la présence de son propre secret (`if (SECRET && …)`).
- ⚠️ `renewal_notices` est une PREUVE (L215-1) : ne jamais la purger.

### Sécurité & env

- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client · committer sans vérifier que `.env` reste ignoré
- ❌ Écrire en base via le MCP Supabase (contourne la RLS)
- ❌ Appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy
  (`EXECUTE` révoqué, mig. `100`) : utiliser `is_above()` ou `i_have_subordinates()`.
- ❌ Garder une surface admin par `admin_allowlisted()` (affichage). La garde est `is_admin()`
  (allowlist ET session `aal2`, mig. `131`).
- ❌ Une fonction de trigger en `SECURITY DEFINER` : `INVOKER` + `REVOKE` pour `anon` (mig. `108`).
- 🔴 En CSP, `https:` ne couvre PAS `wss:`. Garde : `src/csp.guard.test.ts`.
- 🔴 Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin avant.
- ⚠️ Le dépôt est **PUBLIC**. Retirer un fichier du suivi n'efface pas l'historique.

### Documentation

- ❌ Traiter `docs/archive/**` comme l'état courant · citer un numéro de ligne d'un autre `.md`
- ❌ Recopier un « avant » : il se reconstruit à un commit nommé, jamais depuis un tableau ancien.
- ❌ Chercher le symptôme cité par la doc plutôt que la chose décrite.

> Le **pourquoi** de chacune de ces lignes (incident, date, mesure) est dans
> [`docs/SECURITY.md`](./docs/SECURITY.md) § « Garde-fous transversaux, récits repris de `CLAUDE.md` ».

> **Sécurité (RLS, mass-assignment, Stripe, secrets) → [`docs/SECURITY.md`](./docs/SECURITY.md).
> Toujours la consulter avant de toucher `supabase/`, le billing, ou un repository.**
