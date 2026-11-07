# ADR 0005 · Les modules entreprise sont séparés des modules perso

- **Statut** : acceptée
- **Date** : décision structurante du mode entreprise, écrite le 2026-11-07

## Contexte

COSMO a deux mondes. Le monde perso : un utilisateur, ses tâches, ses habitudes, ses OKR, partagés
éventuellement avec des amis. Le monde entreprise (`/entreprise/...`) : une organisation, des équipes
hiérarchiques, des permissions par membre, des rôles personnalisés, de la facturation par paliers.

Les deux mondes ont des objets qui se ressemblent (tâches, catégories, OKR) mais des règles d'accès
différentes : dans le perso, un propriétaire ; dans l'entreprise, une hiérarchie, des équipes, des
permissions par membre et un retrait de membre qui doit réassigner du travail.

## Décision

- Le monde entreprise a **ses propres modules et ses propres tables**, et ne réutilise jamais un module
  perso. Modules : `organizations`, `org-teams`, `org-config`, `org-reports`, `team-projects`,
  `team-okrs`, `team-categories`, `team-lists`. Tables : `team_tasks`, `team_projects`, `team_okrs`,
  `team_categories`, `org_*`… (voir [`docs/MODULES.md`](../MODULES.md)).
- Un module entreprise a son propre repository, ses propres hooks et ses propres politiques RLS,
  fondées sur l'appartenance à l'organisation et sur la hiérarchie (`is_above()`,
  `can_access_team_project`, etc.), jamais sur « cette ligne est à moi ».
- Pour tenir en performance dans une grande organisation, les lectures entreprise passent par des RPC
  ciblées (`get_my_team_tasks`, `get_my_team_projects`…) qui filtrent côté serveur avant tout plafond.
- Un module entreprise ne s'appuie pas sur un contexte global qui agrège plusieurs modules.

## Conséquences

- **Positives.** Un modèle d'accès par monde, que chaque politique RLS peut exprimer sans cas
  particulier. Une règle perso ne peut pas fuiter dans l'entreprise, et inversement : les
  changements du mode entreprise (rôles, offboarding, facturation) ne cassent pas les utilisateurs perso.
- **Négatives.** De la duplication assumée : deux catégories, deux jeux de tâches, deux OKR, deux
  logiques d'écran. Une amélioration d'un objet commun doit parfois être faite deux fois.
- **Garde.** Les nouvelles fonctionnalités entreprise se rangent dans un module `org-*` ou `team-*`.
  Les règles par module vivent dans leurs `CLAUDE.md`, par exemple
  [`src/modules/organizations/CLAUDE.md`](../../src/modules/organizations/CLAUDE.md) et
  [`src/modules/team-projects/CLAUDE.md`](../../src/modules/team-projects/CLAUDE.md).
