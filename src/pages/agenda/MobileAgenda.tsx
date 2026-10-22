// Sous-composants mobile de l'agenda (header segmenté + bandeau de jours) +
// styles FullCalendar mobile — extraits verbatim de AgendaPage, mémoïsés.
import React from 'react';
import { motion } from 'framer-motion';
import { format, addDays, isSameDay, isSameMonth, isSameYear, isToday } from 'date-fns';
import { useT } from '@/i18n/useT';
import { getDateLocale } from '@/i18n/format';
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';

export type MobileView = 'timeGridDay' | 'timeGrid2Day' | 'dayGridMonth';

export const mobileCalendarStyles = `
  .mobile-calendar .fc-timegrid-slot { height: 20px !important; }
  .mobile-calendar .fc-timegrid-slot-label {
    font-size: 11px !important;
    padding: 0 4px !important;
    vertical-align: top;
    color: rgb(var(--color-text-secondary)); /* --color-text-muted ne passe pas le contraste AA (3.4:1) sur le fond de la grille */
  }
  .mobile-calendar .fc-timegrid-axis { width: 40px !important; }
  .mobile-calendar .fc-col-header { display: none !important; }
  .mobile-calendar .fc-scroller::-webkit-scrollbar { display: none; }
  .mobile-calendar .fc-scroller { -ms-overflow-style: none; scrollbar-width: none; }
  .mobile-calendar .fc-timegrid-slot-minor { border-top-style: none !important; }
  /* Maquette 166 : « maintenant » en accent, 2 px, sans triangle. Le rouge
     est réservé au retard et à l'irréversible (règle 121). */
  .mobile-calendar .fc-timegrid-now-indicator-line {
    border-color: rgb(var(--color-accent)) !important;
    border-width: 2px 0 0 !important;
  }
  .mobile-calendar .fc-timegrid-now-indicator-arrow { display: none !important; }
  /* Maquette 161 : le bloc FullCalendar devient transparent, la teinte est
     portée par le contenu (cf. \`renderEventInner\`, variante \`tinted\`). */
  .mobile-calendar .fc-event.cosmo-event-tinted {
    background-color: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }
`;

// ── Mobile Header ────────────────────────────────────────────────────────────
interface MobileAgendaHeaderProps {
  currentDate: Date;
  viewMode: MobileView;
  showTaskSidebar: boolean;
  onToggleSidebar: () => void;
  onSetView: (v: MobileView) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Retour à aujourd'hui (#16). */
  onToday: () => void;
}

