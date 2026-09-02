# CLAUDE.md — COSMO 1.2

Guide de travail dans ce dépôt. **Vérifié dans le code et contre la prod le 2026-08-24.**

**Plan** : [Docs](#-carte-de-la-documentation) · [CLI données réelles](#-tu-peux-écrire-dans-le-vrai-compte-cosmo-daxel) · [Stack](#stack-technique) · [Scripts](#scripts) · [Env](#variables-denvironnement) · [Double mode](#architecture--double-mode-démo--production) · [Modules](#structure-des-modules) · [Hooks](#hooks-essentiels) · [Providers / Routing](#hiérarchie-des-providers-srcapptsx) · [Supabase](#base-de-données-supabase) · [Conventions](#conventions-de-code) · [i18n](#i18n--catalogues-maison-fr--en) · [🚫 Garde-fous](#-garde-fous--à-ne-jamais-faire)

---

## 📚 Carte de la documentation

**Deux statuts, ne jamais les confondre :**

- **Vivant** — maintenu, décrit l'état courant. Ce fichier, `faille.md`, et `docs/*.md`.
- **Archive** — `docs/archive/**` : instantanés datés (audits, rapports, plans exécutés),
  **non maintenus**, chacun coiffé d'un bandeau ⚠️. À lire pour le *pourquoi* d'une décision
  passée, **jamais** comme état courant. Le code fait foi contre une archive.

| Doc vivant | Quand la lire |
|---|---|
| [`docs/README.md`](./docs/README.md) | Carte complète + **tableau de bord des notes d'audit** (avant/après daté) |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Invariants du projet et leur état vérifié (audit 2026-08-14) |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | RLS, migrations SQL, repositories Supabase, Edge Functions, Stripe, CSP, secrets |
| [`docs/MOBILE.md`](./docs/MOBILE.md) | Toute page/composant mobile, bottom-sheets, bug iOS Safari WebKit |
| [`docs/UI-PATTERNS.md`](./docs/UI-PATTERNS.md) | Listes/SmartListMenu, EventModal, tutoriels, onboarding, shadcn, thèmes |
| [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) | `manualChunks`, lazy loading, pagination, budget bundle |
| [`docs/SEO.md`](./docs/SEO.md) | Prérendu, sitemap, `robots.txt`, hreflang, ouvrir une langue à l'indexation, `lastmod`, maillage du blog |
| [`docs/ACQUISITION-BACKLINKS.md`](./docs/ACQUISITION-BACKLINKS.md) | Backlinks : le seul levier qui débloque le SEO aujourd'hui (actions manuelles d'Axel) |
| [`docs/I18N.md`](./docs/I18N.md) | Qualité des traductions, périmètre réellement bilingue |
| [`docs/RGPD.md`](./docs/RGPD.md) | Données personnelles, effacement, rétention, conformité B2B |
| [`docs/LEGAL.md`](./docs/LEGAL.md) | **Obligations légales** : statut juridique, TVA, droit de la consommation, marque, sous-traitants. Tout client est un consommateur (décision 2026-08-26) |
| [`docs/RGPD-REGISTRE.md`](./docs/RGPD-REGISTRE.md) | **Registre art. 30** : dix traitements, base légale, destinataires, durées. Pièce à produire en contrôle CNIL ou en due diligence |
| [`docs/RGPD-VIOLATION.md`](./docs/RGPD-VIOLATION.md) | **Procédure 72 h** : qualification, marche à suivre, arbre de notification, registre des violations |
| [`docs/STRIPE-LIVE.md`](./docs/STRIPE-LIVE.md) | Compte Stripe **live** : les 8 prix, `tax_behavior: inclusive` définitif, ce qui reste avant d'encaisser |
| [`docs/ACCESSIBILITY.md`](./docs/ACCESSIBILITY.md) | a11y WCAG/EAA, aria, contraste |
| [`docs/TESTING.md`](./docs/TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Runbook deploy/rollback Vercel + Supabase |
| [`docs/SCALABILITY.md`](./docs/SCALABILITY.md) | Montée en charge, limites Supabase/localStorage |
| [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md) | Réactivation premium (`PREMIUM_ENFORCED`), finalisation Stripe |
| [`docs/AGENT-AJOUTER-TACHE.md`](./docs/AGENT-AJOUTER-TACHE.md) | **Mémo court** : ajouter une tâche dans le vrai compte COSMO |
| [`docs/COSMO-CLI.md`](./docs/COSMO-CLI.md) | CLI d'accès aux données COSMO réelles (`scripts/cosmo/`) |
| [`faille.md`](./faille.md) | Sécurité : **source de vérité**, findings ouverts + ordre de priorité avant prod |

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

| Couche | Technologie |
|---|---|
| Framework | React 18 + TypeScript 5.5 (strict) |
| Build | Vite 7 (+ prérendu `prerender.mjs` dans `npm run build`) |
| Routing | React Router 7 (imports depuis `react-router`) |
| State serveur | TanStack React Query 5 |
| Backend / Auth | Supabase 2 |
| UI | shadcn/ui (Radix UI + Tailwind CSS 3) |
| Toasts | Sonner |
| Animations | Framer Motion (app) + GSAP 3 (**landing uniquement**, cf. [règle GSAP](#gsap--landing-page-uniquement)) |
| Graphiques | recharts |
| i18n | **Catalogues JSON maison** (`src/i18n/` + `src/locales/{fr,en}/`) — pas d'i18next |
| Paiement | Stripe (`@stripe/react-stripe-js`) — **non finalisé** |
| Icônes | lucide-react (imports nominaux uniquement) |
| Dates | date-fns 3 (locale `fr` importée nominalement) |
| Calendrier | FullCalendar |
| Virtualisation | `@tanstack/react-virtual` (TaskList mobile > 50 items) |
| Validation | `zod` (garde UX client — `src/lib/validation/`) |
| Tests | Vitest (`*.test.ts` à côté du code) + Playwright (`e2e/`) |
| Monitoring | Sentry (`beforeSend` strip emails/UUIDs) |
| Hosting | Vercel (`vercel.json` + headers de sécurité + CSP) |

---

## Scripts

```bash
npm run dev        # Serveur dev local (port 5173)
npm start          # Serveur dev réseau (port 3000) — port utilisé par Playwright
npm run build      # Build prod → dist/ (vite build + node prerender.mjs)
npm run preview    # Prévisualiser le build
npm run lint       # ESLint (doit retourner 0 erreur)
npm run typecheck  # tsc -b (doit retourner 0 erreur)
npm test           # Vitest (run once), 1802 tests / 159 fichiers, ~3,5 min (2026-08-27 soir)
npm run test:watch # Vitest en mode watch
npm run test:coverage       # + couverture v8, seuils globaux et par fichier
                            # ✅ VERTE au 2026-08-27 (soir) : 28,48 L · 28,15 S · 22,78 F · 23,59 B
                            # ❌ NE JAMAIS baisser un seuil pour repasser au vert.
                            # Marge la plus serree : functions, ~1,4 pt. Elle etait tombee a
                            # 0,32 pt le 2026-08-25 : la relancer APRES chaque vague de
                            # features, pas seulement quand on y pense.
                            # Voir docs/TESTING.md
npm run validate:migrations # Garde statique sur supabase/migration/*.sql (CI)
npm run check:rls           # Invariants RLS : auth.uid() wrappé, 1 seule policy PERMISSIVE,
                            # + toute fonction citée par une policy exécutable par authenticated (CI)
npm run check:drift         # Dérive repo ↔ prod (2 étapes : --print-sql puis <introspection.json>)
npm run i18n:check          # Parité des clés fr ↔ en (CI, bloquant)
npm run check:legal         # Cohérence du tableau de conformité de docs/LEGAL.md :
                            # lignes collées, identifiants en double, et surtout que la
                            # synthèse corresponde aux lignes. Ce total a été faux TROIS
                            # fois le 2026-08-26, toujours pour l'avoir additionné de tête.
npm run check:mail          # Délivrabilité des emails Auth : MX, SPF, DKIM Resend, DMARC.
                            # 🔴 ROUGE au 2026-08-27 : aucun SMTP applicatif n'est configuré,
                            # et les confirmations d'inscription sont désactivées (mesuré en
                            # base : `confirmation_sent_at` sur 1 compte / 28). Mise en service
                            # et ordre des opérations : docs/DEPLOYMENT.md §2ter.
                            # PAS une gate CI — dépend d'un état DNS externe.
npm run i18n:scan           # Chaînes en dur non externalisées
npm run i18n:namespaces     # Quels catalogues le SHELL rend (donc eager) ; --pages
                            # donne la liste à déclarer par route dans App.tsx
npm run profile:landing     # Profil du fil principal d'une page (CPU bride, via Playwright).
                            # ⚠️ Mesure du 2026-08-30 : sur un poste de dev, la landing (55 en CI)
                            # et le guide (96 en CI) rendent le MEME score, la charge machine
                            # dominant tout. Un ecart entre deux PAGES ne se lit donc que sur le
                            # runner ; l'outil sert a comparer un AVANT/APRES sur la meme page.
npm run check:bundle        # Budget de bundle sur le build reel (CI, apres npm run build)
                            # Entree < 92 ko gzip. ❌ Ne jamais remonter un plafond.
npm run test:rls   # Tests d'intégration RLS (stack Supabase locale)
npm run test:e2e   # Playwright, 62 tests × 2 projects = 124, 15 specs (+ :ui, :report)
npm run cosmo      # CLI données réelles (cf. plus haut)
```

> Le build prod **drope** `console.*` et `debugger` (`vite.config.ts → esbuild.pure/drop`).
> Les erreurs remontent via Sentry (`VITE_SENTRY_DSN`).

---

## Variables d'environnement

```bash
# .env (non versionné — copier .env.example)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_SENTRY_DSN=  # public, write-only — si absent, monitoring désactivé
```

- `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` absentes → **mode démo automatique** (localStorage).
- Toute variable exposée au navigateur doit être préfixée `VITE_`.
- **Ne jamais** utiliser `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client.
- **`.env` est gitignored** — vérifier `git status` avant chaque commit.
- `.env.cosmo-cli` (gitignored) : config du CLI agent, distincte de `.env`.

---

## Architecture : double mode (démo / production)

- **Mode démo** : pas de Supabase, données en `localStorage`. Automatique si les env vars
  sont absentes, ou via `loginDemo()`.
- **Mode production** : Supabase, si les deux env vars sont définies.

```typescript
// src/lib/app-mode.store.ts
appModeStore.isDemo          // getter
appModeStore.setDemo(bool)   // setter
useIsDemo()                  // hook React
```

Repositories sélectionnés dynamiquement via `src/lib/repository.factory.ts`
(`getTasksRepository()`, `getHabitsRepository()`, … `resetRepositories()`, `clearDemoStorage()`).

### loginDemo() — séquence exacte (`src/modules/auth/AuthContext.tsx`)

```typescript
loginDemo() {
  clearDemoStorage()            // 1. Efface l'ancien localStorage démo
  appModeStore.setDemo(true)    // 2. Active le flag global
  resetRepositories()           // 3. Nullifie les singletons
  queryClient.clear()           // 4. Vide le cache React Query
  setUser({ id: 'demo-user', email: 'demo@cosmo.app', ... })
  setIsLoading(false)
  // 6. navigate('/dashboard') dans le composant appelant, en setTimeout(…, 0)
}
```

> `setTimeout(() => navigate('/dashboard'), 0)` est **obligatoire** : il laisse React commiter
> `setUser()` avant que `ProtectedRoute` vérifie `isAuthenticated`.

### Données seed démo

Rechargées à chaque `loginDemo()` grâce à `clearDemoStorage()`.

| Module | Fichier seed | Volume |
|---|---|---|
| Tasks | `src/modules/tasks/local.repository.ts` | ~100 tâches / 12 mois |
| Habits | `src/modules/habits/local.repository.ts` | ~100 habitudes / 30–120 j |
| Events | `src/modules/events/repository.ts` | ~150 événements |
| OKRs | `src/modules/okrs/repository.ts` | 8 OKRs |
| Entreprise | `src/modules/{organizations,org-teams,team-projects}/local.repository.ts` | organisation, équipes, projets |

Helpers : dates relatives (`getDate`, `getDateString`), historique déterministe
(`generateCompletions` — **pas de `Math.random()`**), raccourcis `t(...)` / `h(...)`.

---

## Structure des modules

```
src/modules/{module}/
├── types.ts               # Interfaces TypeScript
├── constants.ts           # Clés React Query (factory) + clés localStorage
├── repository.ts          # Interface I{Module}Repository
├── local.repository.ts    # Implémentation LocalStorage (quand dédiée)
├── supabase.repository.ts # Implémentation Supabase
├── hooks.ts               # Hooks React Query (lecture + écriture)
├── hooks.derived.ts       # Hooks calculés (useMemo) — quand pertinent
└── index.ts               # Export public (barrel)
```

| Module | Usage |
|---|---|
| `auth` | Authentification, session, AuthContext |
| `billing` | Abonnement premium (⚠️ Stripe non finalisé) |
| `tasks` / `categories` / `lists` | Tâches et leur classement |
| `events` | Événements calendrier |
| `habits` | Habitudes |
| `okrs` / `kr-completions` | OKR + journal append-only des complétions de KR |
| `today` | Vue « aujourd'hui » (agrégat tâches/habitudes/événements) |
| `friends` | Collaboration sociale (partage entre comptes perso) |
| `stats` | Agrégats « temps investi » (RPC `get_work_time_stats` en prod, calcul local en démo) |
| `ui-states` | État UI persistant (couleurs, priorités, modules actifs) |
| `user` | Profil utilisateur, messages inbox |
| `admin` | Console `/admin` (RPC `get_admin_stats`) |
| `organizations` / `org-teams` | **Mode entreprise** : organisation, pyramide managériale, équipes |
| `team-projects` / `team-okrs` / `org-okr-categories` | **Mode entreprise** : projets, OKR d'équipe |

### Règle d'import par zone

| Zone | Modules |
|---|---|
| Tâches | `tasks`, `categories`, `lists` |
| Agenda | `events`, `tasks` |
| Habitudes | `habits`, `categories` |
| OKR | `okrs`, `kr-completions` |
| Amis / Collaboration | `friends` |
| Entreprise | `organizations`, `org-teams`, `team-projects`, `team-okrs` |
| UI / Filtres | `ui-states` |
| Dashboard | `tasks`, `habits`, `events`, `kr-completions`, `okrs`, `auth` |

---

## Hooks essentiels

### Auth — source de vérité unique

```typescript
import { useAuth } from '@/modules/auth/AuthContext';
const { user, isAuthenticated, isDemo, isLoading, login, logout, register, loginWithGoogle,
        updateDemoProfile } = useAuth();
```

> **Ne jamais importer `useAuth` depuis `@/modules/user`** — source unique = `@/modules/auth/AuthContext`.
>
> `updateDemoProfile(patch)` est le **seul** chemin pour modifier le profil en mode démo
> (`name` / `email` / `avatar` / `autoValidation`, whitelistés). Hors démo, c'est un no-op :
> un vrai profil passe par `supabase.auth.updateUser`. Écrire dans `localStorage` en espérant
> que l'écran suive est exactement le bug corrigé le 2026-08-24 (faille B7, 2ᵉ occurrence).

### Billing — vérification premium

```typescript
import { useBilling } from '@/modules/billing/billing.context';
const { isPremium, addTokens, subscription, stats, isLoading } = useBilling();
// isPremium est une FONCTION : isPremium() retourne boolean
```

#### Modèle Premium

> 🟢 **Premium NON APPLIQUÉ** — kill-switch `PREMIUM_ENFORCED = false` dans
> `src/modules/billing/premium-config.ts` (vérifié 2026-08-14). Tant qu'il vaut `false` :
> `isPremium()` renvoie `true` pour tous, le mur-pub Habitudes est masqué, et la route
> `/premium` **redirige vers `/`**. Aucun code premium n'est supprimé (dormant).
> Réactivation : passer le flag à `true`, puis finaliser Stripe (`docs/POST-AUDIT-GUIDE.md`).

Comportement **quand `PREMIUM_ENFORCED = true`** :

- **Partage de tâches → 100 % gratuit** (acquisition virale). Aucun gate `isPremium()` sur la
  collaboration. **Ne PAS réintroduire** ces gates.
- **Statistiques → premium** (`StatisticsPage`).
- **Habitudes → mur-pub quotidien** : `HabitsPage` monte `<HabitsAdGate>` une fois par jour pour
  les non-abonnés. Piloté par un flag localStorage daté
  (`useDailyAdGate('habits')` → `src/lib/hooks/use-daily-ad-gate.ts`, clé `cosmo_adwall_habits`),
  **pas** par `isPremium()` (dette : `consume_premium_token` non câblé client).
- **Abonnés payants** et **mode démo** ne voient jamais le mur.
- Le client ne peut plus écrire `subscriptions` (mig. 015) : `addTokens(1)` passe par la RPC
  `credit_premium_token_from_ad` (cap 20 crédits/24 h).

#### Facturation entreprise — plomberie Stripe COMPLÈTE, facturation DÉSACTIVÉE (2026-08-24)

`org_subscriptions` (mig. 101) porte l'abonnement d'une **organisation** : un palier
(`ENTERPRISE_PRICING_TIERS`), un quota de sièges (`max_members`), un statut. Ne jamais la
confondre avec `subscriptions`, qui porte l'abonnement **particulier** (jetons, `win_streak`) —
les deux ne partagent aucune colonne.

- La table n'a **aucune policy d'écriture**. Seul le webhook Stripe (`service_role`) écrit ;
  la lecture est réservée aux membres. Pas de trigger-guard : rien n'est écrivable, il n'y a
  rien à garder.
- Souscription et gestion : **propriétaire de l'org uniquement**, vérifié dans
  `stripe-org-checkout` / `stripe-org-portal`. Le front ne fait que masquer un onglet.
- Coupons : **promotion codes Stripe natifs** (`allow_promotion_codes`). COSMO ne valide aucun
  code et ne recalcule aucun montant — donc aucune surface de brute-force côté COSMO.
- **Périodicité mensuelle ou annuelle** (2026-08-25), sélecteur dans `/entreprise?tab=billing`.
  L'annuel vaut le mensuel **moins 30 %** (`ENTERPRISE_YEARLY_DISCOUNT`) : 14/35/70/140 € par mois
  en équivalent, débités 168/420/840/1 680 € une fois par an. Huit price IDs Stripe au total
  (`STRIPE_ORG_PRICE_*` et `STRIPE_ORG_PRICE_*_YEARLY`). La colonne descriptive
  `org_subscriptions.billing_interval` (mig. **123**) dit laquelle est facturée.
- Le quota réel est `org_seats_allowed()` (mig. 101), déjà appelé par `claim_org_invite` et
  `respond_join_request`. Un abonnement `past_due` ou `cancelled` retombe au palier gratuit
  **sans jamais retirer de membre** : on bloque la croissance, on ne retire rien.
- UI : vue `/entreprise?tab=billing` (`OrgBillingTab`), grille `EnterpriseTierGrid`. **Ce n'est
  pas un onglet** — la barre d'onglets est lue par toute l'organisation alors qu'un seul compte
  peut payer. L'entrée est la pastille de forfait de l'en-tête (`OrgPlanChip`), montée pour le
  seul propriétaire ; `?tab=billing` reste une valeur d'URL valide (les Edge Functions Stripe y
  renvoient) et un non-propriétaire qui l'ouvre retombe sur l'aperçu.
  Le CTA de paiement n'est monté que si `ENTERPRISE_BILLING_ENFORCED === true` — le flag est la
  **seule** condition, jamais « actif si les variables d'environnement existent ».

Garde-fous propres à cette zone :

- 🟢 **Le price ID ANNUEL se dérive, il ne se configure pas** (`_shared/org-stripe-prices.ts`) :
  c'est le prix récurrent `year`, actif, de la devise du mensuel et **du montant exact annoncé**,
  porté par le MÊME produit Stripe que le prix mensuel. Zéro candidate ou plusieurs → on n'ouvre
  aucune session de paiement (`yearly_unavailable`). Conséquence directe : les 4
  `STRIPE_ORG_PRICE_*_YEARLY` ne sont **pas** nécessaires, et le jour du passage en compte live il
  n'y a que les 4 mensuels à re-poser. Le secret annuel reste lu en premier, comme porte de sortie
  pour épingler un prix qui vivrait ailleurs.
- ❌ **Ne jamais faire deviner un prix à la résolution annuelle.** Le montant est vérifié contre
  `yearlyTotalEur` AVANT toute session, dans les deux sens (checkout et webhook). C'est le seul
  endroit où COSMO choisit un prix au lieu de se le faire désigner, donc le seul endroit où il
  peut se tromper de montant.
- ❌ **Ne jamais écrire une grille de tarifs annuels à la main.** Le montant annuel est DÉRIVÉ du
  mensuel, front et Deno, par la même formule. Deux grilles, c'est une seconde occasion d'annoncer
  un prix et d'en facturer un autre, le risque qui a déjà imposé `org-tiers.parity.test.ts`.
- ❌ **Ne jamais faire dépendre le quota de sièges de la périodicité.** `max_members` est porté par
  le palier SEUL : un client annuel achète le même palier moins cher, pas plus de sièges. Un
  « palier annuel » distinct côté Stripe casserait `tierFromPriceId`, donc le portail.
- ❌ **Ne jamais dériver le palier des metadata Stripe.** Un changement de palier OU DE PÉRIODICITÉ
  fait depuis le Billing Portal ne repasse pas par notre checkout : les deux se redérivent du
  **price ID** (`tierFromPriceId`, `supabase/functions/_shared/org-tiers.ts`, qui rend le palier ET
  la périodicité). Sans ça, un client paie 100 € et reste bloqué au quota de 20 sièges.
- ❌ **Ne jamais laisser un event d'organisation retomber sur la branche particulier.** Le
  customer Stripe d'une org porte `org_owner_uid` (jamais `supabase_uid`) et
  `getUidFromCustomer` refuse tout customer portant `org_id` — sinon la facture d'une entreprise
  écrit dans l'abonnement personnel de son propriétaire, et le marqueur d'idempotence empêche
  Stripe de réessayer.
- ❌ **Ne jamais écrire un montant en dur** côté Deno : `_shared/org-tiers.ts` est verrouillé sur
  `ENTERPRISE_PRICING_TIERS` par `src/modules/billing/org-tiers.parity.test.ts`.
- Les **noms** des paliers (Gratuit · Équipe · Département · Entreprise · Illimité) vivent dans le
  namespace `common` (`orgTier.*`), pas dans `org` ni `landing` : la landing et le produit doivent
  dire le même mot pour le même palier, comme ils annoncent déjà le même montant. Le mapping
  palier → clé est `src/modules/billing/org-tier-labels.ts` (`Record<OrgTierKey, …>`, donc un
  palier ajouté sans nom ne compile pas).
- 🔴 **DÉSARMÉ le 2026-08-26** (mig. `124` appliquée en prod). `ENTERPRISE_BILLING_ENFORCED = false`
  **et** `billing_flags.enterprise_seat_limit = false`, rebasculés ensemble. **Pourquoi** : les
  deux étaient à `true` avec une clé Stripe de TEST, et une organisation sur quatre était déjà au
  plafond. Son parcours : invitation refusée, écran qui propose de payer, clic, checkout en mode
  test, vraie carte refusée. Ni grandir, ni payer, ni résilier. Impasse produit, pas risque
  juridique — aucun euro n'étant encaissé, ni travail dissimulé ni TVA due.
  Réarmement : les deux drapeaux, **après** immatriculation et passage de Stripe en compte live.
  Contexte du 2026-08-25 conservé ci-dessous pour mémoire, il décrivait l'état activé où
  `org_seats_allowed()` renvoyait `false` pour la seule
  organisation qui dépasse le palier gratuit. Aucun membre n'est retiré, c'est la croissance qui
  est bloquée.
- 🔴 **Deux réserves restent ouvertes à cette date :**
  1. `STRIPE_SECRET_KEY` est une clé de TEST, donc le checkout n'accepte que des cartes de test.
     **Le quota est réel, l'encaissement ne l'est pas.**
  2. Les 4 prix ANNUELS n'existent pas encore côté Stripe. Il n'y a **aucun secret à poser** (cf.
     règle de dérivation ci-dessous) : il suffit d'ajouter, sur chacun des 4 produits qui portent
     déjà un prix mensuel, un prix récurrent `year` de 168 / 420 / 840 / 1 680 €. Le checkout
     annuel répond `yearly_unavailable` d'ici là, la grille rebascule seule sur le mensuel, et
     l'annuel se met à marcher tout seul dès que les prix existent.
- **La plomberie reste entière et déployée** : `stripe-org-checkout` / `stripe-org-portal`, les
  `org_subscriptions` (mig. 101 + 123), `org_seats_allowed()`, et `stripe-webhook`. Les deux
  fonctions qui portent la périodicité, `stripe-org-checkout` (v2) et `stripe-webhook` (v17), ont
  été **redéployées en prod le 2026-08-25** et fument-testées (webhook : 400 « Invalid
  signature » ; checkout : 401 JSON de la fonction elle-même, donc les modules `_shared` se
  chargent). Réactiver = rebasculer les deux drapeaux, rien à reconstruire.
- ⚠️ **Corrigé le 2026-08-26 : les 4 prix ANNUELS existent bel et bien** dans le compte de test
  (168 / 420 / 840 / 1 680 €), contrairement à ce que ce fichier affirmait depuis le 2026-08-25.
  Vérifié par API, pas déduit. La dérivation `resolveYearlyPriceId` n'a donc pas besoin des
  secrets `STRIPE_ORG_PRICE_*_YEARLY`.
- 🔴 **Le compte Stripe LIVE est désormais équipé** (2026-08-26) : 4 produits et 8 prix créés,
  tous en `tax_behavior: inclusive`, réglage **DÉFINITIF** chez Stripe. Les 8 prix du compte de
  TEST restent sur `unspecified`, valeur à ne jamais reproduire. Détail et identifiants :
  [`docs/STRIPE-LIVE.md`](./docs/STRIPE-LIVE.md).
  ❌ **Ne jamais créer un prix Stripe sans `tax_behavior` explicite** : il ne se modifie plus, il
  faut créer un nouveau prix et migrer les abonnements.
- 🔴 **Les deux drapeaux se déplacent ensemble.** Le flag TS ne masque que les CTA ; le blocage
  réel est `billing_flags.enterprise_seat_limit`. Serveur `true` + client `false` = un
  propriétaire se voit refuser une invitation (`seat_limit_reached`) sans qu'aucun écran ne lui
  propose de payer : impasse. Client `true` + serveur `false` = on encaisse sans rien débloquer.
- 🔴 **La grille branchée est celle du SANDBOX DE TEST.** `STRIPE_SECRET_KEY` en prod est une
  clé de test — les customers des vrais utilisateurs vivent dans le compte « Environnement de
  test COSMO », le compte live est vide. Un checkout n'accepte donc que des **cartes de test**
  : le quota de sièges est réel, l'encaissement ne l'est pas. Passage en live = recréer les 8
  prix sur le compte live (4 mensuels + 4 annuels), réenregistrer un endpoint webhook live (mêmes 5 events), puis
  remplacer `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et les 8 `STRIPE_ORG_PRICE_*`.
- ⚠️ `APP_URL` vaut `https://thecosmo.app` et **est la seule origine CORS autorisée** par les
  deux Edge Functions org : le checkout entreprise **ne peut pas être testé depuis
  `localhost:5173`**. Tester depuis la prod, ou changer `APP_URL` le temps du test.
- Réactivation (immédiate, réversible) : `ENTERPRISE_BILLING_ENFORCED = true` +
  `UPDATE billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit'` — **après** la
  création de la micro-entreprise et le passage du compte Stripe en live.
  Contexte historique : [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md).

### Données métier

```typescript
import { useFavoriteColors, usePriorityRange, useColorSettings } from '@/modules/ui-states';
import { useFriends, useSendFriendRequest, useShareTask, useFriendRequests } from '@/modules/friends';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs, useUpdateKeyResult } from '@/modules/okrs';
import { useKRCompletions } from '@/modules/kr-completions';
import { useCategories } from '@/modules/categories';
import { useLists } from '@/modules/lists';
```

---

## Hiérarchie des providers (`src/App.tsx`)

```
QueryClientProvider
  AuthProvider
    ActiveOrgProvider        ← organisation courante (mode entreprise)
      BillingProvider        ← dépend de useAuth
        TooltipProvider
          MotionConfig reducedMotion="user"   ← WCAG 2.3.3 pour tout Framer Motion
            Toaster (Sonner, theme="system") + Routes
```

React Query : 5 min stale, 30 min gc, retry 1, pas de `refetchOnWindowFocus`.

`useSharedTasksRealtime` est monté **une seule fois** ici (composant `SharedTasksRealtime`).

### Type User — source de vérité

Défini **uniquement** dans `src/modules/auth/AuthContext.tsx` (`src/modules/user/types.ts` le
ré-exporte sans le redéfinir) :

```typescript
export type User = {
  id: string; name: string; email: string;
  avatar?: string; premiumTokens?: number; premiumWinStreak?: number;
  lastTokenConsumption?: string; subscriptionEndDate?: string; autoValidation?: boolean;
};
```

### Routing (`src/App.tsx`)

| Route | Page | Accès |
|---|---|---|
| `/` | LandingPage — **parcours perso**, redirige `/dashboard` si connecté | public |
| `/entreprise-presentation` (slug localisé) | **même composant `LandingPage`**, parcours entreprise | public |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` | Auth | public |
| `/guide` · `/blog` · `/blog/:slug` | Contenu SEO | public |
| slugs localisés (à-propos, freelances, étudiants, managers, équipes, mentions légales, confidentialité, CGU) | via `routeSlug(key, locale)` — cf. `src/i18n/routes.ts` | public |
| `/invite/:token` · `/org-invite/:token` | Claim d'invitation (partage / entreprise) | public |
| `/dashboard` · `/tasks` · `/settings` | Socle | protégé |
| `/agenda` · `/habits` · `/okr` · `/statistics` | **Toujours visibles pour tout le monde** depuis le 2026-08-23, plus aucun réglage ne les masque | protégé |
| `/entreprise` · `/entreprise/onboarding` | Mode entreprise (onboarding hors Layout) | protégé |
| `/admin` | Console admin — URL non référencée, gating **serveur** (`get_admin_stats` rejette les non-admins) | protégé |
| `/premium` | Redirige `/` tant que `PREMIUM_ENFORCED = false` | protégé |
| `/welcome` | Redirection permanente vers `/` (ancienne URL) | public |
| `*` | **NotFoundPage** (pas de redirect) | — |

Toutes les pages sont lazy-loadées (`React.lazy`) et enveloppées dans `AppErrorBoundary`.

### Landing — deux parcours exclusifs (2026-08-15)

La landing n'est plus une page linéaire. Après le header, un **aiguillage**
(`landing/LandingGateway`) fait choisir entre deux parcours **mutuellement exclusifs** :

| Parcours | Composant | Servi par | DA |
|---|---|---|---|
| perso | `landing/PersoTrack` | `/` | slate-900, bleu → violet → fuchsia |
| entreprise | `landing/entreprise/EnterpriseTrack` (lazy) | `/entreprise-presentation` | `#08090C`, cyan `#22D3EE`, or `#F5B942` |

- Le parcours affiché est **dérivé de l'URL**, pas d'un état local (`useLandingTrack`) : le
  bouton retour marche sans code de synchronisation. Les deux routes rendent le **même
  composant à la même profondeur**, donc basculer ne remonte pas la page.
- `TrackSwitcher` (header) et `TrackAnchors` (sommaire collant, par parcours) garantissent
  qu'on ne peut jamais rester coincé dans un parcours. Les listes d'ancres vivent dans
  `landing/anchors.ts` — une par track, pour qu'aucun lien ne vise une section absente.
- ❌ **Ne jamais ajouter une section entreprise dans `PersoTrack`** (ni l'inverse) : la
  séparation des deux parcours EST la structure de la page.
- 🔴 **L'entrée du hero perso est en CSS, et elle doit le rester** (refonte du 2026-08-30).
  Mesuré à 4× de bridage CPU : la landing affichait **deux secondes d'écran blanc avec un
  spinner**, puis le hero apparaissait déjà fini. Le fallback de page était clair sur une page
  sombre, et toute la chorégraphie GSAP jouait derrière lui. Trois règles en sont sorties :
  **(1)** l'entrée du hero ne dépend ni de GSAP, ni du chunk de page, ni des fontes — elle est en
  keyframes CSS (`src/index.css`, section « Hero de la landing ») pilotées par `--d` / `--tx` ;
  **(2)** chaque règle n'a qu'un `from`, donc **l'état final est l'état par défaut** : une
  animation qui ne joue pas laisse le contenu visible ; **(3)** la route `/` a son propre
  squelette sombre (`LandingSkeleton` dans `App.tsx`), jamais le `PageLoader` clair.
- ❌ **Ne jamais remettre `SplitText` sur le H1 du parcours perso.** Il imposait une re-découpe au
  chargement des fontes et une recopie des classes de gradient sur chaque mot, `bg-clip-text` ne
  survivant pas aux transforms des ENFANTS. Le titre est maintenant révélé ligne par ligne, le
  gradient et le transform portés par le **même** élément — le seul cas que `bg-clip-text`
  supporte. C'est ce qui a fait réapparaître le dégradé bleu → fuchsia, affiché en bleu plat
  depuis le passage à SplitText.
- ⚠️ **`HeroModuleDock` n'est pas une décoration** : les quatre puces suivent la vue affichée par
  `AppWindowShowcase` (`onSlideChange`), et c'est ce qui fait comprendre que Tâches, Habitudes,
  Agenda et OKR sont quatre vues de la MÊME application. Sous `prefers-reduced-motion` elles sont
  déjà arrimées et libellées : **le sens survit à l'absence de mouvement**, c'est le critère qui a
  fait retenir cette idée plutôt qu'un effet.
- ⚠️ Les tarifs affichés viennent de `ENTERPRISE_PRICING_TIERS` — **jamais de montant en dur** :
  la landing et le produit doivent annoncer le même prix le jour de l'activation du paywall.
  Et le montant n'est **pas** animé par un compteur à ressort (il passerait par 48 € avant de
  se poser sur 50 €).
- **Offre de lancement (2026-08-24)** : `landing/entreprise/free-offer.ts` expose
  `ENTERPRISE_FREE_OFFER`, **dérivé de `ENTERPRISE_BILLING_ENFORCED`** — jamais une constante
  indépendante, sinon la landing et le produit peuvent diverger. Tant qu'il est vrai, la section
  tarifs affiche « Gratuit » à la place de chaque montant, le tarif d'après restant visible barré
  (« au lieu de 20 € / mois »), sous un badge « Offre de lancement ». Les textes payants ne sont
  pas remplacés : les variantes `promo*` / `*Free` **s'ajoutent** dans les catalogues, donc
  rebasculer le drapeau restitue la page d'origine mot pour mot.
- ⚠️ **Une page qui dit « gratuit » ne doit plus annoncer de plafond nulle part.** Quatre textes
  décrivaient une limite de sièges qui n'est plus appliquée (`hero.reassurance`,
  `pricing.ctaNote`, `cta.note`, `faq.a4`/`a5`) : tous ont leur variante d'offre. Toute nouvelle
  phrase qui promet « jusqu'à 5 membres » doit en avoir une aussi.

---

## Onboarding du premier compte

🔴 **La sélection de modules N'EXISTE PLUS.** Elle a été supprimée le 2026-08-23 (`acf29b7`,
bug 6 sur 10), et ce fichier a continué à la décrire pendant dix jours. Vérifié dans tout le
dépôt le 2026-09-02, en cherchant le code et pas seulement le nom : `active-modules.store.ts`,
`useActiveModules`, `isModuleActive`, `ModuleOnboarding.tsx`, `RequireModule` et la clé
`cosmo_active_modules` rendent **zéro occurrence**. Agenda, Habitudes, OKR et Statistiques sont
visibles par tout le monde, tout le temps.

> ⚠️ **Une note ajoutée le 2026-09-02 sur cette même section n'a corrigé qu'un nom sur six** :
> elle constatait l'absence de `RequireModule` et concluait « écrire la garde OU retirer
> l'affirmation », sans voir que la fonctionnalité entière avait disparu. Chercher le symptôme
> cité par la doc plutôt que la chose décrite laisse la dérive presque intacte, et la fait
> paraître vérifiée.

**Ce qui se passe réellement après une inscription** (parcours personnel) :

1. `SignupPage` renvoie sur `/dashboard` (`postAuthRoute`) — `/entreprise/onboarding` pour un
   compte professionnel, qui est le seul onboarding restant.
2. `FirstRunSetup` (`src/components/onboarding/`, monté dans `Layout`) pose **trois questions
   passables** à un compte VIDE : des tâches, une habitude, un objectif. Ce qui est écrit devient
   de vraies données. Une fois par appareil (`cosmo_first_run_done`), jamais en mode démo.

Livré le 2026-09-02 (T-23). Il remplace `OnboardingExampleTasks`, qui créait 3 tâches d'exemple
sans écran, **écrites en dur en français** hors des catalogues i18n.

- ❌ **Ne jamais différer les créations à la dernière étape.** Chaque étape crée au moment où elle
  est validée : quelqu'un qui répond à la première question puis ferme l'onglet garde sa tâche, et
  c'est exactement la population que l'écran existe pour retenir (50 % des inscrits ne revenaient
  jamais après leur session d'inscription).
- ❌ **Ne jamais le déplacer sur une route.** Une inscription par Google ne repasse pas par
  `SignupPage` : un accueil monté sur une route n'accueillerait qu'un des deux chemins.
- ❌ **Ne jamais poser d'échéance sur la première tâche.** La personne a donné un intitulé, pas une
  date ; en inventer une la ferait apparaître « en retard » dès le lendemain.
- ⚠️ L'ancien drapeau `cosmo_onboarding_examples_created` reste **lu, jamais écrit** : qui a eu
  l'ancien accueil puis supprimé ses tâches n'est pas accueilli une seconde fois.
- Debug : `localStorage.removeItem('cosmo_first_run_done')`, supprimer ses tâches, puis recharger.
  ⚠️ **Le compte doit être vide** : la garde est `taskCount === 0`, pas « compte récent ».

---

## Base de données Supabase

Migrations dans `supabase/migration/*.sql`, convention `NNN_<feature>.sql`.
**136 fichiers de migration, dernière = `132_task_dependencies.sql`** (au 2026-08-30).
Ledger prod relu le 2026-08-31 : **tout le dépôt est appliqué**, `131` et `132` comprises.
⚠️ Elles l'ont été dans l'ordre INVERSE de leur numéro (la `132` le 08-30, la `131` le 08-31) —
elles ne se touchent pas, mais le ledger ne se lit donc pas comme une suite croissante.
✅ **La `132` a été appliquée en prod le 2026-08-30** (dépendances entre tâches PERSONNELLES,
jumelle de la `108`), et vérifiée invariant par invariant plutôt que sur un « success » :
`user_id` bien redérivé alors qu'on envoyait exprès celui d'un autre compte, doublon refusé
par la PK (23505), auto-dépendance et cycles direct **et indirect à trois maillons** refusés,
arête inter-comptes refusée, tâche inexistante refusée, `ON DELETE CASCADE` vérifié (2 arêtes
→ 0). Isolation mesurée acteur par acteur : le propriétaire voit son arête, un autre compte
en voit **zéro**, et son insertion est refusée. Tests joués dans une transaction annulée par
un `RAISE` final — la table est restée à 0 ligne. Zéro advisor de sécurité sur cette table.
Elle n'a modifié aucune table existante.
✅ **La `131` a été appliquée en prod le 2026-08-31** (`/admin` exige une session `aal2`),
et vérifiée acteur par acteur dans une transaction annulée : admin en `aal1` →
`admin_allowlisted()` vrai mais `is_admin()` FAUX et `get_admin_stats()` refusée **42501** ;
admin dont le jeton n'a **aucune** claim `aal` → `is_admin()` faux (la garde ne se relâche pas
sur une valeur manquante) ; admin en `aal2` → garde ouverte, statistiques rendues ; compte non
admin en `aal2` → tout faux, inchangé.
🔴 **ELLE A ÉTÉ APPLIQUÉE AVANT L'ENRÔLEMENT**, à la demande explicite d'Axel, donc dans
l'ordre que l'en-tête de la migration déconseille. Mesuré juste avant : le compte admin a
**zéro facteur MFA**. Conséquence, tant qu'aucun code TOTP n'a été vérifié : `/admin`
n'affiche plus de statistiques. Ce n'est pas un verrouillage — `AdminMfaGate` reste
atteignable parce que `admin_allowlisted()` ignore volontairement le niveau d'assurance.
✅ **L'enrôlement a eu lieu le 2026-09-01**, mesuré en base le 2026-09-02 : `auth.mfa_factors`
porte **1 facteur `totp` en statut `verified`** sur le compte admin, créé à 14:20:27 UTC et
vérifié 46 secondes plus tard. Accès à `/admin` confirmé le 2026-09-02. Le verrouillage
a donc duré **du 2026-08-31 au 2026-09-01**, pas au-delà.
⚠️ **Un seul compte au monde ouvre cette console** : `public.admin_users` ne contient qu'une
ligne, l'adresse Gmail personnelle d'Axel, pas l'adresse pro. Téléphone perdu →
`DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';` depuis le SQL editor, seule porte de
sortie, et elle n'a pas d'autre gardien.
🔴 **La porte de sortie était elle-même cassée, et ça a bel et bien produit un verrouillage
(2026-09-01).** Le raisonnement ci-dessus — « ce n'est pas un verrouillage, `AdminMfaGate`
reste atteignable » — était juste sur la garde et faux dans les faits : l'écran d'enrôlement
levait une exception **en phase de rendu**, donc l'`AppErrorBoundary` affichait « Une erreur
inattendue s'est produite » au lieu du QR code. Atteignable, mais inutilisable : `/admin` est
resté inaccessible du 2026-08-31 au 2026-09-01, mesuré (`auth.mfa_factors` = 0 ligne).
Corrigé (`formatSecret` rendue totale, réponse d'enrôlement validée à la frontière), avec les
tests de régression qui manquaient — ils mockaient `startTotpEnrolment` sans jamais le
résoudre, donc le QR n'était **jamais rendu**.
**La leçon, qui vaut au-delà de cet écran** : quand une migration crée une dépendance à un
chemin de récupération, ce chemin se PARCOURT avant d'appliquer la migration, il ne se
raisonne pas. Ici il suffisait d'ouvrir l'écran une fois. ✅ La `130` a été appliquée
le 2026-08-29, vérifiée acteur par acteur (membre simple : 0 ligne).
✅ **Les `127`, `128` et `129` ont été appliquées en prod le 2026-08-27**, dans cet ordre, chacune
vérifiée après coup : la `127` rend un résultat identique pour les 18 comptes qui ont des données
(comparaison par empreinte, prise avant application), la `128` laisse **une seule policy
PERMISSIVE** sur `events`, et un manager voit toujours exactement les 30 événements non privés de
son subordonné, zéro de celui qu’il ne gère pas ; la `129` est `SECURITY INVOKER` et un membre
simple ne voit toujours aucune des demandes d’adhésion réservées aux admins.
**Tout le reste est en prod**, ledger relu en base le 2026-08-27 : la `129` est la dernière
appliquée. La `123` l’a été avant le redéploiement de `stripe-webhook`, qui écrit
désormais `billing_interval`.

> ⚠️ **Le ledger porte une entrée de plus que le dépôt** :
> `119b_habits_bounded_payload_future_guard`, appliquée en prod, sans fichier correspondant. Son
> contenu a été relu et comparé au fichier `119` du dépôt : **identique**, le correctif a été
> replié dans le fichier d'origine au lieu d'être versionné à part. Rejouer le dépôt sur base
> vierge donne donc le même état final. **Règle : un correctif appliqué en prod se versionne sous
> son propre numéro**, jamais par édition d'un fichier déjà appliqué.

> ⚠️ Quatre migrations ne portent pas de fonctionnalité : elles **formalisent
> l'existant**. `subscriptions`, trois colonnes et les privilèges par défaut du
> schéma `public` existaient en prod sans qu'aucune migration ne les crée — le
> dépôt ne décrivait donc pas la base qu'il prétend reconstruire, et le replay
> sur base vierge échouait. Elles sont **no-op en production** (`IF NOT EXISTS`,
> `CREATE OR REPLACE`) : elles alignent le dépôt sur la prod, jamais l'inverse.
> Deux d'entre elles sont numérotées `000_` parce qu'elles précèdent réellement
> l'historique. Le job CI `rls-integration` est vert depuis (run #713) — il ne
> l'avait **jamais** été depuis sa création le 2026-06-21.
>
> 🔴 **Ne jamais ajouter une colonne ou un GRANT depuis le dashboard Supabase.**
> C'est ce qui a produit cette dérive : la prod avance, le dépôt non, et
> personne ne le voit tant que rien ne rejoue les migrations à blanc.

Toutes les tables ont **RLS activée**. Pattern obligatoire + checklist migration →
[`docs/SECURITY.md`](./docs/SECURITY.md).

Fonctions SECURITY DEFINER clés : `accept_friend_request_v2`, `accept_shared_task`,
`consume_premium_token` / `credit_premium_token_from_ad`, `remove_friendship` /
`resolve_profile_by_email`, `handle_new_user_profile`, `prevent_user_id_change`, `owns_task`,
`claim_share_link`, `sanitize_display_name`, `get_my_tasks`, `toggle_task_complete_v2`,
`get_work_time_stats`, `get_admin_stats`. Schéma `friend_requests` = `sender_id` / `receiver_id`.

> **Une seule policy PERMISSIVE par rôle+action** (mig. 049). Les anciens splits `tasks`
> (own / collaborator) et `friend_requests` (sender / receiver) sont **fusionnés en une policy
> `OR` unique**, sémantique préservée. **Ne jamais recréer deux policies permissives** pour le
> même rôle+action : élargir le `OR` existant. `npm run check:rls` est la gate.

### Pattern critique : journal append-only `kr_completions`

Quand un KR passe `completed: false → true`, **les deux repositories OKR doivent insérer une
ligne dans `kr_completions`** atomiquement. Cette table alimente le graphique « KR réalisés » du
Dashboard.

- **LocalStorage** : `src/modules/okrs/repository.ts → updateKeyResult`
- **Supabase** : `src/modules/okrs/supabase.repository.ts → recordKRCompletion()`
  (appelé depuis `updateKeyResult` ET `updateKeyResultViaJsonb`)

> **Ne jamais retirer cette logique** : sans elle, le graphique reste à 0 en production.

---

## ⚡ Lecture des tâches — passer par `get_my_tasks()`

**Ne jamais lire `tasks` en direct pour une vue de liste.** La policy
`tasks_select_own_or_shared` (mig. 049) est un `OR` entre une égalité et un `EXISTS` : Postgres
ne peut pas utiliser `idx_tasks_user_id` et fait un **`Seq Scan` de la table globale** (vérifié
par `EXPLAIN` en prod le 2026-08-07). Le coût d'une lecture croît alors avec le volume de TOUTE
la plateforme, pas avec celui de l'utilisateur.

```typescript
supabase.from('tasks').select(...)          // ❌ Seq Scan global
supabase.rpc('get_my_tasks').select(...)    // ✅ Index Scan (mig. 085)
```

`get_my_tasks()` ne prend **aucun paramètre** : son périmètre vient de `auth.uid()` seul. Les
policies RLS restent en place (défense en profondeur) ; l'isolation est prouvée par
`e2e/rls/get-my-tasks.test.ts`. Exception légitime : `getById` (accès par clé primaire).

> ⚠️ **`task_dependencies` (mig. 132) se lit en direct, et c'est voulu.** Sa policy est
> `(SELECT auth.uid()) = user_id`, pas un `EXISTS` sur `tasks` : le périmètre est porté par une
> colonne dénormalisée (redérivée par trigger, jamais envoyée par le client), donc indexable dès
> le premier jour. Déléguer à `tasks` aurait payé le `OR` ci-dessus **par arête** — l'erreur que
> la mig. 117 a dû rattraper côté entreprise. Second motif, suffisant à lui seul : une tâche
> personnelle peut être **partagée**, et déléguer à « les tâches que je vois » ferait entrer dans
> le graphe des arêtes entre deux tâches d'un autre compte. Le graphe personnel est celui de son
> propriétaire ; la version partagée du graphe, c'est le mode entreprise.

### ⚡ Tables entreprise — même règle, même correctif (mig. 113)

`team_tasks` et `team_projects` avaient exactement le même défaut : les policies les filtrent par
`USING (can_access_team_project(...))`, un prédicat-fonction sur une colonne, qui **ne peut pas
utiliser d'index** — donc `Seq Scan` de toute la table et une CTE récursive (`get_subtree`)
évaluée **par ligne**. Mesuré en prod le 2026-08-14 : **≈ 60× le coût par ligne** du prédicat de
`tasks`.

```typescript
supabase.from('team_tasks').select(...)                                // ❌ Seq Scan + CTE par ligne
supabase.rpc('get_my_team_tasks',             { p_org: orgId })        // ✅ mig. 113
supabase.rpc('get_my_team_projects',          { p_org: orgId })        // ✅ mig. 113
supabase.rpc('get_my_team_task_dependencies', { p_org: orgId })        // ✅ mig. 117
```

- Le périmètre vient de `auth.uid()` seul : **`p_org` est un filtre, pas une portée.** Forger un
  `p_org` étranger renvoie 0 ligne (les trois branches exigent l'appartenance de l'appelant).
- Le gain tient en une phrase : `get_subtree()` est appelée **une fois par organisation** au lieu
  d'une fois par ligne lue.
- Les policies restent en place, inchangées (défense en profondeur). Le déploiement est donc
  réversible sans downtime — mais la **mig. 113 doit être appliquée AVANT** de déployer le front,
  sinon la RPC n'existe pas. **Appliquée en prod le 2026-08-24**, avant que `main` (qui appelle
  déjà ces RPC) ne soit déployé sur Vercel.
- Le chemin d'accès est verrouillé par test (`src/modules/team-projects/supabase.repository.test.ts`) :
  un retour à `.from('team_tasks')` échoue en CI.

> ⚠️ **Ne pas ajouter de nouvelle table entreprise sur le modèle prédicat-fonction.** Exprimer
> l'appartenance en **jointure indexable** dans une RPC, en réutilisant `my_team_project_ids()`
> plutôt qu'en déléguant à `team_tasks` : c'est la délégation qui a fait hériter
> `team_task_dependencies` du coût qu'on venait d'éliminer (mig. 108, refermé par la mig. 117).
> Détail et projections : [`docs/SCALABILITY.md`](./docs/SCALABILITY.md) §2.

### ⚡ `events` : un ensemble calculé une fois, jamais une fonction par ligne (mig. 128)

Troisième occurrence de la même classe, la première hors du mode entreprise. La policy de lecture
d'`events` appelait `manages_user(user_id)`, donc une fonction **sur une colonne**, donc un appel
par ligne examinée, chacun joignant deux fois `organization_members` puis évaluant `get_subtree`.

```sql
-- ❌ dépend de la ligne : rappelée pour chaque ligne, index inutilisable
USING ((SELECT auth.uid()) = user_id OR (manages_user(user_id) AND NOT is_private))
-- ✅ ne dépend PAS de la ligne : hissée en InitPlan, et devient condition d'index
USING ((SELECT auth.uid()) = user_id
       OR (NOT is_private AND user_id = ANY (public.my_managed_user_ids())))
```

Mesuré en prod le 2026-08-26, lecture de l'agenda d'un membre non géré : **17,19 ms → 0,61 ms**,
et zéro ligne remontée du tas pour être rejetée ensuite (`Rows Removed by Filter: 128` → BitmapOr
de deux Index Scan). Lire son propre agenda ne changeait rien et ne change rien : la branche
« own » court-circuitait déjà le `OR`.

- ❌ **Ne jamais faire dépendre un prédicat de policy d'un argument pris dans la ligne.** La règle
  couvre `tasks` (085), `team_tasks` / `team_projects` (113), `team_task_dependencies` (117) et
  maintenant `events` (128). Un helper sans argument, dont le périmètre vient de `auth.uid()`
  seul, est évalué une fois par requête, exactement comme `(SELECT auth.uid())` depuis la 043.
- 🔴 **Une policy réécrite « pour aller plus vite » se prouve AVANT d'être écrite.** Pour la 128 :
  parité booléenne sur chaque couple (acteur, cible) de `organization_members`, puis égalité de
  l'ensemble des `events.id` visibles pour **chaque** compte de `auth.users`. C'est une frontière
  de sécurité, pas un plan d'exécution.
- ⚠️ `manages_user` survit, redéfinie **en fonction** de `my_managed_user_ids()` : deux
  définitions concurrentes de « qui je gère » finiraient par diverger.
- Garde : `scripts/migration-guards.test.mjs`, vue rouge sur la régression avant d'être committée.

### 📬 Agréger des lectures, oui. Agréger des AUTORISATIONS, jamais (mig. 129)

`get_my_org_inbox()` remplace **cinq** lectures qui partaient à chaque ouverture de
l'application, sur toutes les pages protégées, parce que `Layout` monte `useOrgBadges` pour
peindre une pastille : invitations, avis de retrait, ma demande d'adhésion, demandes reçues côté
admin, notifications, plus un sixième appel conditionnel à `profiles`.

- 🔴 **Une RPC d'agrégat est `SECURITY INVOKER`.** En `DEFINER`, agréger cinq lectures revient à
  réécrire cinq autorisations à la main dans une fonction qui contourne la RLS : c'est là qu'une
  agrégation « de performance » devient une fuite. Les deux sections qui ont besoin de privilèges
  élevés ne sont pas réécrites, elles **appellent** les fonctions `DEFINER` existantes
  (`get_my_org_invitations`, `get_my_org_removal_notices`), inchangées.
- ❌ **Ne jamais lui donner un `p_org`.** Le périmètre vient de `auth.uid()` seul, comme
  `get_my_tasks`. Un paramètre d'organisation forcerait le client à attendre que l'organisation
  active soit résolue : on échangerait quatre requêtes contre du délai, en sérialisant ce qui
  partait en parallèle. Les sections par organisation couvrent TOUTES mes organisations, le
  client filtre.
- ❌ **Ne jamais borner globalement.** 200 demandes et 50 notifications, **par organisation**
  (window function). Une borne globale tronquerait la troisième organisation d'un compte avec les
  lignes des deux premières, et ça ne se verrait que chez lui.
- ❌ **Ne jamais réintroduire une invalidation par section** dans `useOrgInboxRealtime` : ces clés
  ne portent plus de donnée, l'écran cesserait de se rafraîchir **en silence**. Une seule clé,
  `orgKeys.inbox()`.
- Les cinq hooks gardent leur nom et leur forme de retour : ce sont des sélecteurs `useMemo`.
  Garde : `src/modules/organizations/inbox.hooks.test.tsx`.

## 🔐 Permissions entreprise — surcharge, jamais remplacement (mig. 115)

Les droits du mode entreprise sont **dérivés par défaut** (`is_org_admin`, `is_org_manager`) et
**surchargeables par membre** depuis l'annuaire → menu « … » → **Modifier les permissions**.

- Table `org_member_permissions (org_id, user_id)`, colonnes booléennes **NULLables** :
  `NULL` = suit le défaut dérivé, `true`/`false` = décision explicite. Une organisation sans
  aucune ligne se comporte **exactement** comme avant la mig. 115 — c'est ce qui rend le
  déploiement réversible.
- Dix droits (`task.create` · `task.editAny` · `task.deleteAny` · `project.create` ·
  `project.delete` · `okr.create` · `okr.delete` · `category.manage` · `team.create` ·
  `member.invite`) + une portée d'assignation cumulable
  (`self` · `peers` · `manager` · `subordinates` · `everyone`, `{}` = personne).
- Côté client, **une seule source de vérité** : `src/modules/organizations/permissions.ts`
  (fonctions pures, miroir du SQL) exposé par `useMyOrgPermissions(orgId)`. Aucun composant ne
  recalcule un droit ; le hook lit l'utilisateur via `useAuth`, jamais via une prop.

- ❌ **Ne jamais gater une création/suppression par `isManager`.** `isManager` ne désigne plus
  qu'une **position** (onglets Pyramide et Statistiques, dépendances de tâches) ; un droit passe
  par `can['<clé>']`.
- ❌ **Ne jamais enregistrer un instantané des dix droits.** La fiche n'écrit que les lignes
  DÉCIDÉES : figer les droits d'un manager le jour où on ouvre sa fiche ferait qu'un
  déplacement dans la pyramide ne les lui retirerait plus jamais.
- ❌ **Ne jamais confondre `assign_targets = NULL` (aucune décision → tout le monde) et `{}`
  (personne).** Ce sont deux états opposés.
- ❌ **Ne jamais poser de ligne sur un admin** : `my_org_perm` court-circuite sur
  `is_org_admin`, et le trigger la refuse. Sans cette règle, un admin peut se retirer un droit
  et bloquer son organisation sans chemin de retour.
- ⚠️ Le contrôle des assignations ne porte que sur les **AJOUTS** : retirer un assigné reste
  toujours permis, sinon une tâche héritée devient ingérable et les purges RGPD cassent. Les
  sélecteurs de membres appliquent la même règle (`canAssign(id) || déjà assigné`).
- ⚠️ **L'archivage d'un projet est un UPDATE**, pas un DELETE, et l'application ne supprime
  jamais un projet : c'est le trigger `enforce_team_project_archive_scope` qui rattache
  l'archivage à `project.delete`. Une policy, qui juge la ligne entière, ne sait pas le faire.

## 📉 Habitudes — `completions` est BORNÉ à la lecture (mig. 119)

`habits.completions` est un JSONB qui gagnait une entrée **par jour et par habitude**,
sans aucune borne : 12,7 octets/jour mesurés, soit ~280 ko par ouverture de la page
Habitudes à trois ans pour 20 habitudes.

```typescript
supabase.from('habits').select('*')                       // ❌ payload sans borne
supabase.rpc('get_my_habits', { p_days: 400 })            // ✅ mig. 119
```

La RPC renvoie `completions` **filtré aux 400 derniers jours**, ET quatre agrégats
calculés **serveur sur l'historique entier** : `streak_current`, `streak_best`,
`completions_total`, `first_completion_date`. C'est ce qui rend la troncature acceptable.

- 🔴 **Ne jamais faire juger « aujourd'hui » par le serveur.** La base est en **UTC**, les clés
  de `completions` sont écrites en date LOCALE (`toLocaleDateString('en-CA')`). Toute fonction qui
  raisonne sur un jour prend `p_today` du client (`get_my_habits`, `toggle_habit_completion_v2`).
  Utiliser `CURRENT_DATE` a produit une série affichée à **zéro** en Amérique du Nord entre 19 h
  et minuit, et un compteur qui **baissait** en cochant entre 00 h et 02 h en France (mig. 119,
  corrigé par la mig. 122). C'est la même classe de bug que celle éradiquée en juin 2026, revenue
  par le SQL.
- ❌ **Ne jamais dériver une série ou un total de `habit.completions`.** Utiliser
  `habitStreak(habit)` (`src/modules/habits/streak.ts`), `habit.completionsTotal` et
  `habit.firstCompletionDate`. Sur la fenêtre, un utilisateur assidu depuis trois ans
  verrait sa série plafonner à 400 — un chiffre faux, affiché comme s'il était juste.
- ❌ **Ne jamais compter les complétions dans un export.** L'export est le support du
  droit à la portabilité (RGPD art. 20) : il utilise `completionsTotal`.
- ⚠️ Les agrégats sont **absents en mode démo et local** (le repository local a toute la
  donnée) : chaque helper retombe alors sur le calcul JS. Garder ce repli.
- ⚠️ Augmenter la fenêtre réintroduit le problème proportionnellement (+12,7 o/jour et
  par habitude). La RPC plafonne à 3 650 quoi qu'on demande.
- La table n'est PAS modifiée : rien n'est supprimé, c'est la LECTURE qui est bornée.

## 🔁 Récurrence des tâches — serveur uniquement

La génération de l'occurrence suivante appartient à `toggle_task_complete_v2` (mig. 086), **pas
au client**. Elle est atomique (même transaction que la bascule) et idempotente (index unique
`ux_tasks_recurrence_parent`). Le client ne fournit QUE la date suivante, calculée en date locale
(`nextOccurrenceDeadline`) — le serveur ne connaît pas son fuseau.

- ❌ Ne jamais recréer un `repository.create(nextOccurrence)` côté client (faille H1 : occurrence
  perdue si l'onglet se ferme, doublon si on décoche puis recoche, échec avalé).
- ❌ Ne jamais écrire `recurrence_parent_id` depuis le client — c'est la clé d'idempotence,
  `mapTaskToDb` ne l'émet volontairement pas.

## 📡 Synchronisation de la collaboration — Realtime, pas sondage

Trois canaux, tous montés **une seule fois** dans `App.tsx` :
`useSharedTasksRealtime` (`shared_tasks`), `useOrgInboxRealtime` (mig. 118 : notifications,
invitations et demandes d'adhésion d'organisation) et `useFriendsInboxRealtime` (mig. 120 :
demandes d'amis reçues/envoyées, listes partagées).

Ensemble, ils ont remplacé **huit** sondages permanents, soit environ 30 requêtes par minute et
par utilisateur connecté avant toute interaction.

**Il reste QUATRE déclarations de `refetchInterval`, et aucune n'est permanente** (vérifié le
2026-08-25) :

| Où | Nature |
|---|---|
| `organizations/hooks.ts` · `useOrgMembers` | conditionnelle (`live`) |
| `team-projects/hooks.ts` · `useTeamTasks` | conditionnelle (`live`) |
| `team-okrs/hooks.ts` · `useTeamOKRs` | conditionnelle (`live`) |
| `tasks/hooks.ts` · `useTasks` | filet à 5 min, et seulement si une collaboration est active |

> ⚠️ **Compter les `refetchInterval` ne suffit pas : il faut qualifier chacun.** Une première
> version de ce paragraphe annonçait « aucun permanent » alors que deux l'étaient encore, dont
> `useOrgJoinRequests`, monté par `Layout` donc actif sur TOUTES les pages protégées pour tout
> admin d'organisation. Un audit indépendant l'a trouvé. Le décompte ci-dessus est nominatif
> exprès : un total ne prouve rien. Le `refetchInterval` de `useTasks` n'est plus qu'un filet
de sécurité à 5 min.

- ❌ Ne pas remonter la cadence du sondage : chaque tick est un `getAll()` complet. La version à
  15 s coûtait ≈ 58 Mo/mois/utilisateur d'egress.
- ❌ Ne pas monter le canal Realtime dans un composant de page : c'est un WebSocket, il s'en
  ouvrirait un par écran affiché.
- ❌ **Ne pas rajouter un `refetchInterval` « juste pour être sûr ».** Chaque tick est une requête
  pour tout le monde, en permanence. Si une donnée doit se rafraîchir toute seule, elle passe par
  Realtime (publication `supabase_realtime` + `REPLICA IDENTITY FULL`) ; sinon
  `refetchOnWindowFocus` suffit.
- ⚠️ Toute nouvelle table écoutée en Realtime doit être ajoutée à la publication
  `supabase_realtime` **et** passée en `REPLICA IDENTITY FULL` (sinon les DELETE ne portent que
  la clé primaire et les filtres client ne matchent jamais) — cf. mig. 087.

---

## Conventions de code

### Imports — toujours l'alias `@/`

```typescript
import { supabase } from '@/lib/supabase';      // ✅
import { supabase } from '../../lib/supabase';   // ❌
```

### GSAP — landing page uniquement

```typescript
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap';  // ✅
import { gsap } from 'gsap';                                            // ❌ jamais
```

- **Point d'entrée unique** : `src/lib/gsap.ts` (registration des plugins + isolation du chunk
  `vendor-gsap`, chargé seulement par la LandingPage lazy).
- **Périmètre** : `src/pages/LandingPage.tsx`, `src/pages/landing/*`, `src/lib/hooks/use-magnetic.ts`.
  Le reste de l'app reste sur **Framer Motion**.
- Toute animation doit respecter `prefers-reduced-motion` (`gsap.matchMedia()` ou guard équivalent).

### Toasts

```typescript
import { toast } from 'sonner';
toast.success('Message'); toast.error('Erreur');
// Jamais depuis un repository ni depuis normalizeApiError
```

### TypeScript

- Strict (`noUnusedLocals`, `noUnusedParameters`) · **pas de `as any`**
- `interface` pour les objets, `type` pour les unions
- Variables/args/catch inutilisés intentionnellement → préfixer par `_`

### Validation zod

`src/lib/validation/validate.ts` (`validateOrThrow` / `safeValidate` + `ValidationError`) +
schémas par module. Câblé dans les `mutationFn` create/update.

- ⚠️ **Ce n'est PAS la frontière de sécurité** — celle-ci reste RLS + whitelist `mapToDb`.

### ESLint

- Config `eslint.config.js`. **0 erreur** avant chaque commit.
- Ignorés : `dist`, `src/components/showcase/**`, `e2e/**`, `playwright.config.ts`
- Warnings tolérés : Fast refresh sur les contextes + fichiers ui shadcn (préexistants)

---

## i18n — catalogues maison (fr + en)

L'app est **bilingue fr/en**, sans framework i18n (pas d'i18next). Socle dans `src/i18n/`,
catalogues JSON par namespace dans `src/locales/{fr,en}/*.json` (19 namespaces : `common`,
`tasks`, `org`, `landing`, `seo`, `settings`…).

