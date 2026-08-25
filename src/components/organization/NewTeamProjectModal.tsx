import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Trash2, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type { CreateTeamProjectInput } from '@/modules/team-projects';
import { PROJECT_COLOR_NAMES, PROJECT_COLORS, PRIORITY_META } from './team-projects.helpers';
import AssigneesPicker from './AssigneesPicker';
import TeamCategoryPicker from './TeamCategoryPicker';
import { useT } from '@/i18n/useT';

/** Tâche initiale saisie dans le popup (créée après le projet). */
export interface DraftTask {
  name: string;
  assigneeIds: string[];
}

interface NewTeamProjectModalProps {
  orgId: string;
  teams: OrgTeam[];
  members: OrgMember[];
  /** Équipe présélectionnée (depuis le filtre courant) — '' = toute l'entreprise. */
  defaultTeamId?: string;
  /** Crée le projet PUIS ses tâches initiales. Rejette en cas d'échec. */
  onSubmit: (input: CreateTeamProjectInput, tasks: DraftTask[]) => Promise<void>;
  onClose: () => void;
}

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };
const inputClass =
  'w-full px-[0.875425rem] h-[2.626275rem] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-[0.875425rem]';
const inputStyle = { backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' };

/**
 * Popup de création de projet d'équipe (même langage visuel que TeamTaskModal) :
 * nom, couleur, équipe de rattachement (= collaborateurs qui y ont accès) et une
 * liste de tâches initiales, chacune assignable à des membres.
 */
const NewTeamProjectModal = ({ orgId, teams, members, defaultTeamId, onSubmit, onClose }: NewTeamProjectModalProps) => {
  const { t, tp } = useT('org');
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(defaultTeamId ?? '');
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [composerName, setComposerName] = useState('');
  const [composerAssignees, setComposerAssignees] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const addTask = () => {
    const n = composerName.trim();
    if (!n) return;
    setTasks((prev) => [...prev, { name: n, assigneeIds: composerAssignees }]);
    setComposerName('');
    setComposerAssignees([]);
  };

  const removeTask = (i: number) => setTasks((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (pending) return;
    if (!name.trim()) { setError(t('project.nameRequired')); return; }
    setPending(true);
    setError(null);
    // Une tâche en cours de saisie non ajoutée est incluse (évite la perte).
    const pendingDraft = composerName.trim()
      ? [...tasks, { name: composerName.trim(), assigneeIds: composerAssignees }]
      : tasks;
    try {
      await onSubmit({ name: name.trim(), color, teamId: teamId || null, categoryId }, pendingDraft);
      onClose();
    } catch {
      setPending(false); // erreur déjà notifiée par les hooks (toast)
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('project.newAria')}
      >
        {/* Poignée de glissement RETIRÉE, pas oubliée : elle ne faisait rien, et le geste n'a pas sa place sur un formulaire (docs/MOBILE.md §3). */}
        <div className="sm:hidden pt-3 shrink-0" aria-hidden="true" />

        {/* Header */}
        <div
          className="flex justify-between items-center px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b gap-2 shrink-0"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {t('common.newProject')}
          </h2>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label={t('project.closeForm')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 font-medium" role="alert">
              {error}
            </div>
          )}

          {/* Nom */}
          <div>
            <label htmlFor="new-project-name" className={labelClass} style={labelStyle}>{t('project.name')}</label>
            <input
              id="new-project-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              placeholder={t('project.namePlaceholder')}
              autoFocus
              maxLength={120}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Couleur */}
          <div>
            <span className={labelClass} style={labelStyle}>{t('project.color')}</span>
            <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={t('project.colorAria')}>
              {PROJECT_COLOR_NAMES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Couleur ${c}`}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-background))] ring-blue-500' : ''}`}
                >
                  <span className={`w-5 h-5 rounded-full ${PROJECT_COLORS[c].dot}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Catégorie — distincte du projet (mig. 111) : une étiquette
              transverse, pas une unité de travail. Facultative. */}
          <div>
            <span className={labelClass} style={labelStyle}>{t('project.category')}</span>
            <TeamCategoryPicker orgId={orgId} value={categoryId} onChange={setCategoryId} />
          </div>

          {/* Équipe / collaborateurs */}
          <div>
            <label htmlFor="new-project-team" className={labelClass} style={labelStyle}>{t('project.team')}</label>
            <select
              id="new-project-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">{t('project.wholeOrg')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{t('project.teamOption', { name: team.name })}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              {teamId
                ? t('project.teamHint')
                : t('project.visibleWholeOrg')}
            </p>
          </div>

          {/* Tâches initiales */}
          <div>
            <span className={labelClass} style={labelStyle}>
              <ListTodo size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />
              {t('project.initialTasks')}
            </span>

            {tasks.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {tasks.map((draft, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                    style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_META[3].dot}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {draft.name}
                    </span>
                    {draft.assigneeIds.length > 0 && (
                      <span className="text-[11px] shrink-0" style={{ color: 'rgb(var(--color-text-muted))' }}>
                        {tp('assign.assigneeCount', draft.assigneeIds.length)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTask(i)}
                      aria-label={t('projects.removeTaskAria', { name: draft.name })}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 shrink-0"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Composer d'ajout de tâche */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={composerName}
                onChange={(e) => setComposerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                placeholder={t('project.addTask')}
                maxLength={500}
                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-[rgb(var(--color-accent-solid))] transition-colors"
                style={inputStyle}
              />
              <AssigneesPicker members={members} value={composerAssignees} onChange={setComposerAssignees} />
              <button
                type="button"
                onClick={addTask}
                disabled={!composerName.trim()}
                aria-label={t('project.addTaskToList')}
                className="h-10 px-3 rounded-lg bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] disabled:opacity-40 text-sm font-semibold inline-flex items-center gap-1 shrink-0"
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[0.874rem] border-t flex flex-col-reverse sm:flex-row sm:justify-end items-stretch sm:items-center gap-2 sm:gap-3 shrink-0"
          style={{
            borderColor: 'rgb(var(--color-border))',
            backgroundColor: 'rgb(var(--color-surface))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.6555rem)',
          }}
        >
          <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11 w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className={`min-h-11 w-full sm:w-auto ${
              pending || !name.trim()
                ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40 !border-0'
                : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0'
            }`}
          >
            {pending ? (
              <>
                <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                <span>{t('project.creating')}</span>
              </>
            ) : (
              tasks.length > 0 ? tp('project.createWithTasks', tasks.length) : t('project.create')
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default NewTeamProjectModal;
