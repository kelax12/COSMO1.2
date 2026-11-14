# Carte des modules · où est quoi

> **Quand lire** : pour trouver un module de `src/modules/*`, ses tables, ses RPC ou son écran.
> **Fait foi** : le code ; les RPC et leurs appelants sont dans `supabase/rpc-inventory.md` (généré). Les règles des modules sont dans [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md).

⚠️ Un nom ci-dessous qui n'existe plus est un bug de cette carte : le corriger ici.

## Lire un module

Partir de `index.ts` (exports publics), puis ([`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md) § Forme d'un module ; choix démo / Supabase : `src/lib/repository.factory.ts`) :

| Fichier | Rôle |
|---|---|
| `types.ts` | Types métier |
| `repository.ts` | Interface du dépôt et ses types, rien d'exécutable (garde V12.3) |
| `supabase.repository.ts` | Implémentation prod, frontière `mapToDb` |
| `local.repository.ts` | Implémentation démo (`localStorage` via `safe-json`) |
| `local.seed.ts` | Jeu de données démo |
| `hooks.ts` | Hooks React Query (lecture + mutations) |
| `constants.ts` | Fabriques de clés React Query |
| `*.schema.ts` | Garde zod côté client (UX, pas sécurité) |

## Personnel

| Module | Tables | À savoir | Écran |
|---|---|---|---|
| `tasks` | `tasks`, `task_dependencies` | récurrence, `snooze.ts`, `status-sync.ts`, Realtime des partagées · [CLAUDE.md](../src/modules/tasks/CLAUDE.md) | `pages/TasksPage.tsx`, `components/task-*` |
| `habits` | `habits`, `habit_completions` (mig. `248`) | `completions` en date machine (gelé, [`ARCHITECTURE.md`](./ARCHITECTURE.md) § 1.1) · `streak.ts` · [CLAUDE.md](../src/modules/habits/CLAUDE.md) | `pages/HabitsPage.tsx`, `components/Habit*` |
| `okrs` | `okrs`, `key_results`, `kr_completions` | `progress.ts`, restauration du journal · [CLAUDE.md](../src/modules/okrs/CLAUDE.md) | `pages/OKRPage.tsx`, `pages/okr/` |
| `kr-completions` | `kr_completions` | journal append-only lu par les graphiques (cap 100/write) | dashboard, statistiques |
| `categories` | `categories` | arbre (`tree.ts`), impact de suppression (`impact.ts`) · [CLAUDE.md](../src/modules/categories/CLAUDE.md) | `components/category/` |
| `lists` | `lists` | listes intelligentes (`smart-rules.ts`), `delete-flow.hooks.ts` | `components/SmartListMenu.tsx`, `add-to-list/` |
| `events` | `events` | récurrence et fenêtre (`recurrence.ts`, `window.ts`) | `pages/AgendaPage.tsx`, `components/event-modal/` |
| `today` | aucune | agrège tâches, habitudes, moments (`today.helpers.ts`) | `components/Today*` |
| `stats` | aucune (RPC) | `get_work_time_stats` côté SQL | `pages/StatisticsPage.tsx` |
| `friends` | `friends`, `friend_requests`, `shared_tasks`, `shared_lists`, `share_links` | partage gratuit, liens de partage, Realtime de la boîte | `components/share/`, `ShareListSheet.tsx` |
| `user` | `profiles` | profil seul ; `useAuth` vient d'`auth`, jamais d'ici | `pages/SettingsPage.tsx` |
| `auth` | aucune | `AuthContext.tsx` (session, OAuth, inscription, démo), MFA ; unités abonnées à ses événements : `use-offline-cache`, `use-session-preload`, `use-last-seen`, `use-attribution` (`acquisition-claim.ts`, `affiliate-claim.ts`) | `pages/LoginPage.tsx`, `SignupPage.tsx` |
| `ui-states` | aucune | états d'interface persistés | transverse |

## Entreprise

| Module | Tables | À savoir |
|---|---|---|
| `organizations` | `organizations`, `organization_members`, `org_invitations`, `org_invite_links`, `org_member_permissions`, `org_roles`, `org_member_roles`, `org_notifications`, `org_notification_settings`, `org_audit_log`, `org_weekly_reviews`, `organization_join_requests` | org active (`ActiveOrgContext.tsx`), permissions (`permissions.ts`, `use-my-permissions.ts`, défaut d'un membre `use-member-defaults.ts`, mig. `232`), rôles personnalisés (`roles.*`, mig. `219`, rôle d'office mig. `230`), gouvernance (`governance.*`), boîte de réception (`inbox.*`) · [CLAUDE.md](../src/modules/organizations/CLAUDE.md) |
| `org-teams` | `org_teams`, `org_team_members` | équipes |
| `team-projects` | `team_projects`, `team_tasks` et leurs tables `team_task_*` / `team_project_*` | accès, portefeuille, abonnements, activité, sous-tâches, corbeille, validateur d'une tâche (`validator_id`, mig. `233` à `235`) ; implémentations découpées `supabase.*.ts` / `local.*.ts` · [CLAUDE.md](../src/modules/team-projects/CLAUDE.md) |
| `team-okrs` | `team_okrs`, `team_key_results`, `team_kr_checkins`, `team_okr_members`, `team_okr_teams`, `team_kr_projects` | exécution (`execution.*`), audience des OKR confidentiels |
| `team-categories` | `team_categories` | table unique (mig. `148`) · [CLAUDE.md](../src/modules/team-categories/CLAUDE.md) |
| `team-lists` | `team_lists`, `team_list_tasks` | épinglage par défaut (`default-pin.ts`) |
| `org-config` | `org_settings`, `org_verified_domains`, `org_webhooks`, `team_automations`, `team_project_statuses` | automatisations, webhooks sortants ; `org_settings` porte aussi `member_default_perms` (mig. `232`) et `default_role_id` (mig. `230`) |
| `org-reports` | `org_activity_reports` | rapports d'activité (mig. `202`) |
| `billing` | `subscriptions`, `org_subscriptions`, `org_billing_contacts`, `org_seat_alerts` (mig. `240`, Edge `seat-alert` : alerte 80 % des sièges, quotidienne) | Stripe, paliers entreprise · [CLAUDE.md](../src/modules/billing/CLAUDE.md) |
| `admin` | aucune (RPC) | console `/admin`, garde `is_admin()` (aal2) |

Écrans entreprise : `pages/OrganizationPage.tsx`, `pages/organization/`, `components/organization/`, `components/org-guide/` (guide entreprise).

## Hors de `src/modules`

| Quoi | Où |
|---|---|
| Migrations SQL, RLS | `supabase/migration/` · [CLAUDE.md](../supabase/migration/CLAUDE.md) |
| Edge Functions | `supabase/functions/` · [CLAUDE.md](../supabase/functions/CLAUDE.md) |
| Fonctions Vercel (collecteur d'audience) | `api/` · [CLAUDE.md](../api/CLAUDE.md) |
| Landing, SEO, prérendu | `src/pages/landing/`, `prerender/` |
| Traductions | `src/locales/{fr,en}/`, `src/i18n/` |
| Gardes CI | `scripts/` · [CLAUDE.md](../scripts/CLAUDE.md) |
| CLI sur les vraies données | `scripts/cosmo/` · [`COSMO-CLI.md`](./COSMO-CLI.md) |
| Import de tâches (Todoist, TickTick, Notion, CSV) | `src/lib/task-import/` (analyse, plan, exécution), écran `pages/settings/ImportTasksDialog.tsx` |
| Affiliation (lien `?aff=<slug>`, last-click 30 j, hors consentement par décision d'Axel) | `src/lib/affiliation.ts` (capture, clé `cosmo_aff` préservée par la démo, ping `affiliation-api/click`), `src/modules/auth/affiliate-claim.ts` (RPC `claim_affiliate`, inscription Google) ; metadata `affiliate_slug` lue par le trigger (mig. `236`) |
