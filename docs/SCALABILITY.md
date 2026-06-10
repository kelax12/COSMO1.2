# Scalabilité — état, décisions et runbook

> Issu de l'audit architecture 2026-06-10, section 6. Ce document trace ce qui a
> été corrigé **en code**, ce qui est **bloqué par une contrainte produit**, et
> ce qui relève de l'**infrastructure** (Supabase / Vercel) hors de ce dépôt.
>
> Contrainte de l'itération : **aucune modification de l'UI ni de l'UX.** Seuls
> les gains 100 % invisibles (payload réseau) ont été appliqués en code.

---

## 1. Appliqué en code (gain invisible, zéro régression UX)

### Trim des colonnes sur les lectures de liste `tasks`
`src/modules/tasks/supabase.repository.ts` — `getByDate` et `getFiltered`
passaient `select('*')`, ramenant `description` (texte long) et
`collaborator_validations` (JSONB) inutiles pour des vues liste.

- Source unique de colonnes : constante `TASK_LIST_COLUMNS` (réutilisée par
  `getAll` / `getByDate` / `getFiltered`) → plus de drift.
- `getById` conserve `select('*')` : c'est le chemin détail qu'utilise la
  TaskModal, il a besoin du payload complet.
- Consommateurs vérifiés (`DeadlineCalendar`, `TasksSummary` via
  `usePendingTasks`) : aucun ne lit `description` / `collaboratorValidations`.
- Tests mappers + hooks tasks verts (35/35), `tsc -b` + lint OK.

---

## 2. Bloqué par la contrainte « pas de régression UX » (dette à lever séparément)

Les lectures de liste de **events / habits / okrs** ne sont **PAS** trimmées,
volontairement.

**Raison** : ces 3 modules n'ont pas de séparation liste/détail. Leur modale
d'édition **réutilise la ligne déjà chargée par `getAll`** (les hooks unitaires
`useHabit` / `useOkr` / event single ne sont consommés nulle part). Comme leurs
mappers lisent `description` / `notes`, trimmer leur `getAll` viderait ces champs
**dans la modale d'édition** = régression UX → interdit.

**Prérequis pour débloquer le gain** (refactor séparé, hors « no-UX ») :
1. Faire pointer chaque modale d'édition (Event / Habit / OKR) sur un
   `getById`-backed hook (`useEvent` / `useHabit` / `useOkr`) au lieu de la
   ligne de liste.
2. Une fois la modale alimentée par `getById` (`select('*')`), trimmer le
   `getAll` correspondant sur le modèle de `TASK_LIST_COLUMNS`.

Gain attendu : réduction du payload `getAll` des 3 modules les plus volumineux
(events ~150 lignes seed, habits, okrs) — c'est le plus gros levier restant.

---

## 3. True pagination UI — projet séparé, **pas** un quick-fix

`useTasksInfinite` / `getPage` existent (`src/modules/tasks/`) mais **ne sont
câblés sur aucune page**. Les brancher naïvement casserait l'UX actuelle.

**Cause** : tout `TasksPage` calcule en mémoire, sur le dataset **complet** :
- compteurs par chip (`TasksPage.tsx:295`),
- liste virtuelle « Aujourd'hui » (`tasksDueToday`),
- smart lists (`overdue` / `this-week` / `high-priority`, `tasksInList`),
- filtres + tri client.

Avec une liste paginée, ces calculs ne verraient que la page chargée → compteurs
faux, smart lists incomplètes. Le rendu est déjà virtualisé
(`@tanstack/react-virtual` au-delà de 50 items) : la perf d'affichage n'est
**pas** le problème ; le payload de `getAll` (plafond `MAX_ROWS = 5000`) l'est.

**Pour livrer la vraie pagination, il faut d'abord** pousser filtres / smart
rules / tri / **comptage** côté SQL (PostgREST), puis câbler `useTasksInfinite`.
C'est une refonte du data-layer de `TasksPage` (god component 728 LOC), à
spécifier indépendamment. Plafond actuel par compte ≈ 5000 tâches.

---

## 4. Infrastructure (hors dépôt — Supabase / Vercel)

Non modifiable par le code applicatif. À traiter dans les dashboards.

