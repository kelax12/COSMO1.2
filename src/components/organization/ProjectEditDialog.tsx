// ═══════════════════════════════════════════════════════════════════
// Formulaire de projet — LE SEUL, en création comme en modification
//
// 2026-10-30 (décision d'Axel) : la modale de création (`NewTeamProjectModal`)
// est supprimée. Elle proposait des options que la modification n'avait pas
// (modèles, tâches initiales, couleur) ; il n'en reste qu'une, celle-ci.
//
//   • plus de choix de COULEUR : le projet prend celle de sa catégorie (la plus
//     proche de la palette fixe, `projectColorFromCategory`) ;
//   • l'ÉQUIPE fixe QUI LIT le projet (M5). À la création, l'audience est dite
//     sous le champ ; en modification, la changer passe d'abord par
//     `ConfirmProjectAudienceDialog`, qui nomme la nouvelle audience.
//
// Le responsable n'est modifiable qu'avec `project.edit` : le trigger
// `enforce_team_project_edit_scope` refuse qu'un responsable se remplace.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import type { OrgMember } from '@/modules/organizations';
import {
  useSetProjectMember, useTeamProjectMembers,
  type CreateTeamProjectInput, type TeamProject, type TeamProjectStatus, type UpdateTeamProjectInput,
} from '@/modules/team-projects';
import { useOrgTeamMembers, type OrgTeam } from '@/modules/org-teams';
import { useOrgSettings } from '@/modules/org-config';
import { useTeamCategories } from '@/modules/team-categories';
import ConfirmProjectAudienceDialog from './ConfirmProjectAudienceDialog';
import { projectAudience } from './audience.helpers';
import MemberMultiSelectField from './MemberMultiSelectField';
import { projectColorFromCategory } from './team-projects.helpers';
import { PROJECT_STATUSES } from './portfolio.helpers';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MenuSelect from '@/components/organization/MenuSelect';

interface ProjectEditDialogProps {
  /** Projet modifié ; absent = création. */
  project?: TeamProject;
  /** Organisation : celle du projet en modification, requise en création. */
  orgId?: string;
  members: OrgMember[];
  teams?: OrgTeam[];
  /** `project.edit` : autorise aussi le changement de responsable et d'équipe. */
  canChangeOwner: boolean;
  /** Création : responsable proposé (celui qui crée en répond). */
  currentUserId?: string;
  /** Création : équipe présélectionnée (filtre courant) — '' = toute l'entreprise. */
  defaultTeamId?: string;
  onSubmit?: (input: UpdateTeamProjectInput) => Promise<unknown>;
  /** Création : crée le projet ; `coLeadIds` deviennent co-responsables (mig. 190). */
  onCreate?: (input: CreateTeamProjectInput, coLeadIds: string[]) => Promise<unknown>;
  onClose: () => void;
}

const labelClass = 'block text-caption font-semibold uppercase tracking-wide mb-2 text-[rgb(var(--color-text-secondary))]';
const inputClass =
  'w-full px-3.5 h-11 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-sm bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))]';

