# Mode entreprise : rôles personnalisés à durée limitée · design

Statut : conçu avec Axel le 2026-10-12, **à valider avant plan d'implémentation**.
Maquettes retenues (rendues dans la conversation du 2026-10-12) : 1 · Paramètres › Rôles,
2 · Éditeur de rôle (feuille latérale, interrupteurs à deux positions), 3 · Attribuer un rôle
(depuis l'annuaire, menu « … » d'un membre).

## 1. Problème

Les droits du mode entreprise sont dérivés (admin, manager, membre) et surchargeables **membre par
membre** (mig. `115`, fiche « Modifier les permissions »). Une organisation qui veut donner le même
paquet de droits à dix personnes doit régler dix fiches, et rien ne permet de donner un droit pour
une période (remplacement pendant des congés, stagiaire, mission de trois mois).

## 2. Décisions (validées par Axel)

| Sujet | Décision |
|---|---|
| Ce qu'est un rôle | Un nom, une couleur, les droits réglables (interrupteur activé / désactivé) et une portée d'assignation. |
| Sens d'un interrupteur | **Le rôle définit tout.** Activé = accordé, désactivé = refusé, y compris un droit qu'un membre a par défaut. |
| Rôle contre fiche individuelle | **Le rôle écrase tout** : tant qu'un rôle est actif, la fiche individuelle et le défaut dérivé sont ignorés. |
| Plusieurs rôles | Permis. Les droits **s'additionnent** : un droit est accordé si au moins un rôle actif l'active. |
| Durée | Choisie à l'attribution : 1 semaine, 1 mois, 3 mois, « Jusqu'au… » (date), « Sans limite ». |
| Fin d'un rôle | Retour aux droits d'avant (fiche individuelle, sinon défaut). Rien ne bouge sur les tâches, projets, OKR. |
| Prévenir | **Le jour J seulement**, la personne ET celui qui a attribué. Pas de préavis. |
| Qui gère | Nouvelle permission **`role.manage`** (« Gérer les rôles »), défaut admin seulement. Droit de confiance : son détenteur peut créer un rôle et l'attribuer même s'il contient des droits qu'il n'a pas, y compris à lui-même. |

Décisions par défaut annoncées à Axel et non contestées :

- 🔴 **Un admin n'est jamais concerné par un rôle.** `my_org_perm` court-circuite sur `is_org_admin`
  avant toute lecture de rôle ; on ne peut pas attribuer un rôle à un admin (trigger). Sinon une
  organisation peut se bloquer elle-même.
- **Modifier un rôle change immédiatement les droits de tous ses détenteurs.** Jamais d'instantané
  des droits à l'attribution (même règle que la mig. `115`).
- **Prolonger = modifier la date de fin** de l'attribution existante, jamais une seconde ligne.
- **Supprimer un rôle attribué** passe par une confirmation qui nomme les membres concernés ; les
  attributions partent avec lui.
- Chaque création, modification, suppression de rôle, attribution, prolongation, retrait et
  expiration est écrit dans `org_audit_log` (mig. `162`).

## 3. Résolution d'un droit

Pour un non-admin, dans l'ordre :

1. **Au moins un rôle actif** → droit = OU logique des rôles actifs. Fin : on ne lit rien d'autre.
2. Sinon, surcharge individuelle (`org_member_permissions`, mig. `115`) si non `NULL`.
3. Sinon, défaut dérivé (membre / manager / admin seul pour les rapports).

Portée d'assignation : avec au moins un rôle actif, **union** des `assign_targets` des rôles actifs
(un tableau vide dans tous les rôles = personne). Sinon, règle actuelle de la mig. `115`.

**Actif** = `starts_at <= now() AND (ends_at IS NULL OR ends_at > now())`.

### Expiration vérifiée à la lecture (approche retenue)

Le droit tombe parce que la fonction de résolution compare `ends_at` à `now()` à chaque appel, pas
parce qu'un job supprime une ligne. Un job qui ne tourne pas ne laisse donc jamais un droit en place.
Le job planifié ne sert qu'à **prévenir** et à **journaliser**.

Écartée : un job qui supprime les attributions échues. S'il ne tourne pas, la personne garde ses
droits sans que rien ne le montre.

## 4. Base · migration (numéro à confirmer contre le ledger au moment de l'écrire, `219` attendu)

### Tables

`org_roles`
- `id uuid PK`, `org_id uuid NOT NULL → organizations ON DELETE CASCADE`
- `name text NOT NULL` (1 à 40 caractères), unicité `(org_id, lower(name))`
- `color text NOT NULL` (palette fermée, même jeu que les équipes)
- `granted_keys text[] NOT NULL DEFAULT '{}'` : clés activées. `CHECK` : toutes appartiennent à la
  liste fermée des clés (13 actuelles + `role.manage`).
- `assign_targets text[] NOT NULL DEFAULT '{self}'` : `CHECK` sur `self | peers | manager |
  subordinates | everyone`. Pas de `NULL` : un rôle décide toujours.
- `created_by`, `created_at`, `updated_at`
- `org_id` et `created_by` figés par trigger (comme les équipes, mig. `163`).

`org_member_roles`
- `id uuid PK`, `org_id`, `role_id → org_roles ON DELETE CASCADE`, `user_id`
- `starts_at timestamptz NOT NULL DEFAULT now()`, `ends_at timestamptz NULL` (`NULL` = sans limite),
  `CHECK (ends_at IS NULL OR ends_at > starts_at)`
- `granted_by uuid`, `created_at`, `expiry_notified_at timestamptz NULL`
- Unicité `(role_id, user_id)` : réattribuer un rôle échu met à jour la ligne.
- Trigger : refuse si `user_id` est admin de l'org ou n'en est pas membre actif ; `org_id` doit
  être celui du rôle.
