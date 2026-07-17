import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import type { MyOrganization } from '@/modules/organizations';

interface DeleteOrganizationDialogProps {
  org: MyOrganization;
  memberCount: number;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation « extrême » de suppression d'entreprise (#5), calquée sur la
 * suppression d'un repo GitHub : rappel des conséquences, puis saisie du nom
 * EXACT de l'entreprise pour déverrouiller le bouton.
 */
const DeleteOrganizationDialog = ({ org, memberCount, pending, onConfirm, onCancel }: DeleteOrganizationDialogProps) => {
  const [typed, setTyped] = useState('');
  const match = typed === org.name;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onCancel}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-red-300/60 dark:border-red-700/50 rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Supprimer l'entreprise ${org.name}`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgb(var(--color-border))]">
          <span className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] flex-1">
            Supprimer {org.name} ?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-red-300/60 dark:border-red-700/40 bg-red-50/60 dark:bg-red-900/10 px-4 py-3">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
              Cette action est irréversible.
            </p>
            <ul className="text-xs text-[rgb(var(--color-text-secondary))] space-y-1 list-disc pl-4">
              <li>Les {memberCount} membre{memberCount > 1 ? 's' : ''} perdent l'accès immédiatement.</li>
              <li>Tous les projets, tâches d'équipe et OKR sont supprimés définitivement.</li>
              <li>Les équipes, invitations et la pyramide sont effacées.</li>
              <li>Les données personnelles des membres ne sont pas affectées.</li>
            </ul>
          </div>

          <div>
            <label htmlFor="delete-org-confirm" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Pour confirmer, tapez <strong className="text-[rgb(var(--color-text-primary))] select-all">{org.name}</strong> ci-dessous :
            </label>
            <input
              id="delete-org-confirm"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              spellCheck={false}
              className="w-full px-3 py-2.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!match || pending}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Suppression…' : 'Je comprends les conséquences — supprimer cette entreprise'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DeleteOrganizationDialog;
