import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable, EventReceiveArg } from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventDropArg, EventDragStartArg, EventDragStopArg, DatesSetArg } from '@fullcalendar/core';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, CreateEventInput, UpdateEventInput, CalendarEvent, expandRecurringEvents, getMasterId } from '@/modules/events';
import { useCategories } from '@/modules/categories';
import { ChevronLeft, ChevronRight, Calendar, Plus, ZoomIn, ZoomOut, X as CloseIcon, Trash2 } from 'lucide-react';
import TaskSidebar from '../components/TaskSidebar';
import EventModal from '../components/EventModal';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { agendaTutorialStepsDesktop } from '@/tutorials/agenda.desktop';
import { agendaTutorialStepsMobile } from '@/tutorials/agenda.mobile';

type MobileView = 'timeGridDay' | 'timeGrid2Day' | 'dayGridMonth';

const mobileCalendarStyles = `
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
}

const MobileAgendaHeader: React.FC<MobileAgendaHeaderProps> = ({
  currentDate,
  viewMode,
  showTaskSidebar,
  onToggleSidebar,
  onSetView,
  onPrevMonth,
  onNextMonth,
  onAddEvent,
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

          {/* Add */}
          <button
            onClick={onAddEvent}
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

// ── Mobile Day Strip ─────────────────────────────────────────────────────────
interface MobileDayStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const MobileDayStrip: React.FC<MobileDayStripProps> = ({ selectedDate, onSelectDate }) => {
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

// ── Page principale ──────────────────────────────────────────────────────────
const AgendaPage: React.FC = () => {
  const tutorialIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const tutorial = useTutorial(tutorialIsMobile ? 'agenda_mobile' : 'agenda_desktop', 800);
  const tutorialSteps = tutorialIsMobile ? agendaTutorialStepsMobile : agendaTutorialStepsDesktop;
  const { data: events = [] } = useEvents();
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  const { data: categories = [] } = useCategories();

  const isMobile = useIsMobile();

  const [currentView, setCurrentView] = useState('timeGridWeek');
  const [showTaskSidebar, setShowTaskSidebar] = useState(() => window.innerWidth >= 768);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showRecurringManager, setShowRecurringManager] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const calendarRef = useRef<FullCalendar>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const categoriesRef = useRef(categories);
  // Timestamp pour suppression du clic résiduel après un drag — auto-expire après 300ms
  // (jamais "stuck" même si le cleanup ne tourne pas).
  const lastDragEndAtRef = useRef<number>(0);
  const [zoomLevel, setZoomLevel] = useState(3);
  const zoomDurations = ['00:05:00', '00:10:00', '00:15:00', '00:30:00', '01:00:00'];

  // Mobile state
  const mobileCalendarRef = useRef<FullCalendar>(null);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date>(() => new Date());
  const [mobileCalendarKey, setMobileCalendarKey] = useState(0);
  const [mobileViewMode, setMobileViewMode] = useState<MobileView>('timeGridDay');

  const getInitialScrollTime = () => {
    const now = new Date();
    const hour = now.getHours();
    const scrollHour = Math.max(0, hour - 4);
    return `${scrollHour.toString().padStart(2, '0')}:00:00`;
  };

  const handleZoomIn = () => {
    if (zoomLevel > 0) { setZoomLevel(prev => prev - 1); setCalendarKey(prev => prev + 1); }
  };

  const handleZoomOut = () => {
    if (zoomLevel < zoomDurations.length - 1) { setZoomLevel(prev => prev + 1); setCalendarKey(prev => prev + 1); }
  };

  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  // Draggable init (desktop + mobile sidebar)
  useEffect(() => {
    if (!showTaskSidebar) return;
    const timer = setTimeout(() => {
      const container = document.getElementById('external-events-container');
      if (container && !draggableRef.current) {
        draggableRef.current = new Draggable(container, {
          itemSelector: '.external-event',
          longPressDelay: 50,
          eventData: function (eventEl) {
            const taskData = JSON.parse(eventEl.getAttribute('data-task') || '{}');
            const catColor = categoriesRef.current.find(cat => cat.id === taskData.category)?.color || '#6B7280';
            return {
              title: taskData.name,
              duration: { minutes: taskData.estimatedTime },
              backgroundColor: catColor,
              borderColor: catColor,
              textColor: '#ffffff',
              extendedProps: {
                taskId: taskData.id,
                priority: taskData.priority,
                category: taskData.category,
                estimatedTime: taskData.estimatedTime,
                categoryName: categoriesRef.current.find(c => c.id === taskData.category)?.name || 'Sans catégorie',
              },
            };
          },
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [showTaskSidebar, categories, events]);

  useEffect(() => {
    if (!showTaskSidebar && !isDraggingTask && draggableRef.current) {
      try { draggableRef.current.destroy(); } catch { /* ignore */ }
      draggableRef.current = null;
    }
  }, [showTaskSidebar, isDraggingTask]);

  useEffect(() => {
    const timer = setTimeout(() => {
      calendarRef.current?.getApi().updateSize();
      mobileCalendarRef.current?.getApi().updateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [showTaskSidebar]);

  useEffect(() => {
    if (!isDraggingTask) return;
    const handleMove = (x: number) => {
      const sidebarWidth = sidebarRef.current?.offsetWidth || 224;
      if (x > sidebarWidth && window.innerWidth < 768) setShowTaskSidebar(false);
    };
    const handlePointerMove = (e: PointerEvent) => { if (isDraggingTask) handleMove(e.clientX); };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', () => setIsDraggingTask(false));
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', () => setIsDraggingTask(false));
    };
  }, [isDraggingTask]);

  const handleViewChange = (newView: string) => {
    setCurrentView(newView);
    setCalendarKey(prev => prev + 1);
    setTimeout(() => { calendarRef.current?.getApi().changeView(newView); }, 100);
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedTimeSlot({ start: selectInfo.start.toISOString(), end: selectInfo.end.toISOString() });
    setShowAddEventModal(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    // Suppress le click résiduel qui peut firer juste après un drag (long-press
    // sans mouvement notamment). Auto-expire après 300ms : pas de blocage permanent.
    if (Date.now() - lastDragEndAtRef.current < 300) return;
    try { clickInfo.view.calendar.unselect(); } catch { /* ignore */ }
    const masterId = getMasterId(clickInfo.event.id);
    const taskId = clickInfo.event.extendedProps?.taskId;
    const event = events.find(e => e.id === masterId || (taskId && e.taskId === taskId));
    if (event) { setSelectedEvent(event); setShowEditEventModal(true); }
  };

  const draggedEventIdRef = useRef<string | null>(null);
  const dragEndHandlerRef = useRef<((clientX?: number, clientY?: number) => void) | null>(null);

  const handleEventDragStart = (info: EventDragStartArg) => {
    draggedEventIdRef.current = info.event.id;

    const je = info.jsEvent as MouseEvent | undefined;
    const startPos = je && typeof je.clientX === 'number' ? { x: je.clientX, y: je.clientY } : null;

    let handled = false;
    let lastX: number | undefined = startPos?.x;
    let lastY: number | undefined = startPos?.y;
    const draggedId = info.event.id;
    const taskId = info.event.extendedProps?.taskId as string | undefined;

    const onPointerMove = (e: PointerEvent) => { lastX = e.clientX; lastY = e.clientY; };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0] || e.changedTouches[0];
      if (t) { lastX = t.clientX; lastY = t.clientY; }
    };

    const removeWindowListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('pointercancel', onCancel);
    };

    const handleEnd = (clientX?: number, clientY?: number) => {
      if (handled) return;
      handled = true;
      dragEndHandlerRef.current = null;
      removeWindowListeners();
      draggedEventIdRef.current = null;
      lastDragEndAtRef.current = Date.now();

      const x = typeof clientX === 'number' ? clientX : lastX;
      const y = typeof clientY === 'number' ? clientY : lastY;

      // 1) Drop sur la sidebar → suppression
      if (typeof x === 'number' && typeof y === 'number') {
        const sidebar = document.getElementById('agenda-task-sidebar-dropzone');
        if (sidebar) {
          const rect = sidebar.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            const masterId = getMasterId(draggedId);
            const ev = events.find(e2 => e2.id === masterId);
            if (ev) {
              // Quand un event FC est droppé hors de ses drop zones, FC entre
              // dans un état d'auto-revert qui retient la référence DOM de
              // l'event. Même si React Query retire l'event de son cache
              // (optimistic update de useDeleteEvent), FC ne se re-sync pas et
              // garde un ghost visible + bloque tous les pointer events suivants.
              //
              // Solution nucléaire mais fiable : bumper la key de FullCalendar
              // pour forcer un remount complet (qui se re-initialise sur la
              // bonne date via mobileSelectedDate / currentView). On défère
              // mutation + remount au prochain tick pour laisser FC sortir
              // proprement de son pointerup handler.
              setTimeout(() => {
                deleteEventMutation.mutate(ev.id);
                setCalendarKey(k => k + 1);
                setMobileCalendarKey(k => k + 1);
              }, 0);
            }
            return;
          }
        }
      }

      // 2) Long-press sans mouvement → traiter comme un clic (ouvrir EventModal)
      if (
        startPos &&
        typeof x === 'number' && typeof y === 'number' &&
        Math.abs(x - startPos.x) < 5 && Math.abs(y - startPos.y) < 5
      ) {
        const masterId = getMasterId(draggedId);
        const ev = events.find(e => e.id === masterId || (taskId && e.taskId === taskId));
        if (ev) {
          setSelectedEvent(ev);
          setShowEditEventModal(true);
        }
        return;
      }

      // 3) Drag intra-calendar normal → FC gère eventDrop naturellement.
    };

    const onPointerUp = (e: PointerEvent) => handleEnd(e.clientX, e.clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      handleEnd(t?.clientX, t?.clientY);
    };
    const onCancel = () => handleEnd();

    dragEndHandlerRef.current = handleEnd;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('pointercancel', onCancel);
  };

  const handleEventDragStop = (info: EventDragStopArg) => {
    const je = info.jsEvent as MouseEvent | undefined;
    dragEndHandlerRef.current?.(je?.clientX, je?.clientY);
  };

  const handleEventDrop = (dropInfo: EventDropArg) => {
    const masterId = getMasterId(dropInfo.event.id);
    const taskId = dropInfo.event.extendedProps?.taskId;
    const event = events.find(e => e.id === masterId || (taskId && e.taskId === taskId));
    if (!event) return;
    const newStart = dropInfo.event.start?.toISOString();
    if (!newStart) return;
    const newEnd = dropInfo.event.end
      ? dropInfo.event.end.toISOString()
      : new Date((dropInfo.event.start?.getTime() ?? Date.now()) + 3600000).toISOString();
    updateEventMutation.mutate({ id: event.id, updates: { start: newStart, end: newEnd } });
  };

  const handleEventReceive = (receiveInfo: EventReceiveArg) => {
    const eventData = receiveInfo.event;
    const newEvent: CreateEventInput = {
      title: eventData.title,
      start: eventData.start?.toISOString() ?? new Date().toISOString(),
      end: eventData.end
        ? eventData.end.toISOString()
        : new Date((eventData.start?.getTime() ?? Date.now()) + (eventData.extendedProps.estimatedTime as number) * 60000).toISOString(),
      color: eventData.backgroundColor ?? undefined,
      notes: `Priorité: ${eventData.extendedProps.priority} | Catégorie: ${eventData.extendedProps.categoryName}`,
      taskId: eventData.extendedProps.taskId as string,
    };
    const isDuplicate = events.some(e =>
      (newEvent.taskId && e.taskId === newEvent.taskId) ||
      (e.title === newEvent.title && e.start === newEvent.start && e.end === newEvent.end)
    );
    if (isDuplicate) { receiveInfo.event.remove(); return; }
    createEventMutation.mutate(newEvent);
  };

  const projectionFrom = new Date();
  projectionFrom.setMonth(projectionFrom.getMonth() - 13);
  const projectionTo = new Date();
  projectionTo.setMonth(projectionTo.getMonth() + 13);
  const expandedEvents = expandRecurringEvents(events, projectionFrom, projectionTo);

  const calendarEvents = expandedEvents.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: '#ffffff',
    editable: !event.id.includes('::'),
    extendedProps: { notes: event.notes, taskId: event.taskId, isRecurringInstance: event.id.includes('::') },
  }));

  const handleAddEvent = (eventData: CreateEventInput) => {
    createEventMutation.mutate({ ...eventData, taskId: eventData.taskId || undefined });
    setShowAddEventModal(false);
    setSelectedTimeSlot(null);
    setTimeout(() => { calendarRef.current?.getApi().unselect(); }, 100);
  };

  const handleUpdateEvent = (eventId: string, eventData: UpdateEventInput) => {
    updateEventMutation.mutate({ id: eventId, updates: eventData });
    setShowEditEventModal(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEventMutation.mutate(eventId);
    setShowEditEventModal(false);
    setSelectedEvent(null);
  };

  const handleOpenAddModal = () => { setSelectedTimeSlot(null); setShowAddEventModal(true); };

  const handleCloseAddModal = () => {
    setShowAddEventModal(false);
    setSelectedTimeSlot(null);
    setTimeout(() => { calendarRef.current?.getApi().unselect(); }, 100);
  };

  // ── Mobile handlers ───────────────────────────────────────────────────────
  const handleMobileSetView = (view: MobileView) => {
    setMobileViewMode(view);
    mobileCalendarRef.current?.getApi().changeView(view);
    setMobileCalendarKey(prev => prev + 1);
  };

  const handleMobileSelectDate = (date: Date) => {
    setMobileSelectedDate(date);
    const api = mobileCalendarRef.current?.getApi();
    if (!api) return;
    if (mobileViewMode !== 'timeGridDay' && mobileViewMode !== 'timeGrid2Day') {
      handleMobileSetView('timeGridDay');
    }
    api.gotoDate(date);
  };

  const _handleMobileGoToMonth = () => { handleMobileSetView('dayGridMonth'); };

  const _handleMobileGoToday = () => {
    const today = new Date();
    setMobileSelectedDate(today);
    handleMobileSetView('timeGridDay');
    setTimeout(() => { mobileCalendarRef.current?.getApi().gotoDate(today); }, 50);
  };

  const handleMobileMonthPrev = () => { mobileCalendarRef.current?.getApi().prev(); };
  const handleMobileMonthNext = () => { mobileCalendarRef.current?.getApi().next(); };

  const handleMobileDatesSet = (info: DatesSetArg) => {
    setMobileSelectedDate(info.view.currentStart);
  };

  const isMonthView = mobileViewMode === 'dayGridMonth';

  // Label du jour sélectionné
  const mobileDayLabel = (() => {
    const raw = format(mobileSelectedDate, 'EEEE - d MMMM yyyy', { locale: fr });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      {/* Task Sidebar & Backdrop */}
      <AnimatePresence mode="wait">
        {showTaskSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowTaskSidebar(false)}
              className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-[1px]"
            />
            <motion.div
              ref={sidebarRef}
              layoutRoot
              initial={{ x: -400, opacity: 0, width: 0 }}
              animate={{ x: 0, opacity: 1, width: 'auto' }}
              exit={{ x: -400, opacity: 0, width: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed md:relative inset-y-0 left-0 z-50 md:z-40 flex overflow-hidden flex-shrink-0 shadow-2xl md:shadow-none"
              onAnimationComplete={() => { calendarRef.current?.getApi().updateSize(); }}
            >
              <TaskSidebar
                onClose={() => setShowTaskSidebar(false)}
                onDragStart={() => { if (window.innerWidth < 768) setIsDraggingTask(true); }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── MOBILE HEADER ── */}
        <MobileAgendaHeader
          currentDate={mobileSelectedDate}
          viewMode={mobileViewMode}
          showTaskSidebar={showTaskSidebar}
          onToggleSidebar={() => setShowTaskSidebar(prev => !prev)}
          onSetView={handleMobileSetView}
          onPrevMonth={handleMobileMonthPrev}
          onNextMonth={handleMobileMonthNext}
          onAddEvent={handleOpenAddModal}
        />

        {/* ── DESKTOP HEADER (hidden on mobile) ── */}
        <div className="hidden md:block">
          <motion.div
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="px-4 py-3 border-b"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
          >
            <div className="flex items-center justify-between gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowTaskSidebar(!showTaskSidebar)}
                data-tutorial-id="agenda-task-sidebar-toggle"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm shrink-0 border ${showTaskSidebar ? 'shadow-md' : ''}`}
                style={{
                  backgroundColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-bg))',
                  borderColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-border))',
                  color: showTaskSidebar ? 'white' : 'rgb(var(--color-text-primary))',
                }}
              >
                <Calendar size={18} />
                <span className="font-medium text-sm lg:text-base">Tâches</span>
              </motion.button>

              <div className="flex items-center gap-2 lg:gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleZoomIn}
                    disabled={zoomLevel === 0}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}>
                    <ZoomIn size={18} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleZoomOut}
                    disabled={zoomLevel === zoomDurations.length - 1}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === zoomDurations.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}>
                    <ZoomOut size={18} />
                  </motion.button>
                </div>

                <div className="flex gap-1 p-1 rounded-xl border"
                  data-tutorial-id="agenda-view-switcher"
                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
                  {(['timeGridDay', 'timeGridWeek', 'dayGridMonth'] as const).map(view => (
                    <button key={view} onClick={() => handleViewChange(view)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none whitespace-nowrap ${
                        currentView === view
                          ? 'bg-[rgb(var(--color-accent))] text-white shadow-sm monochrome:bg-white monochrome:text-zinc-900'
                          : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                      }`}>
                      {view === 'timeGridDay' ? 'Jour' : view === 'timeGridWeek' ? 'Semaine' : 'Mois'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().prev()}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronLeft size={18} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().next()}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronRight size={18} />
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRecurringManager(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium transition-all border shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: 'rgb(var(--color-chip-bg))', borderColor: 'rgb(var(--color-chip-border))', color: 'rgb(var(--color-text-primary))' }}>
                  <span className="text-sm lg:text-base">Récurrences</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={handleOpenAddModal}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 monochrome:shadow-white/10 transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black shrink-0 whitespace-nowrap">
                  <Plus size={18} />
                  <span className="font-medium text-sm lg:text-base">Nouveau</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── MOBILE : bandeau jours + label (masqué en vue mois) ── */}
        {!isMonthView && (
          <div
            className="md:hidden border-b shrink-0"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
          >
            <MobileDayStrip
              selectedDate={mobileSelectedDate}
              onSelectDate={handleMobileSelectDate}
            />
            <p
              className="text-center pb-2 text-sm font-medium"
              style={{ color: 'rgb(var(--color-text-secondary))' }}
            >
              {mobileDayLabel}
            </p>
          </div>
        )}

        {/* ── MOBILE CALENDAR ── */}
        {isMobile && (
          <div className="md:hidden mobile-calendar flex-1 overflow-hidden pb-[calc(64px+env(safe-area-inset-bottom))]">
            <FullCalendar
              key={mobileCalendarKey}
              ref={mobileCalendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={mobileViewMode}
              initialDate={mobileSelectedDate}
              headerToolbar={false}
              views={{
                timeGrid2Day: { type: 'timeGrid', duration: { days: 2 } },
              }}
              events={calendarEvents}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
              height="100%"
              locale="fr"
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              scrollTime={getInitialScrollTime()}
              allDaySlot={false}
              nowIndicator={true}
              eventDisplay="block"
              eventLongPressDelay={250}
              selectLongPressDelay={250}
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              snapDuration="00:15:00"
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDragStart={handleEventDragStart}
              eventDragStop={handleEventDragStop}
              eventDrop={handleEventDrop}
              eventReceive={handleEventReceive}
              unselectAuto={true}
              unselectCancel=".modal-overlay,.modal-content,input,textarea,select,button,.fc-event"
              datesSet={handleMobileDatesSet}
              eventContent={(eventInfo) => (
                <div className="h-full w-full flex items-center p-1 text-xs cursor-pointer">
                  <div className="font-medium text-white truncate leading-tight">
                    {eventInfo.event.title}
                  </div>
                </div>
              )}
              eventClassNames="rounded-lg shadow-sm border-0 cursor-pointer"
            />
            <style>{mobileCalendarStyles}</style>
          </div>
        )}

        {/* ── DESKTOP CALENDAR (hidden on mobile) ── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="hidden md:flex flex-1 p-2 lg:p-6 min-w-0 overflow-hidden"
        >
          <div className="rounded-xl shadow-lg border h-full w-full overflow-hidden"
            data-tutorial-id="agenda-calendar-grid"
            style={{ backgroundColor: 'rgb(var(--calendar-bg))', borderColor: 'rgb(var(--calendar-border))' }}>
            <div className="p-2 lg:p-6 h-full w-full overflow-hidden">
              <FullCalendar
                key={calendarKey}
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={currentView}
                headerToolbar={false}
                events={calendarEvents}
                editable={true}
                droppable={true}
                eventStartEditable={true}
                eventDurationEditable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={false}
                weekends={true}
                height="100%"
                locale="fr"
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                scrollTime={getInitialScrollTime()}
                allDaySlot={false}
                nowIndicator={true}
                eventDisplay="block"
                eventLongPressDelay={250}
                selectLongPressDelay={250}
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                slotDuration={zoomDurations[zoomLevel]}
                slotLabelInterval={zoomLevel === zoomDurations.length - 1 ? '02:00:00' : '01:00:00'}
                snapDuration={zoomDurations[zoomLevel]}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDragStart={handleEventDragStart}
                eventDragStop={handleEventDragStop}
                eventDrop={handleEventDrop}
                eventReceive={handleEventReceive}
                unselectAuto={true}
                unselectCancel=".modal-overlay,.modal-content,input,textarea,select,button,.fc-event"
                eventContent={(eventInfo) => (
                  <div className="h-full w-full flex items-center justify-center p-1 text-xs cursor-pointer">
                    <div className="font-medium text-white truncate text-center leading-tight">
                      {eventInfo.event.title}
                    </div>
                  </div>
                )}
                eventClassNames="rounded-lg shadow-sm border-0 cursor-pointer hover:shadow-md transition-all hover:scale-105"
              />
              <style>{`
                .dark .fc-theme-standard td.fc-day:hover,
                .dark .fc-theme-standard .fc-timegrid-col:hover { background-color: rgba(255,255,255,0.06) !important; }
                .dark .fc-theme-standard td.fc-day,
                .dark .fc-theme-standard .fc-timegrid-col { background-color: transparent !important; }
                .fc-event { transition: all 0.2s ease; }
                .fc-event:hover { transform: scale(1.02); z-index: 999; }
              `}</style>
            </div>
          </div>
        </motion.div>
      </div>

      {showAddEventModal && (
        <EventModal
          mode="add"
          isOpen={showAddEventModal}
          onClose={handleCloseAddModal}
          task={{ id: '', name: '', priority: 3, category: 'blue', deadline: '', estimatedTime: 60, createdAt: '', bookmarked: false, completed: false }}
          onAddEvent={handleAddEvent}
          prefilledTimeSlot={selectedTimeSlot || undefined}
        />
      )}

      <AnimatePresence>
        {showRecurringManager && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowRecurringManager(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl shadow-2xl w-full overflow-hidden border"
              style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', maxWidth: 'calc(32rem * 1.08)' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
                <h3 className="text-base font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Événements récurrents</h3>
                <button onClick={() => setShowRecurringManager(false)}
                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  <CloseIcon size={18} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {(() => {
                  const recurring = events.filter(e => (e.recurrence ?? 'none') !== 'none');
                  if (recurring.length === 0) {
                    return (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>Aucun événement récurrent pour le moment.</p>
                      </div>
                    );
                  }
                  return (
                    <ul className="divide-y" style={{ borderColor: 'rgb(var(--color-border))' }}>
                      {recurring.map(ev => {
                        const startDate = new Date(ev.start);
                        const label = ev.recurrence === 'daily' ? 'Quotidien' : ev.recurrence === 'weekly' ? 'Hebdomadaire' : 'Récurrent';
                        return (
                          <li key={ev.id} className="px-6 py-3 flex items-center gap-3" style={{ borderColor: 'rgb(var(--color-border))' }}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color || 'rgb(var(--color-accent))' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{ev.title}</p>
                              <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                                {label} · démarre le {startDate.toLocaleDateString('fr-FR')} à {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <button
                              onClick={() => updateEventMutation.mutate({ id: ev.id, updates: { recurrence: 'none' } })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-200 dark:border-red-800/40 transition-colors shrink-0"
                            >
                              <Trash2 size={13} />
                              <span>Récurrence</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showEditEventModal && selectedEvent && (
        <EventModal
          mode="edit"
          isOpen={showEditEventModal}
          onClose={() => { setShowEditEventModal(false); setSelectedEvent(null); }}
          event={selectedEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}

      {/* Tutoriel page Agenda — variante adaptée au viewport */}
      <PageTutorial
        steps={tutorialSteps}
        isOpen={tutorial.isOpen}
        onClose={tutorial.close}
        accentColor="#EF4444"
      />
    </motion.div>
  );
};

export default AgendaPage;
