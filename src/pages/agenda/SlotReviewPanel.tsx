// ═══════════════════════════════════════════════════════════════════
// LE SECOND ACCÈS À LA DÉCISION : le panneau de l'EventModal
// ═══════════════════════════════════════════════════════════════════
//
// Quand on ouvre un créneau de tâche TERMINÉ et non tranché, la question se
// pose déjà : autant la poser là, à côté du formulaire, plutôt que de laisser
// refermer la modale pour aller chercher la pastille du calendrier.
//
// ⚠️ Il n'a AUCUNE logique propre. Il affiche `slot` et délègue les quatre
// actions au même `SlotReviewMenu` que la pastille. Deux accès, un seul jeu
// d'actions : dupliquer les entrées ici serait le moyen le plus sûr de les
// faire diverger le jour où l'une des quatre change.
//
// Desktop uniquement : c'est `EventModal` qui le masque sous `md`, pas ce
// fichier (le point de rupture appartient à la mise en page de la modale).
import React from 'react';
import { ListChecks } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { formatTimeInTz, toDisplayISO, type TimezonePref } from '@/lib/timezone';
import SlotReviewMenu, { type SlotReviewActions } from './SlotReviewMenu';
import type { OverdueTaskSlot } from './overdue-slots';

interface SlotReviewPanelProps extends SlotReviewActions {
  slot: OverdueTaskSlot;
  /** Fuseau d'affichage choisi : le créneau se lit dans SON heure, pas celle de la machine. */
  tzPref: TimezonePref;
}

const SlotReviewPanel: React.FC<SlotReviewPanelProps> = ({ slot, tzPref, ...actions }) => {
  const { t } = useT('agenda');
  const start = new Date(toDisplayISO(slot.event.start, tzPref));

  return (
    <div className="bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] w-64 rounded-2xl border p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] leading-tight">
          {t('slotReview.panelTitle')}
        </h3>
      </div>

      <p className="mb-3 text-xs text-[rgb(var(--color-text-muted))]">
        {t('slotReview.question')}
      </p>

      <div className="bg-[rgb(var(--color-hover))] mb-4 rounded-lg p-3">
        <p className="truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {slot.task.name}
        </p>
        <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))]">
          {formatDate(start, { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
          {formatTimeInTz(slot.event.start, tzPref)} – {formatTimeInTz(slot.event.end, tzPref)}
        </p>
      </div>

      <SlotReviewMenu slot={slot} variant="panel" {...actions} />
    </div>
  );
};

export default SlotReviewPanel;
