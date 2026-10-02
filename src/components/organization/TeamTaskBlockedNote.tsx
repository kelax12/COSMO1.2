import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTeamTaskDependencies, useTeamTasks, type TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';

interface Props {
  task: TeamTask;
  /** Ouvre l'onglet Dépendances, où vivent le détail et l'ajout. */
  onOpen: () => void;
}

/**
 * Alerte de blocage, en tête de l'onglet Détails d'une tâche d'équipe.
 *
 * 🔴 Elle vivait dans l'en-tête de la section Dépendances, « visible section
 * repliée : c'est l'information qui change la décision de démarrer, elle ne
 * doit pas se mériter ». L'audit des popups du 2026-09-25 (f3a49583) a rangé
 * la section dans son propre onglet : l'alerte n'apparaissait plus qu'une fois
 * l'onglet ouvert, c'est-à-dire exactement quand on n'en a plus besoin.
 * Le parcours `demo-entreprise-dependencies` l'a vu ; aucun test unitaire ne
 * le pouvait.
 */
const TeamTaskBlockedNote = ({ task, onOpen }: Props) => {
  const { tp } = useT('org');
  const { data: allTasks = [] } = useTeamTasks(task.orgId);
  const { data: dependencies = [] } = useTeamTaskDependencies(task.orgId);

  const unfinished = useMemo(() => {
    const done = new Map(allTasks.map((x) => [x.id, x.completed]));
    return dependencies.filter((d) => d.taskId === task.id && done.get(d.dependsOnId) === false).length;
  }, [allTasks, dependencies, task.id]);

  if (unfinished === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline ${TAP_AREA_44_Y}`}
    >
      <AlertTriangle size={13} aria-hidden="true" />
      {tp('projects.blockedWarning', unfinished)}
    </button>
  );
};

export default TeamTaskBlockedNote;
