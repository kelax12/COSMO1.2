// ═══════════════════════════════════════════════════════════════════
// PendingSharedLists — bandeau des LISTES partagées reçues en attente.
// Distinction visuelle vs PendingSharedTasks (ambre) : ici teal/émeraude +
// icône liste + mention « N tâches ». Accepter → matérialise la liste + ses
// tâches chez le destinataire ; Refuser → supprime la grant.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { Check, X } from 'lucide-react';
import {
  useIncomingSharedLists,
  useAcceptSharedList,
  useRefuseSharedList,
  type SharedListGrant,
} from '@/modules/friends';

const PendingSharedLists: React.FC = () => {
  const { data: grants = [] } = useIncomingSharedLists();
  const acceptMutation = useAcceptSharedList();
  const refuseMutation = useRefuseSharedList();

  if (grants.length === 0) return null;

  const handleAccept = (grant: SharedListGrant) => acceptMutation.mutate(grant);
  const handleRefuse = (grant: SharedListGrant) => refuseMutation.mutate(grant.id);

  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
        Listes partagées en attente ({grants.length})
      </p>
      {grants.map((grant) => (
        <div
          key={grant.id}
          className="flex items-center gap-3 p-3 rounded-xl border border-teal-300 dark:border-teal-700/60 bg-teal-50 dark:bg-teal-900/20"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'rgb(var(--color-text-primary))' }} title={grant.name}>
              {grant.name}
            </p>
            <p className="text-xs truncate text-teal-700 dark:text-teal-300">
              Partagé par {grant.sharedByName ?? 'un collaborateur'} · {grant.tasks.length} tâche{grant.tasks.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleAccept(grant)}
              disabled={acceptMutation.isPending}
              className="min-w-touch min-h-touch sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              aria-label={`Accepter la liste partagée ${grant.name}`}
            >
              <Check size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleRefuse(grant)}
              disabled={refuseMutation.isPending}
              className="min-w-touch min-h-touch sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 rounded-lg border border-teal-300 dark:border-teal-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label={`Refuser la liste partagée ${grant.name}`}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingSharedLists;
