import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useT } from '@/i18n/useT';

interface ConfirmProjectAudienceDialogProps {
  projectName: string;
  /** Équipe de destination ; `null` = toute l'organisation. */
  targetTeamName: string | null;
  /** Nombre de membres de l'organisation, pour chiffrer une ouverture à tous. */
  orgMemberCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation avant de changer l'équipe d'un projet (M5).
 *
 * Changer d'équipe, c'est changer QUI LIT le projet, ses tâches et ses
 * commentaires. Le menu le faisait d'un clic, sans rien dire. La modale nomme
 * la nouvelle audience, et chiffre le cas « toute l'entreprise », le seul qui
 * ouvre un projet à des gens qui ne le voyaient pas.
 */
const ConfirmProjectAudienceDialog = ({
  projectName, targetTeamName, orgMemberCount, onConfirm, onCancel,
}: ConfirmProjectAudienceDialogProps) => {
  const { t, tp } = useT('org');
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">
            {t('project.audienceDialog.title', { name: projectName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
            {targetTeamName
              ? t('project.audienceDialog.toTeam', { team: targetTeamName })
              : tp('project.audienceDialog.toOrg', orgMemberCount)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-xl font-semibold text-sm bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))]"
          >
            {t('project.audienceDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmProjectAudienceDialog;
