<!-- GENERE par scripts/contrat-donnees.mjs. NE PAS EDITER A LA MAIN. -->
# Inventaire des fonctions SQL du schema `public`

Genere depuis une base vierge sur laquelle toutes les migrations de `supabase/migration/` ont ete
rejouees. La CI echoue si ce fichier diverge de ce que les migrations produisent : chaque ajout
ou changement de droit d'une fonction est donc relu dans le diff.

Regenerer : npm run contrat:generer (Docker, supabase start, node scripts/apply-migrations.mjs) ou copier les fichiers de l'artefact `contrat-donnees` du job CI.

- Les droits sont les droits EFFECTIFS (`has_function_privilege`), le droit accorde a `PUBLIC` compris.
- Les appelants sont cherches par texte (`rpc('nom'`) dans `src/`, `supabase/functions/` et `api/`,
  tests exclus. `~` : le nom n'apparait que comme chaine (constante, table de noms). Un appel depuis SQL
  (fonction, policy, trigger) n'est pas liste : `-` ne prouve pas qu'une fonction est inutilisee.

## Synthese

| Mesure | Nombre |
|---|---|
| Fonctions | 237 |
| Executables par `anon` | 3 |
| Executables par `authenticated` | 109 |
| Executables par `service_role` | 237 |
| Droit accorde a `PUBLIC` | 0 |
| SECURITY DEFINER | 155 |
| SECURITY DEFINER sans `search_path` fige | 0 |
| SECURITY DEFINER executables par `anon` | 2 |

## Executables par `anon` (surface ouverte sans session)

| Fonction (arguments) | Mode | search_path | anon | authenticated | service_role | Appelants |
|---|---|---|---|---|---|---|
| `preview_share_link(p_token uuid)` | DEFINER | `""` | oui | oui | oui | `src/modules/friends/share-link.hooks.ts`<br>~`src/pages/InvitePage.tsx` |
| `record_demo_visit(p_device_id uuid)` | DEFINER | `""` | oui | oui | oui | `src/lib/demo-metrics.ts` |
| `sanitize_display_name(raw text)` | INVOKER | `""` | oui | oui | oui | - |

## SECURITY DEFINER sans `search_path` fige

Aucune.

## Toutes les fonctions

