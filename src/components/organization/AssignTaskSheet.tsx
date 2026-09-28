import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { projectColor, PRIORITY_META, isTaskOverdue, priorityLabelOf } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface AssignTaskSheetProps {
  /** Membre cible (null = colonne « Non assignées » → création seule). */
  member: OrgMember | null;
  projects: TeamProject[];
  /** Tâches ouvertes des projets visibles. */
  tasks: TeamTask[];
  /** Ajoute le membre aux assignés d'une tâche existante. */
  onAssign: (task: TeamTask) => void;
  /**
   * Bascule vers le modal de création (assigné présélectionné), dans le
   * projet choisi ici. `null` : aucun choix, la fiche le demandera.
   */
  onCreateNew: (projectId: string | null) => void;
  onClose: () => void;
}

/**
 * Kanban « + » d'une colonne : attribuer une tâche EXISTANTE au membre
 * (liste des ouvertes où il ne figure pas encore, filtrable) ou en créer
 * une nouvelle via le modal complet.
 *
 * Le projet se CHOISIT ici (audit des popups, 2026-09-25) : la création
 * tombait dans le premier projet de la liste quand on n'en disait rien. Il
 * filtre aussi les tâches existantes. Un seul projet ouvert : il est pris.
 */
const AssignTaskSheet = ({ member, projects, tasks, onAssign, onCreateNew, onClose }: AssignTaskSheetProps) => {
  const { t, tp } = useT('org');
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string>(projects.length === 1 ? projects[0].id : '');

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Candidates : ouvertes, pas déjà assignées au membre cible.
  const candidates = useMemo(() => {
    const base = tasks.filter(
      (t) => !t.completed && (!member || !t.assigneeIds.includes(member.userId)) && (!projectId || t.projectId === projectId),
    );
    const q = search.trim().toLowerCase();
    return q ? base.filter((t) => t.name.toLowerCase().includes(q)) : base;
  }, [tasks, member, search, projectId]);

  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Le nom accessible est celui que la surface portait deja.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: onClose,
    label: member ? t('assign.assignTo', { name: member.displayName }) : t('assign.addUnassigned'),
  });

  const createButton = (
    <button
      type="button"
      onClick={() => onCreateNew(projectId || null)}
      className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
    >
      <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
        <Plus size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {t('assign.createNew')}
        </span>
        <span className="block text-xs text-[rgb(var(--color-text-muted))] truncate">
          {projectId
            ? t('popups.assignSheet.inProject', { name: projects.find((p) => p.id === projectId)?.name ?? '' })
            : t('popups.assignSheet.pickLater')}
        </span>
      </span>
    </button>
  );

  // Grand format (maquette B, 2026-09-28) : filtres dans l'en-tête, tableau à
  // colonnes, création en bas de liste. Une colonne sur téléphone.
  const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_150px_80px_80px_80px] items-center gap-x-3';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-3xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        {/* En-tête : identité, puis projet et recherche sur la même ligne. */}
        <div className="p-5 pb-3 border-b border-[rgb(var(--color-border))] space-y-3">
          <div className="flex items-center gap-3">
            {member && <MemberAvatar avatar={member.avatar} name={member.displayName} size={36} />}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">
                {member ? t('assign.assignToShort', { name: member.displayName }) : t('assign.newUnassigned')}
              </h2>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {member ? t('assign.pickOrCreate') : t('assign.createWithout')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {(projects.length > 1 || member) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {projects.length > 1 && (
                <select
                  id="assign-sheet-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-label={t('popups.assignSheet.project')}
                  className="sm:w-56 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))]"
                >
                  <option value="">{t('popups.assignSheet.allProjects')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              {member && (
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('assign.searchPlaceholder')}
                    aria-label={t('assign.searchExisting')}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {member ? (
          <div className="overflow-y-auto p-3 flex-1 min-h-[120px]">
            {candidates.length > 0 && (
              <div className={`${ROW} hidden sm:grid px-3 pb-2 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]`} aria-hidden="true">
                <span>{t('popups.member.colTask')}</span>
                <span>{t('popups.member.colProject')}</span>
                <span>{t('popups.member.colAssignees')}</span>
                <span>{t('popups.member.colDeadline')}</span>
                <span />
              </div>
            )}
            {candidates.length === 0 && (
              <p className="text-xs text-[rgb(var(--color-text-muted))] text-center py-6">
                {search.trim() ? t('assign.noMatch') : t('assign.noOpenTask')}
              </p>
            )}
            <div className="space-y-1">
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
                    aria-label={t('projects.assignTaskAria', { name: task.name })}
                    className={`group w-full text-left ${ROW} rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] px-3 py-2.5 transition-colors`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} role="img" aria-label={priorityLabelOf(task.priority)} title={priorityLabelOf(task.priority)} />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">{task.name}</span>
                    </span>
                    <span className="hidden sm:block min-w-0">
                      {project && pColor && (
                        <span className={`inline-block max-w-full text-[11px] font-semibold px-2 py-0.5 rounded-full truncate ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:block text-xs text-[rgb(var(--color-text-muted))]">
                      {task.assigneeIds.length > 0 ? tp('assign.assignees', task.assigneeIds.length) : ''}
                    </span>
                    <span className={`text-xs inline-flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                      {task.deadline && (
                        <>
                          <CalendarClock size={11} aria-hidden="true" />
                          {format(parseISO(task.deadline), 'd MMM', { locale: getDateLocale() })}
                        </>
                      )}
                    </span>
                    <span className="hidden sm:block text-right text-xs font-semibold text-[rgb(var(--color-accent))] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      {t('popups.member.assignAction')}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pt-3">{createButton}</div>
          </div>
        ) : (
          <div className="p-3">{createButton}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default AssignTaskSheet;
