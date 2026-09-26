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
  /**
   * Un abonnement payant existe (actif ou en retard de paiement). Il SUIT le
   * propriétaire : le dialogue le dit au lieu de le laisser découvrir.
   */
  hasSubscription?: boolean;
  pending?: boolean;
  onConfirm: (newOwnerId: string) => void;
  onCancel: () => void;
}

/**
 * Transfert de propriété de l'entreprise (reco #18, mig. 081) — réservé à
 * l'owner actuel. Le destinataire devient admin ; l'owner sortant reste
 * admin et peut ensuite se rétrograder ou quitter.
 *
 * Audit du 2026-09-24 : le dialogue ne disait rien de la FACTURATION, qui suit
 * le propriétaire. Seul `organizations.owner_id` ouvre le portail Stripe
 * (`stripe-org-portal`) et souscrit (`stripe-org-checkout`) ; le client Stripe,
 * lui, appartient à l'organisation. Donc : l'abonnement continue, ses factures
 * et le moyen de paiement enregistré se gèrent désormais par le nouveau
 * propriétaire, et l'ancien n'y a plus accès.
 */
const TransferOwnershipDialog = ({ orgName, candidates, hasSubscription = false, pending, onConfirm, onCancel }: TransferOwnershipDialogProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const [selected, setSelected] = useState('');
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">
            {ta('transfer.title', { org: orgName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
            {ta('transfer.body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))] mb-1">{ta('transfer.billingTitle')}</p>
          <ul className="text-xs text-[rgb(var(--color-text-secondary))] space-y-1 list-disc pl-4">
            <li>{ta(hasSubscription ? 'transfer.billingSubscription' : 'transfer.billingNoSubscription')}</li>
            <li>{ta('transfer.billingInvoices')}</li>
            {hasSubscription && <li>{ta('transfer.billingCard')}</li>}
            <li>{ta('transfer.billingYou')}</li>
          </ul>
        </div>
        <label className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1" htmlFor="transfer-owner-select">
          {ta('transfer.newOwner')}
        </label>
        <select
          id="transfer-owner-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
        >
          <option value="">{ta('transfer.choose')}</option>
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
            {pending ? ta('transfer.pending') : ta('transfer.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TransferOwnershipDialog;
