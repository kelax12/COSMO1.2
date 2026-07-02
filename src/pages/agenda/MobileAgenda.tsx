// Sous-composants mobile de l'agenda (header segmenté + bandeau de jours) +
// styles FullCalendar mobile — extraits verbatim de AgendaPage, mémoïsés.
import React from 'react';
import { motion } from 'framer-motion';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

export type MobileView = 'timeGridDay' | 'timeGrid2Day' | 'dayGridMonth';

export const mobileCalendarStyles = `
  .mobile-calendar .fc-timegrid-slot { height: 20px !important; }
  .mobile-calendar .fc-timegrid-slot-label {
    font-size: 10px !important;
    padding: 0 4px !important;
    vertical-align: top;
    color: rgb(var(--color-text-muted));
  }
  .mobile-calendar .fc-timegrid-axis { width: 40px !important; }
  .mobile-calendar .fc-col-header { display: none !important; }
  .mobile-calendar .fc-scroller::-webkit-scrollbar { display: none; }
  .mobile-calendar .fc-scroller { -ms-overflow-style: none; scrollbar-width: none; }
  .mobile-calendar .fc-timegrid-slot-minor { border-top-style: none !important; }
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
  onAddEvent: () => void;
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
  onAddEvent,
  onToday,
}) => {
  const monthYear = format(currentDate, 'MMMM yyyy', { locale: fr });
  const capitalMonthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
  const isMonthView = viewMode === 'dayGridMonth';

  // Segmented view selector
  const views: { key: MobileView; label: string }[] = [
    { key: 'timeGridDay', label: 'Jour' },
    { key: 'timeGrid2Day', label: '2J' },
    { key: 'dayGridMonth', label: 'Mois' },
  ];

  return (
    <div
      className="md:hidden shrink-0 border-b"
      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
    >
      {/* Row 1: main controls */}
      <div className="flex items-center justify-between px-3 py-1">
        {/* Left: Tâches toggle */}
        <button
          onClick={onToggleSidebar}
          data-tutorial-id="agenda-mobile-tasks-toggle"
          className={`flex items-center gap-1 px-2 min-h-[44px] rounded-lg text-xs font-medium transition-colors`}
          style={{
            backgroundColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'transparent',
            color: showTaskSidebar ? 'white' : 'rgb(var(--color-text-secondary))',
          }}
        >
          <Calendar size={15} />
          <span>Tâches</span>
        </button>

        {/* Right */}
        <div className="flex items-center gap-1">
          {/* 3-way view selector */}
          <div
            data-tutorial-id="agenda-mobile-view-switcher"
            className="flex rounded-lg overflow-hidden border text-xs"
            style={{ borderColor: 'rgb(var(--color-border))' }}
          >
            {views.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onSetView(key)}
                className="px-2 py-1.5 font-medium transition-colors"
                style={{
                  backgroundColor:
                    viewMode === key ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-bg))',
                  color: viewMode === key ? 'white' : 'rgb(var(--color-text-secondary))',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Aujourd'hui (#16) */}
          <button
            onClick={onToday}
            aria-label="Revenir à aujourd'hui"
            className="px-2 min-h-[44px] flex items-center justify-center rounded-lg text-xs font-semibold border"
            style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
          >
            Auj.
          </button>

          {/* Add */}
          <button
            onClick={onAddEvent}
            data-tutorial-id="agenda-mobile-add-button"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
            style={{ color: 'rgb(var(--color-accent))' }}
          >
            <Plus size={22} />
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-base">{capitalMonthYear}</span>
          <button
            onClick={onNextMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <ChevronRight size={20} />
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
        const initial = format(day, 'EEEEE', { locale: fr }).toUpperCase();
        const num = format(day, 'd');

        return (
          <button
            key={key}
            onClick={() => onSelectDate(day)}
            className="flex flex-col items-center gap-1 min-w-[44px] py-2 flex-shrink-0"
          >
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              {initial}
            </span>
            <span className="relative w-8 h-8 flex items-center justify-center">
              {selected && (
                <motion.span
                  layoutId="mobile-day-indicator"
                  className="absolute inset-0 rounded-full bg-black dark:bg-white"
                  transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                />
              )}
              <span
                className={`relative z-10 text-sm font-semibold ${selected ? 'text-white dark:text-black' : ''}`}
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