| Fonction (arguments) | Mode | search_path | anon | authenticated | service_role | Appelants |
|---|---|---|---|---|---|---|
| `accept_friend_request_v2(request_id uuid)` | DEFINER | `public, pg_temp` | - | oui | oui | `src/modules/friends/supabase.repository.ts` |
| `accept_shared_task(p_task_id uuid)` | DEFINER | `public, pg_temp` | - | oui | oui | `src/modules/friends/supabase.repository.ts` |
| `account_activity()` | DEFINER | `""` | - | - | oui | - |
| `account_has_live_billing(p_user uuid)` | DEFINER | `""` | - | - | oui | - |
| `account_inactivity_deletion_due(p_user uuid)` | DEFINER | `""` | - | - | oui | `supabase/functions/delete-account/index.ts` |
| `accounts_due_for_inactivity_deletion(p_limit integer)` | DEFINER | `""` | - | - | oui | `supabase/functions/inactive-accounts/index.ts` |
| `accounts_due_for_inactivity_notice(p_limit integer)` | DEFINER | `""` | - | - | oui | `supabase/functions/inactive-accounts/index.ts` |
| `add_task_to_list(p_task_id uuid, p_list_id uuid)` | INVOKER | `public, pg_temp` | - | oui | oui | `src/modules/lists/supabase.repository.ts` |
| `admin_allowlisted()` | DEFINER | `""` | - | oui | oui | `src/modules/admin/repository.ts` |
| `admin_stats_excluded_uids()` | INVOKER | `""` | - | oui | oui | - |
| `affiliate_attach(p_affiliate_id uuid, p_email text)` | DEFINER | `""` | - | oui | oui | `supabase/functions/affiliation-api/index.ts` |
| `affiliate_backfill()` | DEFINER | `""` | - | oui | oui | - |
| `affiliate_compute(p_gross bigint, p_vat_bp integer, p_fee_bp integer, p_fee_fixed integer, p_rate_bp integer, OUT vat_cents bigint, OUT fee_cents bigint, OUT base_cents bigint, OUT commission_cents bigint)` | INVOKER | `""` | - | - | oui | - |
| `affiliate_process(p_rec payment_records)` | DEFINER | `""` | - | - | oui | - |
| `apply_team_task_custom_status()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `assign_default_org_role()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/organizations/roles.local.repository.ts` |
| `audit_org_change()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `audit_team_okr_trash()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `audit_team_project_details()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `audit_team_project_members()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `audit_team_task_trash()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `billing_acceptances_append_only()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `build_org_activity_report(p_org uuid, p_team uuid, p_day date, p_tz text)` | DEFINER | `""` | - | - | oui | - |
| `can_access_team_okr(p_okr uuid)` | DEFINER | `""` | - | oui | oui | - |
| `can_access_team_project(p_project uuid)` | DEFINER | `""` | - | oui | oui | ~`src/components/organization/audience.helpers.ts`<br>~`src/components/organization/visibility.helpers.ts`<br>~`src/modules/team-projects/messages.repository.ts`<br>~`src/modules/team-projects/supabase.access.ts`<br>~`src/modules/team-projects/supabase.repository.ts` |
| `can_access_team_task(p_task uuid)` | DEFINER | `""` | - | oui | oui | - |
| `can_assign_to(p_org uuid, p_target uuid)` | DEFINER | `""` | - | oui | oui | ~`src/modules/organizations/permissions.ts` |
| `can_edit_team_project(p_project uuid)` | INVOKER | `""` | - | oui | oui | ~`src/components/organization/config/ProjectWorkflowSection.tsx` |
| `can_manage_team(p_team uuid)` | DEFINER | `""` | - | oui | oui | ~`src/components/organization/TeamMembersPanel.tsx`<br>~`src/components/organization/member-bulk.helpers.ts`<br>~`src/components/organization/team-page.helpers.ts`<br>~`src/modules/org-teams/hooks.ts`<br>~`src/modules/org-teams/repository.ts` |
| `can_manage_team_okr_audience(p_okr uuid)` | DEFINER | `""` | - | oui | oui | - |
| `can_restore_team_okr(p_org uuid, p_deleted_by uuid)` | DEFINER | `""` | - | - | oui | - |
| `can_restore_team_task(p_org uuid, p_project uuid, p_deleted_by uuid)` | DEFINER | `""` | - | - | oui | - |
| `claim_acquisition_source(p_source text, p_campaign text)` | DEFINER | `""` | - | oui | oui | `src/modules/auth/acquisition-claim.ts` |
| `claim_affiliate(p_slug text)` | DEFINER | `""` | - | oui | oui | `src/modules/auth/affiliate-claim.ts`<br>~`src/lib/affiliation.ts` |
| `claim_org_invite(p_token uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `claim_share_link(p_token uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/friends/share-link.hooks.ts`<br>~`src/components/ShareInviteClaimer.tsx` |
| `consume_email_lookup_quota(p_cost integer)` | DEFINER | `""` | - | - | oui | - |
| `consume_rate_limit(p_key text, p_limit integer, p_window interval)` | DEFINER | `""` | - | - | oui | `supabase/functions/_shared/rate-limit.ts` |
| `create_org_email_invitations(p_org uuid, p_emails text[], p_manager uuid, p_team_ids uuid[], p_access_days integer)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/governance.supabase.repository.ts`<br>~`src/components/organization/InviteByEmailDialog.tsx`<br>~`src/components/organization/OrgInviteSection.tsx`<br>~`src/components/organization/OrgMembersSection.tsx`<br>~`src/components/organization/OrgSettingsSection.tsx`<br>~`supabase/functions/send-org-invite/index.ts` |
| `create_organization(p_name text)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `create_profile_for_new_user(p_id uuid, p_email text, p_meta jsonb)` | DEFINER | `""` | - | - | oui | - |
| `create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb, p_milestones jsonb)` | INVOKER | `""` | - | oui | oui | `src/modules/team-projects/supabase.portfolio.ts`<br>~`src/modules/team-projects/local.repository.ts`<br>~`src/modules/team-projects/types.ts` |
| `delete_organization(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts`<br>~`src/components/organization/DeleteOrganizationDialog.tsx`<br>~`src/components/organization/OrgSettingsSection.tsx`<br>~`src/pages/organization/useDeleteOrgFlow.ts` |
| `delete_team_with_transfer(p_team uuid, p_target uuid, p_archive_projects boolean)` | INVOKER | `""` | - | oui | oui | `src/modules/org-teams/supabase.repository.ts`<br>~`src/modules/org-teams/local.repository.ts`<br>~`src/modules/org-teams/repository.ts` |
| `drop_muted_org_notification()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/components/organization/OrgNotificationSettingsDialog.tsx` |
| `enforce_category_tree()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/categories/local.repository.ts`<br>~`src/modules/categories/tree.ts`<br>~`src/modules/team-categories/tree.ts` |
| `enforce_org_invite_domain()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enforce_org_member_role_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enforce_org_permission_ceiling()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/components/organization/MemberDirectory.tsx`<br>~`src/components/organization/MemberPermissionsSheet.tsx`<br>~`src/modules/organizations/permissions.ts`<br>~`src/modules/organizations/repository.ts` |
| `enforce_org_role_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enforce_org_settings_default_role()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enforce_profile_integrity()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enforce_team_category_tree()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/components/organization/TeamCategoryTreeManager.tsx`<br>~`src/components/organization/TeamCategoryTreeSelect.tsx`<br>~`src/modules/team-categories/tree.ts` |
| `enforce_team_project_archive_scope()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/team-projects/repository.ts` |
| `enforce_team_project_edit_scope()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/components/organization/ProjectEditDialog.tsx` |
| `enforce_team_task_assign_scope()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enforce_team_task_project_role()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `enqueue_team_task_webhook(p_task uuid, p_event text)` | DEFINER | `""` | - | oui | oui | - |
| `events_enforce_created_by()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `expire_org_member_roles()` | DEFINER | `""` | - | - | oui | - |
| `forbid_consent_mutation()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `forbid_payment_mutation()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `freeze_team_membership_identity()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/org-teams/supabase.repository.ts` |
| `generate_due_activity_reports()` | DEFINER | `""` | - | - | oui | - |
| `generate_join_code()` | INVOKER | `""` | - | - | oui | - |
| `get_admin_onboarding_funnel(p_days integer)` | DEFINER | `""` | - | oui | oui | `src/modules/admin/repository.ts` |
| `get_admin_revenue(p_days integer)` | DEFINER | `""` | - | oui | oui | - |
| `get_admin_stats()` | DEFINER | `""` | - | oui | oui | `src/modules/admin/repository.ts` |
| `get_admin_traffic(p_days integer)` | DEFINER | `""` | - | oui | oui | - |
| `get_incoming_request_senders()` | DEFINER | `public, pg_temp` | - | oui | oui | `src/modules/friends/supabase.repository.ts`<br>~`src/modules/friends/types.ts` |
| `get_my_habits(p_days integer, p_today date)` | INVOKER | `""` | - | oui | oui | `src/modules/habits/supabase.repository.ts` |
| `get_my_org_inbox()` | INVOKER | `public` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `get_my_org_invitations()` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `get_my_org_removal_notices()` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts`<br>~`src/modules/organizations/useOrgInboxRealtime.ts` |
| `get_my_tasks()` | DEFINER | `""` | - | oui | oui | `src/modules/tasks/supabase.repository.ts` |
| `get_my_team_kr_projects(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-okrs/execution.supabase.repository.ts` |
| `get_my_team_project_dependencies(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.portfolio.ts` |
| `get_my_team_project_members(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.access.ts` |
| `get_my_team_project_progress(p_org uuid)` | DEFINER | `""` | - | oui | oui | - |
| `get_my_team_projects(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts` |
| `get_my_team_task_dependencies(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts` |
| `get_my_team_tasks(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts`<br>~`src/modules/organizations/inbox.ts`<br>~`src/modules/team-projects/hooks.ts` |
| `get_org_billing_history(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/billing/org-billing-account.repository.ts`<br>~`src/components/organization/OrgBillingHistory.tsx`<br>~`src/modules/billing/org-billing.types.ts` |
| `get_org_email_invitations(p_org uuid)` | INVOKER | `""` | - | oui | oui | `src/modules/organizations/governance.supabase.repository.ts` |
| `get_org_member_last_activity(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/member-activity.repository.ts`<br>~`src/modules/organizations/member-activity.ts` |
| `get_pending_shared_tasks()` | DEFINER | `""` | - | oui | oui | `src/modules/tasks/supabase.repository.ts` |
| `get_subtree(p_org uuid, p_root uuid)` | DEFINER | `""` | - | - | oui | ~`src/components/organization/pyramid.helpers.ts`<br>~`src/modules/team-projects/supabase.repository.ts` |
| `get_support_stats()` | DEFINER | `""` | - | oui | oui | `src/modules/admin/repository.ts`<br>~`src/modules/admin/types.ts` |
| `get_team_deletion_impact(p_team uuid)` | INVOKER | `""` | - | oui | oui | `src/modules/org-teams/supabase.repository.ts` |
| `get_team_member_workload(p_org uuid, p_today date)` | INVOKER | `""` | - | oui | oui | `src/modules/team-projects/supabase.access.ts`<br>~`src/modules/team-projects/local.access.ts` |
| `get_team_okr_trash(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-okrs/supabase.repository.ts`<br>~`src/components/organization/TeamTrashDialog.tsx` |
| `get_team_project_task_stats(p_org uuid, p_today date)` | INVOKER | `""` | - | oui | oui | `src/modules/team-projects/supabase.access.ts`<br>~`src/components/organization/okr-execution.helpers.ts`<br>~`src/modules/team-projects/local.access.ts` |
| `get_team_trash(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts`<br>~`src/components/organization/TeamTrashDialog.tsx`<br>~`src/modules/team-projects/types.ts` |
| `get_work_time_stats(p_ranges jsonb, p_tz text)` | INVOKER | `public` | - | oui | oui | `src/modules/stats/supabase.repository.ts`<br>~`src/lib/workTimeCalculator.ts`<br>~`src/modules/stats/repository.ts` |
| `handle_new_user_profile()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/lib/attribution.ts` |
| `has_subordinates(p_org uuid, p_user uuid)` | DEFINER | `""` | - | - | oui | - |
| `i_have_subordinates(p_org uuid)` | DEFINER | `""` | - | oui | oui | - |
| `init_team_task_status()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text)` | DEFINER | `""` | - | oui | oui | - |
| `invite_friend_to_org(p_org uuid, p_invitee uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts`<br>~`src/components/organization/InviteFriendsToOrg.tsx` |
| `is_above(p_org uuid, p_user uuid)` | DEFINER | `""` | - | oui | oui | ~`src/components/organization/audience.helpers.ts`<br>~`src/components/organization/member-bulk.helpers.ts`<br>~`src/components/organization/visibility.helpers.ts` |
| `is_admin()` | DEFINER | `""` | - | oui | oui | `src/modules/admin/repository.ts`<br>`supabase/functions/affiliation-api/index.ts`<br>`supabase/functions/stripe-org-refund/index.ts` |
| `is_allowed_avatar_url(p_url text)` | INVOKER | `""` | - | oui | oui | - |
| `is_org_admin(p_org uuid)` | DEFINER | `""` | - | oui | oui | - |
| `is_org_manager(p_org uuid)` | DEFINER | `""` | - | oui | oui | - |
| `is_org_member(p_org uuid)` | DEFINER | `""` | - | oui | oui | ~`src/components/organization/MemberAccessDialog.tsx`<br>~`src/modules/organizations/types.ts`<br>~`supabase/functions/_shared/org-membership.ts`<br>~`supabase/functions/send-org-invite/index.ts` |
| `leave_organization(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `log_team_task_activity()` (trigger) | DEFINER | `""` | - | - | oui | ~`src/modules/team-projects/demo-seed.ts`<br>~`src/modules/team-projects/local.repository.ts`<br>~`src/modules/team-projects/types.ts` |
| `log_team_task_creation()` (trigger) | DEFINER | `""` | - | - | oui | ~`src/modules/team-projects/types.ts` |
| `manages_user(p_user uuid)` | DEFINER | `""` | - | oui | oui | - |
| `member_departure_impact(p_org uuid, p_user uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/governance.supabase.repository.ts`<br>~`src/components/organization/OffboardMemberDialog.tsx` |
| `my_assign_targets(p_org uuid)` | DEFINER | `""` | - | oui | oui | ~`src/modules/organizations/permissions.ts` |
| `my_managed_user_ids()` | DEFINER | `""` | - | oui | oui | - |
| `my_org_badge_tasks()` | DEFINER | `""` | - | oui | oui | - |
| `my_org_perm(p_org uuid, p_key text)` | DEFINER | `""` | - | oui | oui | ~`src/modules/organizations/permissions.ts`<br>~`src/modules/organizations/roles.hooks.ts`<br>~`src/modules/organizations/roles.types.ts` |
| `my_project_edit_perm(p_org uuid)` | DEFINER | `""` | - | oui | oui | - |
| `my_project_role(p_project uuid)` | DEFINER | `""` | - | oui | oui | - |
| `my_report_perm(p_org uuid, p_key text)` | DEFINER | `""` | - | oui | oui | - |
| `my_role_assign_targets(p_org uuid)` | DEFINER | `""` | - | - | oui | - |
| `my_role_perm(p_org uuid, p_key text)` | DEFINER | `""` | - | - | oui | - |
| `my_team_project_ids(p_org uuid)` | DEFINER | `""` | - | - | oui | ~`src/components/organization/team-audience.helpers.ts` |
| `notify_comment_mention()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `notify_event_scheduled()` (trigger) | DEFINER | `""` | - | - | oui | ~`src/components/organization/AssignEventDialog.tsx` |
| `notify_kr_due()` | DEFINER | `""` | - | - | oui | - |
| `notify_member_position_change()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `notify_project_at_risk()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `notify_task_assignment()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `notify_task_comment()` (trigger) | DEFINER | `""` | - | - | oui | ~`src/modules/organizations/notifications.ts` |
| `notify_team_project_archived()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `notify_team_task_automations()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `notify_team_task_status()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `offboard_org_member(p_org uuid, p_user uuid, p_tasks_to uuid, p_reports_to uuid, p_leads_to uuid, p_projects_to uuid, p_krs_to uuid, p_mode text)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/governance.supabase.repository.ts`<br>~`src/components/organization/MemberDirectory.tsx`<br>~`src/components/organization/MemberLifecycleActions.tsx`<br>~`src/components/organization/OffboardMemberDialog.tsx`<br>~`src/modules/organizations/governance.local.repository.ts`<br>~`src/modules/organizations/hooks.ts` |
| `org_admin_count(p_org uuid)` | DEFINER | `""` | - | - | oui | - |
| `org_member_can_invite(p_org uuid, p_user uuid)` | DEFINER | `""` | - | - | oui | - |
| `org_member_default_perm(p_org uuid, p_key text)` | DEFINER | `""` | - | - | oui | ~`src/modules/organizations/permissions.ts` |
| `org_notifications_to_email(p_mode text)` | DEFINER | `""` | - | - | oui | `supabase/functions/org-digest/index.ts` |
| `org_saved_view_before_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `org_seats_allowed(p_org uuid)` | DEFINER | `""` | - | oui | oui | ~`src/components/organization/OrgBillingSeats.tsx`<br>~`src/pages/OrganizationPage.tsx`<br>~`supabase/functions/_shared/seat-alert-text.ts`<br>~`supabase/functions/seat-alert/index.ts`<br>~`supabase/functions/stripe-webhook/index.ts` |
| `org_settings_before_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `org_team_before_update()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/org-teams/supabase.repository.ts` |
| `org_verified_domain_before_insert()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `org_webhook_before_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `org_webhook_deliveries_due(p_limit integer)` | DEFINER | `""` | - | - | oui | `supabase/functions/org-webhook-dispatch/index.ts` |
| `orgs_due_for_renewal_notice(p_min_days integer, p_max_days integer)` | DEFINER | `""` | - | - | oui | `supabase/functions/renewal-notice/index.ts` |
| `orgs_for_seat_alert()` | DEFINER | `""` | - | - | oui | `supabase/functions/seat-alert/index.ts` |
| `orgs_missing_renewal_notice()` | DEFINER | `""` | - | - | oui | `supabase/functions/renewal-notice/index.ts` |
| `owns_task(p_task_id uuid)` | DEFINER | `""` | - | oui | oui | ~`src/modules/friends/share-link.repository.ts` |
| `payment_records_affiliate()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `post_kr_checkin(p_kr uuid, p_value numeric, p_status text, p_note text)` | INVOKER | `""` | - | oui | oui | `src/modules/team-okrs/execution.supabase.repository.ts`<br>~`src/modules/team-okrs/execution.local.repository.ts`<br>~`src/modules/team-okrs/local.repository.ts`<br>~`src/modules/team-okrs/types.ts` |
| `prevent_org_immutables()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `prevent_task_dependency_cycle()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/tasks/local.repository.ts` |
| `prevent_team_task_dependency_cycle()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `prevent_user_id_change()` (trigger) | INVOKER | `public, pg_temp` | - | - | oui | - |
| `preview_share_link(p_token uuid)` | DEFINER | `""` | oui | oui | oui | `src/modules/friends/share-link.hooks.ts`<br>~`src/pages/InvitePage.tsx` |
| `profiles_affiliation_frozen()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `prune_declined_org_invitations()` | DEFINER | `""` | - | - | oui | - |
| `prune_processed_stripe_events()` | DEFINER | `""` | - | - | oui | `supabase/functions/stripe-webhook/index.ts` |
| `purge_archived_team_project(p_project uuid)` | INVOKER | `""` | - | oui | oui | `src/modules/team-projects/audience.repository.ts`<br>~`src/components/organization/ProjectBulkBar.tsx`<br>~`src/modules/team-projects/local.repository.ts`<br>~`src/modules/team-projects/repository.ts` |
| `purge_expired_email_invitations()` | DEFINER | `""` | - | - | oui | - |
| `purge_org_audit_log()` | DEFINER | `""` | - | - | oui | ~`src/components/organization/OrgAuditLogSection.tsx` |
| `purge_project_memberships_on_leave()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `purge_stale_rate_limits()` | DEFINER | `""` | - | - | oui | `supabase/functions/_shared/rate-limit.ts` |
| `purge_team_okr(p_okr uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-okrs/supabase.repository.ts`<br>~`src/components/organization/TeamTrashDialog.tsx` |
| `purge_team_okr_trash()` | DEFINER | `""` | - | - | oui | ~`src/modules/team-okrs/constants.ts` |
| `purge_team_task(p_task uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts`<br>~`src/components/organization/TeamTrashDialog.tsx` |
| `purge_team_task_trash()` | DEFINER | `""` | - | - | oui | ~`src/modules/team-projects/constants.ts` |
| `purge_traffic()` | INVOKER | `""` | - | - | oui | - |
| `purge_user_from_team_assignments(p_user uuid)` | DEFINER | `""` | - | - | oui | `supabase/functions/delete-account/index.ts` |
| `record_demo_conversion(p_device_id uuid)` | DEFINER | `""` | - | oui | oui | `src/lib/demo-metrics.ts` |
| `record_demo_visit(p_device_id uuid)` | DEFINER | `""` | oui | oui | oui | `src/lib/demo-metrics.ts` |
| `record_support_report(p_category text)` | DEFINER | `""` | - | - | oui | `supabase/functions/report-bug/index.ts` |
| `regenerate_join_code(p_org uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `release_member_work(p_org uuid, p_user uuid)` | DEFINER | `""` | - | - | oui | ~`src/modules/organizations/local.repository.ts` |
| `remove_friendship(p_friend_row_id uuid)` | DEFINER | `public, pg_temp` | - | oui | oui | `src/modules/friends/supabase.repository.ts` |
| `remove_member(p_org uuid, p_user uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `remove_task_from_list(p_task_id uuid, p_list_id uuid)` | INVOKER | `public, pg_temp` | - | oui | oui | `src/modules/lists/supabase.repository.ts` |
| `request_join_organization(p_code text)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `reset_stripe_identifiers(p_apply boolean)` | INVOKER | `""` | - | - | oui | ~`supabase/functions/_shared/stripe-errors.ts` |
| `resolve_profile_by_email(p_email text)` | DEFINER | `""` | - | oui | oui | `src/modules/friends/supabase.repository.ts` |
| `resolve_profiles_by_emails(p_emails text[])` | DEFINER | `""` | - | oui | oui | `src/modules/friends/supabase.repository.ts` |
| `respond_join_request(p_request_id uuid, p_accept boolean)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `respond_org_invitation(p_invitation uuid, p_accept boolean)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `restore_team_okr(p_okr uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-okrs/supabase.repository.ts` |
| `restore_team_task(p_task uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts` |
| `run_overdue_reminders()` | DEFINER | `""` | - | - | oui | - |
| `run_team_task_automations()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `sanitize_display_name(raw text)` | INVOKER | `""` | oui | oui | oui | - |
| `seal_payment_period(p_month date)` | DEFINER | `""` | - | - | oui | - |
| `seal_payment_record()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `search_org(p_org uuid, p_query text, p_limit integer)` | INVOKER | `""` | - | oui | oui | `src/modules/organizations/governance.supabase.repository.ts`<br>~`src/components/CommandPalette.tsx`<br>~`src/components/organization/org-search.helpers.ts`<br>~`src/modules/organizations/governance.types.ts` |
| `seed_default_categories()` (trigger) | DEFINER | `public, pg_temp` | - | - | oui | - |
| `set_friend_request_receiver_id()` (trigger) | DEFINER | `public, pg_temp` | - | - | oui | - |
| `set_friend_request_sender_email()` (trigger) | DEFINER | `public, pg_temp` | - | - | oui | - |
| `set_key_result_completed_at()` (trigger) | INVOKER | `public, pg_temp` | - | - | oui | - |
| `set_member_access(p_org uuid, p_user uuid, p_suspended boolean, p_expires_at timestamp with time zone)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/governance.supabase.repository.ts`<br>~`src/components/organization/MemberDirectory.tsx`<br>~`src/components/organization/MemberLifecycleActions.tsx`<br>~`src/modules/organizations/governance.local.repository.ts` |
| `set_member_manager(p_org uuid, p_user uuid, p_manager uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts`<br>~`src/components/organization/member-bulk.helpers.ts`<br>~`src/components/organization/pyramid.helpers.ts` |
| `set_member_role(p_org uuid, p_user uuid, p_role text)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `set_tasks_updated_at()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[])` | DEFINER | `""` | - | oui | oui | `src/modules/team-okrs/supabase.repository.ts` |
| `shares_org_with(p_target uuid)` | DEFINER | `""` | - | oui | oui | - |
| `sync_profile_email()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `sync_task_status()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/tasks/status-sync.ts`<br>~`src/modules/tasks/types.ts` |
| `sync_team_task_status()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/team-projects/local.repository.ts` |
| `team_automation_before_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_okr_trash_guard()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_project_dependency_before_insert()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid)` | DEFINER | `""` | - | oui | oui | - |
| `team_project_health_stamp()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_project_member_before_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_project_status_before_write()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_task_before_update()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_task_validation_gate()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `team_task_webhook_events()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `toggle_habit_completion(p_habit_id uuid, p_date text)` | INVOKER | `public, pg_temp` | - | oui | oui | - |
| `toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date)` | INVOKER | `""` | - | oui | oui | `src/modules/habits/supabase.repository.ts`<br>~`src/modules/habits/mappers.ts` |
| `toggle_task_bookmark(p_task_id uuid)` | INVOKER | `public, pg_temp` | - | oui | oui | `src/modules/tasks/supabase.repository.ts` |
| `toggle_task_complete(p_task_id uuid)` | INVOKER | `public, pg_temp` | - | oui | oui | - |
| `toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone)` | INVOKER | `public, pg_temp` | - | oui | oui | `src/modules/tasks/supabase.repository.ts`<br>~`src/components/task-board/board.helpers.ts`<br>~`src/components/task-board/use-move-task.ts`<br>~`src/modules/tasks/local.repository.ts`<br>~`src/modules/tasks/recurrence.ts`<br>~`src/modules/tasks/status-sync.ts`<br>~`src/modules/tasks/types.ts` |
| `touch_last_seen()` | DEFINER | `""` | - | oui | oui | `src/modules/auth/AuthContext.tsx` |
| `track_hit(p jsonb)` | INVOKER | `""` | - | - | oui | ~`api/collect.ts` |
| `transfer_org_ownership(p_org uuid, p_new_owner uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/organizations/supabase.repository.ts` |
| `trash_team_okr(p_okr uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-okrs/supabase.repository.ts` |
| `trash_team_task(p_task uuid)` | DEFINER | `""` | - | oui | oui | `src/modules/team-projects/supabase.repository.ts`<br>~`src/components/organization/team-task-rights.ts` |
| `update_updated_at_column()` (trigger) | INVOKER | `public, pg_temp` | - | - | oui | - |
| `validate_org_manager()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `validate_project_team()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `validate_task_dependency()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/tasks/local.repository.ts`<br>~`src/modules/tasks/supabase.repository.ts` |
| `validate_team_kr()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `validate_team_kr_contributors()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `validate_team_kr_project()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `validate_team_membership()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `validate_team_okr_parent()` (trigger) | INVOKER | `""` | - | - | oui | ~`src/modules/team-okrs/local.repository.ts` |
| `validate_team_okr_team()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `validate_team_task()` (trigger) | DEFINER | `""` | - | - | oui | - |
| `validate_team_task_dependency()` (trigger) | INVOKER | `""` | - | - | oui | - |
| `verify_payment_chain()` | DEFINER | `""` | - | - | oui | - |
| `write_org_audit(p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_target_user uuid, p_meta jsonb)` | DEFINER | `""` | - | - | oui | - |