const MobileAgendaHeaderBase: React.FC<MobileAgendaHeaderProps> = ({
  currentDate,
  viewMode,
  showTaskSidebar,
  onToggleSidebar,
  onSetView,
  onPrevMonth,
  onNextMonth,
  onToday: onTodayClick,
}) => {
  const { t } = useT('agenda');
  const monthYear = format(currentDate, 'MMMM yyyy', { locale: getDateLocale() });
  const capitalMonthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
  const isMonthView = viewMode === 'dayGridMonth';
  // Maquette 164 : le mois devient le titre des vues Jour et 2 jours (seule
  // la vue Mois le disait). L'année ne s'écrit que si ce n'est pas la nôtre.
  const now = new Date();
  const monthTitle = (() => {
    const label = format(currentDate, isSameYear(currentDate, now) ? 'MMMM' : 'MMMM yyyy', { locale: getDateLocale() });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();
  // « Aujourd'hui » n'a rien à faire quand on y est déjà.
  const onToday = isMonthView ? isSameMonth(currentDate, now) : isToday(currentDate);

  // Segmented view selector
  const views: { key: MobileView; label: string }[] = [
    { key: 'timeGridDay', label: t('view.day') },
    { key: 'timeGrid2Day', label: t('view.twoDays') },
    { key: 'dayGridMonth', label: t('view.month') },
  ];

  return (
    <div
      className="md:hidden shrink-0 border-b"
      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
    >
      {/* Row 1: main controls */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-2">
        <h2 className="min-w-0 flex-1 truncate text-headline font-semibold text-[rgb(var(--color-text-primary))]">
          {!isMonthView && monthTitle}
        </h2>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sélecteur de vue : le segment actif prend un gris relevé, pas un
              bleu plein (le bleu reste à l'action et au jour choisi). */}
          <div
            data-tutorial-id="agenda-mobile-view-switcher"
            className="flex items-center gap-0.5 rounded-full p-0.5 text-xs"
            style={{ backgroundColor: 'rgb(var(--color-chip-bg))' }}
          >
            {views.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onSetView(key)}
                aria-pressed={viewMode === key}
                className="px-2.5 min-h-touch min-w-touch flex items-center justify-center rounded-full font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === key ? 'rgb(var(--color-active))' : 'transparent',
                  color: viewMode === key ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Aujourd'hui (#16) */}
          {!onToday && (
            <button
              onClick={onTodayClick}
              className="px-2.5 min-h-touch min-w-touch flex items-center justify-center rounded-full text-xs font-semibold shrink-0"
              style={{ color: 'rgb(var(--color-accent))' }}
            >
              {t('nav.today')}
            </button>
          )}

          {/* Maquette 170 : « Tâches » devient une icône ; elle ouvre la
              feuille « Planifier une tâche » (`MobileScheduleSheet`). */}
          <button
            onClick={onToggleSidebar}
            data-tutorial-id="agenda-mobile-tasks-toggle"
            aria-label={t('nav.tasks')}
            aria-expanded={showTaskSidebar}
            aria-haspopup="dialog"
            className="min-h-touch min-w-touch flex items-center justify-center rounded-full shrink-0"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <ListChecks size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Row 2 (month mode only): < Mois Année > navigation */}
      {isMonthView && (
        <div
          className="flex items-center justify-center gap-4 pb-2 px-3"
          style={{ color: 'rgb(var(--color-text-primary))' }}
        >
          <button
            onClick={onPrevMonth}
            aria-label={t('nav.prevPeriod')}
            className="min-h-touch min-w-touch flex items-center justify-center"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="font-semibold text-base">{capitalMonthYear}</span>
          <button
            onClick={onNextMonth}
            aria-label={t('nav.nextPeriod')}
            className="min-h-touch min-w-touch flex items-center justify-center"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export const MobileAgendaHeader = React.memo(MobileAgendaHeaderBase);

// ── Mobile Day Strip ─────────────────────────────────────────────────────────
interface MobileDayStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const MobileDayStripBase: React.FC<MobileDayStripProps> = ({ selectedDate, onSelectDate }) => {
  // Tableau ancré sur aujourd'hui : 3 jours passés + 90 jours futurs
  // Aujourd'hui est à l'index 3, visible sans scroll dès le premier rendu
  const todayRef = new Date();
  const days: Date[] = [];
  for (let i = -3; i <= 90; i++) {
    days.push(addDays(todayRef, i));
  }

  return (
    <div
      className="flex overflow-x-auto px-2"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const selected = isSameDay(day, selectedDate);
        const today = isToday(day);
        // Maquette 168 : « lun. mar. mer. » ; l'initiale seule donnait deux M.
        const initial = format(day, 'EEE', { locale: getDateLocale() });
        const num = format(day, 'd');

        return (
          <button
            key={key}
            onClick={() => onSelectDate(day)}
            className="flex flex-col items-center gap-1 min-w-touch py-2 flex-shrink-0"
          >
            <span
              className="text-caption font-medium"
              style={{ color: selected ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-muted))' }}
            >
              {initial}
            </span>
            <span className="relative w-8 h-8 flex items-center justify-center">
              {selected && (
                <motion.span
                  layoutId="mobile-day-indicator"
                  // Maquette 162 : le jour choisi prend l'accent, comme toute
                  // sélection de l'app (il était en disque blanc plein).
                  className="absolute inset-0 rounded-full bg-[rgb(var(--color-accent-solid))]"
                  transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                />
              )}
              <span
                className={`relative z-10 text-sm font-semibold ${selected ? 'text-[rgb(var(--color-accent-solid-foreground))]' : ''}`}
                style={
                  !selected && today
                    ? { color: 'rgb(var(--color-accent))' }
                    : !selected
                    ? { color: 'rgb(var(--color-text-primary))' }
                    : {}
                }
              >
                {num}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export const MobileDayStrip = React.memo(MobileDayStripBase);
