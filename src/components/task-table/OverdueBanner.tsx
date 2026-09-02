import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { DateCalendarPanel, DATE_PANEL_CLASS } from '@/components/ui/date-picker';
import { useT } from '@/i18n/useT';

// Le type vient du module de report : le redéclarer ici, c'était deux
// définitions à garder d'accord, et c'est ce qui a laissé le libellé en dur.
import type { SnoozeOption } from '@/modules/tasks/snooze';

interface OverdueBannerProps {
  count: number;
  options: SnoozeOption[];
  onSnoozeAll: (deadline: string) => void;
}

/**
 * Bandeau « En retard » (#9) et sa replanification groupée.
 *
 * Extrait de `TaskTable` : le calendrier COSMO qui remplace l'ancien picker
 * natif y ajoutait une trentaine de lignes, et `TaskTable` fait partie des
 * fichiers que `architecture.guard` oblige à MAIGRIR. Le bandeau était de
 * toute façon la partie la plus autonome du composant — il ne lit rien de son
 * état, juste un compte et une liste d'options.
 */
const OverdueBanner = ({ count, options, onSnoozeAll }: OverdueBannerProps) => {
  const { t, tp } = useT('tasks');

  // « Choisir une date… » REMPLACE le contenu du menu par le calendrier, au
  // lieu d'ouvrir une seconde couche par-dessus.
  //
  // ⚠️ Ne pas revenir à un popover séparé. Deux variantes ont été mesurées
  // cassées dans le navigateur avant celle-ci :
  //   1. ouvrir le popover dans le `onClick` de l'entrée → il se montait puis
  //      disparaissait dans la même frappe (en se fermant, le menu rend le
  //      focus à son déclencheur, et ce focus sortant est capté par le
  //      `DismissableLayer` du popover) ;
  //   2. l'ouvrir dans `onCloseAutoFocus` → il ne se montait plus DU TOUT
  //      (vérifié au MutationObserver : aucun mount).
  // Une seule couche supprime la course au focus, l'ancrage invisible et la
  // question du z-index d'un coup.
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
      <AlertTriangle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-label sm:text-sm font-medium text-red-700 dark:text-red-300">
        {tp('table.overdueCount', count)}
      </span>

      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          // Rouvrir le menu doit repartir de la liste, jamais du calendrier
          // laissé ouvert la fois d'avant.
          if (!open) setShowCalendar(false);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="px-3 min-h-touch sm:min-h-0 sm:py-1.5 rounded-lg text-label sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            {t('table.rescheduleAllBtn')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={showCalendar ? `${DATE_PANEL_CLASS} p-0` : undefined}
          aria-label={showCalendar ? t('table.rescheduleAll') : undefined}
        >
          {showCalendar ? (
            <DateCalendarPanel
              // `minDate` reprend l'attribut `min` de l'ancien input natif :
              // reporter une tâche en retard vers hier n'a pas de sens.
              minDate={new Date().toLocaleDateString('en-CA')}
              allowClear={false}
              onSelect={(date) => {
                if (!date) return;
                onSnoozeAll(date);
                setMenuOpen(false);
              }}
            />
          ) : (
            <>
              {options.map((opt) => (
                <DropdownMenuItem key={opt.id} onClick={() => onSnoozeAll(opt.deadline)}>
                  {t(opt.labelKey)}
                </DropdownMenuItem>
              ))}
              {/* `preventDefault` : sans lui Radix referme le menu, alors
                  qu'on veut justement y afficher le calendrier. */}
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowCalendar(true); }}>
                {t('table.pickADate')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default OverdueBanner;
