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
import { useDepartureImpact } from '@/modules/organizations/governance.hooks';
import { useT } from '@/i18n/useT';

interface ConfirmRemoveMemberDialogProps {
  member: OrgMember;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Étape 3 de l'audit : fourni, le dialogue lit et annonce ce que le retrait
   * laisserait orphelin (`member_departure_impact`, admins seulement).
   */
  orgId?: string;
  /** Fourni, propose « Organiser le départ » (assistant, mig. 161) à la place du retrait nu. */
  onPlanDeparture?: () => void;
}

/**
 * Modal de confirmation avant de retirer un membre de l'entreprise (#3) —
 * remplace les window.confirm de l'annuaire et de la pyramide. Le cas
 * « membre avec subordonnés » reste géré en amont par ReassignManagerSheet.
 */
const ConfirmRemoveMemberDialog = ({ member, pending, onConfirm, onCancel, orgId, onPlanDeparture }: ConfirmRemoveMemberDialogProps) => {
  const { t, tp } = useT('org');
  const { data: impact } = useDepartureImpact(orgId, orgId ? member.userId : null);
  const orphaned = impact ? impact.tasks + impact.reports + impact.leads + impact.krs : 0;
  return (
  <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
    <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-xl font-bold">
          {t('members.removeTitleNamed', { name: member.displayName })}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
          {t('removeMemberDialog.body')}
        </AlertDialogDescription>
        {impact && orphaned > 0 && (
          <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{t('lifecycle.removeWouldOrphan')}</p>
            <ul className="mt-1 list-disc pl-5">
              {impact.tasks > 0 && <li>{tp('lifecycle.impactTasks', impact.tasks)}</li>}
              {impact.reports > 0 && <li>{tp('lifecycle.impactReports', impact.reports)}</li>}
              {impact.leads > 0 && <li>{tp('lifecycle.impactLeads', impact.leads)}</li>}
              {impact.krs > 0 && <li>{tp('lifecycle.impactKrs', impact.krs)}</li>}
            </ul>
          </div>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
          {t('common.cancel')}
        </AlertDialogCancel>
        {onPlanDeparture && (
          <button
            type="button"
            onClick={onPlanDeparture}
            className="rounded-xl font-semibold text-sm px-4 min-h-10 bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]"
          >
            {t('lifecycle.menuOffboard')}
          </button>
        )}
        <AlertDialogAction
          disabled={pending}
          onClick={onConfirm}
          className="rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
        >
          {pending ? t('member.removing') : t('member.removeFromOrgAction')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  );
};

export default ConfirmRemoveMemberDialog;
