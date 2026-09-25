// ═══════════════════════════════════════════════════════════════════
// Les CHAMPS d'une tâche d'équipe
//
// FRONTIÈRE : ce composant ne sait ni enregistrer, ni fermer, ni commenter.
// Il rend un formulaire (statut, nom, description, catégorie, étiquettes,
// projet, priorité, dates, durée, assignés) et remonte chaque saisie. `TeamTaskModal` garde
// l'enveloppe : la sauvegarde, les commentaires, les sous-tâches, le panneau
// latéral, et la création silencieuse déclenchée par un premier commentaire.
//
// ⚠️ Deux détails qui ne se devinent pas et se perdraient à la réécriture :
//   • l'échéance passe par le calendrier COSMO, JAMAIS le picker natif (il
//     ignore le thème, la locale de l'app et les presets) — et son popover
//     monte à `z-[10000]`, un cran au-dessus de la modale à `z-[9999]` ;
//   • les assignés passent par `MemberPickList`, le MÊME sélecteur que le
//     panneau latéral desktop et que « Attribuer à quelqu'un » : recherche,
//     groupes d'équipe, pagination, aucune copie qui pourrait diverger.
//
// 2026-09-25 (audit des popups) : le statut arrive EN TÊTE, et la création de
// projet en ligne est retirée. C'était un troisième chemin de création de
// projet, sans équipe : le projet naissait visible par toute l'entreprise.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import type { TeamProject, TeamTaskStatus } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { DatePicker } from '@/components/ui/date-picker';
import DescriptionField from '@/components/DescriptionField';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import MemberPickList from './MemberPickList';
import { PRIORITY_META, STATUS_META, STATUS_ORDER, projectColor } from './team-projects.helpers';

import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };
// Hauteur extraite pour que le groupe priorité (pas un input, mais aligné à côté) la partage.
//
// 🔴 `h-11` (44 px) et non plus `h-[2.626275rem]` (42,02 px) — C-70. Les cinq
// pilules de priorité ET le sélecteur de date héritent de cette valeur : à
// 42 px ils étaient SIX commandes sous la cible WCAG 2.5.5, pour deux pixels.
// La corriger ici les corrige toutes, et garde la rangée alignée — le groupe
// priorité est en `items-stretch`, donc une hauteur différente de celle des
// champs se verrait immédiatement.
const inputHeightClass = 'h-11';
const inputClass =
  `w-full px-[0.875425rem] ${inputHeightClass} border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-[0.875425rem]`;
