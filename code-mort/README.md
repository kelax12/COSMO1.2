# code-mort/ · code retiré de l'app

**Quand lire** : avant de ranimer un écran ou un hook retiré. **Fait foi** : le code de `src/`.

- Contenu : du code que rien ne monte plus, sorti de `src/` le 2026-11-25 à la demande d'Axel. L'arborescence d'origine est gardée (`code-mort/src/...` = ancien `src/...`).
- ❌ Hors build, hors `tsc` (`tsconfig.app.json` n'inclut que `src` et `prerender`), hors Vitest, hors ESLint : rien ici n'est vérifié, et le code peut ne plus compiler contre `src/`.
- ✅ Ranimer un fichier : le remettre à son chemin d'origine, le rebrancher sur un écran, puis rejouer `verif:rapide` (gardes `orphan-hooks`, `modal-a11y`, `keyboard-audit-coverage`).
- Les fichiers `*.extrait.ts` contiennent des hooks coupés d'un fichier vivant : ce sont des extraits, sans leurs imports.

| Groupe | Fichiers |
|---|---|
| Check-in hebdo OKR (Aperçu perso) | `components/WeeklyCheckinModal.tsx`, hook `useActiveOkrs` |
| Page premium perso | `pages/PremiumPage.tsx`, `pages/premium/data.ts` ; la route `/premium` redirige vers `/` |
| Organigramme (pyramide) | `components/organization/Pyramid*`, `UnplacedMembersPanel`, `usePyramid*` |
| OKR d'équipe, anciens écrans | `KRExecutionDialog`, `KRContributorsField`, `TeamOKRLinkFields`, `okr-links.helpers`, hook `useKRCheckins` |
| Projets d'entreprise, anciens écrans | `ProjectTemplatesSection`, `project-templates`, `ProjectDependenciesSection`, `team-task-rights`, hooks `useAdd/RemoveProjectDependency`, `useTeamMemberWorkload` |
| Fils d'activité | `OrgEventsTimeline`, `TeamActivityFeed` |
| Landing | `pages/landing/LandingGateway.tsx`, `components/reactbits/{DotGrid,ShinyText,ScrollReveal}` |
| Divers | `task-table/TasksInboxMenu.tsx`, `lib/hooks/useDebounce.ts`, `organization/use-widget-drag.ts` |
