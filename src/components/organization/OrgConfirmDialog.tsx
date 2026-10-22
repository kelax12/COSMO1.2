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
//      Supprimer l'entreprise, supprimer une équipe, purger un projet.
//
// ❌ Plus aucun `window.confirm` : il ne dit pas l'impact, ne se traduit pas
// dans son bouton, et bloque le fil principal. Gardes :
// `confirm-levels.guard.test.ts` et `org-confirm.guard.test.ts`.
// ═══════════════════════════════════════════════════════════════════

export interface OrgConfirmDialogProps {
  title: string;
  /** Ce qui va se passer, en une phrase. */
  description?: ReactNode;
  /** Impact chiffré, une ligne par conséquence. Vide = rien à annoncer. */
  impact?: string[];
  impactTitle?: string;
  confirmLabel: string;
  pendingLabel?: string;
  /** Niveau DESTRUCTEUR : le bouton ne s'active qu'une fois ce nom saisi à l'identique. */
  requireName?: string;
  pending?: boolean;
  /** `danger` (rouge) pour ce qui supprime, `warning` pour ce qui modifie, `accent` pour ce qui ajoute. */
  tone?: 'danger' | 'warning' | 'accent';
  /** Second chemin, moins destructeur (« Organiser le départ » plutôt que retirer). */
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_CLASS = {
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  accent: 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90',
} as const;

/**
 * LA confirmation du mode entreprise (audit du 2026-09-24, étapes 3 et 5).
 *
 * Trois styles coexistaient : `window.confirm` (impossible à mettre au thème,
 * n'annonçant aucun impact), des dialogues maison, et la saisie du nom de
 * `DeleteOrganizationDialog`. Tout geste lourd passe désormais ici : un titre
 * qui nomme l'objet, la LISTE de ce qu'il emporte, et la saisie du nom quand
 * rien ne se rattrape.
 */
const OrgConfirmDialog = ({
  title, description, impact = [], impactTitle, confirmLabel, pendingLabel, requireName,
  pending = false, tone = 'danger', secondaryAction, children, onConfirm, onCancel,
}: OrgConfirmDialogProps) => {
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
  const [typed, setTyped] = useState('');
  const nameOk = requireName === undefined || typed.trim() === requireName.trim();
  const canConfirm = nameOk && !pending;

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {impact.length > 0 && (
          <div
            className={`rounded-xl border px-4 py-3 ${
              tone === 'danger'
                ? 'border-red-300/60 dark:border-red-700/40 bg-red-50/60 dark:bg-red-900/10'
                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]'
            }`}
          >
            <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))] mb-1">
              {impactTitle ?? tOrgAdmin('confirm.impactTitle')}
            </p>
            <ul className="text-xs text-[rgb(var(--color-text-secondary))] space-y-1 list-disc pl-4">
              {impact.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}

        {children}

        {requireName !== undefined && (
          <div>
            <label htmlFor="org-confirm-name" className="block text-xs font-semibold mb-1.5 text-[rgb(var(--color-text-secondary))]">
              {tOrgAdmin('confirm.typeName', { name: requireName })}
            </label>
            <input
              id="org-confirm-name"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 flex-wrap">
          <AlertDialogCancel
            disabled={pending}
            className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm"
          >
            {t('common.cancel')}
          </AlertDialogCancel>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={pending}
              className="inline-flex items-center justify-center px-4 min-h-10 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
          {/* Pas d'AlertDialogAction : elle fermerait la modale avant la réponse
              du serveur, et un refus arriverait sur un écran qui n'existe plus. */}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 font-semibold text-sm disabled:opacity-50 ${TONE_CLASS[tone]}`}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OrgConfirmDialog;
