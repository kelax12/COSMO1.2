import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { projectColor } from './team-projects.helpers';
import { useT } from '@/i18n/useT';
import { useOrgCreate } from './org-create.context';
import { PermissionGate } from './permission-hints';

/**
 * Puces de projets visibles avant « +N projets ». Au-delà, la rangée devenait
 * un mur de cinq cents boutons au-dessus du tableau (audit du 2026-09-24).
 */
const PROJECT_CHIPS_LIMIT = 12;

const chipBase =
  'shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 h-10 sm:h-auto sm:py-2 rounded-lg text-sm font-medium transition-all shadow-sm border';
const chipActive =
  'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))] shadow-md';
const chipInactive =
  'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]';

interface TeamTasksProjectChipsProps {
  /** Projets actifs (non archivés). */
  projects: TeamProject[];
  tasks: TeamTask[];
  projectFilter: string | null;
  onProjectFilter: (projectId: string | null) => void;
  canCreateProject: boolean;
  /** Pourquoi « Nouveau projet » est grisé, quand il l'est. */
  createDeniedReason?: string;
}

/**
 * Accès rapide aux projets de l'onglet Tâches, équivalent entreprise de la
 * barre de listes personnelle : les projets sont déjà l'unité de classement
 * ici, inutile d'inventer un second système de regroupement.
 *
 * Extrait de `TeamTasksTab` (plafond de 600 lignes d'`architecture.guard`).
 */
const TeamTasksProjectChips = ({
  projects, tasks, projectFilter, onProjectFilter, canCreateProject, createDeniedReason,
}: TeamTasksProjectChipsProps) => {
  const { t, tp } = useT('org');
  // « + Nouveau projet » ouvrait ici un champ « nom seul » qui créait un
  // projet gris, sans équipe ni responsable (cohérence globale, 2026-09-25).
  const create = useOrgCreate();
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Compteur par projet : tâches OUVERTES uniquement, même convention que
  // les chips de listes personnelles (le reste à faire, pas le volume).
  const openCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.completed) continue;
      map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  // Le projet filtré reste visible même s'il tombe après la coupure : sinon
  // la puce active disparaîtrait et on ne saurait plus ce qui filtre la table.
  const shownProjects = useMemo(() => {
    if (showAllProjects || projects.length <= PROJECT_CHIPS_LIMIT) return projects;
    const head = projects.slice(0, PROJECT_CHIPS_LIMIT);
    const active = projectFilter ? projects.find((p) => p.id === projectFilter) : undefined;
    return active && !head.includes(active) ? [...head, active] : head;
  }, [projects, showAllProjects, projectFilter]);
  const hiddenProjects = projects.length - shownProjects.length;


  if (projects.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        {t('projects.tasksTabQuickAccess')}
      </h2>
      <div className="flex sm:flex-wrap gap-3 overflow-x-auto sm:overflow-visible -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onProjectFilter(null)}
          className={`${chipBase} ${!projectFilter ? chipActive : chipInactive}`}
        >
          {t('projects.tasksTabAll')}
        </button>
        {shownProjects.map((project) => {
          const color = projectColor(project.color);
          const active = projectFilter === project.id;
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onProjectFilter(active ? null : project.id)}
              className={`${chipBase} ${active ? chipActive : chipInactive}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? 'bg-white/80' : color.dot}`}
                aria-hidden="true"
              />
              <span className="truncate max-w-[160px]">{project.name}</span>
              <span className="text-xs opacity-70">{openCountByProject.get(project.id) ?? 0}</span>
            </button>
          );
        })}

        {hiddenProjects > 0 && (
          <button
            type="button"
            onClick={() => setShowAllProjects(true)}
            className={`${chipBase} ${chipInactive}`}
          >
            {tp('projects.tasksTabMoreProjects', hiddenProjects)}
          </button>
        )}
        {showAllProjects && projects.length > PROJECT_CHIPS_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAllProjects(false)}
            className={`${chipBase} ${chipInactive}`}
          >
            {t('projects.tasksTabFewerProjects')}
          </button>
        )}

        <PermissionGate reason={canCreateProject ? undefined : createDeniedReason}>
          <button
            type="button"
            // LE formulaire de projet (org-create.context) : couleur, équipe,
            // responsable. Le projet créé devient aussitôt le filtre.
            onClick={() => create.openProject({ onCreated: onProjectFilter })}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 h-10 sm:h-auto sm:py-2 px-3.5 rounded-lg border-2 border-dashed border-[rgb(var(--color-border))] bg-transparent text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-[rgb(var(--color-border-strong))] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
          >
            <Plus size={16} aria-hidden="true" /> {t('projects.newProject')}
          </button>
        </PermissionGate>
      </div>
    </div>
  );
};

export default TeamTasksProjectChips;
