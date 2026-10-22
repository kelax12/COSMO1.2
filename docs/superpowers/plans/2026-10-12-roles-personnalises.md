# Rôles personnalisés à durée limitée · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un admin (ou un détenteur de `role.manage`) crée des rôles nommés qui fixent les droits
du mode entreprise, et les attribue à des membres pour une durée choisie.

**Architecture :** deux tables (`org_roles`, `org_member_roles`) et une couche « rôles » insérée en
tête de chacun des quatre résolveurs SQL existants, juste après le court-circuit admin.
L'expiration est vérifiée à la lecture (`ends_at > now()`) ; un job horaire ne fait que notifier et
journaliser. Côté client, `permissions.ts` reste le miroir pur du SQL, un sous-module `roles.*` porte
les données (Supabase + démo), trois écrans suivent les maquettes 1, 2, 3.

**Spec :** [`docs/superpowers/specs/2026-10-12-roles-personnalises-design.md`](../specs/2026-10-12-roles-personnalises-design.md)

**Tech :** Postgres 17 (Supabase), React 18, TanStack Query 5, Vitest, catalogues i18n maison.

---

## Faits relus au catalogue le 2026-10-12 (base du plan)

- Ledger : dernière entrée `218_events_no_category_light_gray` → la migration est la **`219`**.
- Corps vivants relus par `pg_get_functiondef` : `my_org_perm` (corps de la 152),
  `my_project_edit_perm` (153), `my_report_perm` (202), `my_assign_targets` (115),
  `enforce_org_permission_ceiling` (202), `audit_org_change` (162 + 216). La 219 repart de **ces**
  corps, pas des fichiers.
- Seuls ces quatre résolveurs lisent `org_member_permissions` ; tout le reste appelle `my_org_perm`
  et hérite de la couche rôle sans réécriture.
- `organization_members` : PK `(org_id, user_id)` → une FK composite `ON DELETE CASCADE` purge les
  attributions au départ (assistant de départ, retrait, `leave_organization`), sans trigger.
- `org_notifications.kind` a un `CHECK` fermé ; `role_changed` existe et se distingue par
  `meta.change` (`notifications.helpers.ts`). Sourdine appliquée par le trigger
  `drop_muted_org_notification` : rien à faire.
- `org_audit_log` : aucun `CHECK` sur `action` / `target_type`.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migration/219_org_custom_roles.sql` | tables, RLS, triggers, couche rôle, 4 résolveurs, plafond, audit, job |
| `supabase/proofs/219.proof.sql` | preuve acteur par acteur, bloc `DO` terminé par `RAISE` |
| `src/modules/organizations/permissions.ts` | `role.manage` ; `effectivePermissions` / `effectiveAssignTargets` prennent `roles` |
| `src/modules/organizations/roles.types.ts` | types `OrgCustomRole`, `OrgRoleAssignment`, entrées |
| `src/modules/organizations/roles.helpers.ts` | actif, rôles actifs d'un membre, calcul de date de fin, résumé |
| `src/modules/organizations/roles.repository.ts` | interface `IOrgRolesRepository` |
| `src/modules/organizations/roles.supabase.repository.ts` | implémentation Supabase |
| `src/modules/organizations/roles.local.repository.ts` | implémentation démo (localStorage) |
| `src/modules/organizations/roles.hooks.ts` | requêtes et mutations |
| `src/lib/repository.factory.ts`, `src/lib/demo-repositories.ts` | `getOrgRolesRepository()` |
| `src/modules/organizations/use-my-permissions.ts` | lit mes rôles actifs |
| `src/components/organization/PermissionSwitch.tsx` | interrupteur extrait de `MemberPermissionsSheet` |
| `src/components/organization/OrgRolesSettings.tsx` | maquette 1 (Paramètres › Rôles) |
| `src/components/organization/RoleEditorSheet.tsx` | maquette 2 (feuille latérale) |
| `src/components/organization/AssignRoleDialog.tsx` | maquette 3 (attribuer, prolonger, retirer) |
| `MemberDirectoryRow.tsx`, `MemberDirectory.tsx`, `OrgSettingsSection.tsx`, `MemberPermissionsSheet.tsx` | branchements |
| `notifications.helpers.ts`, `OrgNotificationsPanel.tsx`, `audit-log.helpers.ts` | expiration et journal lisibles |
| `src/locales/{fr,en}/orgAdmin.json`, `org.json` | libellés |

---

### Tâche 1 · Migration 219

**Fichiers :** créer `supabase/migration/219_org_custom_roles.sql`.

- [ ] **1.1** Colonne `org_member_permissions.can_manage_roles boolean` (NULL = défaut admin seul).
- [ ] **1.2** Tables :

```sql
CREATE TABLE public.org_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  granted_keys text[] NOT NULL DEFAULT '{}' CHECK (granted_keys <@ ARRAY[<14 clés>]),
  assign_targets text[] NOT NULL DEFAULT '{self}' CHECK (assign_targets <@ ARRAY['self','peers','manager','subordinates','everyone']),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX org_roles_org_name_uidx ON public.org_roles (org_id, lower(btrim(name)));

