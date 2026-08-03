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

interface ConfirmLeaveOrgDialogProps {
  orgName: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation avant de quitter l'entreprise — remplace le window.confirm
 * (même pattern que ConfirmRemoveMemberDialog).
 */
const ConfirmLeaveOrgDialog = ({ orgName, pending, onConfirm, onCancel }: ConfirmLeaveOrgDialogProps) => {
  const { t } = useT('org');
  return (
  <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
    <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-xl font-bold">
          Quitter {orgName} ?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
          {t('leaveDialog.body')}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
          Annuler
        </AlertDialogCancel>
        <AlertDialogAction
          disabled={pending}
          onClick={onConfirm}
          className="rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
        >
          {pending ? 'Sortie…' : 'Quitter l\'entreprise'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  );
};

export default ConfirmLeaveOrgDialog;
