# Finitions mode entreprise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les 14 dernières modifications du mode entreprise (annuaire, équipes, permissions, stats, suppression d'entreprise, avatar org, agenda).

**Architecture:** Tout s'appuie sur les modules existants `organizations` / `org-teams` / `team-projects` / `team-okrs` (pattern repository double mode démo/prod). Deux migrations SQL nouvelles (org avatar + delete_organization RPC). Aucune nouvelle table.

**Tech Stack:** React 18 + TS strict, React Query 5, Supabase RLS, Tailwind/shadcn, zod.

---

### Task 1 — Fix #9 : erreurs création projet / OKR
**Cause** : `.insert().select('*').single()` échoue au SELECT de représentation (`can_access_team_project`) quand un manager non-admin rattache un projet à une équipe hors de son périmètre ; + `createTeamProjectSchema` strippe `teamId` silencieusement.
- [ ] `team-task.schema.ts` : ajouter `teamId: z.string().nullable().optional()` au schéma create.
- [ ] `team-projects/supabase.repository.ts createProject` : générer l'id client (`crypto.randomUUID()`), insert sans `.select()`, retourner l'objet construit.
- [ ] `team-okrs/supabase.repository.ts create` : idem pour team_okrs + KRs.
- [ ] Hooks : mapper l'erreur RLS 42501 vers un message FR clair.
- [ ] Appliquer mig. 074 (stats RPC) en prod (dette mémoire).
- [ ] lint + typecheck + tests → commit + push.

### Task 2 — Annuaire (#1, #3, #4, #11)
- [ ] `MemberDirectory.tsx` : supprimer le sous-menu « Rôle » (la pyramide est la seule source de hiérarchie) ; badge conservé.
- [ ] Clic sur la ligne → `MemberProfileSheet` (comme la pyramide) (#11).
- [ ] Menu « … » (pour supérieurs hiérarchiques uniquement, `canManage`) : Attribuer une tâche (TeamTaskModal préréglé assigné), Voir ses tâches / agenda / contribution (`MemberInsightsSheet`) (#4).
- [ ] Retrait : modal de confirmation `AlertDialog` (nouveau composant partagé `ConfirmRemoveMemberDialog`) au lieu d'un item direct ; réutilisé par `PyramidTab.handleRemove` (remplace `window.confirm`) (#3).
- [ ] commit + push.

### Task 3 — Équipes (#2)
- [ ] Nouveau `CreateTeamModal.tsx` : nom, couleur (palette), membres (multi-sélection dans le périmètre du créateur). Bouton « Ajouter une équipe » dans `TeamsSection`.
- [ ] création = `createTeam` puis `addTeamMember` en série.
- [ ] commit + push.

### Task 4 — OKR sans assigné (#10)
- [ ] `TeamOKRModal.tsx` : retirer le picker assigné des KR ; ne plus envoyer `assigneeId`.
- [ ] commit + push.

### Task 5 — Suppression d'entreprise (#5)
- [ ] Migration 075 : RPC `delete_organization(p_org uuid)` SECURITY DEFINER (owner uniquement) — supprime l'org (cascade).
- [ ] Repository (interface + supabase + local + demo) `deleteOrganization(orgId)` + hook `useDeleteOrganization`.
- [ ] `OrganizationPage` onglet Membres : admin-owner voit « Supprimer l'entreprise » (zone danger) au lieu de « Quitter » ; modal type GitHub (taper le nom exact de l'org). Autres membres : « Quitter » inchangé.
- [ ] Appliquer la migration prod. commit + push.

### Task 6 — Avatar d'entreprise (#12)
- [ ] Migration 076 : `organizations.avatar_url text` (update via policy admin déjà en place pour update org ? sinon inclure).
- [ ] Types + repo `updateOrganization` acceptent `avatarUrl` ; `OrgProfileSheet` : upload image (réutilise `validateAvatarFile`/`computeAvatarDimensions`).
- [ ] Header `OrganizationPage` + `OrgSwitcher` affichent l'avatar.
- [ ] Appliquer migration prod. commit + push.

### Task 7 — Aperçu personnel (#7) + onglet Statistiques (#13)
- [ ] Nouveau `MyWorkTab.tsx` (Aperçu) : mes tâches d'équipe (ouvertes/retard), mes échéances, mes projets — vue « mon travail dans l'entreprise ».
- [ ] Onglet « Statistiques » (visible admin + managers) : contenu actuel de `TeamOverviewTab`, filtré au sous-arbre pour un manager non-admin (`subtreeOf`), toute l'org pour l'admin.
- [ ] commit + push.

### Task 8 — Paramètres : sidebar fixe (#6)
- [ ] `SettingsPage` : sidebar `sticky top-0 h-screen` (ne défile plus avec la page).
- [ ] commit + push.

### Task 9 — Auto-assignation (#8)
- [ ] `TeamProjectCard` : bouton « + tâche » visible pour tout membre (RLS le permet déjà), assigné par défaut = soi.
- [ ] commit + push.

### Task 10 — Tâches d'équipe dans l'agenda perso (#14)
- [ ] AgendaPage : afficher les échéances de MES tâches d'équipe en couleur spéciale (indigo, badge Équipe) — parité avec `TeamAssignedSection` (déjà distinct côté To-Do).
- [ ] commit + push.

### Task 11 — Vérification finale
- [ ] `npm run lint`, `npm run typecheck`, `npm test`.
- [ ] Preview navigateur en mode démo : parcours entreprise complet.
- [ ] Mémoire mise à jour.
