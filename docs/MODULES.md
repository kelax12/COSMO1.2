<!-- note-audit: couvert-par=ARCHITECTURE.md -->
# Carte des modules · où est quoi

> **Note d'audit** — carte de navigation, pas un audit : elle dit où se trouve quoi, et ses défauts sont ceux de l'architecture, que `ARCHITECTURE.md` note.

**Relevée le 2026-10-11** dans `src/modules/*` : fichiers listés, tables lues par les appels
`.from('…')` et RPC comptées par `.rpc('…')`. Les **règles** des modules (double mode,
repositories, Realtime) sont dans [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md) ; ce fichier
ne dit que **où chercher**. Le code fait foi : si un nom ci-dessous n'existe plus, le relever ici.

## Lire un module

Tous suivent la même forme. Partir de `index.ts` (exports publics), puis :

| Fichier | Rôle |
|---|---|
| `types.ts` | Types métier |
| `repository.ts` | Interface + choix démo / Supabase |
| `supabase.repository.ts` | Implémentation prod, frontière `mapToDb` |
| `local.repository.ts` | Implémentation démo (`localStorage` via `safe-json`) |
| `hooks.ts` | Hooks React Query (lecture + mutations) |
| `constants.ts` | Fabriques de clés React Query |
| `*.schema.ts` | Garde zod côté client (UX, pas sécurité) |

## Personnel

| Module | Tables | RPC | À savoir | Écran |
|---|---|---|---|---|
| `tasks` | `tasks`, `task_dependencies` | 3 | récurrence, `snooze.ts`, `status-sync.ts`, Realtime des partagées · [CLAUDE.md](../src/modules/tasks/CLAUDE.md) | `pages/TasksPage.tsx`, `components/task-*` |
| `habits` | `habits` | 1 | `completions` en date machine (gelé) · `streak.ts` · [CLAUDE.md](../src/modules/habits/CLAUDE.md) | `pages/HabitsPage.tsx`, `components/Habit*` |
| `okrs` | `okrs`, `key_results`, `kr_completions` | 0 | `progress.ts`, restauration du journal · [CLAUDE.md](../src/modules/okrs/CLAUDE.md) | `pages/OKRPage.tsx`, `pages/okr/` |
| `kr-completions` | `kr_completions` | 0 | journal append-only lu par les graphiques (cap 100/write) | dashboard, statistiques |
| `categories` | `categories` | 0 | arbre (`tree.ts`), impact de suppression (`impact.ts`) · [CLAUDE.md](../src/modules/categories/CLAUDE.md) | `components/category/` |
| `lists` | `lists` | 2 | listes intelligentes (`smart-rules.ts`), `delete-flow.hooks.ts` | `components/SmartListMenu.tsx`, `add-to-list/` |
| `events` | `events` | 0 | récurrence et fenêtre (`recurrence.ts`, `window.ts`) | `pages/AgendaPage.tsx`, `components/event-modal/` |
| `today` | aucune | 0 | agrège tâches, habitudes, moments (`today.helpers.ts`) | `components/Today*` |
| `stats` | aucune (RPC) | 1 | `get_work_time_stats` côté SQL | `pages/StatisticsPage.tsx` |
| `friends` | `friends`, `friend_requests`, `shared_tasks`, `shared_lists`, `share_links` | 7 | partage gratuit, liens de partage, Realtime de la boîte | `components/share/`, `ShareListSheet.tsx` |
| `user` | `profiles` | 0 | profil seul ; `useAuth` vient d'`auth`, jamais d'ici | `pages/SettingsPage.tsx` |
| `auth` | aucune | 1 | `AuthContext.tsx`, MFA, OAuth, attribution (`acquisition-claim.ts`) | `pages/LoginPage.tsx`, `SignupPage.tsx` |
| `ui-states` | aucune | 0 | états d'interface persistés | transverse |

## Entreprise

| Module | Tables | RPC | À savoir |
|---|---|---|---|
| `organizations` | `organizations`, `organization_members`, `org_invitations`, `org_invite_links`, `org_member_permissions`, `org_notifications`, `org_audit_log`, `org_weekly_reviews`, `organization_join_requests` | 23 | org active (`ActiveOrgContext.tsx`), permissions (`permissions.ts`, `use-my-permissions.ts`), gouvernance (`governance.*`), boîte de réception (`inbox.*`) · [CLAUDE.md](../src/modules/organizations/CLAUDE.md) |
| `org-teams` | `org_teams`, `org_team_members` | 2 | équipes |
| `team-projects` | `team_projects`, `team_tasks` et leurs tables `team_task_*` / `team_project_*` | 13 | le plus gros module : accès, portefeuille, abonnements, activité, sous-tâches ; implémentations découpées `supabase.*.ts` / `local.*.ts` |
| `team-okrs` | `team_okrs`, `team_key_results`, `team_kr_checkins`, `team_okr_members`, `team_okr_teams`, `team_kr_projects` | 7 | exécution (`execution.*`), audience des OKR confidentiels |
| `team-categories` | `team_categories` | 0 | table unique (mig. `148`) · [CLAUDE.md](../src/modules/team-categories/CLAUDE.md) |
| `team-lists` | `team_lists`, `team_list_tasks` | 0 | épinglage par défaut (`default-pin.ts`) |
| `org-config` | `org_settings`, `org_verified_domains`, `org_webhooks`, `team_automations`, `team_project_statuses` | 0 | automatisations, webhooks sortants |
| `org-reports` | `org_activity_reports` | 0 | rapports d'activité (mig. `202`) |
| `billing` | `subscriptions`, `org_subscriptions`, `org_billing_contacts` | 1 | Stripe, paliers entreprise · [CLAUDE.md](../src/modules/billing/CLAUDE.md) |
| `admin` | aucune (RPC) | 5 | console `/admin`, garde `is_admin()` (aal2) |

Écrans entreprise : `pages/OrganizationPage.tsx`, `pages/organization/`, `components/organization/`.

## Ce qui n'est pas dans `src/modules`

| Quoi | Où |
|---|---|
| Migrations SQL, RLS | `supabase/migration/` · [CLAUDE.md](../supabase/migration/CLAUDE.md) |
| Edge Functions | `supabase/functions/` · [CLAUDE.md](../supabase/functions/CLAUDE.md) |
| Landing, SEO, prérendu | `src/pages/landing/`, `prerender.mjs` |
| Traductions | `src/locales/{fr,en}/`, `src/i18n/` |
| Gardes CI | `scripts/` · [CLAUDE.md](../scripts/CLAUDE.md) |
| CLI sur les vraies données | `scripts/cosmo/` · [`COSMO-CLI.md`](./COSMO-CLI.md) |
