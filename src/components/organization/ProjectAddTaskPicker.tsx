import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { STATUS_META } from './team-projects.helpers';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface ProjectAddTaskPickerProps {
  project: TeamProject;
  /** Tâches de l'organisation : on propose celles d'AUTRES projets, non terminées. */
  tasks: TeamTask[];
  projects: TeamProject[];
  /** Range la tâche choisie dans ce projet. */
  onPick: (task: TeamTask) => void;
  /** « Créer une tâche » : ouvre la modale de création, projet présélectionné. */
  onCreate: () => void;
  onClose: () => void;
}

/**
 * « Ajouter une tâche… » d'un projet en vue liste (2026-10-30) : un sélecteur
 * filtré par nom parmi les tâches ouvertes des autres projets, et en tête
 * « Créer une tâche », qui mène à la modale de création.
 */
const ProjectAddTaskPicker = ({ project, tasks, projects, onPick, onCreate, onClose }: ProjectAddTaskPickerProps) => {
  const { t } = useT('org');
  const [query, setQuery] = useState('');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, labelledBy: 'project-add-task-title' });

  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const candidates = tasks.filter((x) => x.projectId !== project.id && !x.completed);
    return (q ? candidates.filter((x) => x.name.toLowerCase().includes(q)) : candidates).slice(0, 60);
  }, [tasks, project.id, query]);

  return createPortal(
    <div
      ref={ref}
      {...dialogProps}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-[rgb(var(--color-surface))]"
      >
        <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border))] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="project-add-task-title" className="text-lg font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {t('project.addTaskPickerTitle')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <label className="relative block">
            <span className="sr-only">{t('project.addTaskPickerSearch')}</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('project.addTaskPickerSearch')}
              autoFocus
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))]"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <button
            type="button"
            onClick={onCreate}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> {t('project.addTaskPickerCreate')}
          </button>
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-[rgb(var(--color-text-muted))]">{t('project.addTaskPickerEmpty')}</p>
          ) : (
            <ul className="mt-1 border-t border-[rgb(var(--color-border))] divide-y divide-[rgb(var(--color-border))]">
              {shown.map((task) => {
                const from = projectName.get(task.projectId);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onPick(task)}
                      className="w-full min-h-11 flex items-center gap-3 px-2 py-2 text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[task.status].dot}`} aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-[rgb(var(--color-text-primary))]">{task.name}</span>
                        {from && <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">{from.name}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ProjectAddTaskPicker;
