import { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Plus, X } from 'lucide-react';
import {
  useRemoveTaskDependency,
  useTaskDependencies,
  useTasks,
  type Task,
} from '@/modules/tasks';
import TaskDependencyPicker from './TaskDependencyPicker';
import { useT } from '@/i18n/useT';

interface TaskDependenciesSectionProps {
  /**
   * Id de la tâche ouverte. On prend l'id et non l'objet parce que le corps
   * mobile ne dispose que de l'id — et parce que la tâche est de toute façon
   * relue dans la liste ici, donc la passer entière n'ajouterait qu'une
   * seconde source de vérité pour le même enregistrement.
   */
  taskId: string;
  /**
   * Lecture seule — une tâche partagée dont je ne suis pas propriétaire.
   * Le graphe personnel appartient à son propriétaire (mig. 132), donc en
   * pratique la section n'est même pas montée dans ce cas ; la prop existe
   * pour que l'appelant puisse afficher sans risquer un 403.
   */
  readOnly?: boolean;
}

/**
 * Dépendances d'une tâche personnelle (mig. 132) : ce qui la bloque, et ce
 * qu'elle bloque.
 *
 * Les deux sens sont affichés parce qu'ils répondent à deux questions
 * différentes : « puis-je commencer ? » (bloquée par) et « qu'est-ce que je
 * retarde si je glisse ? » (bloque). La seconde est celle qu'on oublie, et
 * c'est celle qui fait rater une échéance en aval.
 *
 * Le graphe n'est lu QUE depuis ce composant : c'est le seul endroit qui monte
 * `useTaskDependencies`. La page Tâches, ouverte bien plus souvent que le
 * modal, ne paie donc jamais cette requête.
 */
const TaskDependenciesSection = ({ taskId, readOnly = false }: TaskDependenciesSectionProps) => {
  const { t, tp } = useT('tasks');
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: allTasks = [] } = useTasks();
  const { data: dependencies = [] } = useTaskDependencies();
  const removeDependency = useRemoveTaskDependency();

  const byId = useMemo(() => new Map(allTasks.map((x) => [x.id, x])), [allTasks]);
  const task = byId.get(taskId);

  const blockedBy = useMemo(
    () =>
      dependencies
        .filter((d) => d.taskId === taskId)
        .map((d) => byId.get(d.dependsOnId))
        .filter((x): x is Task => !!x),
    [dependencies, taskId, byId],
  );

  const blocks = useMemo(
    () =>
      dependencies
        .filter((d) => d.dependsOnId === taskId)
        .map((d) => byId.get(d.taskId))
        .filter((x): x is Task => !!x),
    [dependencies, taskId, byId],
  );

  const unfinishedBlockers = blockedBy.filter((x) => !x.completed).length;

  const row = (item: Task, direction: 'blockedBy' | 'blocks') => (
    <li key={`${direction}-${item.id}`} className="flex items-center gap-2 py-1">
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
      {!readOnly && (
        <button
          type="button"
          onClick={() =>
            removeDependency.mutate(
              direction === 'blockedBy'
                ? { taskId, dependsOnId: item.id }
                : { taskId: item.id, dependsOnId: taskId },
            )
          }
          aria-label={t('dependencies.remove')}
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
        <span className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          {t('dependencies.title')}
        </span>
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
          {blockedBy.length + blocks.length}
        </span>
        {/* L'alerte reste visible section repliée : c'est l'information qui
            change la décision de démarrer, elle ne doit pas se mériter. */}
        {unfinishedBlockers > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={11} aria-hidden="true" />
            {tp('dependencies.blockedWarning', unfinishedBlockers)}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-0.5">
              {t('dependencies.blockedBy')}
            </p>
            {blockedBy.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {t('dependencies.none')}
              </p>
            ) : (
              <ul>{blockedBy.map((x) => row(x, 'blockedBy'))}</ul>
            )}
          </div>

          {blocks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-0.5">
                {t('dependencies.blocks')}
              </p>
              <ul>{blocks.map((x) => row(x, 'blocks'))}</ul>
            </div>
          )}

          {/* Toujours proposé, même quand il n'y a aucune autre tâche : la
              popup sait en créer une, et un bouton qui disparaît quand il n'y
              a « rien à choisir » supprime précisément le chemin dont on a
              besoin ce jour-là. */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
            >
              <Plus size={12} aria-hidden="true" /> {t('dependencies.add')}
            </button>
          )}
        </div>
      )}

      {!readOnly && pickerOpen && task && (
        <TaskDependencyPicker
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

export default TaskDependenciesSection;
