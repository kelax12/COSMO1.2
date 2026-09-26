import { Suspense, useState } from 'react';
import { ArrowRightLeft, LogOut, Trash2 } from 'lucide-react';
import {
  useLeaveOrganization,
  useTransferOwnership,
  type MyOrganization,
  type OrgMember,
} from '@/modules/organizations';
import { useDeleteOrgFlow } from '@/pages/organization/useDeleteOrgFlow';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

const DeleteOrganizationDialog = lazyWithRetry(() => import('./DeleteOrganizationDialog'));
const ConfirmLeaveOrgDialog = lazyWithRetry(() => import('./ConfirmLeaveOrgDialog'));
const TransferOwnershipDialog = lazyWithRetry(() => import('./TransferOwnershipDialog'));

interface OrgDangerZoneProps {
  org: MyOrganization;
  members: OrgMember[];
  /** Le PROPRIÉTAIRE, jamais « un admin » (C-39, mig. 138). */
  isOwner: boolean;
}

/**
 * Paramètres → Zone de danger (M13) : transférer la propriété, supprimer
 * l'organisation (propriétaire), ou la quitter (tous les autres).
 *
 * 🔴 C-39 : la zone de suppression se monte sur `isOwner`, pas `isAdmin`. Un
 * second admin qui ne paie rien supprimait l'organisation pendant que le
 * propriétaire continuait d'être débité. La règle réelle vit dans
 * `delete_organization` (mig. 138) ; ceci n'est que l'affichage.
 */
const OrgDangerZone = ({ org, members, isOwner }: OrgDangerZoneProps) => {
  const { t } = useT('org');
  const leave = useLeaveOrganization();
  const transfer = useTransferOwnership();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const deleteFlow = useDeleteOrgFlow(() => setConfirmingDelete(false));

  return (
    <>
      {isOwner ? (
        <div className="rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/40 dark:bg-red-900/10 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400">{t('page.dangerZone')}</h3>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('page.dangerHint')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {members.length > 1 && (
              <button
                type="button"
                onClick={() => setTransferring(true)}
                disabled={transfer.isPending}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60"
              >
                <ArrowRightLeft size={15} aria-hidden="true" /> {t('page.transferOwnership')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleteFlow.isPending}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 size={15} aria-hidden="true" /> {t('page.deleteOrg')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingLeave(true)}
          disabled={leave.isPending}
          className="inline-flex items-center gap-1.5 min-h-11 text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-60"
        >
          <LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}
        </button>
      )}

      <Suspense fallback={null}>
      {transferring && (
        <TransferOwnershipDialog
          orgName={org.name}
          candidates={members.filter((m) => m.userId !== org.ownerId)}
          pending={transfer.isPending}
          onConfirm={(newOwnerId) =>
            transfer.mutate({ orgId: org.id, newOwnerId }, { onSuccess: () => setTransferring(false) })
          }
          onCancel={() => setTransferring(false)}
        />
      )}
      {confirmingLeave && (
        <ConfirmLeaveOrgDialog
          orgName={org.name}
          pending={leave.isPending}
          onConfirm={() => leave.mutate(org.id, { onSettled: () => setConfirmingLeave(false) })}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
      {confirmingDelete && (
        <DeleteOrganizationDialog
          org={org}
          memberCount={members.length}
          pending={deleteFlow.isPending}
          onConfirm={() => deleteFlow.run(org.id)}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      </Suspense>
    </>
  );
};

export default OrgDangerZone;
