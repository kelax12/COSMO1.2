import { useMemo, useState } from 'react';
import { Link2, X, Plus, AlertTriangle } from 'lucide-react';
import {
  useTeamTaskDependencies,
  useRemoveTaskDependency,
  useTeamTasks,
  type TeamTask,
} from '@/modules/team-projects';
import TeamTaskDependencyPicker from './TeamTaskDependencyPicker';
import { useT } from '@/i18n/useT';

interface TeamTaskDependenciesSectionProps {
  task: TeamTask;
  /** Seul un gestionnaire modifie le graphe ; tout le monde le lit. */
  isManager: boolean;
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
const TeamTaskDependenciesSection = ({ task, isManager }: TeamTaskDependenciesSectionProps) => {
  const { t, tp } = useT('org');
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const row = (item: TeamTask, direction: 'blockedBy' | 'blocks') => (
    <li
      key={`${direction}-${item.id}`}
      className="flex items-center gap-2 py-1"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          item.completed ? 'bg-emerald-500' : 'bg-[rgb(var(--color-text-muted))]'
        }`}
        aria-hidden="true"
      />
      <span
        className={`text-xs flex-1 truncate ${
          item.completed
            ? 'text-[rgb(var(--color-text-muted))] line-through'
            : 'text-[rgb(var(--color-text-primary))]'
        }`}
      >
        {item.name}
      </span>
      {isManager && (
        <button
          type="button"
          onClick={() =>
            removeDependency.mutate(
              direction === 'blockedBy'
                ? { taskId: task.id, dependsOnId: item.id }
                : { taskId: item.id, dependsOnId: task.id },
            )
          }
          aria-label={t('projects.removeDependency')}
          className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </li>
  );

  return (
    <div className="pt-3 border-t border-[rgb(var(--color-border))]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left"
      >
        <Link2 size={13} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        <span className="text-caption font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
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
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-caption font-semibold text-[rgb(var(--color-text-secondary))] mb-0.5">
              {t('projects.blockedBy')}
            </p>
            {blockedBy.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {t('projects.noDependencies')}
              </p>
            ) : (
              <ul>{blockedBy.map((x) => row(x, 'blockedBy'))}</ul>
            )}
          </div>

          {blocks.length > 0 && (
            <div>
              <p className="text-caption font-semibold text-[rgb(var(--color-text-secondary))] mb-0.5">
                {t('projects.blocks')}
              </p>
              <ul>{blocks.map((x) => row(x, 'blocks'))}</ul>
            </div>
          )}

          {/* Toujours proposé, même sans autre tâche dans le projet : la
              popup sait en créer une, et un bouton qui disparaît quand il n'y
              a « rien à choisir » supprime précisément le chemin dont on a
              besoin ce jour-là. */}
          {isManager && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
            >
              <Plus size={12} aria-hidden="true" /> {t('projects.addDependency')}
            </button>
          )}
        </div>
      )}

      {isManager && pickerOpen && (
        <TeamTaskDependencyPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          task={task}
          tasks={allTasks}
          dependencies={dependencies}
        />
      )}
    </div>
  );
};

export default TeamTaskDependenciesSection;
