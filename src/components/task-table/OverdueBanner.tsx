import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateCalendarPanel, DATE_PANEL_CLASS } from '@/components/ui/date-picker';
import { useT } from '@/i18n/useT';

interface SnoozeOption {
  id: string;
  label: string;
  /** Date locale 'YYYY-MM-DD'. */
  deadline: string;
}

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

  // Le calendrier vit HORS du menu : le menu Radix se ferme au clic, l'ancre
  // doit survivre à sa fermeture.
  //
  // ⚠️ L'ouverture est différée à la fermeture EFFECTIVE du menu. Ouvrir dans
  // le `onClick` de l'entrée marche une fraction de seconde puis échoue : en se
  // fermant, le menu rend le focus à son déclencheur, et ce focus sortant est
  // capté par le `DismissableLayer` du popover, qui se referme aussitôt.
  // Mesuré dans le navigateur : le calendrier se montait bien, puis
  // disparaissait dans la même frappe.
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarPending = useRef(false);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
      <AlertTriangle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-label sm:text-sm font-medium text-red-700 dark:text-red-300">
        {tp('table.overdueCount', count)}
      </span>

      {/* `relative` : c'est l'ancre du calendrier qui se positionne dessus.
          Sans lui, l'ancre remonte au prochain parent positionné et le
          calendrier s'ouvre en bas de page, hors écran — il était bien monté,
          simplement invisible. */}
      <div className="relative">
        <DropdownMenu>
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
            onCloseAutoFocus={(e) => {
              if (!calendarPending.current) return;
              calendarPending.current = false;
              // Sans ça, le focus rendu au déclencheur congédie le popover.
              e.preventDefault();
              setCalendarOpen(true);
            }}
          >
            {options.map((opt) => (
              <DropdownMenuItem key={opt.id} onClick={() => onSnoozeAll(opt.deadline)}>
                {opt.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => { calendarPending.current = true; }}>
              {t('table.pickADate')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          {/* Ancre invisible, calée sur le bouton : le calendrier s'ouvre sous
              lui alors qu'aucun champ de date n'est affiché.
              `pointer-events-none` pour ne jamais lui voler un clic. */}
          <PopoverTrigger asChild>
            <span aria-hidden="true" className="absolute inset-0 pointer-events-none" />
          </PopoverTrigger>
          <PopoverContent
            className={`${DATE_PANEL_CLASS} z-[100]`}
            align="end"
            collisionPadding={16}
            sideOffset={8}
            aria-label={t('table.rescheduleAll')}
          >
            <DateCalendarPanel
              // `minDate` reprend l'attribut `min` de l'ancien input natif :
              // reporter une tâche en retard vers hier n'a pas de sens.
              minDate={new Date().toLocaleDateString('en-CA')}
              allowClear={false}
              onSelect={(date) => {
                if (!date) return;
                onSnoozeAll(date);
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default OverdueBanner;
