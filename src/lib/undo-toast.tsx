import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';

/**
 * Toast d'annulation réutilisable avec barre de progression.
 *
 * Affiche un message + un bouton « Annuler » et une barre de progression qui
 * se vide sur `duration` ms (5 s par défaut). À l'expiration, le toast se ferme
 * tout seul. Le bouton « Annuler » exécute `onUndo` puis ferme le toast.
 *
 * Le Toaster global est positionné en haut à droite (cf. `src/App.tsx`), donc
 * ce toast apparaît bien en haut à droite comme attendu.
 */
export function showUndoToast(
  message: string,
  onUndo: () => void,
  opts?: { duration?: number }
): void {
  const duration = opts?.duration ?? 5000;

  toast.custom(
    (id) => (
      <UndoToastCard
        message={message}
        duration={duration}
        onUndo={() => {
          onUndo();
          toast.dismiss(id);
        }}
      />
    ),
    { duration }
  );
}

interface UndoToastCardProps {
  message: string;
  duration: number;
  onUndo: () => void;
}

function UndoToastCard({ message, duration, onUndo }: UndoToastCardProps) {
  return (
    <div
      className="flex flex-col gap-2 w-[320px] max-w-[90vw] rounded-xl border shadow-lg overflow-hidden"
      style={{
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span
          className="text-sm font-medium"
          style={{ color: 'rgb(var(--color-text-primary))' }}
        >
          {message}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Undo2 size={15} aria-hidden="true" />
          Annuler
        </button>
      </div>
      <div
        className="h-1 w-full overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-hover))' }}
      >
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-full bg-blue-500"
        />
      </div>
    </div>
  );
}