const ProjectEditDialog = ({
  project, orgId: orgIdProp, members, teams = [], canChangeOwner, currentUserId, defaultTeamId = '',
  onSubmit, onCreate, onClose,
}: ProjectEditDialogProps) => {
  const { t, tp } = useT('org');
  const creating = !project;
  const orgId = project?.orgId ?? orgIdProp ?? '';
  const { t: pf } = useT('portfolio');
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(project?.categoryId ?? null);
  const { data: categories = [] } = useTeamCategories(orgId);
  const [teamId, setTeamId] = useState(project?.teamId ?? defaultTeamId);
  const [teamTouched, setTeamTouched] = useState(false);
  // Changement d'équipe en modification : confirmé avant d'écrire (M5).
  const [confirmAudience, setConfirmAudience] = useState(false);
  const { data: teamMembers = [] } = useOrgTeamMembers(orgId);
  // Audience PROPOSÉE (mig. 195) : « une équipe » présélectionne la première
  // équipe du créateur, une seule fois, sans écraser un choix ni une équipe imposée.
  const { data: orgSettings } = useOrgSettings(orgId);
  useEffect(() => {
    if (!creating || teamTouched || teamId || defaultTeamId) return;
    if (orgSettings?.defaultProjectAudience !== 'team') return;
    const mine = teamMembers.find((tm) => tm.userId === currentUserId);
    if (mine) setTeamId(mine.teamId);
  }, [creating, orgSettings?.defaultProjectAudience, teamMembers, currentUserId, teamTouched, teamId, defaultTeamId]);
  const audience = projectAudience(
    members,
    teamId ? teamMembers.filter((tm) => tm.teamId === teamId).map((tm) => tm.userId) : null,
  );
  // Responsables : `owner_id` en tête, puis les membres du projet au rôle `lead` (mig. 190).
  const { data: projectMembers } = useTeamProjectMembers(orgId);
  const setProjectMember = useSetProjectMember(orgId);
  const initialOwners = useMemo(() => {
    if (!project) return currentUserId ? [currentUserId] : [];
    const leads = (projectMembers ?? [])
      .filter((pm) => pm.projectId === project.id && pm.role === 'lead' && pm.userId !== project.ownerId)
      .map((pm) => pm.userId);
    return project.ownerId ? [project.ownerId, ...leads] : leads;
  }, [projectMembers, project, currentUserId]);
  const [ownerIds, setOwnerIds] = useState<string[]>(initialOwners);
  const [ownersTouched, setOwnersTouched] = useState(false);
  // Les membres arrivent après l'ouverture : on suit tant que rien n'est coché à la main.
  useEffect(() => { if (!ownersTouched) setOwnerIds(initialOwners); }, [initialOwners, ownersTouched]);
  const ownerId = ownerIds[0] ?? '';
  const [status, setStatus] = useState<TeamProjectStatus>(project?.status ?? 'active');
  const [dueDate, setDueDate] = useState(project?.dueDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: project ? pf('edit.aria', { name: project.name }) : t('project.newAria'),
  });

  /** Couleur du projet = celle de sa catégorie (2026-10-30) ; sans catégorie, on garde l'actuelle. */
  const colorFor = (catId: string | null) => {
    const hex = categories.find((c) => c.id === catId)?.color;
    return hex ? projectColorFromCategory(hex) : project?.color ?? 'blue';
  };

  const create = async () => {
    setPending(true);
    setError(null);
    try {
      await onCreate?.(
        {
          name: name.trim(),
          color: colorFor(categoryId),
          teamId: teamId || null,
          categoryId,
          ownerId: ownerIds[0] ?? null,
          description: description.trim() || null,
          status,
          startDate: null,
          dueDate: dueDate || null,
        },
        ownerIds.slice(1),
      );
      onClose();
    } catch {
      setPending(false); // déjà notifié par le hook (toast) : rien n'a été créé
    }
  };

  const submit = async (audienceConfirmed = false) => {
    if (pending) return;
    if (!name.trim()) { setError(t('project.nameRequired')); return; }
    if (!project) { await create(); return; }
    const teamChanged = canChangeOwner && (teamId || null) !== (project.teamId ?? null);
    if (teamChanged && !audienceConfirmed) { setConfirmAudience(true); return; }
    // N'envoie QUE ce qui a changé : un responsable qui renvoie `ownerId`
    // inchangé passerait, mais un patch minimal ne dépend d'aucune garde.
    const patch: UpdateTeamProjectInput = {};
    if (name.trim() !== project.name) patch.name = name.trim();
    if (description !== (project.description ?? '')) patch.description = description.trim() || null;
    if (categoryId !== (project.categoryId ?? null)) {
      patch.categoryId = categoryId;
      const nextColor = colorFor(categoryId);
      if (nextColor !== project.color) patch.color = nextColor;
    }
    if (teamChanged) patch.teamId = teamId || null;
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
      if (Object.keys(patch).length > 0) await onSubmit?.(patch);
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
            {creating ? t('common.newProject') : pf('edit.title')}
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

          <div data-guide-id="project-form-name">
            <label htmlFor="project-edit-name" className={labelClass}>{t('project.name')}</label>
            <input
              id="project-edit-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              maxLength={120}
              placeholder={t('project.namePlaceholder')}
              autoFocus={creating}
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

          {/* Catégorie et fin sur la même ligne (2026-10-30) ; la catégorie donne sa couleur au projet. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className={labelClass}>{t('project.category')}</span>
              <TeamCategoryTreeSelect orgId={orgId} value={categoryId} onChange={setCategoryId} />
            </div>
            <div data-guide-id="project-form-due">
              <label htmlFor="project-edit-due" className={labelClass}>{pf('edit.dueDate')}</label>
              <DatePicker id="project-edit-due" value={dueDate} onChange={(v) => { setDueDate(v); setError(null); }} className="h-11" popoverClassName="z-[10000]" />
            </div>
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
          </div>

          {canChangeOwner && (
            <div data-guide-id="project-form-team">
              <label htmlFor="project-edit-team" className={labelClass}>{t('project.team')}</label>
              <MenuSelect
                id="project-edit-team"
                value={teamId}
                onChange={(e) => { setTeamTouched(true); setTeamId(e.target.value); }}
                className={inputClass}
              >
                <option value="">{t('project.wholeOrg')}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{t('project.teamOption', { name: team.name })}</option>
                ))}
              </MenuSelect>
              <p
                className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs ${
                  audience.wholeOrg ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]'
                }`}
                role="status"
              >
                <Eye size={13} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  {audience.wholeOrg
                    ? tp('popups.project.audienceOrg', audience.count)
                    : tp('popups.project.audienceTeam', audience.count, { team: teams.find((tm) => tm.id === teamId)?.name ?? '' })}
                </span>
              </p>
            </div>
          )}
          {!creating && <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('edit.ownerHint')}</p>}
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
            {pending
              ? (<><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {creating ? t('project.creating') : pf('edit.saving')}</>)
              : creating ? t('project.create') : pf('edit.save')}
          </Button>
        </div>
      </div>
      {confirmAudience && project && (
        <ConfirmProjectAudienceDialog
          projectName={project.name}
          targetTeamName={teamId ? teams.find((team) => team.id === teamId)?.name ?? null : null}
          orgMemberCount={members.length}
          onConfirm={() => { setConfirmAudience(false); void submit(true); }}
          onCancel={() => setConfirmAudience(false)}
        />
      )}
    </div>,
    document.body,
  );
};

export default ProjectEditDialog;
