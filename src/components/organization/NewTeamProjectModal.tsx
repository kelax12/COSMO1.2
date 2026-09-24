import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Trash2, ListTodo, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type {
  CreateTeamProjectInput,
  DraftProjectMilestone,
  DraftProjectTask,
  TeamProject,
  TeamProjectTemplatePayload,
} from '@/modules/team-projects';
import { PRIORITY_META } from './team-projects.helpers';
import { instantiateTemplate, todayLocal } from './portfolio.helpers';
import { BUILT_IN_TEMPLATES, builtInPayload } from './project-templates';
import AssigneesPicker from './AssigneesPicker';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import { ProjectColorPicker } from './ProjectEditDialog';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

/** Tâche initiale saisie dans le popup. */
export interface DraftTask {
  name: string;
  assigneeIds: string[];
}

interface NewTeamProjectModalProps {
  orgId: string;
  teams: OrgTeam[];
  members: OrgMember[];
  /** Responsable par défaut : celui qui crée le projet en répond. */
  currentUserId?: string;
  /** Équipe présélectionnée (depuis le filtre courant) — '' = toute l'entreprise. */
  defaultTeamId?: string;
  /** Modèles enregistrés par l'entreprise (mig. 153). */
  templates: TeamProject[];
  /** Modèle présélectionné (« Nouveau projet depuis ce modèle »). */
  initialTemplateId?: string;
  /**
   * Crée le projet, ses tâches et ses jalons en UNE transaction
   * (`create_team_project_with_tasks`). Rejette en cas d'échec : rien n'est créé.
   */
  onSubmit: (
    input: CreateTeamProjectInput,
    tasks: DraftProjectTask[],
    milestones: DraftProjectMilestone[],
  ) => Promise<void>;
  onClose: () => void;
}

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };
const inputClass =
  'w-full px-[0.875425rem] h-[2.626275rem] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-[0.875425rem]';
