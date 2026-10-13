// ═══════════════════════════════════════════════════════════════════
// « Modifier le projet » — le projet riche de la mig. 153 (M2)
//
// Nom, description, couleur, catégorie, responsable, statut, début et fin.
//
// ⚠️ Deux choses n'y sont PAS, et c'est voulu :
//   • l'ÉQUIPE : la changer change QUI LIT le projet (M5). Elle passe par le
//     menu de la carte et `ConfirmProjectAudienceDialog`, qui nomme la
//     nouvelle audience ; un champ de formulaire la changerait en silence ;
//   • la couleur n'est plus DÉRIVÉE de la catégorie. Choisir une catégorie
//     écrasait la couleur que l'équipe avait choisie (audit 2026-09-24) : la
//     catégorie s'affiche désormais en pastille, la couleur reste la sienne.
//
// Le responsable n'est modifiable qu'avec `project.edit` : le trigger
// `enforce_team_project_edit_scope` refuse qu'un responsable se remplace.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import type { OrgMember } from '@/modules/organizations';
import {
  useSetProjectMember, useTeamProjectMembers,
  type TeamProject, type TeamProjectStatus, type UpdateTeamProjectInput,
} from '@/modules/team-projects';
import MemberMultiSelectField from './MemberMultiSelectField';
import { PROJECT_COLOR_NAMES, projectColor } from './team-projects.helpers';
import { PROJECT_STATUSES } from './portfolio.helpers';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MenuSelect from '@/components/organization/MenuSelect';

interface ProjectEditDialogProps {
  project: TeamProject;
  members: OrgMember[];
  /** `project.edit` : autorise aussi le changement de responsable. */
  canChangeOwner: boolean;
  onSubmit: (input: UpdateTeamProjectInput) => Promise<unknown>;
  onClose: () => void;
}

const labelClass = 'block text-caption font-semibold uppercase tracking-wide mb-2 text-[rgb(var(--color-text-secondary))]';
const inputClass =
  'w-full px-3.5 h-11 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-sm bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))]';

/** Palette de couleurs du projet — les neuf noms fixes que Tailwind connaît. */
export const ProjectColorPicker = ({ value, onChange, label }: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  return (
  <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
    {PROJECT_COLOR_NAMES.map((name) => (
      <button
        key={name}
        type="button"
        role="radio"
        aria-checked={value === name}
        aria-label={tOrgAdmin(`colors.${name}` as 'colors.blue')}
        title={tOrgAdmin(`colors.${name}` as 'colors.blue')}
        onClick={() => onChange(name)}
        className={`w-8 h-8 rounded-full ${projectColor(name).dot} transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))] ring-offset-[rgb(var(--color-background))] ${
          value === name ? 'ring-2 ring-offset-2 ring-[rgb(var(--color-text-primary))] scale-110' : 'hover:scale-110'
        }`}
      />
    ))}
  </div>
  );
};