CREATE TABLE public.org_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expiry_notified_at timestamptz,
  CONSTRAINT org_member_roles_member_fkey FOREIGN KEY (org_id, user_id)
    REFERENCES public.organization_members(org_id, user_id) ON DELETE CASCADE,
  CONSTRAINT org_member_roles_period_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT org_member_roles_role_user_key UNIQUE (role_id, user_id)
);
CREATE INDEX org_member_roles_org_user_idx ON public.org_member_roles (org_id, user_id);
CREATE INDEX org_member_roles_expiry_idx ON public.org_member_roles (ends_at) WHERE expiry_notified_at IS NULL AND ends_at IS NOT NULL;
```

- [ ] **1.3** RLS : SELECT `is_org_member(org_id)` ; INSERT / UPDATE / DELETE
  `is_org_admin(org_id) OR my_org_perm(org_id, 'role.manage')`. Une policy par action.
- [ ] **1.4** Triggers `INVOKER`, `REVOKE` à `PUBLIC, anon, authenticated` :
  - `enforce_org_role_write` (org_roles, BEFORE INSERT/UPDATE) : `created_by := auth.uid()` à
    l'insertion ; `org_id` et `created_by` figés ; `updated_at := now()` ; `granted_keys`
    dédoublonné et trié (`ARRAY(SELECT DISTINCT unnest ORDER BY 1)`), idem `assign_targets`.
  - `enforce_org_member_role_write` (org_member_roles, BEFORE INSERT/UPDATE) : rôle de la même
    organisation ; cible jamais admin (`RAISE 'org_member_roles: an admin always holds every permission'`) ;
    `granted_by := auth.uid()` à l'insertion ; `org_id`, `role_id`, `user_id` figés ; si `ends_at`
    change, `expiry_notified_at := NULL`.
- [ ] **1.5** Couche rôle, `SECURITY DEFINER`, `search_path ''`, **aucun** `EXECUTE` hors
  propriétaire (appelée seulement depuis les résolveurs DEFINER) :

```sql
CREATE FUNCTION public.my_role_perm(p_org uuid, p_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE bool_or(p_key = ANY (r.granted_keys)) END
    FROM public.org_member_roles mr JOIN public.org_roles r ON r.id = mr.role_id
   WHERE mr.org_id = p_org AND mr.user_id = (SELECT auth.uid())
     AND mr.starts_at <= now() AND (mr.ends_at IS NULL OR mr.ends_at > now());
$function$;

CREATE FUNCTION public.my_role_assign_targets(p_org uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT CASE WHEN count(DISTINCT mr.id) = 0 THEN NULL
              ELSE COALESCE(array_agg(DISTINCT t.target) FILTER (WHERE t.target IS NOT NULL), '{}'::text[]) END
    FROM public.org_member_roles mr JOIN public.org_roles r ON r.id = mr.role_id
    LEFT JOIN LATERAL unnest(r.assign_targets) AS t(target) ON true
   WHERE mr.org_id = p_org AND mr.user_id = (SELECT auth.uid())
     AND mr.starts_at <= now() AND (mr.ends_at IS NULL OR mr.ends_at > now());
$function$;
```

- [ ] **1.6** Les quatre résolveurs, corps vivants + `public.my_role_perm(...)` en tête du `COALESCE` :
  `my_org_perm` (+ `WHEN 'role.manage' THEN p.can_manage_roles`, défaut déjà `false`),
  `my_project_edit_perm`, `my_report_perm`, `my_assign_targets` (`my_role_assign_targets` en tête).
- [ ] **1.7** `enforce_org_permission_ceiling` : ligne `(NEW.can_manage_roles, 'role.manage')`.
- [ ] **1.8** `audit_org_change` : corps vivant + deux branches. `org_roles` → `role.created` /
  `role.updated` / `role.deleted`, `target_type 'role'`, `meta {name}`. `org_member_roles` →
  `role.assigned` (`meta {role_id, name, endsAt}`), `role.revoked`, `role.extended`
  (`meta {name, from, to}` quand `ends_at` change). Le `pg_trigger_depth() > 1` existant tait les
  suppressions en cascade (rôle supprimé, membre parti). Triggers AFTER sur les deux tables.
- [ ] **1.9** `expire_org_member_roles()` DEFINER, `REVOKE` à tous : boucle `FOR UPDATE SKIP LOCKED`
  sur `ends_at <= now() AND expiry_notified_at IS NULL` ; notification `role_changed`
  `meta {change:'custom_role_expired', for:'holder', role_name}` au membre, et
  `meta {…, for:'granter', member_id}` à `granted_by` s'il est encore membre et n'est pas le membre ;
  `write_org_audit(org, 'role.expired', 'member', role_id, user_id, {name})` ; puis
  `expiry_notified_at := now()`. Job `cosmo-expire-org-roles`, `'7 * * * *'`.
- [ ] **1.10** Commit `feat(db): mig. 219, roles personnalises a duree limitee (NON appliquee)`.

### Tâche 2 · Preuve 219

**Fichier :** `supabase/proofs/219.proof.sql`, forme de la 217 (migration exécutée dans le bloc,
passe témoin avec `proof.skip_migration`).

Acteurs : `A` admin, `G` membre avec `role.manage` individuel, `M` membre ordinaire, `X` membre
sans rien, organisation `O`. Cas :

1. `M` sans rôle : `task.create` vrai, `project.create` faux (défaut inchangé).
2. Rôle R1 sans `task.create` attribué à `M` → `task.create` faux (le rôle écrase le défaut).
3. Surcharge individuelle `can_create_project = true` sur `M` + R1 sans `project.create` → faux.
4. R2 avec `project.create` en plus → vrai (cumul).
5. R1 et R2 expirés (`ends_at` passé) → retour à la surcharge individuelle (`project.create` vrai).
6. Rôle à `starts_at` futur → inactif.
7. Rôle sur `A` → refusé ; `my_org_perm` de `A` reste vrai partout.
8. `G` crée un rôle et l'attribue à `X` ; `M` (sans `role.manage`) refusé (`42501`).
9. Portée : R1 `{self}` + R2 `{subordinates}` → `my_assign_targets` = l'union.
10. `report.org` et `project.edit` suivent la couche rôle.
11. Suppression d'un rôle → attributions parties, droits d'avant.
12. Départ de `X` (DELETE `organization_members`) → attributions parties.
13. `expire_org_member_roles()` : 2 notifications, 1 entrée `role.expired`, idempotent au second appel.
14. Droits : `anon` et `authenticated` sans `EXECUTE` sur `my_role_perm`, `my_role_assign_targets`,
    `expire_org_member_roles`.

- [ ] **2.1** Écrire la preuve. **2.2** La jouer en prod (bloc qui ne peut que s'annuler) : attendu
  `PREUVE-ANNULEE 0 ECHEC`. **2.3** Passe témoin : les cas 2, 4, 8 doivent échouer. **2.4** Commit.

### Tâche 3 · `permissions.ts`, miroir pur (TDD)

- [ ] **3.1** Tests dans `permissions.test.ts` : défaut sans rôle ; un rôle écrase surcharge et
  défaut ; cumul ; admin insensible ; portée en union ; `role.manage` défaut admin seul.
- [ ] **3.2** Rouge. **3.3** Code :

```ts
export interface ActiveRoleGrant { grantedKeys: readonly OrgPermissionKey[]; assignTargets: readonly OrgAssignTarget[] }

// effectivePermissions({ member, members, overrides, roles = [] })
if (roles.length > 0) { out[key] = roles.some((r) => r.grantedKeys.includes(key)); continue; }

// effectiveAssignTargets({ member, overrides, roles = [] })
if (roles.length > 0) return ORG_ASSIGN_TARGETS.filter((t) => roles.some((r) => r.assignTargets.includes(t)));
```

  `role.manage` rejoint `ORG_PERMISSION_KEYS` et `ADMIN_DEFAULT_KEYS`. **3.4** Vert. **3.5** Commit.

### Tâche 4 · Types, helpers (TDD)

`roles.types.ts` : `OrgCustomRole { id, orgId, name, color, grantedKeys, assignTargets, createdAt,
updatedAt }`, `OrgRoleAssignment { id, orgId, roleId, userId, startsAt, endsAt: string | null,
grantedBy, createdAt }`, `SaveCustomRoleInput`, `AssignRoleInput { orgId, roleId, userId, endsAt }`,
`RoleDuration = 'week' | 'month' | 'quarter' | 'until' | 'unlimited'`, `ROLE_COLORS` (palette des équipes).

`roles.helpers.ts` (tests d'abord) :
- `isAssignmentActive(a, now)` ; `activeAssignmentsOf(assignments, userId, now)` ;
- `activeRolesOf(roles, assignments, userId, now): OrgCustomRole[]` ;
- `computeEndsAt(duration, from: Date, until?: string): string | null` : `addWeeks(1)`,
  `addMonths(1)`, `addMonths(3)`, `until` = début du lendemain local, `unlimited` = `null` ;
- `holdersCount(roleId, assignments, now)`, `expiresSoon(roleId, assignments, now, 7)`.

### Tâche 5 · Repositories

Interface `IOrgRolesRepository` : `getRoles`, `getAssignments`, `createRole`, `updateRole`,
`deleteRole`, `assignRole` (upsert `onConflict: 'role_id,user_id'`, `starts_at = now`),
`setAssignmentEnd`, `revokeAssignment`. Supabase : whitelist de colonnes à l'écriture,
`normalizeApiError`. Démo : clés `cosmo_org_roles`, `cosmo_org_member_roles`, refuse un admin et un
nom en double comme la base (`makeApiError`). Factory paresseuse comme la gouvernance. Ajout de
`role.manage → can_manage_roles` à `PERMISSION_COLUMNS`. Tests du repository démo.

### Tâche 6 · Hooks et `useMyOrgPermissions`

`roles.hooks.ts` : `rolesKeys`, `useOrgRoles`, `useOrgRoleAssignments`, mutations (toasts via
`@/lib/toast`, invalidation `rolesKeys.all`). `useMyOrgPermissions` passe `activeRolesOf(…)` à
`effectivePermissions` / `effectiveAssignTargets` ; `isLoading` inclut les deux lectures.

### Tâche 7 · Écrans

- `PermissionSwitch.tsx` extrait de `MemberPermissionsSheet` (même rendu, `role="switch"`).
- `OrgRolesSettings.tsx` (maquette 1) : nouvelle rubrique `roles` du groupe Accès de
  `OrgSettingsSection`, visible si `isAdmin || can['role.manage']`. Menu « … » : Modifier,
  Dupliquer, Supprimer (`OrgConfirmDialog`, nomme les détenteurs).
- `RoleEditorSheet.tsx` (maquette 2) : portail + `useModalA11y`, nom, couleur, trois colonnes
  (Tâches · Projets · OKR et autres, dont rapports et « Gérer les rôles »), puces de portée.
  Nouveau rôle : tout désactivé, portée `self`.
- `AssignRoleDialog.tsx` (maquette 3) : rôles actuels du membre (date de fin, retirer), sélecteur de
  rôle, durées en puces, `DatePicker` pour « Jusqu'au », phrase de résumé. Réattribuer un rôle
  détenu = prolonger.
- `MemberDirectoryRow` : pastilles des rôles actifs + entrée « Attribuer un rôle » si
  `can['role.manage']` et cible non admin.
- `MemberPermissionsSheet` : bandeau « Les rôles … priment ».
- Notifications et journal : `custom_role_expired`, actions `role.*`, famille `role.`.
- i18n fr / en.

### Tâche 8 · Vérifications, doc, application

`npm run typecheck`, `npm run lint`, `npm test` (lire `$?` et le nombre de fichiers),
`npm run check:docs`, `npm run check:bundle`, gardes i18n. Parcours en démo dans le navigateur.
Doc : `src/modules/organizations/CLAUDE.md`, `docs/MODULES.md`, `supabase/migration/CLAUDE.md`.
Application en prod de la 219 **après accord d'Axel**, relecture au catalogue, PUIS push du front
(la fiche de permissions écrit `can_manage_roles`).
