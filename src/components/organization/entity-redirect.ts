// Hors de `deep-link.helpers`, qui vit dans le chunk d'ENTRÉE (App.tsx
// l'importe) : cette règle ne sert qu'à /entreprise, avec `OrgDeepLinkHost`.
import { buildOrgLink, orgTeamPath, readEntityParam } from './deep-link.helpers';

/**
 * Adresse de la fiche d'une entité dont la fiche est une PAGE, quand l'URL la
 * demande depuis une autre section. `null` : rien à rediriger, soit parce que
 * l'entité s'ouvre sur place (tâche, membre), soit parce qu'on y est déjà.
 *
 *   `?team=<id>`    → `/entreprise/teams/<id>` (la page d'équipe)
 *   `?project=<id>` → `/entreprise/projects?project=<id>` (la page projet)
 *   `?okr=<id>`     → `/entreprise/okr?okr=<id>` (l'objectif, mis en avant)
 */
export const entityRedirect = (section: string, params: URLSearchParams): string | null => {
  const team = readEntityParam(params, 'team');
  if (team) return orgTeamPath(team);
  const project = readEntityParam(params, 'project');
  if (project && section !== 'projects') return buildOrgLink('projects', { project });
  const okr = readEntityParam(params, 'okr');
  if (okr && section !== 'okr') return buildOrgLink('okr', { okr });
  return null;
};
