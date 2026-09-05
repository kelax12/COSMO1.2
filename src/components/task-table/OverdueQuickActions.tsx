// ═══════════════════════════════════════════════════════════════════
// task-table/OverdueQuickActions — maquette 16, « Le retard porte sa solution »
//
// Une tâche en retard était signalée en rouge et laissée là. La sortir du rouge
// demandait d'ouvrir le menu « … » puis « Reporter à demain » : deux gestes
// pour l'état le plus fréquent d'une liste de tâches.
//
// Ces trois raccourcis ne sont montés QUE sur une tâche en retard — partout
// ailleurs ils seraient du bruit. Composant sans logique métier : il reçoit un
// `onReschedule(dayKey)` et n'écrit rien lui-même.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateCalendarPanel, DATE_PANEL_CLASS } from '@/components/ui/date-picker';
import { deadlineDayKey } from '@/lib/deadline';
import { addDaysToKey, getTimezonePref, todayKeyInTz } from '@/lib/timezone';
import { useT } from '@/i18n/useT';

interface OverdueQuickActionsProps {
  /** Échéance courante — sert seulement à ouvrir le calendrier au bon mois. */
  deadline?: string;
  /** Reçoit une clé de jour `YYYY-MM-DD` dans le fuseau de la personne. */
  onReschedule: (dayKey: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHIP =
  'min-h-touch px-2.5 rounded-full text-caption font-semibold transition-colors';

export const OverdueQuickActions: React.FC<OverdueQuickActionsProps> = ({
  deadline,
  onReschedule,
  open,
  onOpenChange,
}) => {
  const { t } = useT('tasks');

  // ⚠️ Les jours sont calculés dans le fuseau CHOISI par la personne, jamais
  // celui de la machine : `todayKeyInTz` est le seul découpage de journée qui
  // fasse foi (cf. CLAUDE.md, § Fuseau horaire).
  const tzPref = getTimezonePref();
  const todayKey = todayKeyInTz(tzPref);

  return (
    <div
      className="mt-1.5 flex items-center gap-1.5"
      role="group"
      aria-label={t('card.overdueActions')}
      // La ligne entière ouvre la tâche : sans ça, viser « Demain » ouvrirait
      // la fiche au lieu de reporter.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onReschedule(todayKey)}
        className={`${CHIP} text-red-600 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20`}
      >
        {t('snooze.today')}
      </button>
      <button
        type="button"
        onClick={() => onReschedule(addDaysToKey(todayKey, 1))}
        className={`${CHIP} text-red-600 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20`}
      >
        {t('snooze.tomorrow')}
      </button>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${CHIP} text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]`}
          >
            {t('snooze.chooseDate')}
          </button>
        </PopoverTrigger>
        <PopoverContent className={`${DATE_PANEL_CLASS} z-[100]`} align="start">
          <DateCalendarPanel
            // `deadlineDayKey` et jamais `.slice(0, 10)` : ce dernier rend le
            // jour UTC de l'instant, pas le jour vécu (R-01).
            value={deadlineDayKey(deadline, tzPref) || undefined}
            onSelect={(day) => { if (day) onReschedule(day); }}
            allowClear={false}
            // Sans `minDate`, « Choisir » permettrait de reporter une tâche en
            // retard vers HIER (cf. CLAUDE.md, § Saisie de date).
            minDate={todayKey}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default OverdueQuickActions;
