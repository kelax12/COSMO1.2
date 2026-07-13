import { useMemo, useState } from 'react';
import { CalendarClock, UserRound } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { projectColor, PRIORITY_META, isTaskOverdue, sortOpenTasks } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';

interface TeamProjectsKanbanProps {
  projects: TeamProject[];
  /** Tâches ouvertes des projets visibles (les terminées sont exclues). */
  tasks: TeamTask[];
  members: OrgMember[];
  onReassign: (task: TeamTask, assigneeId: string | null) => void;
  onOpenTask: (task: TeamTask) => void;
}

const UNASSIGNED = '__unassigned__';

/**
 * Vue Kanban « charge par personne » : une colonne par membre (+ non
 * assignées). Glisser une carte sur une colonne réassigne la tâche.
 */
const TeamProjectsKanban = ({ projects, tasks, members, onReassign, onOpenTask }: TeamProjectsKanbanProps) => {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const openTasks = useMemo(() => sortOpenTasks(tasks.filter((t) => !t.completed)), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Colonnes : non assignées + tous les membres (les plus chargés d'abord).
  const columns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of openTasks) counts.set(t.assigneeId ?? UNASSIGNED, (counts.get(t.assigneeId ?? UNASSIGNED) ?? 0) + 1);
    const memberCols = [...members].sort(
      (a, b) => (counts.get(b.userId) ?? 0) - (counts.get(a.userId) ?? 0),
    );
    return [
      { id: UNASSIGNED, label: 'Non assignées', member: null as OrgMember | null },
      ...memberCols.map((m) => ({ id: m.userId, label: m.displayName, member: m as OrgMember | null })),
    ];
  }, [members, openTasks]);

  const tasksOf = (colId: string) =>
    openTasks.filter((t) => (t.assigneeId ?? UNASSIGNED) === colId);

  const handleDrop = (colId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    const task = openTasks.find((t) => t.id === taskId);
    if (!task) return;
    const target = colId === UNASSIGNED ? null : colId;
    if ((task.assigneeId ?? null) !== target) onReassign(task, target);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" role="list" aria-label="Kanban par assigné">
      {columns.map((col) => {
        const colTasks = tasksOf(col.id);
        const overdue = colTasks.filter(isTaskOverdue).length;
        return (
          <div
            key={col.id}
            role="listitem"
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver((v) => (v === col.id ? null : v))}
            onDrop={(e) => handleDrop(col.id, e)}
            className={`w-64 shrink-0 rounded-2xl border bg-[rgb(var(--color-surface))] transition-colors ${
              dragOver === col.id ? 'border-indigo-500 bg-indigo-500/5' : 'border-[rgb(var(--color-border))]'
            }`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[rgb(var(--color-border))]">
              {col.member ? (
                <MemberAvatar avatar={col.member.avatar} name={col.member.displayName} size={22} />
              ) : (
                <span className="w-[22px] h-[22px] rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center">
                  <UserRound size={12} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                </span>
              )}
              <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">{col.label}</span>
              <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))] tabular-nums shrink-0">
                {colTasks.length}
                {overdue > 0 && <span className="text-red-500 font-semibold"> · {overdue} ⏰</span>}
              </span>
            </div>

            <div className="p-2 space-y-1.5 min-h-[64px] max-h-[60vh] overflow-y-auto">
              {colTasks.length === 0 && (
                <p className="text-xs text-[rgb(var(--color-text-muted))] text-center py-4">
                  Déposez une tâche ici
                </p>
              )}
              {colTasks.map((task) => {
                const project = projectById.get(task.projectId);
                const pColor = project ? projectColor(project.color) : null;
                const overdueTask = isTaskOverdue(task);
                const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
                return (
                  <button
                    key={task.id}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                    onClick={() => onOpenTask(task)}
                    aria-label={`Modifier la tâche ${task.name}`}
                    className="w-full text-left rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] px-3 py-2 hover:border-indigo-400 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <p className="text-sm text-[rgb(var(--color-text-primary))] line-clamp-2">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} title={priority.label} aria-hidden="true" />
                      {project && pColor && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                      {task.deadline && (
                        <span className={`ml-auto text-[10px] inline-flex items-center gap-0.5 shrink-0 ${overdueTask ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                          <CalendarClock size={10} aria-hidden="true" />
                          {format(parseISO(task.deadline), 'd MMM', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TeamProjectsKanban;
