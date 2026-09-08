// ═══════════════════════════════════════════════════════════════════
// Astuce de découvrabilité des gestes (mobile, redesign 2026-09-07).
//
// Extrait de `TaskTable` : c'est la seule surface du tableau qui porte sa
// PROPRE mémoire. Elle se ferme une fois pour toutes et le retient dans
// `localStorage` ; ni le tri, ni les filtres, ni la sélection ne lisent cet
// état, et `TaskTable` n'avait aucune raison de le tenir. La frontière est le
// souvenir, pas la taille du bloc.
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useT } from '@/i18n/useT';

/** Clé de persistance — un seul écrit, jamais relu ailleurs. */
const DISMISSED_KEY = 'cosmo_swipe_hint_dismissed';

interface SwipeHintBannerProps {
  /** Masqué pendant l'ajout à une liste : le geste de balayage n'y est pas actif. */
  addToListMode: boolean;
  /** Nombre de lignes affichées — aucune astuce au-dessus d'une liste vide. */
  rowCount: number;
}

export default function SwipeHintBanner({ addToListMode, rowCount }: SwipeHintBannerProps) {
  const { t } = useT('tasks');

  // `localStorage` peut jeter (Safari privé, site data bloqué) : dans ce cas
  // l'astuce revient à chaque visite, ce qui reste préférable à un écran blanc.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
  });

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  };

  if (dismissed || addToListMode || rowCount === 0) return null;

  return (
    <div
      className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs"
      style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-secondary))' }}
    >
      <span className="flex-1 flex items-center gap-1.5">
        <Lightbulb size={14} className="shrink-0" aria-hidden="true" />
        {t('table.gestureHint')}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('table.dismissHint')}
        className="shrink-0 w-11 h-11 flex items-center justify-center rounded-md hover:bg-[rgb(var(--color-surface))]"
        style={{ color: 'rgb(var(--color-text-muted))' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
