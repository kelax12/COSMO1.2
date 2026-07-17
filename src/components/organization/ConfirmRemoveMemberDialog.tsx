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
import type { OrgMember } from '@/modules/organizations';

interface ConfirmRemoveMemberDialogProps {
  member: OrgMember;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmation avant de retirer un membre de l'entreprise (#3) —
 * remplace les window.confirm de l'annuaire et de la pyramide. Le cas
 * « membre avec subordonnés » reste géré en amont par ReassignManagerSheet.
 */
const ConfirmRemoveMemberDialog = ({ member, pending, onConfirm, onCancel }: ConfirmRemoveMemberDialogProps) => (
  <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
    <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-xl font-bold">
          Retirer {member.displayName} ?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
          Cette personne perdra immédiatement l'accès aux projets, tâches et OKR de
          l'entreprise. Ses données personnelles (tâches, habitudes, agenda) ne sont
          pas affectées. Elle pourra revenir avec un nouveau code d'invitation.
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
          {pending ? 'Retrait…' : 'Retirer de l\'entreprise'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmRemoveMemberDialog;