```typescript
import { useT } from '@/i18n/useT';
const { t, tp } = useT('org');   // tp = pluriel
t('project.name')                // clé plate dans le namespace
```

- **`fr` est le catalogue de référence** : le moteur retombe clé par clé sur lui. Un catalogue
  traduit incomplet n'affiche donc jamais de clé brute — et ne se voit pas non plus.
  `npm run i18n:check` (bloquant CI) est la seule protection réelle.
- **Slugs de routes localisés** : `src/i18n/routes.ts` + `route-slugs.json`. Une seule URL
  canonique par langue et par page (`/en/about` répond, `/en/a-propos` → 404, voulu).
- Le préfixe de locale est porté par le `basename` du routeur, **figé au montage** — changer de
  langue implique un rechargement complet (cf. `src/i18n/bootstrap.ts`).
- Les dates passent par `src/i18n/format.ts` (locale date-fns alignée sur la locale active).
- ⚠️ **« Servie » ≠ « indexable »** : `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) ouvre une langue
  aux utilisateurs ; `INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) l'ouvre à Google. `en` est
  servie mais **pas indexable**, parce que le corps des pages est encore en français. Ne jamais
  ajouter une locale à `INDEXABLE_LOCALES` avant d'avoir traduit le contenu — procédure complète
  dans [`docs/SEO.md`](./docs/SEO.md).
