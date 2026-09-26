import type { ReactNode } from 'react';
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

interface ConfirmActionDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation d'un geste lourd, au thème de l'application.
 *
 * Remplace les `window.confirm` du mode entreprise (audit 2026-09-23, étape 3) :
 * la boîte native ignore le thème et la langue de l'app, et ne peut pas dire ce
 * que le geste emporte.
 */
const ConfirmActionDialog = ({
  title, description, confirmLabel, pending, destructive = true, onConfirm, onCancel,
}: ConfirmActionDialogProps) => {
  const { t } = useT('org');
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className={`rounded-xl font-semibold text-sm disabled:opacity-50 ${
              destructive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmActionDialog;
