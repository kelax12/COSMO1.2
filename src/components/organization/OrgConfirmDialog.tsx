import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useT } from '@/i18n/useT';

// ═══════════════════════════════════════════════════════════════════
// Confirmations du mode entreprise : TROIS niveaux, jamais un quatrième
//
//   1. RÉVERSIBLE  → aucune question, un toast « Annuler » (`showUndoToast`).
//      Supprimer une tâche (corbeille), réassigner, changer un statut, un lot.
//   2. LOURD       → ce dialogue, qui AFFICHE L'IMPACT avant d'agir.
//      Régénérer le code, défaire une réorganisation, supprimer un OKR.
//   3. DESTRUCTEUR → ce dialogue avec `requireName` : il faut saisir le nom.
//      Supprimer l'entreprise, supprimer une équipe.
//
// ❌ Plus aucun `window.confirm` : il ne dit pas l'impact, ne se traduit pas
// dans son bouton, et bloque le fil principal. Garde : `confirm-levels.guard.test.ts`.
// ═══════════════════════════════════════════════════════════════════

interface OrgConfirmDialogProps {
  title: string;
  /** Ce qui va se passer, en une phrase. */
  description?: ReactNode;
  /** Impact chiffré, une ligne par conséquence. Obligatoire dès le niveau « lourd ». */
  impact: string[];
  confirmLabel: string;
  /** Niveau DESTRUCTEUR : le bouton ne s'active qu'une fois ce nom saisi à l'identique. */
  requireName?: string;
  pending?: boolean;
  /** `danger` (rouge) pour ce qui supprime, `warning` pour ce qui modifie. */
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const OrgConfirmDialog = ({
  title, description, impact, confirmLabel, requireName, pending = false, tone = 'danger', onConfirm, onCancel,
}: OrgConfirmDialogProps) => {
  const { t } = useT('org');
  const [typed, setTyped] = useState('');
  const nameOk = requireName === undefined || typed.trim() === requireName.trim();
  const canConfirm = nameOk && !pending;
  const toneClass = tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600';

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm leading-relaxed text-[rgb(var(--color-text-secondary))]">
              {description && <p>{description}</p>}
              {impact.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5">
                  {impact.map((line) => <li key={line}>{line}</li>)}
                </ul>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireName !== undefined && (
          <div>
            <label htmlFor="org-confirm-name" className="block text-xs font-semibold mb-1.5 text-[rgb(var(--color-text-secondary))]">
              {t('confirm.typeName', { name: requireName })}
            </label>
            <input
              id="org-confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            disabled={pending}
            className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm"
          >
            {t('common.cancel')}
          </AlertDialogCancel>
          {/* Pas d'AlertDialogAction : elle fermerait la modale avant la réponse
              du serveur, et un refus arriverait sur un écran qui n'existe plus. */}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 font-semibold text-sm text-white disabled:opacity-50 ${toneClass}`}
          >
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OrgConfirmDialog;
