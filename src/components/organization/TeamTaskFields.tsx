// ═══════════════════════════════════════════════════════════════════
// Les CHAMPS d'une tâche d'équipe
//
// FRONTIÈRE : ce composant ne sait ni enregistrer, ni fermer, ni commenter.
// Il rend un formulaire — nom, description, catégorie, projet, priorité,
// échéance, durée, assignés — et remonte chaque saisie. `TeamTaskModal` garde
// l'enveloppe : la sauvegarde, les commentaires, les sous-tâches, le panneau
// latéral, et la création silencieuse déclenchée par un premier commentaire.
//
// ⚠️ Deux détails qui ne se devinent pas et se perdraient à la réécriture :
//   • l'échéance passe par le calendrier COSMO, JAMAIS le picker natif (il
//     ignore le thème, la locale de l'app et les presets) — et son popover
//     monte à `z-[10000]`, un cran au-dessus de la modale à `z-[9999]` ;
//   • la ligne d'assigné est rendue par UNE fonction (`renderAssigneeRow`,
//     fournie par l'appelant) partagée avec le panneau latéral desktop :
//     même état, même comportement, aucune copie qui pourrait diverger.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { TeamProject } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { DatePicker } from '@/components/ui/date-picker';
import DescriptionField from '@/components/DescriptionField';
import AddCategoryButton from '@/components/AddCategoryButton';
import TeamCategoryPicker from './TeamCategoryPicker';
import TeamAssigneeGroups from './TeamAssigneeGroups';
import { PRIORITY_META, projectColor } from './team-projects.helpers';

import { useT } from '@/i18n/useT';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };
// Hauteur extraite pour que le groupe priorité (pas un input, mais aligné à côté) la partage.
const inputHeightClass = 'h-[2.626275rem]';
const inputClass =
  `w-full px-[0.875425rem] ${inputHeightClass} border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-[0.875425rem]`;
