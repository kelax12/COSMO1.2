# Organisations · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Ce fichier est chargé
> automatiquement dès qu un fichier de ce dossier est lu ou édité, et lui seul.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

## 🧭 Navigation : une route par section (2026-09-23)

`/entreprise/<section>` (`tasks`, `projects`, `okr`, `stats`, `pyramid`, `members`, `billing`),
l'Aperçu restant `/entreprise`. Desktop : panneau à droite (`OrgSideNav`), monté par portail dans
l'emplacement que `Layout` pose hors de `<main>` (`page-right-rail.ts`). Mobile : `OrgSectionSwitcher`.
Liste des sections : `org-sections.ts` ; chemins et liens : `deep-link.helpers.ts` (`buildOrgLink`).

- 🔴 **Ne JAMAIS retirer la redirection `?tab=`** (`legacyOrgTabRedirect`). Stripe
  (`stripe-org-checkout`, `stripe-org-portal`) et les e-mails déjà envoyés par `renewal-notice`
  pointent sur `/entreprise?tab=billing` : ces URLs vivent hors du dépôt.
- ❌ Ne jamais écrire un lien entreprise à la main : passer par `buildOrgLink`.
- **Personnes · Équipes · Paramètres** (audit Membres du 2026-09-24, « quatre pages en une ») :
  `members` ne porte plus que l'annuaire, `teams` la liste des équipes et `teams/<id>` la page
  d'une équipe (`TeamPage`, id lu par `readTeamIdSegment`), `settings` les invitations et la zone
  de danger. ❌ Ne jamais renommer le segment `members` : des liens `?member=` et des e-mails y
  pointent. Une seule route `entreprise/:section?/:entityId?`, pour ne pas remonter la page.
- **Page d'équipe** : fiche éditable (nom, couleur, description, mig. 163) par `can_manage_team`
  (admin, créateur, responsable). `org_id` et `created_by` d'une équipe sont figés par trigger.
- **Retirer un membre passe TOUJOURS par l'assistant de départ** (`OffboardMemberDialog`,
  `offboard_org_member`, mig. 161), depuis l'annuaire comme depuis la pyramide. ❌ Ne jamais
  remonter un retrait nu : il laissait tâches, subordonnés, rôles de responsable et KR orphelins.
- **Paramètres** (`/entreprise/settings`, M13, 2026-09-24) : profil, organisations, forfait,
  zone dangereuse, et les invitations depuis l'audit Membres (`OrgSettingsSection`).
  La garde C-39 (`org-deletion.guard.test.ts`) suit la zone dangereuse jusque-là.
- **Épinglés / Récents** du panneau (`org-pins.ts`) : préférence par personne et par appareil,
  donc `localStorage`, jamais la base. Une ouverture `?project=` est notée comme récente.
- **Toast « Vous encadrez maintenant X »** (`org-page.hooks.ts`) : seul le passage non → oui
  le déclenche ; la première visite ENREGISTRE l'état sans rien dire.

## 🏠 Aperçu : lectures CIBLÉES, jamais l'organisation entière (2026-09-24)

`MyWorkTab` lisait l'ensemble de travail de toute l'organisation (plafond 1 000) pour n'en
garder que mes tâches. Chaque bloc passe désormais par `useTeamTaskSlice(orgId, filtres)` :
`assigneeId: moi`, « 30 prochaines échéances », « mes tâches créées en revue », créations
récentes, et une lecture par `ids` pour nommer le reste. Le serveur filtre AVANT le plafond.

- ❌ Ne pas y remonter `useTeamTasks` / `useTeamTaskWorkingSet` : une tâche à moi retomberait
  sous le plafond dans une grande organisation.
- Le fil d'activité lit `team_task_activity` (mig. 094). Le journal ne voit que les UPDATE :
  les créations viennent des tâches récentes. Dérivations pures : `my-work.helpers.ts`.
