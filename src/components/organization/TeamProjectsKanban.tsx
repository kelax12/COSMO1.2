import { useMemo, useState } from 'react';
import { CalendarClock, UserRound, Plus } from 'lucide-react';
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
  /** Remplace la liste des assignés d'une tâche. */
  onSetAssignees: (task: TeamTask, assigneeIds: string[]) => void;
  onOpenTask: (task: TeamTask) => void;
  /** Ouvre le sheet « attribuer / créer » pour une colonne (null = non assignées). */
  onAddToColumn: (memberId: string | null) => void;
}

export const KANBAN_UNASSIGNED = '__unassigned__';

/** Payload drag : id de la tâche + colonne d'origine (pour déplacer l'assignation). */
interface DragPayload {
  taskId: string;
  from: string;
}

/**
 * Vue Kanban « charge par personne » : une colonne par membre (+ non
 * assignées). Une tâche multi-assignée apparaît dans chaque colonne de ses
 * assignés. Glisser une carte déplace l'assignation d'une colonne à l'autre.
 */
const TeamProjectsKanban = ({ projects, tasks, members, onSetAssignees, onOpenTask, onAddToColumn }: TeamProjectsKanbanProps) => {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const openTasks = useMemo(() => sortOpenTasks(tasks.filter((t) => !t.completed)), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Colonnes : non assignées + tous les membres (les plus chargés d'abord).
  const columns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of openTasks) {
      if (t.assigneeIds.length === 0) counts.set(KANBAN_UNASSIGNED, (counts.get(KANBAN_UNASSIGNED) ?? 0) + 1);
      for (const uid of t.assigneeIds) counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    const memberCols = [...members].sort(
      (a, b) => (counts.get(b.userId) ?? 0) - (counts.get(a.userId) ?? 0),
    );
    return [
      { id: KANBAN_UNASSIGNED, label: 'Non assignées', member: null as OrgMember | null },
      ...memberCols.map((m) => ({ id: m.userId, label: m.displayName, member: m as OrgMember | null })),
    ];
  }, [members, openTasks]);

  const tasksOf = (colId: string) =>
    colId === KANBAN_UNASSIGNED
      ? openTasks.filter((t) => t.assigneeIds.length === 0)
      : openTasks.filter((t) => t.assigneeIds.includes(colId));

  const handleDrop = (colId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    let payload: DragPayload | null = null;
    try { payload = JSON.parse(e.dataTransfer.getData('text/plain')) as DragPayload; } catch { /* drag externe */ }
    if (!payload) return;
    const task = openTasks.find((t) => t.id === payload!.taskId);
    if (!task || colId === payload.from) return;

    // Déplace l'assignation : retire la colonne d'origine, ajoute la cible.
    let next = task.assigneeIds.filter((id) => id !== payload!.from);
    if (colId !== KANBAN_UNASSIGNED && !next.includes(colId)) next = [...next, colId];
    onSetAssignees(task, next);
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
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums">
                  {colTasks.length}
                  {overdue > 0 && <span className="text-red-500 font-semibold"> · {overdue} ⏰</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onAddToColumn(col.member ? col.id : null)}
                  aria-label={col.member ? `Attribuer une tâche à ${col.label}` : 'Ajouter une tâche non assignée'}
                  title="Attribuer ou créer une tâche"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
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
                const coAssignees = col.member
                  ? task.assigneeIds.filter((id) => id !== col.id)
                  : [];
                return (
                  <button
                    key={task.id}
                    type="button"
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, from: col.id } satisfies DragPayload))
                    }
                    onClick={() => onOpenTask(task)}
                    aria-label={`Modifier la tâche ${task.name}${overdueTask ? ' (en retard)' : ''}`}
                    className={`w-full text-left rounded-xl border px-3 py-2 transition-colors cursor-grab active:cursor-grabbing ${
                      overdueTask
                        ? 'border-red-400/60 dark:border-red-700/60 bg-red-50 dark:bg-red-900/25 hover:border-red-500'
                        : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] hover:border-indigo-400'
                    }`}
                  >
                    <p className="text-sm text-[rgb(var(--color-text-primary))] line-clamp-2">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} title={priority.label} aria-hidden="true" />
                      {project && pColor && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                      {/* Co-assignés (tâche partagée entre plusieurs personnes) */}
                      {coAssignees.length > 0 && (
                        <span className="flex -space-x-1 shrink-0" title={`Aussi assignée à ${coAssignees
                          .map((id) => members.find((m) => m.userId === id)?.displayName)
                          .filter(Boolean)
                          .join(', ')}`}>
                          {coAssignees.slice(0, 2).map((id) => {
                            const m = members.find((x) => x.userId === id);
                            return m ? (
                              <span key={id} className="rounded-full ring-1 ring-[rgb(var(--color-surface))]">
                                <MemberAvatar avatar={m.avatar} name={m.displayName} size={16} />
                              </span>
                            ) : null;
                          })}
                          {coAssignees.length > 2 && (
                            <span className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] pl-1.5">+{coAssignees.length - 2}</span>
                          )}
                        </span>
                      )}
                      {task.deadline && (
                        <span className={`ml-auto text-[10px] inline-flex items-center gap-0.5 shrink-0 ${overdueTask ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
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