- Index `(org_id, user_id)` pour la résolution.

### Fonctions

- **Un seul point d'entrée pour la couche rôle** : `my_role_perm(p_org, p_key) RETURNS boolean`
  (`NULL` = aucun rôle actif), `SECURITY DEFINER`, `search_path` fixé, `REVOKE` `PUBLIC`/`anon`.
  Même chose pour `my_role_assign_targets(p_org) RETURNS text[]`.
- Chaque résolveur existant l'appelle **juste après** le court-circuit admin, en `COALESCE` en tête :
  `my_org_perm` (dernière définition : mig. `152`), le résolveur de `project.edit` (mig. `153`),
  `my_report_perm` (mig. `202`), `my_assign_targets` (mig. `115`). 🔴 Repartir du **corps actuel**
  de chacun (cf. mémoire « migrations concurrentes, fonction réécrite ») : une réécriture depuis
  une version ancienne retirerait un droit.
- Si l'audit montre une variante « droit d'un AUTRE membre » (affichage de l'annuaire, rapports),
  elle reçoit la même couche.
- RLS : lecture de `org_roles` et `org_member_roles` par tout membre de l'org (l'annuaire affiche les
  pastilles) ; écriture si `is_org_admin OR my_org_perm(org, 'role.manage')`.
- `offboard_org_member` (mig. `161`) et la purge RGPD suppriment les attributions du membre.
- Trigger d'audit sur les deux tables vers `org_audit_log`.

### Job planifié (pg_cron, motif de la mig. `199`)

Toutes les heures : attributions avec `ends_at <= now() AND expiry_notified_at IS NULL` →
une notification à `user_id`, une à `granted_by` (s'il est encore membre), une ligne d'audit
`role.expired`, puis `expiry_notified_at = now()`. Idempotent. Une prolongation remet
`expiry_notified_at` à `NULL`.

### Preuve

`supabase/proofs/<n>.proof.sql`, bloc `DO` qui finit par `RAISE` (aucune trace laissée), au minimum :
membre sans rôle inchangé ; rôle qui retire `task.create` ; deux rôles qui s'additionnent ; rôle
expiré = retour à la fiche individuelle ; rôle futur inactif ; admin insensible ; attribution à un
admin refusée ; `role.manage` sans admin peut créer et attribuer ; membre ordinaire refusé ;
`assign_targets` en union ; suppression du rôle = droits d'avant.

## 5. Client

- `permissions.ts` : `role.manage` rejoint `ORG_PERMISSION_KEYS` et `ADMIN_DEFAULT_KEYS`.
  `effectivePermissions` / `effectiveAssignTargets` reçoivent `activeRoles` et appliquent l'ordre
  du § 3. Reste le **miroir exact** du SQL ; tests de parité étendus.
- Module : `roles.types.ts`, `roles.repository.ts` (interface) + implémentations Supabase et
  **locale (mode démo)**, `roles.hooks.ts`. `useMyOrgPermissions` lit mes rôles actifs. Les
  mutations invalident les permissions et l'annuaire.
- « Actif » côté client se recalcule à l'affichage (`ends_at` comparé à l'heure courante) ; le
  serveur reste seul juge.
- Durées : 1 semaine / 1 mois / 3 mois ajoutées à la date d'attribution (date-fns). « Jusqu'au »
  = fin de la journée choisie, dans le fuseau de celui qui attribue (cf. `src/lib/CLAUDE.md`).

### Écrans

1. **Paramètres › Rôles** (section de `/entreprise/settings`, maquette 1) : liste nom, pastille,
   résumé (« 7 permissions · assigne à son équipe »), nombre de membres, pastille « expire bientôt »
   si une attribution finit dans les 7 jours, menu « … » (modifier, dupliquer, supprimer).
   Bouton « Créer un rôle ». Visible si `can['role.manage']`.
2. **Éditeur de rôle** (feuille latérale, maquette 2) : nom, couleur, trois colonnes Tâches /
   Projets / OKR et autres (rapports et « Gérer les rôles » inclus), interrupteurs à deux
   positions, puces « Peut assigner une tâche à ». Nouveau rôle : tout désactivé, portée `self`.
3. **Attribuer un rôle** (annuaire, menu « … », maquette 3) : rôle, durée en puces, phrase de
   résumé « Du … au …, puis X retrouve ses droits actuels. ». Absent pour un admin.
- Fiche « Modifier les permissions » : si le membre a un rôle actif, bandeau « Les rôles … priment
  jusqu'au … : ces réglages s'appliqueront à leur fin. » La fiche reste éditable.
- Annuaire : une pastille par rôle actif à côté du nom, date de fin au survol.
- Retirer / prolonger une attribution : depuis le menu « … » du membre.

i18n fr / en dès le départ. Toast via `@/lib/toast`. Modales selon `src/components/CLAUDE.md`.

## 6. Tests

- Preuve SQL (§ 4), `npm run test:rls` sur les policies des deux tables.
- Vitest : parité `permissions.ts` ↔ SQL sur les cas de la preuve ; repository local ; calcul des
  dates de fin.
- Playwright (mode démo) : créer un rôle, l'attribuer pour une semaine, constater le bouton
  disparu, retirer le rôle, constater le retour.

## 7. Hors périmètre

Rôles hors mode entreprise · rôles par équipe ou par projet (les rôles de projet de la mig. `190`
restent séparés) · préavis avant la fin · historique des attributions dans l'UI (le journal d'audit
suffit) · date de début future dans l'UI (la colonne `starts_at` existe, l'écran ne la propose pas).
