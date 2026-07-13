import { useMemo, useState } from 'react';
import {
  Plus, ChevronDown, ChevronRight, UsersRound, MoreHorizontal,
  Pencil, Archive, ArchiveRestore, Palette, Flag, CalendarClock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type { TeamProject, TeamTask, UpdateTeamProjectInput, CreateTeamTaskInput } from '@/modules/team-projects';
import {
  projectColor, PROJECT_COLOR_NAMES, PROJECT_COLORS, PRIORITY_META,
  sortOpenTasks, sortCompletedTasks, isTaskOverdue,
} from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import AssigneePicker from './AssigneePicker';
import TeamTaskRow from './TeamTaskRow';

interface TeamProjectCardProps {
  project: TeamProject;
  /** Tâches du projet (déjà filtrées par assigné le cas échéant). */
  tasks: TeamTask[];
  members: OrgMember[];
  teams: OrgTeam[];
  currentUserId?: string;
  isManager: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** True quand un filtre assigné est actif (adapte l'empty state). */
  assigneeFiltered: boolean;
  onCreateTask: (input: CreateTeamTaskInput) => void;
  createPending: boolean;
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, assigneeId: string | null) => void;
  onDelete: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onUpdateProject: (input: UpdateTeamProjectInput) => void;
}

/** Carte d'un projet : header (couleur, progression, contributeurs, retard, menu), tâches triées, composer. */
const TeamProjectCard = ({
  project, tasks, members, teams, currentUserId, isManager,
  collapsed, onToggleCollapse, assigneeFiltered,
  onCreateTask, createPending, onToggleComplete, onReassign, onDelete, onOpenTask,
  onUpdateProject,
}: TeamProjectCardProps) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerName, setComposerName] = useState('');
  const [composerPriority, setComposerPriority] = useState(3);
  const [composerDeadline, setComposerDeadline] = useState('');
  const [composerAssignee, setComposerAssignee] = useState<string | null>(currentUserId ?? null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [showCompleted, setShowCompleted] = useState(false);

  const color = projectColor(project.color);
  const teamName = teams.find((t) => t.id === project.teamId)?.name;
  const archived = !!project.archivedAt;

  const openTasks = useMemo(() => sortOpenTasks(tasks.filter((t) => !t.completed)), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks.filter((t) => t.completed)), [tasks]);
  const overdueCount = openTasks.filter(isTaskOverdue).length;
  const done = completedTasks.length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  // Contributeurs (assignés distincts) + charge pour le tooltip.
  const contributors = useMemo(() => {
    const byId = new Map<string, { member: OrgMember; open: number; overdue: number }>();
    for (const task of tasks) {
      if (!task.assigneeId) continue;
      const m = members.find((x) => x.userId === task.assigneeId);
      if (!m) continue;
      const entry = byId.get(m.userId) ?? { member: m, open: 0, overdue: 0 };
      if (!task.completed) {
        entry.open += 1;
        if (isTaskOverdue(task)) entry.overdue += 1;
      }
      byId.set(m.userId, entry);
    }
    return [...byId.values()].sort((a, b) => b.open - a.open);
  }, [tasks, members]);

  const handleAddTask = () => {
    const name = composerName.trim();
    if (!name) return;
    onCreateTask({
      projectId: project.id,
      name,
      priority: composerPriority,
      deadline: composerDeadline,
      assigneeId: composerAssignee,
    });
    setComposerName('');
  };

  const commitRename = () => {
    const name = renameValue.trim();
    setRenaming(false);
    if (name && name !== project.name) onUpdateProject({ name });
    else setRenameValue(project.name);
  };

  return (
    <section className={`rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] overflow-hidden ${archived ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
        >
          {collapsed ? <ChevronRight size={16} className="shrink-0" aria-hidden="true" /> : <ChevronDown size={16} className="shrink-0" aria-hidden="true" />}
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
          {renaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setRenaming(false); setRenameValue(project.name); }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              maxLength={120}
              aria-label="Renommer le projet"
              className="h-7 px-2 rounded-md border border-indigo-400 bg-[rgb(var(--color-background))] text-sm font-bold focus:outline-none min-w-0 flex-1"
            />
          ) : (
            <span className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">{project.name}</span>
          )}
          {teamName && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${color.soft}`}>
              <UsersRound size={10} aria-hidden="true" /> {teamName}
            </span>
          )}
          {archived && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] shrink-0">
              Archivé
            </span>
          )}
          {overdueCount > 0 && !archived && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0"
              title={`${overdueCount} tâche${overdueCount > 1 ? 's' : ''} en retard`}
            >
              {overdueCount} en retard
            </span>
          )}

          {/* Contributeurs (avatars empilés + charge au survol) */}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {contributors.length > 0 && (
              <span className="flex -space-x-1.5" aria-label={`${contributors.length} contributeurs`}>
                {contributors.slice(0, 4).map(({ member, open, overdue }) => (
                  <span
                    key={member.userId}
                    className="rounded-full ring-2 ring-[rgb(var(--color-surface))]"
                    title={`${member.displayName} — ${open} tâche${open > 1 ? 's' : ''} ouverte${open > 1 ? 's' : ''}${overdue > 0 ? `, ${overdue} en retard` : ''}`}
                  >
                    <MemberAvatar avatar={member.avatar} name={member.displayName} size={22} />
                  </span>
                ))}
                {contributors.length > 4 && (
                  <span className="w-[22px] h-[22px] rounded-full bg-[rgb(var(--color-hover))] ring-2 ring-[rgb(var(--color-surface))] flex items-center justify-center text-[9px] font-bold text-[rgb(var(--color-text-muted))]">
                    +{contributors.length - 4}
                  </span>
                )}
              </span>
            )}
            {/* Progression */}
            <span className="flex items-center gap-1.5" title={`${done}/${total} tâches terminées (${progress} %)`}>
              <span className="w-16 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden hidden sm:block">
                <span className={`block h-full rounded-full ${color.dot} transition-all`} style={{ width: `${progress}%` }} />
              </span>
              <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums">{done}/{total}</span>
            </span>
          </span>
        </button>

        {/* Menu manager */}
        {isManager && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions du projet ${project.name}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => { setRenameValue(project.name); setRenaming(true); }}>
                <Pencil size={14} aria-hidden="true" /> Renommer
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette size={14} aria-hidden="true" /> Couleur
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="grid grid-cols-3 gap-1 p-2">
                  {PROJECT_COLOR_NAMES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateProject({ color: c })}
                      aria-label={`Couleur ${c}`}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--color-hover))] ${project.color === c ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                      <span className={`w-4 h-4 rounded-full ${PROJECT_COLORS[c].dot}`} />
                    </button>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {teams.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UsersRound size={14} aria-hidden="true" /> Équipe
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem onClick={() => onUpdateProject({ teamId: null })}>
                      Toute l'entreprise {!project.teamId && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    {teams.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => onUpdateProject({ teamId: t.id })}>
                        <span className="truncate">{t.name}</span>
                        {project.teamId === t.id && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              {archived ? (
                <DropdownMenuItem onClick={() => onUpdateProject({ archived: false })}>
                  <ArchiveRestore size={14} aria-hidden="true" /> Restaurer
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onUpdateProject({ archived: true })}>
                  <Archive size={14} aria-hidden="true" /> Archiver
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!collapsed && (
        <div className="px-2 pb-2">
          {/* Tâches ouvertes (deadline ↑ puis priorité ↓) */}
          {openTasks.map((task) => (
            <TeamTaskRow
              key={task.id}
              task={task}
              members={members}
              onToggleComplete={onToggleComplete}
              onReassign={onReassign}
              onDelete={onDelete}
              onOpen={onOpenTask}
            />
          ))}

          {tasks.length === 0 && (
            <div className="px-3 py-3 flex items-center gap-3">
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {assigneeFiltered ? 'Aucune tâche pour ce filtre.' : 'Aucune tâche.'}
              </p>
              {!assigneeFiltered && !archived && (
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-600"
                >
                  Créer la première tâche
                </button>
              )}
            </div>
          )}

          {/* Section terminées repliable */}
          {completedTasks.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
              >
                {showCompleted ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                Terminées ({completedTasks.length})
              </button>
              {showCompleted && completedTasks.map((task) => (
                <TeamTaskRow
                  key={task.id}
                  task={task}
                  members={members}
                  onToggleComplete={onToggleComplete}
                  onReassign={onReassign}
                  onDelete={onDelete}
                  onOpen={onOpenTask}
                />
              ))}
            </div>
          )}

          {/* Composer d'ajout de tâche */}
          {!archived && (composerOpen ? (
            <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
              <input
                type="text"
                value={composerName}
                onChange={(e) => setComposerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTask();
                  if (e.key === 'Escape') { setComposerOpen(false); setComposerName(''); }
                }}
                placeholder="Nouvelle tâche…"
                autoFocus
                maxLength={500}
                className="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {/* Priorité */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Priorité : ${PRIORITY_META[composerPriority].label}`}
                  title={PRIORITY_META[composerPriority].label}
                  className="h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Flag size={13} aria-hidden="true" />
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_META[composerPriority].dot}`} aria-hidden="true" />
                  P{composerPriority}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <DropdownMenuItem key={p} onClick={() => setComposerPriority(p)}>
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                      {PRIORITY_META[p].label}
                      {composerPriority === p && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Deadline */}
              <label
                className="h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-text-secondary))] cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500/40"
                title="Deadline"
              >
                <CalendarClock size={13} aria-hidden="true" />
                <input
                  type="date"
                  value={composerDeadline}
                  onChange={(e) => setComposerDeadline(e.target.value)}
                  aria-label="Deadline de la nouvelle tâche"
                  className="bg-transparent text-xs focus:outline-none w-[105px] text-[rgb(var(--color-text-secondary))]"
                />
              </label>
              {/* Assigné */}
              <AssigneePicker members={members} value={composerAssignee} onChange={setComposerAssignee} />
              <button
                type="button"
                onClick={handleAddTask}
                disabled={!composerName.trim() || createPending}
                className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Ajouter
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:text-indigo-500 transition-colors"
            >
              <Plus size={15} aria-hidden="true" /> Ajouter une tâche
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default TeamProjectCard;
