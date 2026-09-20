# CLAUDE.md — COSMO 1.2

Guide de travail dans ce dépôt. **Ce fichier est chargé à CHAQUE session : il reste court.**

🔴 **Il a pesé 2 070 lignes et ~43 000 tokens le 2026-09-16**, contre 17,8 ko dix semaines plus tôt.
Tout son contenu de niche est descendu d un cran, **sans une coupe** : dans le `CLAUDE.md` du
dossier concerné (chargé seulement quand ce code est touché) ou dans le doc de `docs/` qui fait
déjà foi. La table ci-dessous dit où.

❌ **Ne jamais réécrire un récit d incident ici.** Un incident s écrit **une fois**, dans le doc de
son domaine. Le `CLAUDE.md` concerné n en garde que l interdit, en une ligne. C est l absence de
cette règle qui a produit 78 commits sur ce seul fichier en trente jours, et des affirmations
fausses restées en place pendant des jours parce que le fichier était trop gros pour être relu.

✅ Cliquet : `npm run check:docs` refuse ce fichier au-delà de son plafond.

🔴 **Un défaut est OUVERT en production à cette date** : `okrTime` vaut **0** sur `/statistics`
pour tous les comptes réels. La mig. `136`, commitée depuis le 2026-09-03, n a jamais été
appliquée, et le correctif du 09-02 n avait réparé que la moitié cliente. **La démo affiche juste,
le produit affiche zéro.** Item `C-77` de [`a-faire-code.md`](./a-faire-code.md), détail dans
[`docs/SECURITY.md`](./docs/SECURITY.md).

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
| Modales a11y, animations, design system mobile, onboarding | [`src/components/CLAUDE.md`](./src/components/CLAUDE.md) |
| Landing, deux parcours, GSAP, shader | [`src/pages/landing/CLAUDE.md`](./src/pages/landing/CLAUDE.md) |
| Toasts, échéances, fuseau horaire, `safeParse` | [`src/lib/CLAUDE.md`](./src/lib/CLAUDE.md) |
| i18n, slugs localisés, locales indexables | [`src/i18n/CLAUDE.md`](./src/i18n/CLAUDE.md) |
| Migrations SQL, RLS, ledger | [`supabase/migration/CLAUDE.md`](./supabase/migration/CLAUDE.md) |
| Edge Functions, drift déployé | [`supabase/functions/CLAUDE.md`](./supabase/functions/CLAUDE.md) |
| Playwright | [`e2e/CLAUDE.md`](./e2e/CLAUDE.md) |
| Gardes CI, témoins, alerting | [`scripts/CLAUDE.md`](./scripts/CLAUDE.md) |

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
| [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md) | Étude de faisabilité React 19 + `react-router` 8 : chronologie CVE, composants shadcn ref par ref, chiffrage |
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


---

## Scripts

> ⚠️ **Cette liste ne porte QUE les commandes.** Ce que chaque garde mesure, ses pièges et ses
> mesures datées vivent dans le doc de son domaine, cité en fin de ligne. Cette section a pesé
> 281 lignes pour 20 commandes.