const inputStyle = { backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' };

interface TeamTaskFieldsProps {
  orgId: string;
  projects: TeamProject[];

  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  categoryId: string | null;
  onCategoryChange: (value: string | null) => void;
  projectId: string;
  onProjectChange: (value: string) => void;
  priority: number | null;
  onPriorityChange: (value: number) => void;
  deadline: string;
  onDeadlineChange: (value: string) => void;
  estimatedTime: string;
  onEstimatedTimeChange: (value: string) => void;

  /** Création de projet en ligne, sans quitter la tâche. */
  showNewProjectInput: boolean;
  onOpenNewProject: () => void;
  onCancelNewProject: () => void;
  newProjectName: string;
  onNewProjectNameChange: (value: string) => void;
  onSubmitNewProject: () => void;
  isCreatingProject: boolean;

  assigneeIds: string[];
  onAssigneeIdsChange: (ids: string[]) => void;
  /** Membres à portée d'assignation (mig. 115), assignés existants compris. */
  assignableMembers: OrgMember[];
  renderAssigneeRow: (member: OrgMember) => React.ReactNode;
  showAssignees: boolean;
  onToggleAssignees: () => void;
  /**
   * `false` sur mobile/tablette : le repli des assignés n'existe que là. À
   * partir de `lg`, un panneau latéral permanent joue ce rôle.
   */
  isWide: boolean;

  priorityLabelOf: (priority: number) => string;
  onSubmit: () => void;
}

const TeamTaskFields = ({
  orgId,
  projects,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  categoryId,
  onCategoryChange,
  projectId,
  onProjectChange,
  priority,
  onPriorityChange,
  deadline,
  onDeadlineChange,
  estimatedTime,
  onEstimatedTimeChange,
  showNewProjectInput,
  onOpenNewProject,
  onCancelNewProject,
  newProjectName,
  onNewProjectNameChange,
  onSubmitNewProject,
  isCreatingProject,
  assigneeIds,
  onAssigneeIdsChange,
  assignableMembers,
  renderAssigneeRow,
  showAssignees,
  onToggleAssignees,
  isWide,
  priorityLabelOf,
  onSubmit,
}: TeamTaskFieldsProps) => {
  const { t } = useT('org');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
      <div>
        <label htmlFor="team-task-name" className={labelClass} style={labelStyle}>{t('taskModal.name')}</label>
        <input
          id="team-task-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('taskModal.namePlaceholder')}
          autoFocus
          maxLength={500}
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="team-task-desc" className={labelClass} style={labelStyle}>{t('taskModal.description')}</label>
        <DescriptionField
          id="team-task-desc"
          value={description}
          onChange={onDescriptionChange}
          rows={3}
          placeholder={t('taskModal.descriptionPlaceholder')}
          expandedTitle={t('taskModal.description')}
          className={`${inputClass} h-auto py-3 resize-y min-h-[66.5323px]`}
          style={inputStyle}
        />
      </div>

      {/* Catégorie (mig. 111) — distincte du projet, jamais héritée de
          lui : une tâche porte sa propre catégorie. */}
      <div>
        <span className={labelClass} style={labelStyle}>{t('project.category')}</span>
        <TeamCategoryPicker orgId={orgId} value={categoryId} onChange={onCategoryChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="team-task-project" className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>{t('taskModal.project')}</label>
            {/* Créer un projet sans quitter la tâche — même pattern que
                « + Ajouter » pour une catégorie côté tâche personnelle. */}
            <AddCategoryButton onClick={onOpenNewProject} ariaLabel={t('taskModal.createProjectAria')} />
          </div>
          <select
            id="team-task-project"
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {showNewProjectInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => onNewProjectNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSubmitNewProject(); }
                  else if (e.key === 'Escape') onCancelNewProject();
                }}
                placeholder={t('taskModal.projectNamePlaceholder')}
                className="flex-1 min-w-0 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] border-[rgb(var(--color-border))]"
                style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
              />
              <button
                type="button"
                disabled={newProjectName.trim().length < 2 || isCreatingProject}
                onClick={onSubmitNewProject}
                className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 transition-colors"
              >
                {t('taskModal.createProjectCta')}
              </button>
            </div>
          )}
          {projectId && (
            <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              <span className={`w-2 h-2 rounded-full ${projectColor(projects.find((p) => p.id === projectId)?.color ?? 'blue').dot}`} aria-hidden="true" />
              {t('taskModal.teamProject')}
            </span>
          )}
        </div>

        <div>
          <span className={labelClass} style={labelStyle}>{t('taskModal.priority')}</span>
          <div className={`flex gap-1.5 ${inputHeightClass} items-stretch`} role="radiogroup" aria-label={t('taskModal.priority')}>
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                aria-label={priorityLabelOf(p)}
                title={priorityLabelOf(p)}
                onClick={() => onPriorityChange(p)}
                className={`flex-1 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                  priority === p
                    ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-[rgb(var(--color-hover))]'
                }`}
                style={{ color: priority === p ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="team-task-deadline" className={labelClass} style={labelStyle}>{t('taskModal.deadline')}</label>
          {/* Calendrier COSMO, jamais le picker natif du navigateur : il
              ignore le thème, la locale de l'app et les presets. */}
          <DatePicker
            id="team-task-deadline"
            value={deadline}
            onChange={onDeadlineChange}
            placeholder={t('taskModal.deadlinePlaceholder')}
            className={inputHeightClass}
            // Cette modale monte à z-[9999] : au z-[100] par défaut, le
            // calendrier s'ouvrirait derrière elle. `z-[10000]` est le
            // cran « popover DANS une feuille portalisée ».
            popoverClassName="z-[10000]"
          />
        </div>

        <div>
          <label htmlFor="team-task-time" className={labelClass} style={labelStyle}>{t('taskModal.estimatedTime')}</label>
          <input
            id="team-task-time"
            type="number"
            min={0}
            max={100000}
            value={estimatedTime}
            onChange={(e) => onEstimatedTimeChange(e.target.value)}
            placeholder={t('taskModal.timePlaceholder')}
            className={`${inputClass} appearance-none`}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Assignés — disclosure mobile/tablette uniquement : à partir de
          `lg`, un panneau dédié à gauche du modal reprend ce rôle en
          permanence (pas besoin de replier ce qu'il y a la place de
          montrer). Même état, même `renderAssigneeRow`. */}
      {!isWide && (
        <div className="border-t pt-4" style={{ borderColor: 'rgb(var(--color-border))' }}>
          <button
            type="button"
            onClick={onToggleAssignees}
            aria-expanded={showAssignees}
            className="flex items-center gap-2 text-sm font-semibold hover:text-blue-500 transition-colors"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <ChevronRight size={16} aria-hidden="true" className={`transition-transform ${showAssignees ? 'rotate-90' : ''}`} />
            {t('taskModal.assignTask')}
            {assigneeIds.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-[rgb(var(--color-accent-solid))]/10 text-blue-500">
                {assigneeIds.length}
              </span>
            )}
          </button>
          {showAssignees && (
            <div className="mt-3 rounded-xl border overflow-hidden max-h-56 overflow-y-auto" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}>
              <TeamAssigneeGroups orgId={orgId} value={assigneeIds} onChange={onAssigneeIdsChange} />
              {assignableMembers.map(renderAssigneeRow)}
            </div>
          )}
        </div>
      )}
    </form>
  );
};

export default TeamTaskFields;