const inputStyle = { backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' };

interface TeamTaskFieldsProps {
  orgId: string;
  projects: TeamProject[];

  status: TeamTaskStatus;
  onStatusChange: (value: TeamTaskStatus) => void;
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
  /** Début planifié (mig. 153) — '' = aucun. La frise en fait une barre. */
  startDate: string;
  onStartDateChange: (value: string) => void;
  /**
   * Aucun projet présélectionné (création depuis le kanban, audit 2026-09-24) :
   * le sélecteur ouvre sur « Choisir un projet… » au lieu du premier venu.
   */
  requireProjectChoice?: boolean;
  estimatedTime: string;
  onEstimatedTimeChange: (value: string) => void;

  /** Étiquettes (mig. 093), rendues sous la catégorie. */
  labelsField?: React.ReactNode;

  assigneeIds: string[];
  onAssigneeIdsChange: (ids: string[]) => void;
  /** Membres à portée d'assignation (mig. 115), assignés existants compris. */
  assignableMembers: OrgMember[];
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
  status,
  onStatusChange,
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
  startDate,
  onStartDateChange,
  requireProjectChoice = false,
  estimatedTime,
  onEstimatedTimeChange,
  labelsField,
  assigneeIds,
  onAssigneeIdsChange,
  assignableMembers,
  showAssignees,
  onToggleAssignees,
  isWide,
  priorityLabelOf,
  onSubmit,
}: TeamTaskFieldsProps) => {
  const { t } = useT('org');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
      {/* Statut EN TÊTE : c'est la première chose qu'on vient changer sur une
          tâche existante, et la fiche ne permettait pas de le faire. */}
      <div>
        <span className={labelClass} style={labelStyle}>{t('popups.task.status')}</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('popups.task.status')}>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => onStatusChange(s)}
              className={`inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                status === s
                  ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10 text-[rgb(var(--color-text-primary))]'
                  : 'border-slate-200 dark:border-slate-700 bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden="true" />
              {t(STATUS_META[s].labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

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
        <TeamCategoryTreeSelect orgId={orgId} value={categoryId} onChange={onCategoryChange} />
      </div>

      {labelsField}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="team-task-project" className={labelClass} style={labelStyle}>{t('taskModal.project')}</label>
          <select
            id="team-task-project"
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className={inputClass}
            style={inputStyle}
            aria-invalid={requireProjectChoice && !projectId ? true : undefined}
          >
            {(requireProjectChoice || !projectId) && (
              <option value="" disabled>{t('taskModal.chooseProject')}</option>
            )}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
                    : 'border-slate-200 dark:border-slate-700 bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))]'
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
          <label htmlFor="team-task-start" className={labelClass} style={labelStyle}>{t('taskModal.startDate')}</label>
          {/* Début planifié (mig. 153) : même calendrier, même cran de z-index
              que l'échéance. Le serveur refuse un début après l'échéance. */}
          <DatePicker
            id="team-task-start"
            value={startDate}
            onChange={onStartDateChange}
            placeholder={t('taskModal.startDatePlaceholder')}
            className={inputHeightClass}
            popoverClassName="z-[10000]"
          />
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
          {/* Même design +/- que son homologue en mode personnel
              (DesktopDetailsStep) : un pas de 5 min de chaque côté du champ,
              jamais sous 0. */}
          <div className="flex items-stretch gap-2">
            <input
              id="team-task-time"
              type="number"
              min={0}
              max={100000}
              value={estimatedTime}
              onChange={(e) => onEstimatedTimeChange(e.target.value)}
              placeholder={t('taskModal.timePlaceholder')}
              className={`flex-1 min-w-0 ${inputClass} appearance-none`}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => {
                const cur = Number(estimatedTime) || 0;
                onEstimatedTimeChange(String(Math.max(0, cur - 5)));
              }}
              className={`w-11 ${inputHeightClass} flex items-center justify-center border rounded-lg hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors shrink-0`}
              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' }}
              aria-label={t('taskModal.estimatedTimeDecrease')}
            >
              <Minus size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = Number(estimatedTime) || 0;
                onEstimatedTimeChange(String(cur + 5));
              }}
              className={`w-11 ${inputHeightClass} flex items-center justify-center border rounded-lg hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors shrink-0`}
              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' }}
              aria-label={t('taskModal.estimatedTimeIncrease')}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Assignés — disclosure mobile/tablette uniquement : à partir de
          `lg`, un panneau dédié à gauche du modal reprend ce rôle en
          permanence (pas besoin de replier ce qu'il y a la place de
          montrer). Même état, même `MemberPickList`. */}
      {!isWide && (
        <div className="border-t pt-4" style={{ borderColor: 'rgb(var(--color-border))' }}>
          <button
            type="button"
            onClick={onToggleAssignees}
            aria-expanded={showAssignees}
            // 20 px de haut mesurés : cible portée à 44 sans changer le
            // dessin ni pousser la liste d'assignés qui suit (C-70).
            className={`flex items-center gap-2 text-sm font-semibold hover:text-blue-500 transition-colors ${TAP_AREA_44_Y}`}
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
            <div className="mt-3 rounded-xl border overflow-hidden max-h-72 overflow-y-auto" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}>
              <MemberPickList
                members={assignableMembers}
                value={assigneeIds}
                onChange={onAssigneeIdsChange}
                teamGroupsOrgId={orgId}
                label={t('taskModal.assignTask')}
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
};

export default TeamTaskFields;
