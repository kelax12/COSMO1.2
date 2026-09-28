import { useState } from 'react';
import { FolderKanban, ClipboardList, Plus, ListChecks } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { OrgTeam } from '@/modules/org-teams';
import {
  useTeamTasks,
  useUpdateTeamProject,
  useUpdateTeamTask,
  type TeamProject,
} from '@/modules/team-projects';
import { showUndoToast } from '@/lib/undo-toast';
import { useT } from '@/i18n/useT';

/** Éléments listés par sous-menu ; au-delà, la recherche prend le relais. */
const LIST_LIMIT = 30;

const itemClass = 'truncate';

const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="px-1.5 pb-1.5">
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // Le menu Radix capte les touches pour sa saisie semi-automatique.
      onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full px-2.5 py-1.5 text-sm rounded-md border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
    />
  </div>
);

const matches = (name: string, q: string) => !q || name.toLowerCase().includes(q.trim().toLowerCase());

interface TeamAssignMenusProps {
  orgId: string;
  team: OrgTeam;
  /** Projets de l'organisation. */
  projects: TeamProject[];
  onNewProject: () => void;
  onNewTask: () => void;
}

/**
 * « Assigner un projet » et « Assigner une tâche » d'une carte d'équipe :
 * chacun propose un élément EXISTANT ou d'en créer un (2026-09-28 ; le menu
 * ouvrait directement la création).
 *
 * Projet existant : l'équipe devient son équipe principale (`teamId`).
 * Tâche existante : elle est déplacée dans un projet de l'équipe.
 */
const TeamAssignMenus = ({ orgId, team, projects, onNewProject, onNewTask }: TeamAssignMenusProps) => {
  const { t } = useT('org');
  const [projectQuery, setProjectQuery] = useState('');
  const [taskQuery, setTaskQuery] = useState('');
  const { data: tasks = [], isLoading: loadingTasks } = useTeamTasks(orgId, undefined, { background: true });
  const updateProject = useUpdateTeamProject(orgId);
  const updateTask = useUpdateTeamTask(orgId);

  const open = projects.filter((p) => !p.archivedAt);
  const own = open.filter((p) => p.teamId === team.id);
  const ownIds = new Set(own.map((p) => p.id));
  const otherProjects = open.filter((p) => p.teamId !== team.id && matches(p.name, projectQuery));
  const otherTasks = tasks.filter((x) => !x.completed && !ownIds.has(x.projectId) && matches(x.name, taskQuery));

  const assignProject = (p: TeamProject) => {
    const previous = p.teamId ?? null;
    updateProject.mutate({ projectId: p.id, input: { teamId: team.id } }, {
      onSuccess: () => showUndoToast(t('team.menu.projectAssigned', { team: team.name }), () =>
        updateProject.mutate({ projectId: p.id, input: { teamId: previous } })),
    });
  };
  const moveTask = (taskId: string, fromProjectId: string, to: TeamProject) =>
    updateTask.mutate({ taskId, input: { projectId: to.id } }, {
      onSuccess: () => showUndoToast(t('team.menu.taskAssigned', { project: to.name }), () =>
        updateTask.mutate({ taskId, input: { projectId: fromProjectId } })),
    });

  const empty = (label: string) => (
    <p className="px-2 py-3 text-xs text-center text-[rgb(var(--color-text-muted))]">{label}</p>
  );

  return (
    <>
      <DropdownMenuSub onOpenChange={(o) => { if (!o) setProjectQuery(''); }}>
        <DropdownMenuSubTrigger>
          <FolderKanban size={14} aria-hidden="true" /> {t('team.menu.assignProject')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-60">
          <DropdownMenuItem onClick={onNewProject}>
            <Plus size={14} aria-hidden="true" /> {t('team.menu.newProject')}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ListChecks size={14} aria-hidden="true" /> {t('team.menu.existingProject')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60 max-h-72 overflow-y-auto">
              <SearchBox value={projectQuery} onChange={setProjectQuery} placeholder={t('team.menu.searchProject')} />
              {otherProjects.length === 0 && empty(t('team.menu.noProjectToAssign'))}
              {otherProjects.slice(0, LIST_LIMIT).map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => assignProject(p)}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                  <span className={itemClass}>{p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSub onOpenChange={(o) => { if (!o) setTaskQuery(''); }}>
        <DropdownMenuSubTrigger>
          <ClipboardList size={14} aria-hidden="true" /> {t('team.menu.assignTask')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-60">
          <DropdownMenuItem onClick={onNewTask}>
            <Plus size={14} aria-hidden="true" /> {t('team.menu.newTask')}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ListChecks size={14} aria-hidden="true" /> {t('team.menu.existingTask')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 max-h-72 overflow-y-auto">
              {own.length === 0 ? (
                empty(t('team.menu.needProject'))
              ) : (
                <>
                  <SearchBox value={taskQuery} onChange={setTaskQuery} placeholder={t('assign.searchPlaceholder')} />
                  {!loadingTasks && otherTasks.length === 0 && empty(t('team.menu.noTaskToAssign'))}
                  {otherTasks.slice(0, LIST_LIMIT).map((task) =>
                    own.length === 1 ? (
                      <DropdownMenuItem key={task.id} onClick={() => moveTask(task.id, task.projectId, own[0])}>
                        <span className={itemClass}>{task.name}</span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuSub key={task.id}>
                        <DropdownMenuSubTrigger>
                          <span className={itemClass}>{task.name}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          <DropdownMenuLabel>{t('team.menu.moveTo')}</DropdownMenuLabel>
                          {own.map((p) => (
                            <DropdownMenuItem key={p.id} onClick={() => moveTask(task.id, task.projectId, p)}>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                              <span className={itemClass}>{p.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ),
                  )}
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

export default TeamAssignMenus;
