// ═══════════════════════════════════════════════════════════════════
// LA DEMANDE DE DÉCISION SUR UN CRÉNEAU DE TÂCHE TERMINÉ
// ═══════════════════════════════════════════════════════════════════
//
// Remplace `AgendaSlotReviewModal`, supprimée le 2026-09-13. Cette modale
// s'ouvrait SEULE à l'arrivée sur l'agenda, par-dessus ce que la personne était
// en train de faire, et exigeait une réponse avant de rendre la page. Elle
// coupait un geste pour poser une question qui pouvait attendre.
//
// La demande vit désormais SUR le créneau concerné : une pastille ambre, à sa
// place dans le calendrier, qui n'interrompt rien et qu'on ouvre quand on veut.
// Le même composant sert les deux accès (pastille du calendrier et panneau de
// l'EventModal), pour que les quatre actions ne puissent pas diverger entre eux.
//
// ⚠️ C'est un `DropdownMenu` shadcn, exactement comme le menu « … » d'une ligne
// de tâche. Ce n'est pas une préférence visuelle : Radix porte le portail (un
// menu rendu dans le bloc d'événement serait rogné par le débordement du
// calendrier, et un créneau de 15 minutes n'a pas la hauteur pour l'accueillir),
// le placement, le clavier, Échap et la restitution du focus. Écrire un menu
// ancré à la main aurait redemandé tout ça, et C-53 dit ce que ça coûte.
import React from 'react';
import { CheckCircle2, CalendarClock, BellOff, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n/useT';
import type { OverdueTaskSlot } from './overdue-slots';

export interface SlotReviewActions {
  onValidate: (slot: OverdueTaskSlot) => void;
  onPostpone: (slot: OverdueTaskSlot) => void;
  onIgnore: (slot: OverdueTaskSlot) => void;
  onDelete: (slot: OverdueTaskSlot) => void;
}

interface SlotReviewMenuProps extends SlotReviewActions {
  slot: OverdueTaskSlot;
  /**
   * `badge` : la pastille ronde posée sur le bloc du calendrier.
   * `panel` : le bouton pleine largeur du panneau de l'EventModal.
   * Deux déclencheurs, un seul menu.
   */
  variant?: 'badge' | 'panel';
}

const SlotReviewMenu: React.FC<SlotReviewMenuProps> = ({
  slot,
  variant = 'badge',
  onValidate,
  onPostpone,
  onIgnore,
  onDelete,
}) => {
  const { t } = useT('agenda');
  const label = t('slotReview.badgeAria', { title: slot.task.name });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'badge' ? (
          <button
            type="button"
            aria-label={label}
            title={label}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold leading-none text-amber-950 shadow ring-1 ring-amber-900/30 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            !
          </button>
        ) : (
          <button
            type="button"
            aria-label={label}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 shadow transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-950 text-[11px] font-bold leading-none text-amber-50">
              !
            </span>
            {t('slotReview.panelAction')}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* Le nom de la TÂCHE, pas celui de l'événement : c'est sur elle que
            portent trois des quatre actions, et les deux titres peuvent
            différer (un créneau peut s'appeler « Révisions » pour une tâche
            « Réviser le chapitre 1 »). */}
        <DropdownMenuLabel className="leading-tight">
          <span className="block truncate font-semibold">{slot.task.name}</span>
          <span className="text-muted-foreground block text-xs font-normal">
            {t('slotReview.question')}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onValidate(slot)}>
          <CheckCircle2 aria-hidden="true" /> {t('slotReview.validate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPostpone(slot)}>
          <CalendarClock aria-hidden="true" /> {t('slotReview.postpone')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onIgnore(slot)}>
          <BellOff aria-hidden="true" /> {t('slotReview.ignore')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        {/* Supprime la tâche ET son créneau. Réversible par le toast
            « Annuler » posé dans `useOverdueSlotReview` (R-07 : c'était la
            seule action irréversible du produit). */}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(slot)}
          className="!text-red-500 focus:!text-red-500"
        >
          <Trash2 className="!text-red-500" aria-hidden="true" /> {t('slotReview.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SlotReviewMenu;
