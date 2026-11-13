# Organisations (`src/modules/organizations`)

Lire en touchant `src/modules/organizations/**`, `org-*`, `components/organization/**`, `/entreprise/**`. UI : [`docs/UI-PATTERNS.md`](../../../docs/UI-PATTERNS.md) § « Mode entreprise ». Migrations en prod : [`supabase/migration/CLAUDE.md`](../../../supabase/migration/CLAUDE.md).
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md).

## Navigation : une route par section

`/entreprise/<section>` (`tasks`, `projects`, `okr`, `stats`, `pyramid`, `members`, `billing`, `teams`, `settings`) ; l'Aperçu reste `/entreprise`. Desktop : `OrgSideNav` monté par portail dans l'emplacement de `Layout` (`page-right-rail.ts`) ; mobile : `OrgSectionSwitcher`. Sections : `org-sections.ts` ; liens : `deep-link.helpers.ts` (`buildOrgLink`).

- 🔴 Ne JAMAIS retirer la redirection `?tab=` (`legacyOrgTabRedirect`) : Stripe (`stripe-org-checkout`, `stripe-org-portal`) et les e-mails de `renewal-notice` pointent sur `/entreprise?tab=billing`, URLs hors dépôt.
- ❌ Un lien entreprise écrit à la main : `buildOrgLink`.
- ❌ Renommer le segment `members` (liens `?member=` et e-mails). Une seule route `entreprise/:section?/:entityId?` pour ne pas remonter la page.
- ✅ `members` = annuaire ; `teams` = liste ; `teams/<id>` = `TeamPage` (id lu par `readTeamIdSegment`) ; `settings` = profil, organisations, forfait, invitations, zone de danger (`OrgSettingsSection` ; garde C-39 `org-deletion.guard.test.ts`).
- ✅ Page d'équipe : fiche éditable (nom, couleur, description, mig. 163) par `can_manage_team` (admin, créateur, responsable) ; `org_id` et `created_by` figés par trigger.
- 🔴 Retirer un membre passe TOUJOURS par l'assistant de départ (`OffboardMemberDialog`, `offboard_org_member`, mig. 161, `useMemberLifecycle`), annuaire comme pyramide. Un retrait nu laisse tâches, subordonnés, responsables et KR orphelins.
- ✅ Épinglés / Récents du panneau (`org-pins.ts`) : préférence par personne et appareil, `localStorage`. Une ouverture `?project=` compte comme récente.

## Aperçu : lectures CIBLÉES

- ❌ `useTeamTasks` / `useTeamTaskWorkingSet` dans l'Aperçu (`MyWorkTab`) : une tâche à moi retombe sous le plafond de 1 000 dans une grande organisation. Chaque bloc passe par `useTeamTaskSlice(orgId, filtres)` (`assigneeId`, 30 prochaines échéances, créées en revue, créations récentes, lecture par `ids`) ; le serveur filtre AVANT le plafond.
- ✅ Fil d'activité : `team_task_activity` (mig. 094), UPDATE seulement ; les créations viennent des tâches récentes. Dérivations pures : `my-work.helpers.ts`. `canEditDependencies` vient de la PAGE.
- ✅ L'Aperçu est une grille de widgets ([`src/components/CLAUDE.md`](../../components/CLAUDE.md)) : les tâches sont lues dans `MyWorkTab` / `MyWorkSections` et passées aux widgets ; un widget lit une source ÉTROITE (invitations, commentaires d'une tâche), jamais l'ensemble.

## Rapports (mig. 202)

- ✅ Droits `report.org` / `report.allTeams` : admin seul par défaut. ❌ Attribution, modification, création ou événement `is_private` dans un rapport.

## Permissions : surcharge, jamais remplacement (mig. 115)

Défaut (admin : tout ; membre : `task.create`, `task.editAny`), surchargeable par membre (annuaire, « Modifier les permissions », admin seul).