- `isManager` vient de la PAGE, comme pour Projets et Tâches (l'Aperçu passait `isAdmin`).
- Depuis le 2026-10-19 l'Aperçu est une grille de widgets ([`src/components/CLAUDE.md`](../../components/CLAUDE.md)) :
  les tâches sont lues dans `MyWorkTab` / `MyWorkSections` et passées aux widgets ; un widget peut
  lire une source ÉTROITE (invitations, commentaires d'une tâche), jamais l'ensemble de travail
  (relu le 2026-10-20 : aucun widget n'appelle `useTeamTasks`).

---

## 📊 Rapports (mig. 202)

Droits `report.org` / `report.allTeams` : défaut admin seulement.
❌ Ni attribution, ni modification, ni création, ni événement `is_private` dans un rapport.

## 🔐 Permissions entreprise — surcharge, jamais remplacement (mig. 115)

Les droits du mode entreprise sont **dérivés par défaut** (`is_org_admin`, `is_org_manager`) et
**surchargeables par membre** depuis l'annuaire → menu « … » → **Modifier les permissions**.

- Table `org_member_permissions (org_id, user_id)`, colonnes booléennes **NULLables** :
  `NULL` = suit le défaut dérivé, `true`/`false` = décision explicite. Une organisation sans
  aucune ligne se comporte **exactement** comme avant la mig. 115 — c'est ce qui rend le
  déploiement réversible.
- Treize droits (`task.create` · `task.editAny` · `task.deleteAny` · `project.create` ·
  `project.edit` · `project.delete` · `okr.create` · `okr.delete` · `category.manage` · `team.create` ·
  `member.invite`) + une portée d'assignation cumulable
  (`self` · `peers` · `manager` · `subordinates` · `everyone`, `{}` = personne).
- Côté client, **une seule source de vérité** : `src/modules/organizations/permissions.ts`
  (fonctions pures, miroir du SQL) exposé par `useMyOrgPermissions(orgId)`. Aucun composant ne
  recalcule un droit ; le hook lit l'utilisateur via `useAuth`, jamais via une prop.

- ❌ **Ne jamais gater une création/suppression par `isManager`.** `isManager` ne désigne plus
  qu'une **position** (onglets Pyramide et Statistiques, dépendances de tâches) ; un droit passe
  par `can['<clé>']`.
- ❌ **Ne jamais enregistrer un instantané des onze droits.** La fiche n'écrit que les lignes
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
- 🔴 **Supprimer une équipe ne rend JAMAIS rien visible par toute l'organisation** (mig. 151, M5).
  `team_projects.team_id` et `team_okr_teams.team_id` sont en `NO ACTION` : la base refuse tant
  qu'un projet ou un OKR y est rattaché, y compris ceux que l'appelant ne voit pas. La sortie est
  `delete_team_with_transfer` (INVOKER, atomique), via `DeleteTeamDialog`.
  ❌ Ne jamais remettre `SET NULL`/`CASCADE`, ni proposer « toute l'entreprise » comme cible : `NULL`
  y signifie « visible par tous ». Un changement d'équipe de projet passe par
  `ConfirmProjectAudienceDialog`, qui nomme la nouvelle audience.
- ⚠️ **L'archivage d'un projet est un UPDATE**, jamais un DELETE. Détail : [`docs/UI-PATTERNS.md`](../../../docs/UI-PATTERNS.md) § « Mode entreprise ».
- 🔴 **Modifier un projet = `project.edit`, OU responsable encore membre.** Plus `project.create`.
  Le responsable ne change ni `team_id` (audience, M5), ni `owner_id`, ni `is_template` : c'est le
  trigger `enforce_team_project_edit_scope` (INVOKER), une policy ne sait pas juger une colonne.
- 🔴 **Créer un projet avec tâches ou jalons passe par `create_team_project_with_tasks`** (INVOKER,
  une transaction). ❌ Ne jamais revenir à une boucle de `mutateAsync` : un échec au milieu laissait
  un projet à moitié créé. Duplication et « partir d'un modèle » empruntent la même RPC.
- ❌ **Un modèle ne contient JAMAIS de vraies tâches** : son contenu est `template_payload`
  (décalages en jours). De vraies tâches remonteraient dans « Mes tâches » et les statistiques.
  `useTeamProjects` EXCLUT les modèles (`select`) ; ils se lisent par `useTeamProjectTemplates`.
- ❌ **La catégorie ne réécrit plus `color`.** Elle s'affiche en pastille à sa propre couleur ;
  `projectColorFromCategory` n'a plus d'appelant dans l'onglet Projets.
- ⚠️ `my_org_perm` de la 153 part du corps de la **152** (`task.deleteAny` = manager) : appliquer
  la 152 AVANT, sinon la 152 retirerait `project.edit`.

### 🏷️ Rôles personnalisés à durée limitée (mig. 219, 2026-10-12)

Spec : [`docs/superpowers/specs/2026-10-12-roles-personnalises-design.md`](../../../docs/superpowers/specs/2026-10-12-roles-personnalises-design.md).
`org_roles` (paquet nommé de droits) + `org_member_roles` (attribution, `ends_at` NULL = sans limite).
Fichiers : `roles.*` ; écrans `OrgRolesSettings`, `RoleEditorSheet` (une modale centrée depuis le 2026-10-19, malgré son nom), `AssignRoleDialog` (crée aussi un rôle depuis l'attribution).

- 🔴 **Ordre de résolution, non-admin** : rôles actifs (OU logique) > fiche individuelle > défaut.
  Un rôle actif ÉCRASE tout : une clé absente est refusée, même `task.create`.
- 🔴 **La couche rôle s'insère dans les QUATRE résolveurs** (`my_org_perm`, `my_project_edit_perm`,
  `my_report_perm`, `my_assign_targets`), juste après le court-circuit admin. ❌ Réécrire l'un d'eux
  sans `my_role_perm` / `my_role_assign_targets` en tête rendrait les rôles inopérants sur ce droit.
- 🔴 **L'expiration se juge à la lecture** (`ends_at > now()`), jamais par une purge. Le job
  `cosmo-expire-org-roles` (horaire) ne fait que notifier (`role_changed`, `meta.change =
  custom_role_expired`) et journaliser (`role.expired`).
- ❌ Jamais de rôle sur un admin (trigger) ; un membre promu admin garde une ligne inerte.
- `role.manage` : défaut admin seul, droit de CONFIANCE (aucun plafond sur le contenu d'un rôle).
- Le départ d'un membre emporte ses attributions (FK composite vers `organization_members`).

### 🧭 Étape 6 (mig. 190-193, 2026-09-25) : rôles de projet, recherche, vues

En prod **sans ligne au ledger** (relu au catalogue le 2026-09-30, cf. `supabase/migration/CLAUDE.md`).

- 🔴 `team_project_members` : `lead`/`contributor`/`viewer`. Le lecteur est refusé par TRIGGER
  (une policy PERMISSIVE ne retire rien) ; un admin n'est jamais restreint ; tout helper exige un
  membre ACTIF. Preuve : `supabase/proofs/190-193.proof.sql` (55 cas).
- ❌ Ne pas recalculer un avancement ou une charge sur `useTeamTasks` : `useTeamProjectTaskStats`
  / `useTeamMemberWorkload` comptent en base, sur TOUTES les tâches.
- La palette lit `search_org` par `search.hooks.ts` : ❌ jamais `governance.hooks` depuis l'entrée.
- Une vue enregistrée ne DONNE rien : ses filtres se relisent sous la RLS, et se valident (URL).

### 📬 Boîte de réception (mig. 129) et pastille (mig. 142)

Récit, preuves et règles complètes : [`docs/PERFORMANCE.md`](../../../docs/PERFORMANCE.md)
§ « La boîte de réception d'entreprise » et « La pastille COMPTE ».

- 🔴 `get_my_org_inbox()` est `SECURITY INVOKER` : agréger des lectures, oui ; des autorisations, jamais.
- ❌ Jamais de `p_org`, jamais de borne globale (200 / 50 **par organisation**), jamais
  d'invalidation par section dans `useOrgInboxRealtime` : une seule clé, `orgKeys.inbox()`.
- ❌ Hors démo, `useOrgBadges` ne monte pas `useTeamTasks`. Ne jamais faire compter une ligne
  `notified`, ne jamais passer `lastSeen` au serveur.
- Gardes : `organizations/inbox.hooks.test.tsx`, `src/lib/hooks/org-badges.server-count.test.tsx`.

---

## ⚙️ Configuration d'entreprise (mig. 195-199, non appliquées)

Module `org-config`, écrans `components/organization/config/`, via `org-config.lazy.ts`.
- ❌ `getOrgConfigRepository` hors de `repository.factory` (chunk d'entrée).
- 🔴 Un lien hiérarchique secondaire ne donne AUCUN droit.

## 🪟 Popups, confirmations, cas limites (audit 2026-09-24)

Détail : [`docs/UI-PATTERNS.md`](../../../docs/UI-PATTERNS.md) § « Mode entreprise ».

- ❌ Personnes : `MemberPickList` seul. Création d'équipe ou de projet : `org-create.context` seul.
- ❌ `window.confirm` : passer par `OrgConfirmDialog` (garde `org-confirm.guard`).
- 🔴 Un retrait passe par l'assistant de départ (`useMemberLifecycle`).
- 🔴 `orgAdmin` : tout chargeur d'un écran qui s'en sert le déclare.
- ⚠️ Migrations non appliquées : [`supabase/migration/CLAUDE.md`](../../../supabase/migration/CLAUDE.md).
