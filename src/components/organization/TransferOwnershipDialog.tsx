import { useState } from 'react';
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
import { useT } from '@/i18n/useT';

interface TransferOwnershipDialogProps {
  orgName: string;
  /** Membres candidats (tous sauf l'owner actuel). */
  candidates: OrgMember[];
  pending?: boolean;
  onConfirm: (newOwnerId: string) => void;
  onCancel: () => void;
}

/**
 * Transfert de propriété de l'entreprise (reco #18, mig. 081) — réservé à
 * l'owner actuel. Le destinataire devient admin ; l'owner sortant reste
 * admin et peut ensuite se rétrograder ou quitter.
 */
const TransferOwnershipDialog = ({ orgName, candidates, pending, onConfirm, onCancel }: TransferOwnershipDialogProps) => {
  const { t } = useT('org');
  const [selected, setSelected] = useState('');
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">
            {t('transfer.title', { org: orgName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
            {t('transfer.body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1" htmlFor="transfer-owner-select">
          {t('transfer.newOwner')}
        </label>
        <select
          id="transfer-owner-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
        >
          <option value="">{t('transfer.choose')}</option>
          {candidates.map((m) => (
            <option key={m.userId} value={m.userId}>{m.displayName}</option>
          ))}
        </select>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !selected}
            onClick={() => selected && onConfirm(selected)}
            className="rounded-xl font-semibold text-sm bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t('transfer.pending') : t('transfer.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TransferOwnershipDialog;