- 🔴 Plus de « manager » depuis la mig. 229 : un seul grade, administrateur ; le reste passe par les rôles personnalisés ou la fiche. Encadrer quelqu'un n'ouvre AUCUN droit. L'organigramme est masqué (`org-sections.ts`, `hidden`) ; `manager_id` reste en base, dormant. ❌ `is_org_manager` / `isManagerOf` dans un résolveur, une policy ou un écran visible. Portées d'assignation : `self` / `everyone` (CHECK).
- ⚠️ Reste hiérarchique, en lecture seule : `can_access_team_project`, `can_access_team_okr`, `my_managed_user_ids`, `get_org_member_last_activity`.
- ✅ Défaut membre réglable (mig. 232) : `org_settings.member_default_perms` (`NULL` = défaut historique, `[]` = rien), lu par `org_member_default_perm` (dernier cran des quatre résolveurs) et `useOrgMemberDefaults` → `effectivePermissions({ memberDefaults })`.
- ✅ `org_member_permissions (org_id, user_id)`, booléens NULLables : `NULL` = suit le défaut, `true`/`false` = décision. Sans ligne, comportement d'avant la mig. 115 (déploiement réversible).
- ✅ Droits : `ORG_PERMISSION_KEYS` (`permissions.ts`) fait foi, plus une portée `self` · `everyone` (`{}` = personne).
- ✅ Une seule source côté client : `src/modules/organizations/permissions.ts` (pur, miroir du SQL) via `useMyOrgPermissions(orgId)`. ❌ Recalculer un droit dans un composant ; le hook lit l'utilisateur par `useAuth`, jamais par prop.
- ❌ Gater par une position hiérarchique : les dépendances de tâches suivent `task.editAny` (`canEditDependencies`) ; tout droit passe par `can['<clé>']`.
- ❌ Enregistrer un instantané des droits : la fiche n'écrit que les lignes DÉCIDÉES.
- ❌ Confondre `assign_targets = NULL` (tout le monde) et `{}` (personne).
- ❌ Une ligne sur un admin : `my_org_perm` court-circuite sur `is_org_admin` et le trigger la refuse (sinon un admin peut bloquer son organisation).
- ⚠️ Le contrôle d'assignation ne porte que sur les AJOUTS : retirer un assigné reste permis (tâche héritée, purges RGPD). Sélecteurs : `canAssign(id) || déjà assigné`.
- 🔴 Supprimer une équipe ne rend JAMAIS rien visible à toute l'organisation (mig. 151, M5) : `team_projects.team_id` et `team_okr_teams.team_id` en `NO ACTION`, la base refuse tant qu'un projet ou OKR y est rattaché. Sortie : `delete_team_with_transfer` (INVOKER, atomique) via `DeleteTeamDialog`. ❌ `SET NULL`/`CASCADE`, ou « toute l'entreprise » comme cible (`NULL` = visible par tous). Un changement d'équipe de projet passe par `ConfirmProjectAudienceDialog`.
- ⚠️ Archiver un projet est un UPDATE, jamais un DELETE.
- 🔴 Modifier un projet = `project.edit` OU responsable encore membre (pas `project.create`). Le responsable ne change ni `team_id`, ni `owner_id`, ni `is_template` : trigger `enforce_team_project_edit_scope` (INVOKER).
- 🔴 Créer un projet avec tâches : `create_team_project_with_tasks` (INVOKER, une transaction), aussi pour duplication et « partir d'un modèle ». ❌ Une boucle de `mutateAsync`.
- ❌ Un modèle avec de vraies tâches : son contenu est `template_payload` (décalages en jours) ; `useTeamProjects` EXCLUT les modèles (`select`).
- ❌ La catégorie réécrit `color` : pastille à sa propre couleur (`projectColorFromCategory` sans appelant dans Projets).

### Rôles personnalisés à durée limitée (mig. 219)

