import { Suspense, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Link2, Lock, Plus, X } from 'lucide-react';
import type { DependencyDirection } from '@/lib/dependency-graph';
import {
  useRemoveTaskDependency,
  useTaskDependencies,
  useTasksIncluding,
  type Task,
} from '@/modules/tasks';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

// Le sélecteur (~20 ko de source) ne s'ouvre qu'au clic sur « Ajouter une
// dépendance » : chargé à la demande, il sort du chunk `TaskModal`, qui avait
// franchi son plafond (29,3 ko > 29,0 ko). Même découpe que
// `TeamTaskTabPanels` côté entreprise. Catalogue `tasks` déjà chargé par la
// modale.
const TaskDependencyPicker = lazyWithRetry(() => import('./TaskDependencyPicker'));

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
  /**
   * Toujours déplié, « Ajouter » au bout de la ligne de titre. Utilisé par
   * l'onglet Dépendances du modal desktop, où replier n'a plus de sens.
   */
  alwaysOpen?: boolean;
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
const TaskDependenciesSection = ({ taskId, readOnly = false, alwaysOpen = false }: TaskDependenciesSectionProps) => {
  const { t, tp } = useT('tasks');
  const [openState, setOpen] = useState(false);
  const open = alwaysOpen || openState;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDirection, setPickerDirection] = useState<DependencyDirection>('blockedBy');
  const openPicker = (direction: DependencyDirection) => { setPickerDirection(direction); setPickerOpen(true); };

  const { data: dependencies = [] } = useTaskDependencies();
  const removeDependency = useRemoveTaskDependency();

  // V14.1 (PER-01) : une arête peut viser une tâche terminée HORS du jeu de
  // travail (35 j) ; elle disparaissait alors de la liste sans que rien ne le
  // dise. La tâche ouverte elle-même peut venir de l'archive.
  const relatedIds = useMemo(
    () => [taskId, ...dependencies.flatMap((d) => (d.taskId === taskId ? [d.dependsOnId] : d.dependsOnId === taskId ? [d.taskId] : []))],
    [dependencies, taskId],
  );
  const allTasks = useTasksIncluding(relatedIds);

  const byId = useMemo(() => new Map(allTasks.map((x) => [x.id, x])), [allTasks]);
  const task = byId.get(taskId);
  // `useTasks` rend aussi les tâches qu'un ami m'a partagées : elles vivent
  // dans SON compte, et le trigger de la mig. 137 refuse une arête entre deux
  // comptes (`dependency_cross_account`). On ne propose donc que les tâches du
  // même propriétaire que la tâche ouverte.
  const sameAccountTasks = useMemo(
    () =>
      task
        ? allTasks.filter((x) =>
            x.userId && task.userId ? x.userId === task.userId : !x.sharedBy === !task.sharedBy,
          )
        : [],
    [allTasks, task],
  );
  // Une tâche partagée par un ami : son graphe appartient à son propriétaire.
  const locked = readOnly || !!task?.sharedBy;

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

  const row = (item: Task, direction: DependencyDirection) => (
    <li
      key={`${direction}-${item.id}`}
      className="flex items-center gap-2 min-h-11 pl-3 pr-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${item.completed ? 'bg-emerald-500' : 'bg-[rgb(var(--color-text-muted))]'}`}
        aria-hidden="true"
      />
      <span
        className={`flex-1 min-w-0 truncate text-sm ${
          item.completed ? 'text-[rgb(var(--color-text-muted))] line-through' : 'text-[rgb(var(--color-text-primary))]'
        }`}
      >
        {item.name}
      </span>
      {!locked && (
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
          className="shrink-0 w-9 h-9 rounded-md inline-flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );

  // Deux colonnes, comme la fiche entreprise (`TeamTaskDependencyColumns`) :
  // chaque « + » ouvre le sélecteur déjà orienté, qui sait aussi CRÉER la tâche.
  const column = (direction: DependencyDirection, items: Task[]) => {
    const blocking = direction === 'blockedBy';
    const Icon = blocking ? Lock : ArrowRight;
    return (
      <section aria-label={blocking ? t('dependencies.blockedBy') : t('dependencies.blocks')} className="min-w-0">
        <h4 className="flex items-center gap-1.5 mb-2 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          <Icon size={12} aria-hidden="true" />
          {blocking ? t('dependencies.blockedBy') : t('dependencies.blocks')}
          <span className="tabular-nums">· {items.length}</span>
        </h4>
        {items.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">{blocking ? t('dependencies.none') : t('dependencies.noBlocked')}</p>
        ) : (
          <ul className="space-y-1.5">{items.map((x) => row(x, direction))}</ul>
        )}
        {!locked && (
          <button
            type="button"
            onClick={() => openPicker(direction)}
            className="mt-2 inline-flex items-center gap-1 min-h-9 px-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Plus size={13} aria-hidden="true" /> {blocking ? t('dependencies.addBlocker') : t('dependencies.addBlocked')}
          </button>
        )}
      </section>
    );
  };

  return (
    <div className={alwaysOpen ? '' : 'pt-3 border-t border-[rgb(var(--color-border))]'}>
      <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => { if (!alwaysOpen) setOpen((v) => !v); }}
        aria-expanded={alwaysOpen ? undefined : open}
        className={`flex-1 min-w-0 flex items-center gap-2 text-left ${alwaysOpen ? 'cursor-default' : ''}`}
      >
        <Link2 size={13} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        <span className="text-xs font-bold md:uppercase md:tracking-wide text-[rgb(var(--color-text-muted))]">
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
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {column('blockedBy', blockedBy)}
          {column('blocks', blocks)}
        </div>
      )}

      {!locked && pickerOpen && task && (
        <Suspense fallback={null}>
          <TaskDependencyPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            task={task}
            tasks={sameAccountTasks}
            dependencies={dependencies}
            initialDirection={pickerDirection}
          />
        </Suspense>
      )}
    </div>
  );
};

export default TaskDependenciesSection;