```bash
npm run dev        # Serveur dev local (port 5173)
npm start          # Serveur dev réseau (port 3000) — port utilisé par Playwright
npm run build      # Build prod → dist/ (vite build + node prerender.mjs)
npm run preview    # Prévisualiser le build
npm run lint       # ESLint (doit retourner 0 erreur)
npm run typecheck  # tsc -b (doit retourner 0 erreur)
npm test           # Vitest (run once)                          → docs/TESTING.md
npm run test:watch # Vitest en mode watch
npm run test:coverage       # + couverture v8, seuils par fichier → docs/TESTING.md
npm run test:rls            # Intégration RLS (stack locale)      → docs/TESTING.md
npm run test:e2e            # Playwright (+ :ui, :report)         → e2e/CLAUDE.md
npm run validate:migrations # Garde statique sur les .sql (CI)    → docs/SECURITY.md
npm run check:rls           # Invariants RLS (CI)                 → docs/SECURITY.md
npm run check:drift         # Dérive repo ↔ prod (2 étapes)       → docs/SECURITY.md
npm run check:migration-coverage # Fichiers ↔ ledger PROD (CI)    → docs/SECURITY.md
npm run check:edge          # Code DÉPLOYÉ vs dépôt (CI)          → supabase/functions/CLAUDE.md
npm run check:bundle        # Budget de bundle (CI)               → docs/PERFORMANCE.md
npm run analyze:entry       # Qui pèse dans le chunk d'entrée     → docs/PERFORMANCE.md
npm run images:check        # Images non optimisées (pas une gate)→ docs/PERFORMANCE.md
npm run check:mail          # SPF / DKIM / DMARC (pas une gate)   → docs/DEPLOYMENT.md
npm run check:legal         # Tableau de conformité               → docs/LEGAL.md
npm run check:docs          # Plafonds des CLAUDE.md (CI)         → scripts/CLAUDE.md
npm run check:deploy        # Commit SERVI en prod vs depot (CI)   → docs/DEPLOYMENT.md
npm run i18n:check          # Parité des clés fr ↔ en (CI)        → docs/I18N.md
npm run i18n:scan           # Chaînes en dur, cliquet à 0 (CI)    → docs/I18N.md
npm run i18n:identical      # Valeurs en == fr, cliquet à 0 (CI)  → docs/I18N.md
npm run i18n:namespaces     # Catalogues rendus par le SHELL      → docs/I18N.md
npm run profile:landing     # Profil du fil principal (Playwright)→ docs/PERFORMANCE.md
npm run cosmo               # CLI données réelles (cf. plus haut)
```

> Le build prod **drope** `console.*` et `debugger` (`vite.config.ts → esbuild.pure/drop`).
> Les erreurs remontent via Sentry (`VITE_SENTRY_DSN`).

🔴 **Trois règles de lecture, chacune payée d une erreur réelle :**

1. ❌ **Ne JAMAIS conclure d une ligne de résumé.** Lire `$?`, **puis** comparer le nombre de
   fichiers annoncé au périmètre du glob. Le 2026-09-15, une suite a rendu « 225 passed (225) »
   et **exit 1**, quatre fichiers n ayant jamais démarré, dont un qui porte trois témoins.
2. 🔴 **Ne JAMAIS passer `--maxWorkers` en ligne de commande.** `vitest.config.ts` fixe
   `maxWorkers: 2` exprès (C-47) ; l écraser sature la machine et compte comme échec un worker
   qui n a exécuté aucun cas. Ce conseil a vécu dans ce fichier et a désarmé sa propre garde.
3. ❌ **Ne JAMAIS relever un seuil ou un plafond pour faire passer la CI**, ni ajouter une entrée
   d allowlist pour la même raison. Un dépassement dit qu un contenu doit bouger, pas que la borne
   est trop basse.

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


---

## Conventions de code
### Imports — toujours l'alias `@/`

```typescript
import { supabase } from '@/lib/supabase';      // ✅
import { supabase } from '../../lib/supabase';   // ❌
```


### GSAP, toasts

- `gsap` s importe **uniquement** depuis `@/lib/gsap`, et **uniquement** dans la landing.
  Le reste de l app est sur Framer Motion. → [`src/pages/landing/CLAUDE.md`](./src/pages/landing/CLAUDE.md)
- `toast` s importe **uniquement** depuis `@/lib/toast` (façade différée), jamais depuis `sonner`,
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

- Config `eslint.config.js`. **0 erreur** avant chaque commit.
- Ignorés : `dist`, `src/components/showcase/**`, `e2e/**`, `playwright.config.ts`
- Warnings tolérés : Fast refresh sur les contextes + fichiers ui shadcn (préexistants)

---


---
## Déploiement Vercel

