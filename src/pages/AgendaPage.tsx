import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import FullCalendar from '@fullcalendar/react';
import { Draggable } from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { useEventsWindow, useCreateEvent, useUpdateEvent, useDeleteEvent, useRestoreEvent, CalendarEvent } from '@/modules/events';
import { useCategories } from '@/modules/categories';
import TaskSidebar from '@/components/TaskSidebar';
import TaskModal from '@/components/TaskModal';
import EventModal from '@/components/EventModal';
import ColorSettingsModal from '@/components/ColorSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { agendaTutorialStepsDesktop } from '@/tutorials/agenda.desktop';
import { agendaTutorialStepsMobile } from '@/tutorials/agenda.mobile';
import { buildCalendarEvents, defaultEventsWindow, bufferedWindow, resolveDraggedTaskEventData, type DraggedTaskData } from './agenda/calendar-events';
import { useTimezonePref, fromDisplayISO } from '@/lib/timezone';
import SlotReviewMenu from './agenda/SlotReviewMenu';
import SlotReviewPanel from './agenda/SlotReviewPanel';
import { useOverdueSlotReview } from './agenda/useOverdueSlotReview';
import { useTasks, useToggleTaskComplete, useDeleteTask, useRestoreTask } from '@/modules/tasks';
import { MobileAgendaHeader } from './agenda/MobileAgenda';
import AgendaDesktopHeader from './agenda/AgendaDesktopHeader';
import RecurringEventsManager from './agenda/RecurringEventsManager';
import QuickEventCard from './agenda/QuickEventCard';
import { useAgendaEventDrag } from './agenda/useAgendaEventDrag';
import { findSourceEvent } from './agenda/find-event';
import PageErrorState from '@/components/PageErrorState';
import SkipLink from '@/components/SkipLink';
import { deadlineDayKey } from '@/lib/deadline';
import { useAgendaEventActions } from './agenda/useAgendaEventActions';
import AgendaCalendarSection, { AGENDA_CALENDAR_ID } from './agenda/AgendaCalendarSection';
import { useAgendaMobileView } from './agenda/useAgendaMobileView';
import { useCalendarGridGestures } from './agenda/useCalendarGridGestures';