const ProjectEditDialog = ({ project, members, canChangeOwner, onSubmit, onClose }: ProjectEditDialogProps) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [color, setColor] = useState(project.color);
  const [categoryId, setCategoryId] = useState<string | null>(project.categoryId ?? null);
  // Responsables : `owner_id` en tête, puis les membres du projet au rôle `lead` (mig. 190).
  const { data: projectMembers } = useTeamProjectMembers(project.orgId);
  const setProjectMember = useSetProjectMember(project.orgId);
  const initialOwners = useMemo(() => {
    const leads = (projectMembers ?? [])
      .filter((pm) => pm.projectId === project.id && pm.role === 'lead' && pm.userId !== project.ownerId)
      .map((pm) => pm.userId);
    return project.ownerId ? [project.ownerId, ...leads] : leads;
  }, [projectMembers, project.id, project.ownerId]);
  const [ownerIds, setOwnerIds] = useState<string[]>(initialOwners);
  const [ownersTouched, setOwnersTouched] = useState(false);
  // Les membres arrivent après l'ouverture : on suit tant que rien n'est coché à la main.
  useEffect(() => { if (!ownersTouched) setOwnerIds(initialOwners); }, [initialOwners, ownersTouched]);
  const ownerId = ownerIds[0] ?? '';
  const [status, setStatus] = useState<TeamProjectStatus>(project.status ?? 'active');
  const [dueDate, setDueDate] = useState(project.dueDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: pf('edit.aria', { name: project.name }),
  });

  const submit = async () => {
    if (pending) return;
    if (!name.trim()) { setError(t('project.nameRequired')); return; }
    // N'envoie QUE ce qui a changé : un responsable qui renvoie `ownerId`
    // inchangé passerait, mais un patch minimal ne dépend d'aucune garde.
    const patch: UpdateTeamProjectInput = {};
    if (name.trim() !== project.name) patch.name = name.trim();
    if (description !== (project.description ?? '')) patch.description = description.trim() || null;
    if (color !== project.color) patch.color = color;
    if (categoryId !== (project.categoryId ?? null)) patch.categoryId = categoryId;
    if (canChangeOwner && ownerId !== (project.ownerId ?? '')) patch.ownerId = ownerId || null;
    if (status !== (project.status ?? 'active')) patch.status = status;
    // Plus de saisie du début : un ancien début devenu postérieur à l'échéance est effacé (CHECK de dates).
    if (project.startDate && dueDate && project.startDate > dueDate) patch.startDate = null;
    if (dueDate !== (project.dueDate ?? '')) patch.dueDate = dueDate || null;
    // Co-responsables : un coché devient `lead`, un décoché redevient contributeur
    // (il garde l'accès au projet ; on le retire depuis Membres du projet).
    const leadsBefore = initialOwners.filter((id) => id !== (project.ownerId ?? ''));
    const leadsAfter = ownerIds.slice(1);
    const memberChanges = canChangeOwner
      ? [
          ...leadsAfter.filter((id) => !leadsBefore.includes(id)).map((userId) => ({ userId, role: 'lead' as const })),
          ...leadsBefore
            .filter((id) => !leadsAfter.includes(id) && id !== ownerId)
            .map((userId) => ({ userId, role: 'contributor' as const })),
        ]
      : [];
    if (Object.keys(patch).length === 0 && memberChanges.length === 0) { onClose(); return; }
    setPending(true);
    setError(null);
    try {
      if (Object.keys(patch).length > 0) await onSubmit(patch);
      await Promise.all(
        memberChanges.map(({ userId, role }) => setProjectMember.mutateAsync({ projectId: project.id, userId, role })),
      );
      onClose();
    } catch {
      setPending(false); // déjà notifié par le hook (toast)
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden bg-[rgb(var(--color-surface))]"
      >
        <div className="flex justify-between items-center px-4 sm:px-6 py-2 border-b border-[rgb(var(--color-border))] gap-2 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold truncate text-[rgb(var(--color-text-primary))]">
            {pf('edit.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={pf('edit.close')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] disabled:opacity-50"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <form
          className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5 bg-[rgb(var(--color-background))]"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          {error && (
            <div role="alert" className="p-3 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="project-edit-name" className={labelClass}>{t('project.name')}</label>
            <input
              id="project-edit-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              maxLength={120}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="project-edit-description" className={labelClass}>{pf('edit.description')}</label>
            <textarea
              id="project-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder={pf('edit.descriptionPlaceholder')}
              className={`${inputClass} h-auto py-3 resize-y`}
            />
          </div>

          <div>
            <span className={labelClass}>{pf('edit.color')}</span>
            <ProjectColorPicker value={color} onChange={setColor} label={pf('edit.color')} />
          </div>

          <div>
            <span className={labelClass}>{t('project.category')}</span>
            <TeamCategoryTreeSelect orgId={project.orgId} value={categoryId} onChange={setCategoryId} />
            <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]">{pf('edit.categoryHint')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {canChangeOwner ? (
                <MemberMultiSelectField
                  label={pf('new.owners')}
                  labelClassName={labelClass}
                  members={members}
                  value={ownerIds}
                  onChange={(ids) => { setOwnersTouched(true); setOwnerIds(ids); }}
                  emptyLabel={pf('noOwner')}
                  className="h-11 rounded-lg border-slate-200 dark:border-slate-700"
                />
              ) : (
                <>
                  <span className={labelClass}>{pf('new.owners')}</span>
                  <p className="h-11 flex items-center text-sm text-[rgb(var(--color-text-secondary))]">
                    {initialOwners.length > 0
                      ? initialOwners.map((id) => members.find((m) => m.userId === id)?.displayName).filter(Boolean).join(', ')
                      : pf('noOwner')}
                  </p>
                </>
              )}
            </div>
            <div>
              <label htmlFor="project-edit-status" className={labelClass}>{pf('edit.status')}</label>
              <MenuSelect
                id="project-edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TeamProjectStatus)}
                className={inputClass}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{pf(`status.${s}`)}</option>
                ))}
              </MenuSelect>
            </div>
            <div>
              <label htmlFor="project-edit-due" className={labelClass}>{pf('edit.dueDate')}</label>
              <DatePicker id="project-edit-due" value={dueDate} onChange={(v) => { setDueDate(v); setError(null); }} className="h-11" popoverClassName="z-[10000]" />
            </div>
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('edit.ownerHint')}</p>
          {/* Soumission au clavier (Entrée dans un champ) : un bouton submit invisible. */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
        </form>

        <div className="px-4 sm:px-6 py-3 border-t border-[rgb(var(--color-border))] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0 bg-[rgb(var(--color-surface))]">
          <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11">
            {pf('edit.cancel')}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => void submit()}
            disabled={pending || !name.trim()}
            className="min-h-11 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0 disabled:opacity-40"
          >
            {pending ? (<><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {pf('edit.saving')}</>) : pf('edit.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ProjectEditDialog;
