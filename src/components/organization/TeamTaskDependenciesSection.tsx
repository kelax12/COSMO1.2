import { useMemo, useState } from 'react';
import { Link2, AlertTriangle } from 'lucide-react';
import {
  useTeamTaskDependencies,
  useRemoveTaskDependency,
  useTeamTasks,
  type TeamTask,
} from '@/modules/team-projects';
import TeamTaskDependencyPicker from './TeamTaskDependencyPicker';
import TeamTaskDependencyColumns from './TeamTaskDependencyColumns';
import type { DependencyDirection } from '@/lib/dependency-graph';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';

interface TeamTaskDependenciesSectionProps {
  task: TeamTask;
  /** Seul un gestionnaire modifie le graphe ; tout le monde le lit. */
  isManager: boolean;
  /** Ouverte d'emblée : dans l'onglet Dépendances de la fiche, la replier n'a pas de sens. */
  defaultOpen?: boolean;
}

/**
 * Dépendances d'une tâche d'équipe (mig. 108) : ce qui la bloque, et ce
 * qu'elle bloque.
 *
 * Les deux sens sont affichés parce qu'ils répondent à deux questions
 * différentes : « puis-je commencer ? » (bloquée par) et « qui est-ce que je
 * retarde si je glisse ? » (bloque). La seconde est celle qu'on oublie, et
 * c'est celle qui coûte cher en réunion.
 */
const TeamTaskDependenciesSection = ({ task, isManager, defaultOpen = false }: TeamTaskDependenciesSectionProps) => {
  const { t, tp } = useT('org');
  const [open, setOpen] = useState(defaultOpen);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDirection, setPickerDirection] = useState<DependencyDirection>('blockedBy');

  const { data: allTasks = [] } = useTeamTasks(task.orgId);
  const { data: dependencies = [] } = useTeamTaskDependencies(task.orgId);
  const removeDependency = useRemoveTaskDependency(task.orgId);

  const byId = useMemo(() => new Map(allTasks.map((x) => [x.id, x])), [allTasks]);

  const blockedBy = useMemo(
    () =>
      dependencies
        .filter((d) => d.taskId === task.id)
        .map((d) => byId.get(d.dependsOnId))
        .filter((x): x is TeamTask => !!x),
    [dependencies, task.id, byId],
  );

  const blocks = useMemo(
    () =>
      dependencies
        .filter((d) => d.dependsOnId === task.id)
        .map((d) => byId.get(d.taskId))
        .filter((x): x is TeamTask => !!x),
    [dependencies, task.id, byId],
  );

  const unfinishedBlockers = blockedBy.filter((x) => !x.completed).length;

  return (
    <div className="pt-3 border-t border-[rgb(var(--color-border))]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        // Le titre de section fait 14 px de haut : c'est un en-tête, pas un
        // bouton, mais il en EST un (il replie la section). `TAP_AREA_44_Y`
        // porte la cible à 44 px dans un pseudo-élément absolu, donc sans
        // déplacer d'un pixel le dessin de la section (C-70).
        className={`w-full flex items-center gap-2 text-left ${TAP_AREA_44_Y}`}
      >
        <Link2 size={13} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        <span className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          {t('projects.dependenciesTitle')}
        </span>
        <span className="text-caption text-[rgb(var(--color-text-muted))]">
          {blockedBy.length + blocks.length}
        </span>
        {/* L'alerte reste visible section repliée : c'est l'information qui
            change la décision de démarrer, elle ne doit pas se mériter. */}
        {unfinishedBlockers > 0 && (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={11} aria-hidden="true" />
            {tp('projects.blockedWarning', unfinishedBlockers)}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3">
          <TeamTaskDependencyColumns
            blockedBy={blockedBy}
            blocks={blocks}
            canEdit={isManager}
            onAdd={(direction) => { setPickerDirection(direction); setPickerOpen(true); }}
            onRemove={(item, direction) =>
              removeDependency.mutate(
                direction === 'blockedBy'
                  ? { taskId: task.id, dependsOnId: item.id }
                  : { taskId: item.id, dependsOnId: task.id },
              )}
          />
        </div>
      )}

      {isManager && pickerOpen && (
        <TeamTaskDependencyPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          task={task}
          tasks={allTasks}
          dependencies={dependencies}
          initialDirection={pickerDirection}
        />
      )}
    </div>
  );
};

export default TeamTaskDependenciesSection;