| Item | Action | Quand |
|---|---|---|
| **Connection pooling** | Vérifier que la prod utilise l'URL **pooler** Supabase (PgBouncer, port 6543, mode transaction) pour absorber les pics de connexions serverless. | Avant montée en charge |
| **Read replicas** | Activer une replica lecture (plan Supabase ≥ requis) pour décharger les `getAll`/stats. App déjà compatible (lectures séparées des écritures dans les repos). | À ×100 utilisateurs |
| **Plan tier Postgres** | Le scaling est vertical : monter l'instance Supabase quand CPU/IO DB saturent. Surveiller via `get_advisors` + métriques projet. | Réactif (alerting) |
| **Cache serveur (Redis)** | **Différé.** Pas de besoin mesuré ; React Query couvre le cache client. N'introduire qu'avec une métrique justifiant le coût opérationnel. | YAGNI |
| **File d'attente / async** | **Différé.** Tout est synchrone request/response ; le webhook Stripe est idempotent et suffit. Introduire une queue seulement si des traitements lourds apparaissent. | YAGNI |
| **CDN** | OK — assets Vercel immuables (`/assets/* max-age=31536000`). Rien à faire. | ✅ |

---

## 5. Dépendance mono-fournisseur — plan de sortie (audit P1)

Supabase est à la fois l'auth, la DB, les Edge Functions et la frontière de
sécurité (RLS). Un incident fournisseur = panne totale. On ne « code » pas la
sortie aujourd'hui (YAGNI), mais on maintient les conditions qui la rendent
possible en jours plutôt qu'en mois :

| Actif | Portabilité actuelle | Geste qui la préserve |
|---|---|---|
| **Données** | Postgres standard, schéma 100 % versionné (`supabase/migration/`) | Export `pg_dump` mensuel hors Supabase (cf. `DEPLOYMENT.md §7`) |
| **Accès données** | Pattern repository : 8 interfaces `I*Repository`, 2 implémentations chacune | ❌ Ne jamais appeler `supabase.from()` hors d'un repository |
| **Auth** | Standard GoTrue (JWT) ; `useAuth` est l'unique façade | Migration possible vers tout IdP OIDC ; les `user_id` UUID survivent à un export `auth.users` |
| **Edge Functions** | Deno standard, 3 fonctions, zéro API propriétaire hors `supabase-js` | Portables vers Deno Deploy / Cloudflare Workers avec un client PG |
| **RLS (sécurité)** | ⚠️ Le point dur : la sécurité EST le SQL Postgres | Toute cible de sortie doit être un Postgres (RDS, Neon, autohébergé) — les policies se réimportent telles quelles |

**Décision** : pas d'abstraction supplémentaire (le coût dépasserait le risque).
Le plan = Postgres-vers-Postgres + façades existantes. Réévaluer si Supabase
change sa tarification ou si l'app dépasse ~10 k utilisateurs actifs.

## 6. Items explicitement différés (décisions, pas des oublis)

| Item audit | Statut | Pourquoi |
|---|---|---|
| God-components > 600 LOC (P2) | 🔁 Track continu `#6 refactor` (TaskModal, LandingPage, OKRModal, OKRPage faits) | Un split par PR, avec tests — pas un lot unique risqué |
| Vraie pagination UI (P2) | 📋 Projet séparé (cf. §3) | Exige le passage des filtres/compteurs côté SQL ; plafond actuel 5 000 items/compte acceptable |
| Prerender maison → SSR/SSG (P3) | ❄️ Gelé | Migration de framework complète ; à reconsidérer si le SEO devient un canal d'acquisition mesuré |
| Cache Redis / file d'attente | ❄️ YAGNI | Aucun besoin mesuré ; React Query + webhook idempotent suffisent |

## 7. Capacité estimée (rappel audit)

- **×10 utilisateurs** : ✅ sans modification.
- **×100 utilisateurs** : 🟡 pooling + replica + report charts Dashboard.
- **×1000 utilisateurs** : 🔴 nécessite §2 (trim généralisé) **et** §3 (vraie
  pagination server-side). Le code tiendrait ; le frein réel est la profondeur
  de données **par compte**, pas la concurrence.
