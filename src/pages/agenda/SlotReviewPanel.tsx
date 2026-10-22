// ═══════════════════════════════════════════════════════════════════
// LE SECOND ACCÈS À LA DÉCISION : le panneau de l'EventModal
// ═══════════════════════════════════════════════════════════════════
//
// Quand on ouvre un créneau de tâche TERMINÉ et non tranché, la question se
// pose déjà : autant la poser là, à côté du formulaire, plutôt que de laisser
// refermer la modale pour aller chercher la pastille du calendrier.
//
// ⚠️ Simplifié le 2026-09-13 (retour utilisateur, sur capture d'écran) : plus
// d'icône ni de sous-titre dans l'en-tête, plus d'aperçu de la tâche (le champ
// « titre » de l'EventModal, juste à côté, le dit déjà — c'était une
// redondance), plus de bouton qui ouvre un menu. Deux actions DIRECTES
// (Valider / Reporter), les deux réponses les plus fréquentes. Ignorer et
// Supprimer restent accessibles depuis la pastille du calendrier
// (`SlotReviewMenu`), qui garde les quatre — ce panneau n'en est qu'un
// raccourci, pas un second endroit où les quatre coexistent.
//
// Desktop uniquement : c'est `EventModal` qui le masque sous `md`, pas ce
// fichier (le point de rupture appartient à la mise en page de la modale).
import React from 'react';
import { useT } from '@/i18n/useT';
import type { SlotReviewActions } from './SlotReviewMenu';
import type { OverdueTaskSlot } from './overdue-slots';

interface SlotReviewPanelProps extends Pick<SlotReviewActions, 'onValidate' | 'onPostpone'> {
  slot: OverdueTaskSlot;
}

const SlotReviewPanel: React.FC<SlotReviewPanelProps> = ({ slot, onValidate, onPostpone }) => {
  const { t } = useT('agenda');

  return (
    <div className="bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] w-64 rounded-2xl border p-4 shadow-2xl">
      <h3 className="mb-3 text-sm font-bold text-[rgb(var(--color-text-primary))] leading-tight">
        {t('slotReview.panelTitle')}
      </h3>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onValidate(slot)}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {t('slotReview.validate')}
        </button>
        <button
          type="button"
          onClick={() => onPostpone(slot)}
          className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-transparent px-3 py-2 text-sm font-semibold text-[rgb(var(--color-text-primary))] transition-colors hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-border))]"
        >
          {t('slotReview.postpone')}
        </button>
      </div>
    </div>
  );
};

export default SlotReviewPanel;
