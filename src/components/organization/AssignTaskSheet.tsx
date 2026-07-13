import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { projectColor, PRIORITY_META, isTaskOverdue } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';

interface AssignTaskSheetProps {
  /** Membre cible (null = colonne « Non assignées » → création seule). */
  member: OrgMember | null;
  projects: TeamProject[];
  /** Tâches ouvertes des projets visibles. */
  tasks: TeamTask[];
  /** Ajoute le membre aux assignés d'une tâche existante. */
  onAssign: (task: TeamTask) => void;
  /** Bascule vers le modal de création (assigné présélectionné). */
  onCreateNew: () => void;
  onClose: () => void;
}

/**
 * Kanban « + » d'une colonne : attribuer une tâche EXISTANTE au membre
 * (liste des ouvertes où il ne figure pas encore, filtrable) ou en créer
 * une nouvelle via le modal complet.
 */
const AssignTaskSheet = ({ member, projects, tasks, onAssign, onCreateNew, onClose }: AssignTaskSheetProps) => {
  const [search, setSearch] = useState('');

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Candidates : ouvertes, pas déjà assignées au membre cible.
  const candidates = useMemo(() => {
    const base = tasks.filter((t) => !t.completed && (!member || !t.assigneeIds.includes(member.userId)));
    const q = search.trim().toLowerCase();
    return q ? base.filter((t) => t.name.toLowerCase().includes(q)) : base;
  }, [tasks, member, search]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={member ? `Attribuer une tâche à ${member.displayName}` : 'Ajouter une tâche non assignée'}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 p-5 pb-3 border-b border-[rgb(var(--color-border))]">
          {member && <MemberAvatar avatar={member.avatar} name={member.displayName} size={36} />}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">
              {member ? `Attribuer à ${member.displayName}` : 'Nouvelle tâche non assignée'}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              {member ? 'Choisissez une tâche existante ou créez-en une.' : 'Créez une tâche sans assigné.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Créer une nouvelle tâche */}
        <div className="p-3 pb-0">
          <button
            type="button"
            onClick={onCreateNew}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <Plus size={16} aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
              Créer une nouvelle tâche
            </span>
          </button>
        </div>

        {/* Attribuer une existante */}
        {member && (
          <>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une tâche…"
                  aria-label="Rechercher une tâche existante"
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-3 space-y-1 flex-1 min-h-[120px]">
              {candidates.length === 0 && (
                <p className="text-xs text-[rgb(var(--color-text-muted))] text-center py-6">
                  {search.trim() ? 'Aucune tâche ne correspond.' : 'Aucune tâche ouverte à attribuer.'}
                </p>
              )}
              {candidates.map((task) => {
                const project = projectById.get(task.projectId);
                const pColor = project ? projectColor(project.color) : null;
                const overdue = isTaskOverdue(task);
                const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => { onAssign(task); onClose(); }}
                    aria-label={`Attribuer la tâche ${task.name}`}
                    className="w-full text-left rounded-xl border border-transparent hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] px-3 py-2 transition-colors"
                  >
                    <p className="text-sm text-[rgb(var(--color-text-primary))] truncate">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} title={priority.label} aria-hidden="true" />
                      {project && pColor && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                      {task.assigneeIds.length > 0 && (
                        <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                          {task.assigneeIds.length} assigné{task.assigneeIds.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {task.deadline && (
                        <span className={`ml-auto text-[10px] inline-flex items-center gap-0.5 shrink-0 ${overdue ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                          <CalendarClock size={10} aria-hidden="true" />
                          {format(parseISO(task.deadline), 'd MMM', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default AssignTaskSheet;