`org_roles` + `org_member_roles` (`ends_at` NULL = sans limite). Fichiers `roles.*` ; écrans `OrgRolesSettings`, `RoleEditorSheet` (modale centrée malgré son nom), `AssignRoleDialog`. Spec : [`docs/archive/superpowers/specs/2026-10-12-roles-personnalises-design.md`](../../../docs/archive/superpowers/specs/2026-10-12-roles-personnalises-design.md).

- 🔴 Résolution, non-admin : rôles actifs (OU logique) > fiche individuelle > défaut. Un rôle actif ÉCRASE tout : une clé absente est refusée, même `task.create`.
- 🔴 La couche rôle est dans les QUATRE résolveurs (`my_org_perm`, `my_project_edit_perm`, `my_report_perm`, `my_assign_targets`), juste après le court-circuit admin. ❌ Réécrire l'un sans `my_role_perm` / `my_role_assign_targets` en tête.
- 🔴 L'expiration se juge à la lecture (`ends_at > now()`), jamais par une purge ; le job `cosmo-expire-org-roles` (horaire) notifie (`role_changed`, `meta.change = custom_role_expired`) et journalise (`role.expired`).
- ❌ Un rôle sur un admin (trigger) ; un membre promu admin garde une ligne inerte.
- ✅ `role.manage` : admin seul, droit de CONFIANCE (aucun plafond sur le contenu d'un rôle). Le départ d'un membre emporte ses attributions (FK composite).
- ✅ Rôle des nouveaux membres (mig. 230) : `org_settings.default_role_id` ; trigger `assign_default_org_role` (AFTER INSERT sur `organization_members`), sans limite, jamais sur un admin, jamais rétroactif. Démo : `assignDefaultRoleOnJoin` (`roles.local.repository.ts`). ❌ Un INSERT client sur `organization_members` : le trigger compte sur les quatre fonctions DEFINER d'arrivée.

### Rôles de projet, recherche, vues (mig. 190-193)

Détail : `docs/UI-PATTERNS.md` § « Étape 6 ». ❌ Un lecteur de projet se refuse par TRIGGER, jamais par policy. ❌ Un avancement recalculé sur `useTeamTasks`.

## Boîte de réception (mig. 129) et pastille (mig. 142)

Règles complètes : [`docs/PERFORMANCE.md`](../../../docs/PERFORMANCE.md) § « La boîte de réception d'entreprise » et « La pastille COMPTE ».

- 🔴 `get_my_org_inbox()` est `SECURITY INVOKER` : agréger des lectures, jamais des autorisations.
- ❌ Un `p_org`, une borne globale (200 / 50 **par organisation**), une invalidation par section dans `useOrgInboxRealtime` : une seule clé, `orgKeys.inbox()`.
- ❌ Hors démo, `useOrgBadges` ne monte pas `useTeamTasks` ; ne jamais compter une ligne `notified`, ne jamais passer `lastSeen` au serveur.
- Gardes : `organizations/inbox.hooks.test.tsx`, `src/lib/hooks/org-badges.server-count.test.tsx`.

## Configuration et OKR d'entreprise

- ✅ `org-config` (mig. 195-199) : écrans `components/organization/config/`, via `org-config.lazy.ts`. ❌ `getOrgConfigRepository` hors de `repository.factory` (chunk d'entrée). 🔴 Un lien hiérarchique secondaire ne donne AUCUN droit.
- 🔴 OKR d'entreprise fermés par défaut (mig. 205, 212) : public seulement si `audience = 'org'` ET sans lien ; un OKR fermé qui perd ses liens se referme. Lier un public : RPC `set_team_okr_links` (droit vérifié avant).

## Popups et cas limites

- ❌ Personnes : tout sauf `MemberPickList`. Création d'équipe ou de projet : tout sauf `org-create.context`.
- ❌ `window.confirm` : `OrgConfirmDialog` (garde `org-confirm.guard`).
- 🔴 `orgAdmin` : tout chargeur d'un écran qui s'en sert le déclare.
