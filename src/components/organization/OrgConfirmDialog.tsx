import { useState, type ReactNode } from 'react';
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

export interface OrgConfirmDialogProps {
  title: string;
  description?: ReactNode;
  /** Ce que le geste emporte, une ligne par conséquence. Vide = rien à annoncer. */
  impact?: string[];
  impactTitle?: string;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: 'danger' | 'accent';
  pending?: boolean;
  /**
   * Saisie exigée pour déverrouiller le bouton (nom exact). Réservée aux gestes
   * IRRÉVERSIBLES, sur le modèle de `DeleteOrganizationDialog`.
   */
  requireText?: string;
  /** Second chemin, moins destructeur (« Organiser le départ » plutôt que retirer). */
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * LA confirmation du mode entreprise (audit du 2026-09-24, étape 3).
 *
 * Trois styles coexistaient : `window.confirm` (impossible à mettre au thème,
 * n'annonçant aucun impact), des dialogues maison, et la saisie du nom de
 * `DeleteOrganizationDialog`. Tout geste lourd passe désormais ici : un titre
 * qui nomme l'objet, la LISTE de ce qu'il emporte, et la saisie du nom quand
 * rien ne se rattrape.
 *
 * ❌ Ne plus écrire `window.confirm` dans `src/components/organization/` :
 *    `org-confirm.guard.test.ts` le refuse.
 */
const OrgConfirmDialog = ({
  title, description, impact = [], impactTitle, confirmLabel, pendingLabel,
  tone = 'danger', pending, requireText, secondaryAction, children, onConfirm, onCancel,
}: OrgConfirmDialogProps) => {
  const { t } = useT('org');
  const [typed, setTyped] = useState('');
  const locked = requireText !== undefined && typed.trim() !== requireText.trim();
  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90';

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
              {impactTitle ?? t('confirm.impactTitle')}
            </p>
            <ul className="text-xs text-[rgb(var(--color-text-secondary))] space-y-1 list-disc pl-4">
              {impact.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}

        {children}

        {requireText !== undefined && (
          <div>
            <label htmlFor="org-confirm-typed" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              {t('confirm.typeToConfirm', { name: requireText })}
            </label>
            <input
              id="org-confirm-typed"
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
          <AlertDialogAction
            disabled={pending || locked}
            // `preventDefault` : c'est la mutation qui ferme, pas le clic. Sinon
            // un refus serveur fermait le dialogue et perdait le contexte.
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className={`rounded-xl font-semibold text-sm disabled:opacity-50 ${confirmClass}`}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OrgConfirmDialog;