- ❌ **Ne jamais identifier une erreur par son message en français** — il est traduit.
- ❌ Ne jamais concaténer des fragments traduits : une clé = une phrase complète.

---

## Déploiement Vercel

`vercel.json` : SPA rewrite, headers de sécurité (HSTS, X-Frame-Options, CSP…), cache immuable
`/assets/*`. Variables à configurer sur Vercel : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_STRIPE_PUBLISHABLE_KEY` (quand Stripe sera finalisé).
Runbook : [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

---

## 🚫 Garde-fous — à ne jamais faire

Codes entre parenthèses = bugs historiques ayant motivé la règle.

### Mode démo

- ❌ Appeler `login(email, password)` pour l'utilisateur démo — utiliser `loginDemo()`
- ❌ `navigate('/dashboard')` après `loginDemo()` sans `setTimeout(…, 0)`
- ❌ Oublier `clearDemoStorage()` avant de modifier les seeds
- ❌ Dériver `isDemo` de l'email — utiliser `useIsDemo()` / `appModeStore.isDemo` (B0)
- ❌ Muter `DEMO_FRIENDS` / `DEMO_INCOMING_REQUESTS` en place — `JSON.parse(JSON.stringify(...))` (B12)

### 📅 Échéances — un jour, pas un instant (revue du 2026-09-02, R-01)

`tasks.deadline` est un `timestamptz`, mais ce que la personne saisit est un **jour**. Les deux ne
se convertissent ni par `new Date('YYYY-MM-DD')` (qui parse en **UTC**) ni par `.slice(0, 10')`
(qui rend le jour **UTC** de l'instant). Un seul module fait foi : **`src/lib/deadline.ts`**.

```typescript
new Date(formData.deadline).toISOString()   // ❌ minuit UTC → la veille à l'ouest
task.deadline.slice(0, 10)                  // ❌ jour UTC, pas le jour vécu
deadlineFromDayKey(formData.deadline)       // ✅ écriture
deadlineDayKey(task.deadline)               // ✅ lecture
isDueToday(...) / isOverdue(...)            // ✅ comparaisons
```

- 🔴 **Trois écritures divergentes coexistaient** (`save-task`, `snooze`, `TasksPage`), pour trois
  valeurs différentes du même jour choisi. Mesuré en prod : **467 des 601 échéances** portaient
  00:00:00 UTC. Conséquence, pour tout fuseau à décalage négatif : une tâche datée du jour même
  était classée « En retard » et absente de « Aujourd'hui ». **Invisible depuis la métropole**, ce
  qui la rendait introuvable en regardant l'application fonctionner.
- ❌ **Ne jamais comparer des INSTANTS pour décider « en retard ».** `new Date(deadline) < new Date()`
  faisait basculer en rouge une tâche due aujourd'hui dès 00 h 01. On compare des **jours**.
- ⚠️ **Les lignes écrites avant le correctif ne sont pas migrées, et c'est volontaire** : relues par
  `deadlineDayKey`, elles rendent exactement ce qu'elles rendaient avant (juste en métropole, fausses
  ailleurs). Aucune régression, et surtout aucune migration de données qui devrait deviner le fuseau
  de chaque compte — la base ne le connaît pas.
- ✅ **`team_tasks.deadline` est une `date`** et traverse sans conversion : elle ne porte aucun
  instant. `deadlineDayKey` gère les deux formes, c'est sa raison d'être.

### 🌍 Fuseau horaire — la préférence pilote AUSSI les journées

`src/lib/timezone.ts` portait un décalage d'**affichage** pour le seul agenda. Il porte désormais
le découpage des **journées** (`dayKeyInTz`, `todayKeyInTz`, `dayStartInTz`), ce qui permet à
quelqu'un en Guadeloupe, à La Réunion ou en Nouvelle-Calédonie de se détacher du découpage
métropolitain : réglage `manual` + décalage, et ses échéances, ses reports et ses listes
« Aujourd'hui » suivent SON jour.

- ❌ **Ne jamais faire dépendre un jour de `toLocaleDateString('en-CA')` seul** dans un chemin qui
  touche aux échéances : c'est le fuseau de la MACHINE, pas celui que la personne a choisi.
- ⚠️ **Les clés de `habits.completions` restent en date machine**, volontairement : elles sont déjà
  écrites en base sous cette forme et les basculer sur la préférence décalerait tout l'historique
  existant. À traiter par une migration dédiée, pas en passant.

### Champs canoniques du modèle

- ❌ `habit.completedDates` — canonique : `habit.completions: Record<string, boolean>` (B5)
- ❌ `task.status` / `task.title` / `task.dueDate` / `task.isBookmarked` — utiliser
  `task.completed` / `task.name` / `task.deadline` / `task.bookmarked` (B6)
- ❌ Réintroduire `premiumTokens` / `subscriptionEndDate` / `premiumWinStreak` en source de
  vérité dans le type `User` — `useBilling()` only (N5)
- ❌ Stocker un collaborateur par `friend.name` — utiliser `friend.id` partout (B6, B22)

### Architecture & imports

- ❌ Importer depuis `src/context/TaskContext` — **fichier supprimé**
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
- ❌ Importer `useAuth` depuis `@/modules/user`
- ❌ Appeler `repository.getFriends()` depuis un hook — l'interface expose `getAll()` (B3)
- ❌ Importer `gsap` directement ou l'utiliser hors landing — passer par `@/lib/gsap`
- ❌ Appeler `toast` depuis les repositories ou `normalizeApiError`

### Animations

- ❌ **Ne jamais écrire à la main le mouvement d'une feuille.** Utiliser `useSheetMotion()` et
  `useSheetDrag()` (`src/components/mobile/mobile-motion.ts`). **Mesuré dans le navigateur le
  2026-08-24**, `prefers-reduced-motion: reduce` réellement actif : `MobileMoreSheet` s'ouvrait à
  `transform: matrix(1, 0, 0, 1, 0, 510)` — `top: 812` pour un viewport de 812, soit **0 px
  visible**. Le voile s'affichait, la feuille non. Or c'est le SEUL accès mobile à OKR,
  Statistiques, Paramètres et à la déconnexion : la navigation mobile était **sans issue** pour ces
  utilisateurs. Même mécanisme sur les cascades `staggerChildren` (dix blocs du dashboard figés
  20 px trop bas). Garde : `src/design-system.guard.test.ts`.
- ❌ **Ne jamais faire dépendre une position finale d'une animation de transform.**
  `App.tsx` monte `<MotionConfig reducedMotion="user">` : chez un utilisateur en
  `prefers-reduced-motion`, les animations de transform ne jouent pas et la valeur `initial`
  **reste appliquée**. Un `initial={{ y: 120 }} animate={{ y: 0 }}` sur un élément `fixed` le
  laisse 120 px trop bas, définitivement. Mesuré le 2026-08-14 sur `CookieBanner` et
  `DemoBridgePrompt` : leur CTA sortait de l'écran. La position vient du CSS, l'animation ne
  porte que sur l'opacité. Détail : [`docs/MOBILE.md`](./docs/MOBILE.md).
- ⚠️ `prefers-reduced-motion` est **actif sur la machine d'Axel** : si une animation « ne
  s'affiche pas », vérifier ce réglage avant de suspecter le code.

### Logique métier

- ❌ Modifier `recordKRCompletion()` sans vérifier le graphique dashboard (démo ET prod)
- ❌ `kr.currentValue / kr.targetValue` sans guard `targetValue > 0` (B17)
- ❌ Insérer N lignes dans `kr_completions` depuis un `count` client non clampé — cap 100/write (B18)
- ❌ `JSON.parse(localStorage.getItem(...))` sans `try/catch` — utiliser `safeParse<T>` (B14)
- ❌ Réintroduire des gates `isPremium()` sur le partage de tâches / la collaboration

### Journal fiscal et consentement (2026-08-26)

- ❌ **Ne JAMAIS ajouter de policy UPDATE ou DELETE sur `payment_records` ou `payment_closures`,
  ni les inclure dans une purge.** C'est le journal d'encaissement inaltérable (mig. `125`,
  CGI art. 286-I-3° bis). L'immuabilité est portée par un **trigger**, pas par la RLS, parce que
  `service_role` contourne la RLS mais pas les triggers.
  🔴 **CORRIGÉ le 2026-09-02** : ce paragraphe demandait d'« anonymiser `user_id` » à la purge.
  C'est **inapplicable**. `row_hash` scelle `user_id` dans le chaînage, et
  `verify_payment_chain()` recalcule chaque hash depuis les colonnes : écrire NULL casserait la
  chaîne, donc produirait exactement le signal de falsification qu'on montre à un contrôleur.
  Le trigger refuse d'ailleurs l'UPDATE. Ce qui rend la conservation acceptable est ailleurs :
  `user_id` cesse d'identifier quiconque dès que la ligne `auth.users` disparaît, il ne reste
  qu'un UUID que COSMO ne sait plus rattacher. `delete-account` ne touche donc PAS cette table,
  et le commentaire qui l'explique est dans la fonction.
  Une erreur se corrige par une ligne compensatoire, comme en comptabilité.
- ❌ **Ne jamais lire `cosmo_cookie_consent` directement.** Passer par
  `src/lib/cookie-consent.ts`, et par `useCookieConsent()` dans React. La dispersion est
  exactement ce qui a permis au bandeau de proposer un choix qu'aucune ligne de code
  n'appliquait. **Tout nouveau traceur doit être conditionné** : `null` n'est pas une
  acceptation tacite.
- ❌ **Ne jamais rendre une garde conditionnelle à la présence de son propre secret.**
  `if (SECRET && header !== SECRET)` laisse passer tout le monde tant que le secret n'est pas
  posé : on ne se protège que quand on est déjà protégé. Bug introduit puis corrigé le
  2026-08-26 dans `renewal-notice`.
- ⚠️ **`renewal_notices` est une PREUVE**, pas un cache. Ne jamais la purger : c'est ce qu'on
  produit si un client conteste une reconduction (Conso. art. L215-1).

### Sécurité & env

- ❌ `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- ❌ Committer sans vérifier que `.env` reste gitignored
- ❌ Écrire en base via le MCP Supabase (contourne la RLS)
- ❌ **Appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy.** La
  mig. `100` leur a révoqué `EXECUTE` à `authenticated` pour fermer une fuite inter-organisations,
  et une policy s'évalue avec le **rôle courant** : l'appel échoue par `permission denied`. Dans
  une policy, utiliser `is_above(org_id, user_id)` ou `i_have_subordinates(org_id)`. À l'intérieur
  d'une fonction `SECURITY DEFINER`, les helpers restent appelables (rôle = propriétaire).
  Régression en cours en prod : mig. `107`, finding B-1 de [`faille.md`](./faille.md).
- ❌ **Garder une surface admin par `admin_allowlisted()`.** Depuis la mig. `131`, deux fonctions
  répondent à deux questions différentes : `admin_allowlisted()` dit « ce compte est admin »
  (AFFICHAGE, ignore volontairement le niveau d'assurance, sinon l'écran d'enrôlement TOTP
  devient inatteignable) et `is_admin()` dit « cette requête est autorisée » (GARDE : allowlist
  ET `auth.jwt() ->> 'aal' = 'aal2'`). Les intervertir annule la migration. Et ne jamais tester
  « ce compte a activé la 2FA » : `aal2` porte sur la SESSION, or c'est précisément la session
  ouverte avec un mot de passe volé qu'il faut refuser. Détail : `docs/SECURITY.md`.
- ❌ **Une fonction de trigger en `SECURITY DEFINER`.** Une garde doit être `SECURITY INVOKER`
  (défaut) et `REVOKE`-ée pour `anon` (mig. `064b` / `094b`). Un trigger `BEFORE` s'exécutant
  **avant** le `WITH CHECK` de la RLS, en DEFINER ses messages d'erreur deviennent un oracle sur
  des lignes non lisibles (mig. `108`, finding B-3).

### Documentation

- ❌ Traiter un fichier de `docs/archive/**` comme l'état courant du projet
- ❌ Citer un numéro de ligne d'un autre fichier `.md` — les fichiers bougent, les liens de
  section survivent

> **Sécurité (RLS, mass-assignment, Stripe, secrets) → [`docs/SECURITY.md`](./docs/SECURITY.md).
> Toujours la consulter avant de toucher `supabase/`, le billing, ou un repository.**