// ── Page principale ──────────────────────────────────────────────────────────
const AgendaPage: React.FC = () => {
  const { t } = useT('agenda');
  const { t: tCommon } = useT('common');
  const tutorialIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const tutorial = useTutorial(tutorialIsMobile ? 'agenda_mobile' : 'agenda_desktop', 800, !tutorialIsMobile);
  const tutorialSteps = tutorialIsMobile ? agendaTutorialStepsMobile : agendaTutorialStepsDesktop;
  // Pagination serveur de l'agenda : on ne charge que les événements de la
  // fenêtre visible (+ tous les récurrents, cf. window.ts). La fenêtre est
  // affinée par datesSet (desktop + mobile) ; init large pour un 1er paint sans flash.
  const [eventsWindow, setEventsWindow] = useState(() => defaultEventsWindow());
  const { data: events = [], isError: isEventsError, error: eventsError, refetch: refetchEvents } = useEventsWindow(eventsWindow.start, eventsWindow.end);
  const applyVisibleRange = useCallback((rangeStart: Date, rangeEnd: Date) => {
    const next = bufferedWindow(rangeStart, rangeEnd);
    setEventsWindow((prev) =>
      prev.start === next.start && prev.end === next.end ? prev : next,
    );
  }, []);
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  const restoreEventMutation = useRestoreEvent();
  // Feature « revue de créneau » : tâches + mutations pour valider/supprimer.
  const { data: tasks = [] } = useTasks();
  const toggleTaskComplete = useToggleTaskComplete();
  const deleteTaskMutation = useDeleteTask();
  // Sert UNIQUEMENT a l'annulation de l'abandon d'un creneau (R-07).
  const restoreTaskMutation = useRestoreTask();
  const { data: categories = [] } = useCategories();
  const { pref: tzPref } = useTimezonePref();
  const isMobile = useIsMobile();

  const [currentView, setCurrentView] = useState('timeGridWeek');
  const [showTaskSidebar, setShowTaskSidebar] = useState(() => window.innerWidth >= 768);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showRecurringManager, setShowRecurringManager] = useState(false);
  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);

  // Ouverture directe du modal de création depuis la palette ⌘K (#19).
  const location = useLocation();
  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      setShowAddEventModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: string; end: string } | null>(null);
  // Création rapide depuis une plage : petite popup ancrée au clic (remplace
  // l'ouverture d'EventModal, jugé trop lourd visuellement).
  const [quickSlot, setQuickSlot] = useState<{ start: string; end: string; x: number; y: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  // ⚠️ `eventPendingDecision` / `AgendaEventToTaskConfirm` ont disparu le
  // 2026-09-13 : déposer un événement SANS tâche sur la sidebar ouvrait une
  // popup « Que faire de cet événement ? ». C'était la seule surface de
  // validation qui visait des événements non liés à une tâche, et elle se
  // déclenchait sur un geste qui ne demandait rien. Le drop est désormais
  // simplement refusé (FullCalendar ramène le bloc à sa place).
  const [eventForTaskCreation, setEventForTaskCreation] = useState<CalendarEvent | null>(null);
  // Date YYYY-MM-DD de l'instance cliquée (null si event non-récurrent ou master)
  const [selectedInstanceDate, setSelectedInstanceDate] = useState<string | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);
  // Plage visible du calendrier desktop — permet de savoir si "aujourd'hui"
  // est déjà affiché (bouton « Aujourd'hui » → sélecteur de date sinon).
  const [desktopVisibleRange, setDesktopVisibleRange] = useState<{ start: Date; end: Date } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const categoriesRef = useRef(categories);
  // Même raison que `categoriesRef` : le callback `eventData` du `Draggable`
  // est créé UNE fois et vit aussi longtemps que lui. Le mettre en dépendance
  // de l'effet reconstruirait le Draggable à chaque changement de `t`, alors
  // qu'un ref lui donne simplement la valeur fraîche au moment de l'appel.
  const tRef = useRef(t);
  const [zoomLevel, setZoomLevel] = useState(3);
  const zoomDurations = ['00:05:00', '00:10:00', '00:15:00', '00:30:00', '01:00:00'];

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const je = selectInfo.jsEvent as MouseEvent | null;
    // Le calendrier renvoie des instants dans le fuseau d'affichage : on retire
    // le décalage pour stocker l'instant « vrai ». QuickEventCard réaffiche
    // ensuite l'heure dans le fuseau choisi (formatTimeInTz).
    setQuickSlot({
      start: fromDisplayISO(selectInfo.start.toISOString(), tzPref),
      end: fromDisplayISO(selectInfo.end.toISOString(), tzPref),
      x: je?.clientX ?? Math.round(window.innerWidth / 2),
      y: je?.clientY ?? Math.round(window.innerHeight / 2),
    });
  };

  // Quel jour et sous quelle forme le calendrier mobile affiche — état, clé de
  // remontage et navigation vivent dans `useAgendaMobileView`.
  const {
    mobileCalendarRef,
    mobileSelectedDate,
    mobileCalendarKey,
    setMobileCalendarKey,
    mobileViewMode,
    mobileZoom,
    handleMobileSetView,
    handleMobileSelectDate,
    handleMobileDateClick,
    handleMobileDateSelect,
    handleMobileMonthPrev,
    handleMobileMonthNext,
    handleMobileDatesSet,
  } = useAgendaMobileView({ onDateSelect: handleDateSelect, applyVisibleRange });

  const handleZoomIn = () => {
    if (zoomLevel > 0) { setZoomLevel(prev => prev - 1); setCalendarKey(prev => prev + 1); }
  };

  const handleZoomOut = () => {
    if (zoomLevel < zoomDurations.length - 1) { setZoomLevel(prev => prev + 1); setCalendarKey(prev => prev + 1); }
  };

  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { tRef.current = t; }, [t]);

  // Draggable init (desktop + mobile sidebar)
  useEffect(() => {
    if (!showTaskSidebar) return;
    const timer = setTimeout(() => {
      const container = document.getElementById('external-events-container');
      if (container && !draggableRef.current) {
        draggableRef.current = new Draggable(container, {
          itemSelector: '.external-event',
          // 250ms (au lieu de 50) : un swipe vertical rapide scrolle la liste
          // au lieu de démarrer un drag → permet de scroller sans sélectionner
          // une tâche sur mobile (combiné à touch-action: pan-y sur les cartes).
          longPressDelay: 250,
          // Tâche d'équipe (TaskSidebar, item 4) : couleur/nom de catégorie
          // déjà résolus par l'appelant dans le payload — voir
          // `resolveDraggedTaskEventData` (agenda/calendar-events.ts).
          eventData: function (eventEl) {
            const taskData: DraggedTaskData = JSON.parse(eventEl.getAttribute('data-task') || '{}');
            return resolveDraggedTaskEventData(taskData, categoriesRef.current, tRef.current('event.uncategorized'));
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
    // `mobileCalendarRef` vient de `useAgendaMobileView` : c'est un ref, donc
    // une identité stable. Il est dans les dépendances parce qu'ESLint ne peut
    // plus le prouver depuis qu'il traverse une frontière de hook.
  }, [showTaskSidebar, mobileCalendarRef]);

  useEffect(() => {
    if (!isDraggingTask) return;
    const handleMove = (x: number) => {
      const sidebarWidth = sidebarRef.current?.offsetWidth || 224;
      if (x > sidebarWidth && window.innerWidth < 768) setShowTaskSidebar(false);
    };
    const handlePointerMove = (e: PointerEvent) => { if (isDraggingTask) handleMove(e.clientX); };
    // `handlePointerUp` doit être une CONSTANTE : passer deux fonctions fléchées
    // distinctes à add/removeEventListener ne retirait rien, et un écouteur
    // s'accumulait à chaque glisser pour la durée de vie de la page (R-16).
    const handlePointerUp = () => setIsDraggingTask(false);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingTask]);

  const handleViewChange = (newView: string) => {
    setCurrentView(newView);
    setCalendarKey(prev => prev + 1);
    setTimeout(() => { calendarRef.current?.getApi().changeView(newView); }, 100);
  };

  const handleQuickCreate = (title: string, color?: string) => {
    if (!quickSlot) return;
    createEventMutation.mutate({ title, start: quickSlot.start, end: quickSlot.end, color });
    setQuickSlot(null);
    setTimeout(() => {
      calendarRef.current?.getApi().unselect();
      mobileCalendarRef.current?.getApi().unselect();
    }, 50);
  };

  const handleQuickClose = () => {
    setQuickSlot(null);
    setTimeout(() => {
      calendarRef.current?.getApi().unselect();
      mobileCalendarRef.current?.getApi().unselect();
    }, 50);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    // Suppress le click résiduel qui peut firer juste après un drag (long-press
    // sans mouvement notamment). Auto-expire après 300ms : pas de blocage permanent.
    if (Date.now() - lastDragEndAtRef.current < 300) return;
    try { clickInfo.view.calendar.unselect(); } catch { /* ignore */ }
    const rawId = clickInfo.event.id;
    const taskId = clickInfo.event.extendedProps?.taskId;
    const event = findSourceEvent(events, rawId, taskId);
    if (event) {
      setSelectedEvent(event);
      // Si c'est une instance virtuelle (id contient "::"), mémoriser sa date
      const sepIdx = rawId.indexOf('::');
      setSelectedInstanceDate(sepIdx !== -1 ? rawId.slice(sepIdx + 2) : null);
      setShowEditEventModal(true);
    }
  };

  const { lastDragEndAtRef, handleEventDragStart, handleEventDragStop } = useAgendaEventDrag({
    events,
    deleteEvent: (id: string) => deleteEventMutation.mutate(id),
    setSelectedEvent,
    setShowEditEventModal,
    setCalendarKey,
    setMobileCalendarKey,
  });

  // L'agenda personnel n'affiche que les événements (pas de rangée all-day) :
  // ni les tâches perso à deadline (#20 retiré), ni les tâches d'équipe — ces
  // dernières se gèrent dans l'espace entreprise / To-Do.
  // Calculé ici parce que le flux d'édition (`useAgendaEventActions`) en a
  // besoin autant que la grille : la section calendrier le reçoit.
  // ── Créneaux de tâche terminés qui attendent une décision ──────────────────
  // Le corps vit dans `agenda/useOverdueSlotReview.ts`. Il ne rend plus « le
  // créneau courant » d'une popup mais l'ENSEMBLE des créneaux en attente : la
  // demande est désormais peinte sur les blocs concernés (pastille ambre) et
  // reprise dans l'EventModal, au lieu de s'imposer en plein écran à l'arrivée.
  const {
    reviewEventIds,
    doneEventIds,
    findSlot,
    handleSlotValidate,
    handleSlotPostpone,
    handleSlotDelete,
    handleSlotIgnore,
  } = useOverdueSlotReview({
    events,
    tasks,
    toggleTaskComplete: (taskId) => toggleTaskComplete.mutate(taskId),
    updateEvent: (id, updates) => updateEventMutation.mutate({ id, updates }),
    deleteEvent: (id) => deleteEventMutation.mutate(id),
    deleteTask: (taskId) => deleteTaskMutation.mutate(taskId),
    restoreEvent: (event) => restoreEventMutation.mutate(event),
    restoreTask: (task) => restoreTaskMutation.mutate(task),
    deletedLabel: t('slotReview.deleted'),
    postponedLabel: t('slotReview.postponed'),
  });

  /** Les quatre actions, passées telles quelles aux DEUX accès. */
  const slotReviewActions = {
    onValidate: handleSlotValidate,
    onPostpone: handleSlotPostpone,
    onIgnore: handleSlotIgnore,
    onDelete: handleSlotDelete,
  };

  const calendarEvents = buildCalendarEvents(events, new Date(), reviewEventIds, doneEventIds);

  // Déplacer, redimensionner, déposer une tâche : les trois gestes qui écrivent
  // depuis la grille retirent le décalage du fuseau d'affichage au même endroit.
  const { handleEventDrop, handleEventResize, handleEventReceive } = useCalendarGridGestures({
    events,
    tzPref,
    createEvent: (input) => createEventMutation.mutate(input),
    updateEvent: (id, updates) => updateEventMutation.mutate({ id, updates }),
  });

  const {
    handleAddEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleDuplicateEvent,
    handleOpenAddModal,
    handleCloseAddModal,
  } = useAgendaEventActions({
    events,
    calendarEvents,
    selectedInstanceDate,
    createEvent: (input) => createEventMutation.mutate(input),
    updateEvent: (id, updates) => updateEventMutation.mutate({ id, updates }),
    deleteEvent: (id) => deleteEventMutation.mutate(id),
    restoreEvent: (event) => restoreEventMutation.mutate(event),
    closeAddModal: () => { setShowAddEventModal(false); setSelectedTimeSlot(null); },
    closeEditModal: () => {
      setShowEditEventModal(false);
      setSelectedEvent(null);
      setSelectedInstanceDate(null);
    },
    openAddModal: (slot) => { setSelectedTimeSlot(slot); setShowAddEventModal(true); },
    unselectCalendar: () => calendarRef.current?.getApi().unselect(),
    labels: {
      occurrenceDeleted: t('event.occurrenceDeleted'),
      eventDeleted: t('event.eventDeleted'),
      copySuffix: t('event.copySuffix'),
    },
  });

  // Desktop : met à jour la fenêtre chargée selon la plage visible.
  const handleDesktopDatesSet = (info: DatesSetArg) => {
    applyVisibleRange(info.start, info.end);
    setDesktopVisibleRange({ start: info.start, end: info.end });
  };

  const isDesktopTodayVisible = !!desktopVisibleRange
    && new Date() >= desktopVisibleRange.start
    && new Date() < desktopVisibleRange.end;

  // État d'erreur (#39) : sans lui, un échec réseau affichait un calendrier
  // vide — indistinguable d'une semaine sans événement.
  if (isEventsError && events.length === 0) {
    return <PageErrorState subject={tCommon('pageError.subjectAgenda')} error={eventsError as Error | null} onRetry={() => refetchEvents()} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      {/* Second lien d'évitement (WCAG 2.4.1). Celui de `Layout` saute la barre
          latérale de l'APPLICATION ; celui-ci saute le panneau des tâches, ses
          filtres et ses onze boutons « Options de la tâche » tous nommés
          pareil, qui séparaient le haut de page du premier événement (finding
          C-54 : 38 tabulations mesurées). Desktop seulement : sur mobile le
          panneau est un calque, il se ferme par Échap et ne s'interpose pas
          dans l'ordre de tabulation quand il est fermé. */}
      {showTaskSidebar && (
        <SkipLink
          targetId={AGENDA_CALENDAR_ID}
          label={t('nav.skipToCalendar')}
          className="hidden md:block"
        />
      )}

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
          onToday={() => handleMobileSelectDate(new Date())}
        />

        {/* ── DESKTOP HEADER (hidden on mobile) ── */}
        <AgendaDesktopHeader
          showTaskSidebar={showTaskSidebar}
          setShowTaskSidebar={setShowTaskSidebar}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          zoomLevel={zoomLevel}
          zoomDurations={zoomDurations}
          handleViewChange={handleViewChange}
          currentView={currentView}
          calendarRef={calendarRef}
          setShowRecurringManager={setShowRecurringManager}
          handleOpenAddModal={handleOpenAddModal}
          isTodayVisible={isDesktopTodayVisible}
        />

        {/* Bandeau jours mobile + les deux grilles FullCalendar. Cette page ne
            connaît plus une seule prop de FullCalendar. */}
        <AgendaCalendarSection
          calendarEvents={calendarEvents}
          isMobile={isMobile}
          desktopKey={calendarKey}
          mobileKey={mobileCalendarKey}
          desktopRef={calendarRef}
          mobileRef={mobileCalendarRef}
          currentView={currentView}
          mobileViewMode={mobileViewMode}
          mobileSelectedDate={mobileSelectedDate}
          onMobileSelectDate={handleMobileSelectDate}
          mobileZoom={mobileZoom}
          slotDuration={zoomDurations[zoomLevel]}
          slotLabelInterval={zoomLevel === zoomDurations.length - 1 ? '02:00:00' : '01:00:00'}
          onDateSelect={handleDateSelect}
          onMobileDateSelect={handleMobileDateSelect}
          onMobileDateClick={handleMobileDateClick}
          onEventClick={handleEventClick}
          onEventDragStart={handleEventDragStart}
          onEventDragStop={handleEventDragStop}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onEventReceive={handleEventReceive}
          onDesktopDatesSet={handleDesktopDatesSet}
          onMobileDatesSet={handleMobileDatesSet}
          renderReviewBadge={(eventId) => {
            const slot = findSlot(eventId);
            return slot ? <SlotReviewMenu slot={slot} {...slotReviewActions} /> : null;
          }}
        />

      </div>

      {quickSlot && (
        <QuickEventCard
          slot={quickSlot}
          categories={categories}
          tzPref={tzPref}
          onCreate={handleQuickCreate}
          onClose={handleQuickClose}
          onAddCategory={() => setShowQuickCategoryModal(true)}
        />
      )}

      <ColorSettingsModal
        isOpen={showQuickCategoryModal}
        onClose={() => setShowQuickCategoryModal(false)}
      />

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

      <RecurringEventsManager
        isOpen={showRecurringManager}
        setShowRecurringManager={setShowRecurringManager}
        events={events}
        updateEventMutation={updateEventMutation}
        setSelectedEvent={setSelectedEvent}
        setSelectedInstanceDate={setSelectedInstanceDate}
        setShowEditEventModal={setShowEditEventModal}
      />

      {showEditEventModal && selectedEvent && (
        <EventModal
          mode="edit"
          isOpen={showEditEventModal}
          onClose={() => { setShowEditEventModal(false); setSelectedEvent(null); setSelectedInstanceDate(null); }}
          event={selectedEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          onDuplicateEvent={handleDuplicateEvent}
          sidePanel={(() => {
            // Même source que la pastille (`findSlot` lit la liste dérivée) :
            // le panneau ne peut donc pas apparaître sur un créneau qui
            // n'attend rien, ni manquer sur un créneau qui attend.
            const slot = findSlot(selectedEvent.id);
            return slot ? (
              <SlotReviewPanel
                slot={slot}
                onValidate={slotReviewActions.onValidate}
                onPostpone={slotReviewActions.onPostpone}
              />
            ) : null;
          })()}
        />
      )}

      {/* Transformer en tâche confirmé → ouvre TaskModal pré-rempli */}
      {eventForTaskCreation && (
        <TaskModal
          isOpen={true}
          isCreating={true}
          onClose={() => setEventForTaskCreation(null)}
          initialData={{
            name: eventForTaskCreation.title,
            category: categories.find(cat => cat.color === eventForTaskCreation.color)?.id,
            // `.slice(0, 10)` prenait le jour UTC de l'instant : un créneau de
            // fin de nuit créait une tâche datée de la veille (risque R-15).
            deadline: deadlineDayKey(eventForTaskCreation.start),
            estimatedTime: Math.max(
              1,
              Math.round(
                (new Date(eventForTaskCreation.end).getTime() - new Date(eventForTaskCreation.start).getTime()) / 60000
              )
            ),
          }}
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
