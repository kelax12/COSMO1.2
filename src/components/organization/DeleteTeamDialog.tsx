import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTeamDeletionImpact, useDeleteOrgTeam, type OrgTeam } from '@/modules/org-teams';
import { useT } from '@/i18n/useT';

interface DeleteTeamDialogProps {
  orgId: string;
  team: OrgTeam;
  /** Toutes les équipes de l'organisation ; celle qu'on supprime est exclue ici. */
  teams: OrgTeam[];
  onClose: () => void;
}

/**
 * Modale d'impact avant de supprimer une équipe (M5, mig. 151).
 *
 * Remplace un `window.confirm` qui annonçait, en toutes lettres, que les projets
 * de l'équipe deviendraient visibles par toute l'entreprise, et laissait faire.
 *
 * ❌ Aucune option « rendre visible par toute l'organisation » : c'est la fuite
 *    que cette modale ferme. Une équipe qui porte quelque chose se supprime en
 *    le RÉAFFECTANT à une autre équipe, ou ne se supprime pas.
 * ⚠️ Les chiffres sont comptés sous RLS : l'appelant ne compte que ce qu'il
 *    voit. S'il reste un projet invisible pour lui, la base refuse tout, et
 *    l'erreur `team_has_dependents` le dit.
 */
const DeleteTeamDialog = ({ orgId, team, teams, onClose }: DeleteTeamDialogProps) => {
  const { t, tp } = useT('org');
  const { data: impact, isLoading, isError } = useTeamDeletionImpact(team.id);
  const deleteTeam = useDeleteOrgTeam(orgId);
  const others = teams.filter((x) => x.id !== team.id);
  const [targetId, setTargetId] = useState('');
  const [archive, setArchive] = useState(false);
  // Niveau DESTRUCTEUR (cf. OrgConfirmDialog) : une équipe supprimée ne revient
  // pas. On fait saisir son nom, comme pour l'entreprise.
  const [typedName, setTypedName] = useState('');
  const nameOk = typedName.trim() === team.name.trim();

  const projects = (impact?.activeProjects ?? 0) + (impact?.archivedProjects ?? 0);
  const okrs = (impact?.soleOkrs ?? 0) + (impact?.sharedOkrs ?? 0);
  // Un OKR partagé perd seulement ce lien : il garde une audience fermée.
  // Ce sont les projets et les OKR dont c'est la SEULE équipe qui exigent une cible.
  const needsTarget = projects > 0 || (impact?.soleOkrs ?? 0) > 0;
  const target = others.find((x) => x.id === targetId);
  const canConfirm = !isLoading && !isError && nameOk && (!needsTarget || !!target) && !deleteTeam.isPending;

  const confirm = () => {
    deleteTeam.mutate(
      { teamId: team.id, targetTeamId: needsTarget ? targetId : null, archiveProjects: needsTarget && archive },
      { onSuccess: onClose },
    );
  };

  const fieldClass =
    'w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]';

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">
            {t('team.deleteDialog.title', { name: team.name })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm leading-relaxed text-[rgb(var(--color-text-secondary))]">
              {isLoading && <p>{t('team.deleteDialog.loading')}</p>}
              {isError && <p>{t('team.deleteDialog.impactFailed')}</p>}
              {impact && !needsTarget && okrs === 0 && <p>{t('team.deleteDialog.nothingAttached')}</p>}
              {impact && (projects > 0 || okrs > 0) && (
                <p>
                  {t('team.deleteDialog.attached', {
                    projects: tp('team.deleteDialog.projectsCount', projects),
                    okrs: tp('team.deleteDialog.okrsCount', okrs),
                  })}
                </p>
              )}
              {impact && !needsTarget && (impact.sharedOkrs ?? 0) > 0 && (
                <p>{t('team.deleteDialog.sharedOkrsOnly')}</p>
              )}
              {impact && <p className="text-xs">{t('team.deleteDialog.neverOrgWide')}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {impact && needsTarget && (
          others.length === 0 ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t('team.deleteDialog.noOtherTeam')}
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="delete-team-target" className="block text-xs font-semibold mb-1.5 text-[rgb(var(--color-text-secondary))]">
                  {t('team.deleteDialog.targetLabel')}
                </label>
                <select
                  id="delete-team-target"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">{t('team.deleteDialog.targetPlaceholder')}</option>
                  {others.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
                {target && (
                  <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]">
                    {t('team.deleteDialog.newAudience', { name: target.name })}
                  </p>
                )}
              </div>
              {projects > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={archive}
                    onChange={(e) => setArchive(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{t('team.deleteDialog.archiveProjects')}</span>
                </label>
              )}
            </div>
          )
        )}

        <div>
          <label htmlFor="delete-team-name" className="block text-xs font-semibold mb-1.5 text-[rgb(var(--color-text-secondary))]">
            {t('confirm.typeName', { name: team.name })}
          </label>
          <input
            id="delete-team-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            autoComplete="off"
            className={fieldClass}
          />
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          {/* Pas d'AlertDialogAction : elle fermerait la modale avant la
              réponse du serveur, et un refus (`team_has_dependents`)
              arriverait sur un écran qui n'existe plus. */}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={confirm}
            className="rounded-xl px-4 py-2 font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
          >
            {deleteTeam.isPending
              ? t('team.deleteDialog.deleting')
              : needsTarget
                ? t('team.deleteDialog.confirmTransfer')
                : t('team.deleteDialog.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteTeamDialog;