`vercel.json` : SPA rewrite, headers de sécurité (HSTS, X-Frame-Options, CSP…), cache immuable
`/assets/*`. Variables à configurer sur Vercel : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_STRIPE_PUBLISHABLE_KEY` (quand Stripe sera finalisé).
Runbook : [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

---


---

## 🚫 Garde-fous transversaux

> Les garde-fous propres à une zone vivent dans le `CLAUDE.md` de cette zone (table plus haut).
> Ceux-ci valent partout.
### Architecture & imports

- ❌ Importer depuis `src/context/TaskContext` — **fichier supprimé**
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
- ❌ Importer `useAuth` depuis `@/modules/user`
- ❌ Appeler `repository.getFriends()` depuis un hook — l'interface expose `getAll()` (B3)
- ❌ Importer `gsap` directement ou l'utiliser hors landing — passer par `@/lib/gsap`
- ❌ Appeler `toast` depuis les repositories ou `normalizeApiError`

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
- 🔴 **En CSP, un schéma écrit explicitement doit correspondre : `https:` ne couvre PAS `wss:`.**
  `connect-src` autorisait `https://*.supabase.co` sans `wss://*.supabase.co` : le navigateur
  bloquait **toutes** les connexions Realtime **en production**, en silence (la console disait
  « The action has been blocked », l'écran ne disait rien). Les trois canaux d'`App.tsx` étaient
  coupés, et comme ils ont justement REMPLACÉ huit sondages, il n'y avait plus aucun filet
  derrière eux : une tâche partagée n'arrivait jamais. Trouvé le 2026-09-01 dans la console
  d'Axel, **en cherchant autre chose**. Garde : `src/csp.guard.test.ts` (schéma `wss`, directives
  de confinement, absence d'`unsafe-eval`, et `data:` dans `img-src` dont dépend le QR code TOTP).
- 🔴 **Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin
  avant de l'appliquer.** La mig. `131` exige une session `aal2` ; l'écran d'enrôlement TOTP levait
  en phase de rendu et son QR portait un double préfixe `data:`. `/admin` est resté inaccessible du
  2026-08-31 au 2026-09-01, et **un seul compte au monde** ouvre cette console. Le raisonnement
  « ce n'est pas un verrouillage, l'écran reste atteignable » était juste sur la garde et faux dans
  les faits. Il suffisait d'ouvrir l'écran une fois.
- ⚠️ **Le dépôt est PUBLIC**, avec secret scanning, push protection et Dependabot actifs depuis le
  2026-09-01. Une fuite réelle est confirmée dans l'historique (`.env` au commit initial), **inerte**
  car elle vise un projet supprimé depuis. Retirer un fichier du suivi n'efface pas l'historique.

### Documentation

- ❌ Traiter un fichier de `docs/archive/**` comme l'état courant du projet
- ❌ Citer un numéro de ligne d'un autre fichier `.md` — les fichiers bougent, les liens de
  section survivent
- ❌ **Recopier un « avant » au lieu de le relire à sa source.** Le tableau de bord des audits est
  parti d'une note RGPD de 84 le 2026-09-02 alors qu'elle valait 86 depuis le 08-29 : la colonne
  avait été reprise du tableau du 25. Troisième occurrence, après les `refetchInterval` du 08-25 et
  la garde `architecture.guard` du 08-27 (« antérieure à mon travail », déclarée depuis un
  `git stash` qui contenait déjà le commit fautif). **Un « avant » se reconstruit à un commit
  nommé, jamais dans un arbre de travail ni depuis un tableau plus ancien.**
- ❌ **Chercher le symptôme cité par la doc plutôt que la chose décrite.** Une note du 2026-09-02
  n'a corrigé qu'un nom sur six sur la sélection de modules : elle constatait l'absence de
  `RequireModule` sans voir que la fonctionnalité entière avait disparu, ce qui laisse la dérive
  presque intacte **et la fait paraître vérifiée**.

> **Sécurité (RLS, mass-assignment, Stripe, secrets) → [`docs/SECURITY.md`](./docs/SECURITY.md).
> Toujours la consulter avant de toucher `supabase/`, le billing, ou un repository.**