const inputStyle = { backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' };

/** Valeur du sélecteur de modèle : `org:<id>`, `builtin:<clé>` ou ''. */
type TemplateChoice = string;

/**
 * Popup de création de projet d'équipe (même langage visuel que TeamTaskModal) :
 * nom, couleur, catégorie, équipe, responsable, dates, description, un modèle
 * de départ éventuel et des tâches initiales assignables.
 *
 * La couleur est CHOISIE, plus dérivée de la catégorie : la dériver écrasait
 * le choix de l'équipe à chaque changement de catégorie (audit 2026-09-24).
 */
const NewTeamProjectModal = ({
  orgId, teams, members, currentUserId, defaultTeamId, templates, initialTemplateId, onSubmit, onClose,
}: NewTeamProjectModalProps) => {
  const { t, tp } = useT('org');
  const initialOrgTemplate = templates.find((tpl) => tpl.id === initialTemplateId);
  const [name, setName] = useState('');
  const [color, setColor] = useState(initialOrgTemplate?.color ?? 'blue');
  const [categoryId, setCategoryId] = useState<string | null>(initialOrgTemplate?.categoryId ?? null);
  const [teamId, setTeamId] = useState(initialOrgTemplate?.teamId ?? defaultTeamId ?? '');
  const [ownerId, setOwnerId] = useState(currentUserId ?? '');
  const [description, setDescription] = useState(initialOrgTemplate?.description ?? '');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice>(initialOrgTemplate ? `org:${initialOrgTemplate.id}` : '');
  const [templateTasks, setTemplateTasks] = useState<TeamProjectTemplatePayload['tasks']>(
    initialOrgTemplate?.templatePayload?.tasks ?? [],
  );
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [composerName, setComposerName] = useState('');
  const [composerAssignees, setComposerAssignees] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const payloadOf = (choice: TemplateChoice): TeamProjectTemplatePayload | null => {
    if (choice.startsWith('org:')) return templates.find((tpl) => `org:${tpl.id}` === choice)?.templatePayload ?? null;
    if (choice.startsWith('builtin:')) {
      const def = BUILT_IN_TEMPLATES.find((b) => `builtin:${b.key}` === choice);
      return def ? builtInPayload(def, (key) => t(key as 'templates.sprint')) : null;
    }
    return null;
  };
  // Recalculé à chaque rendu : quelques entrées, et un `useMemo` sur une
  // fonction non stable n'aurait rien mémorisé.
  const selectedPayload = payloadOf(templateChoice);

  const pickTemplate = (choice: TemplateChoice) => {
    setTemplateChoice(choice);
    const payload = payloadOf(choice);
    setTemplateTasks(payload?.tasks ?? []);
    const orgTpl = choice.startsWith('org:') ? templates.find((tpl) => `org:${tpl.id}` === choice) : undefined;
    if (orgTpl) {
      setColor(orgTpl.color);
      // L'audience du modèle est une proposition, visible et modifiable ici.
      setTeamId(orgTpl.teamId ?? '');
      setCategoryId(orgTpl.categoryId ?? null);
      if (!description) setDescription(orgTpl.description ?? '');
    }
  };

  const addTask = () => {
    const n = composerName.trim();
    if (!n) return;
    setTasks((prev) => [...prev, { name: n, assigneeIds: composerAssignees }]);
    setComposerName('');
    setComposerAssignees([]);
  };

  const removeTask = (i: number) => setTasks((prev) => prev.filter((_, idx) => idx !== i));
  const removeTemplateTask = (i: number) => setTemplateTasks((prev) => prev.filter((_, idx) => idx !== i));
  const taskTotal = tasks.length + templateTasks.length;

  const handleSubmit = async () => {
    if (pending) return;
    if (!name.trim()) { setError(t('project.nameRequired')); return; }
    if (startDate && dueDate && startDate > dueDate) { setError(t('portfolio.edit.datesInvalid')); return; }
    setPending(true);
    setError(null);
    // Une tâche en cours de saisie non ajoutée est incluse (évite la perte).
    const manual = composerName.trim()
      ? [...tasks, { name: composerName.trim(), assigneeIds: composerAssignees }]
      : tasks;
    // Le modèle se DATE au moment de créer, depuis le début choisi (ou aujourd'hui).
    const fromTemplate = selectedPayload
      ? instantiateTemplate({ ...selectedPayload, tasks: templateTasks }, startDate || todayLocal())
      : { tasks: [], milestones: [], dueDate: null };
    try {
      await onSubmit(
        {
          name: name.trim(),
          color,
          teamId: teamId || null,
          categoryId,
          ownerId: ownerId || null,
          description: description.trim() || null,
          startDate: startDate || (selectedPayload ? todayLocal() : null),
          dueDate: dueDate || fromTemplate.dueDate,
        },
        [...fromTemplate.tasks, ...manual.map((d) => ({ name: d.name, assigneeIds: d.assigneeIds }))],
        fromTemplate.milestones,
      );
      onClose();
    } catch {
      setPending(false); // erreur déjà notifiée par le hook (toast) — rien n'a été créé
    }
  };

  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Le voile refuse de fermer pendant l'envoi : Echap aussi.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: t('project.newAria'),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        {/* Poignée de glissement RETIRÉE, pas oubliée : elle ne faisait rien, et le geste n'a pas sa place sur un formulaire (docs/MOBILE.md §3). */}
        <div className="sm:hidden pt-3 shrink-0" aria-hidden="true" />

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

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 font-medium" role="alert">
              {error}
            </div>
          )}

          {/* Modèle de départ (mig. 153) : ceux de l'entreprise, puis ceux de COSMO. */}
          <div>
            <label htmlFor="new-project-template" className={labelClass} style={labelStyle}>
              <LayoutTemplate size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />
              {t('templates.pickLabel')}
            </label>
            <select
              id="new-project-template"
              value={templateChoice}
              onChange={(e) => pickTemplate(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">{t('templates.clear')}</option>
              {templates.length > 0 && (
                <optgroup label={t('portfolio.templates.orgGroup')}>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={`org:${tpl.id}`}>{tpl.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t('portfolio.templates.builtInGroup')}>
                {BUILT_IN_TEMPLATES.map((b) => (
                  <option key={b.key} value={`builtin:${b.key}`}>{t(`templates.${b.key}`)}</option>
                ))}
              </optgroup>
            </select>
          </div>

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

          <div>
            <span className={labelClass} style={labelStyle}>{t('portfolio.new.color')}</span>
            <ProjectColorPicker value={color} onChange={setColor} label={t('portfolio.new.color')} />
          </div>

          {/* Catégorie — une étiquette transverse (mig. 111), affichée en
              pastille. Elle ne décide plus de la couleur. */}
          <div>
            <span className={labelClass} style={labelStyle}>{t('project.category')}</span>
            <TeamCategoryTreeSelect orgId={orgId} value={categoryId} onChange={setCategoryId} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
            <div>
              <label htmlFor="new-project-owner" className={labelClass} style={labelStyle}>{t('portfolio.new.owner')}</label>
              <select
                id="new-project-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">{t('portfolio.noOwner')}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.userId === currentUserId ? t('projects.you') : m.displayName}</option>
                ))}
              </select>
            </div>
            <p className="sm:col-span-2 -mt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              {teamId ? t('project.teamHint') : t('project.visibleWholeOrg')}
            </p>
            <div>
              <label htmlFor="new-project-start" className={labelClass} style={labelStyle}>
                {selectedPayload ? t('portfolio.templates.startLabel') : t('portfolio.new.startDate')}
              </label>
              <DatePicker id="new-project-start" value={startDate} onChange={(v) => { setStartDate(v); setError(null); }} className="h-[2.626275rem]" popoverClassName="z-[10000]" />
            </div>
            <div>
              <label htmlFor="new-project-due" className={labelClass} style={labelStyle}>{t('portfolio.new.dueDate')}</label>
              <DatePicker id="new-project-due" value={dueDate} onChange={(v) => { setDueDate(v); setError(null); }} className="h-[2.626275rem]" popoverClassName="z-[10000]" minDate={startDate || undefined} />
            </div>
          </div>

          <div>
            <label htmlFor="new-project-description" className={labelClass} style={labelStyle}>{t('portfolio.new.description')}</label>
            <textarea
              id="new-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={2}
              placeholder={t('portfolio.edit.descriptionPlaceholder')}
              className={`${inputClass} h-auto py-2.5 resize-y`}
              style={inputStyle}
            />
          </div>

          <div>
            <span className={labelClass} style={labelStyle}>
              <ListTodo size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />
              {t('project.initialTasks')}
            </span>

            {(templateTasks.length > 0 || tasks.length > 0) && (
              <ul className="space-y-1.5 mb-2">
                {templateTasks.map((draft, i) => (
                  <li
                    key={`tpl-${i}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed"
                    style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}
                  >
                    <LayoutTemplate size={12} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>{draft.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTemplateTask(i)}
                      aria-label={t('projects.removeTaskAria', { name: draft.name })}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 shrink-0"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
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
            {taskTotal > 0 && (
              <p className="mt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('portfolio.new.atomicHint')}</p>
            )}
          </div>
        </div>

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
              taskTotal > 0 ? tp('project.createWithTasks', taskTotal) : t('project.create')
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default NewTeamProjectModal;
