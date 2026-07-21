import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable, EventReceiveArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import { findNextFreeSlot } from './agenda/free-slot';
import { useEventsWindow, useCreateEvent, useUpdateEvent, useDeleteEvent, CreateEventInput, UpdateEventInput, CalendarEvent, getMasterId } from '@/modules/events';
import { showUndoToast } from '@/lib/undo-toast';
import { useCategories } from '@/modules/categories';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import MemberAvatar from '@/components/organization/MemberAvatar';
import TaskSidebar from '../components/TaskSidebar';
import EventModal from '../components/EventModal';
import ColorSettingsModal from '../components/ColorSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { agendaTutorialStepsDesktop } from '@/tutorials/agenda.desktop';
import { agendaTutorialStepsMobile } from '@/tutorials/agenda.mobile';
import { getInitialScrollTime, buildCalendarEvents, shiftEventsForDisplay, defaultEventsWindow, bufferedWindow, taskEventDurationMinutes } from './agenda/calendar-events';
import { useTimezonePref, fromDisplayISO, displayNow } from '@/lib/timezone';
import AgendaSlotReviewModal from './agenda/AgendaSlotReviewModal';
import { findOverdueTaskSlots, type OverdueTaskSlot } from './agenda/overdue-slots';
import { useTasks, useToggleTaskComplete, useDeleteTask } from '@/modules/tasks';
import { type MobileView, mobileCalendarStyles, MobileAgendaHeader, MobileDayStrip } from './agenda/MobileAgenda';
import AgendaDesktopHeader from './agenda/AgendaDesktopHeader';
import RecurringEventsManager from './agenda/RecurringEventsManager';
import QuickEventCard from './agenda/QuickEventCard';
import { useAgendaEventDrag } from './agenda/useAgendaEventDrag';
import PageErrorState from '@/components/PageErrorState';

// ── Page principale ──────────────────────────────────────────────────────────
const AgendaPage: React.FC = () => {
  const tutorialIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const tutorial = useTutorial(tutorialIsMobile ? 'agenda_mobile' : 'agenda_desktop', 800);
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
  // Feature « revue de créneau » : tâches + mutations pour valider/supprimer.
  const { data: tasks = [] } = useTasks();
  const toggleTaskComplete = useToggleTaskComplete();
  const deleteTaskMutation = useDeleteTask();
  // Créneaux « écartés » pour cette session (fermeture sans décision) : ils
  // réapparaîtront au prochain retour sur l'agenda.
  const [snoozedSlotIds, setSnoozedSlotIds] = useState<Set<string>>(new Set());
  const { data: categories = [] } = useCategories();
  const { pref: tzPref } = useTimezonePref();
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  // Membres de l'org active : sert à résoudre l'avatar de l'AUTEUR d'un
  // événement (créé par un manager) pour distinguer perso / pro dans l'agenda.
  const { data: orgMembers = [] } = useOrgMembers(activeOrg?.id);
  const memberById = React.useMemo(() => {
    const m = new Map<string, (typeof orgMembers)[number]>();
    for (const om of orgMembers) m.set(om.userId, om);
    return m;
  }, [orgMembers]);
  // Rendu du contenu d'un événement : titre + avatar de l'auteur si l'événement
  // a été ajouté par quelqu'un d'autre que moi (mon manager, mode entreprise).
  const renderEventInner = (title: string, createdBy: string | undefined, centered: boolean) => {
    const author = createdBy && createdBy !== user?.id ? memberById.get(createdBy) : undefined;
    return (
      <div className={`h-full w-full flex items-center gap-1 p-1 text-xs cursor-pointer ${centered ? 'justify-center' : ''}`}>
        {author && (
          <span className="shrink-0 rounded-full ring-1 ring-white/70" title={`Ajouté par ${author.displayName}`}>
            <MemberAvatar avatar={author.avatar} name={author.displayName} size={16} />
          </span>
        )}
        <span className={`font-medium text-white truncate leading-tight ${centered ? 'text-center' : ''}`}>{title}</span>
      </div>
    );
  };

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
  const [zoomLevel, setZoomLevel] = useState(3);
  const zoomDurations = ['00:05:00', '00:10:00', '00:15:00', '00:30:00', '01:00:00'];

  // Mobile state
  const mobileCalendarRef = useRef<FullCalendar>(null);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date>(() => new Date());
  const [mobileCalendarKey, setMobileCalendarKey] = useState(0);
  const [mobileViewMode, setMobileViewMode] = useState<MobileView>('timeGridDay');

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
          // 250ms (au lieu de 50) : un swipe vertical rapide scrolle la liste
          // au lieu de démarrer un drag → permet de scroller sans sélectionner
          // une tâche sur mobile (combiné à touch-action: pan-y sur les cartes).
          longPressDelay: 250,
          eventData: function (eventEl) {
            const taskData = JSON.parse(eventEl.getAttribute('data-task') || '{}');
            const catColor = categoriesRef.current.find(cat => cat.id === taskData.category)?.color || '#6B7280';
            return {
              title: taskData.name,
              // Garde anti-aperçu-invisible : une tâche sans durée estimée
              // (estimatedTime = 0, défaut du formulaire) donnerait duration:0 →
              // mirror FullCalendar de hauteur nulle. On retombe sur 60 min.
              duration: { minutes: taskEventDurationMinutes(taskData.estimatedTime) },
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
    const masterId = getMasterId(rawId);
    const taskId = clickInfo.event.extendedProps?.taskId;
    const event = events.find(e => e.id === masterId || (taskId && e.taskId === taskId));
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

  const handleEventDrop = (dropInfo: EventDropArg) => {
    const masterId = getMasterId(dropInfo.event.id);
    const taskId = dropInfo.event.extendedProps?.taskId;
    const event = events.find(e => e.id === masterId || (taskId && e.taskId === taskId));
    if (!event) return;
    const rawStart = dropInfo.event.start?.toISOString();
    if (!rawStart) return;
    const rawEnd = dropInfo.event.end
      ? dropInfo.event.end.toISOString()
      : new Date((dropInfo.event.start?.getTime() ?? Date.now()) + 3600000).toISOString();
    // Retire le décalage d'affichage avant de persister l'instant « vrai ».
    const newStart = fromDisplayISO(rawStart, tzPref);
    const newEnd = fromDisplayISO(rawEnd, tzPref);
    updateEventMutation.mutate({ id: event.id, updates: { start: newStart, end: newEnd } });
  };

  // Persiste un redimensionnement (resize) d'event — tactile mobile ET souris
  // desktop. Sans ce handler, FullCalendar applique le resize visuellement mais
  // ne le persiste jamais : au prochain rendu l'event revient à sa durée initiale.
  const handleEventResize = (resizeInfo: EventResizeDoneArg) => {
    const masterId = getMasterId(resizeInfo.event.id);
    const taskId = resizeInfo.event.extendedProps?.taskId;
    const event = events.find(e => e.id === masterId || (taskId && e.taskId === taskId));
    if (!event) { resizeInfo.revert(); return; }
    const rawStart = resizeInfo.event.start?.toISOString();
    const rawEnd = resizeInfo.event.end?.toISOString();
    if (!rawStart || !rawEnd) { resizeInfo.revert(); return; }
    const newStart = fromDisplayISO(rawStart, tzPref);
    const newEnd = fromDisplayISO(rawEnd, tzPref);
    updateEventMutation.mutate({ id: event.id, updates: { start: newStart, end: newEnd } });
  };

  const handleEventReceive = (receiveInfo: EventReceiveArg) => {
    const eventData = receiveInfo.event;
    const rawStart = eventData.start?.toISOString() ?? new Date().toISOString();
    const rawEnd = eventData.end
      ? eventData.end.toISOString()
      : new Date((eventData.start?.getTime() ?? Date.now()) + taskEventDurationMinutes(eventData.extendedProps.estimatedTime as number) * 60000).toISOString();
    const newEvent: CreateEventInput = {
      title: eventData.title,
      // Retire le décalage d'affichage (la tâche est déposée sur la grille
      // décalée) pour stocker l'instant « vrai ».
      start: fromDisplayISO(rawStart, tzPref),
      end: fromDisplayISO(rawEnd, tzPref),
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

  // L'agenda personnel n'affiche que les événements (pas de rangée all-day) :
  // ni les tâches perso à deadline (#20 retiré), ni les tâches d'équipe — ces
  // dernières se gèrent dans l'espace entreprise / To-Do.
  const calendarEvents = buildCalendarEvents(events);
  // Décale les instants dans le fuseau d'affichage choisi (feature « heure
  // personnalisée »). Le reste de la page (conflits, prochain créneau libre,
  // EventModal) raisonne sur les instants « vrais » : seul le calendrier voit
  // les instants décalés, et ses callbacks retirent le décalage (fromDisplayISO).
  const allCalendarEvents = shiftEventsForDisplay(calendarEvents, tzPref) as EventInput[];
  // « Maintenant » et heure de scroll dans le fuseau choisi pour rester cohérent
  // avec les événements décalés (l'indicateur d'heure courante suit le fuseau).
  const calendarNow = tzPref.mode === 'manual' ? () => displayNow(tzPref) : undefined;
  const calendarScrollTime = getInitialScrollTime(displayNow(tzPref));

  // Conflits (#21) : ids des événements horaires qui se chevauchent.
  const conflictIds = React.useMemo(() => {
    const ids = new Set<string>();
    const sorted = [...calendarEvents].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start >= sorted[i].end) break;
        ids.add(sorted[i].id);
        ids.add(sorted[j].id);
      }
    }
    return ids;
  }, [calendarEvents]);

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
    setSelectedInstanceDate(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    const master = events.find(e => e.id === eventId);
    const isRecurring = master && (master.recurrence ?? 'none') !== 'none';
    const instanceDate = selectedInstanceDate;

    if (isRecurring && instanceDate && master) {
      // Suppression d'une seule occurrence : ajouter la date dans les exceptions du master
      const prevExceptions = master.exceptions ?? [];
      updateEventMutation.mutate({ id: eventId, updates: { exceptions: [...prevExceptions, instanceDate] } });
      showUndoToast('Occurrence supprimée', () => {
        // Annulation : retire la date des exceptions → l'occurrence réapparaît.
        updateEventMutation.mutate({ id: eventId, updates: { exceptions: prevExceptions } });
      });
    } else if (master) {
      const { id: _id, ...rest } = master;
      deleteEventMutation.mutate(eventId);
      showUndoToast('Événement supprimé', () => {
        createEventMutation.mutate(rest as CreateEventInput);
      });
    }
    setShowEditEventModal(false);
    setSelectedEvent(null);
    setSelectedInstanceDate(null);
  };

  // Dupliquer un événement (#3) : copie « (copie) » aux mêmes horaires.
  const handleDuplicateEvent = (eventId: string) => {
    const source = events.find(e => e.id === eventId);
    if (!source) return;
    const { id: _id, ...rest } = source;
    createEventMutation.mutate({ ...rest, title: `${source.title} (copie)` } as CreateEventInput);
    setShowEditEventModal(false);
    setSelectedEvent(null);
    setSelectedInstanceDate(null);
  };

  // « Nouveau » sans plage sélectionnée : propose le prochain créneau libre (#19).
  const handleOpenAddModal = () => {
    setSelectedTimeSlot(findNextFreeSlot(calendarEvents));
    setShowAddEventModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddEventModal(false);
    setSelectedTimeSlot(null);
    setTimeout(() => { calendarRef.current?.getApi().unselect(); }, 100);
  };

  // ── Revue des créneaux de tâche terminés (feature 2) ───────────────────────
  // File des créneaux passés à traiter, écartés de cette session retirés.
  const overdueSlots = React.useMemo(
    () => findOverdueTaskSlots(events, tasks).filter((s) => !snoozedSlotIds.has(s.event.id)),
    [events, tasks, snoozedSlotIds],
  );
  const currentReviewSlot = overdueSlots[0] ?? null;

  const dismissReviewSlot = (eventId: string) =>
    setSnoozedSlotIds((prev) => new Set(prev).add(eventId));

  // Réalisée → valide la tâche côté tâche (comme partout ailleurs : toggle +
  // toast d'annulation). Filtrée à « non complétée », donc le toggle = valider.
  const handleSlotValidate = (slot: OverdueTaskSlot) => {
    if (!slot.task.completed) toggleTaskComplete.mutate(slot.task.id);
    dismissReviewSlot(slot.event.id);
  };

  // Reporter → replace le créneau à DEMAIN (relatif à maintenant) en conservant
  // l'heure de début et la durée d'origine. Toujours dans le futur, même pour un
  // créneau en retard de plusieurs jours (sinon le modal réapparaîtrait).
  const handleSlotPostpone = (slot: OverdueTaskSlot) => {
    const origStart = new Date(slot.event.start);
    const durationMs = new Date(slot.event.end).getTime() - origStart.getTime();
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newStart = next.toISOString();
    const newEnd = new Date(next.getTime() + Math.max(durationMs, 0)).toISOString();
    updateEventMutation.mutate({ id: slot.event.id, updates: { start: newStart, end: newEnd } });
    dismissReviewSlot(slot.event.id);
  };

  // Abandonner → supprime la tâche et son créneau agenda.
  const handleSlotDelete = (slot: OverdueTaskSlot) => {
    deleteEventMutation.mutate(slot.event.id);
    deleteTaskMutation.mutate(slot.task.id);
    dismissReviewSlot(slot.event.id);
  };

  const handleSlotSnooze = () => {
    if (currentReviewSlot) dismissReviewSlot(currentReviewSlot.event.id);
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

  const handleMobileMonthPrev = () => { mobileCalendarRef.current?.getApi().prev(); };
  const handleMobileMonthNext = () => { mobileCalendarRef.current?.getApi().next(); };

  const handleMobileDatesSet = (info: DatesSetArg) => {
    setMobileSelectedDate(info.view.currentStart);
    applyVisibleRange(info.start, info.end);
  };

  // Desktop : met à jour la fenêtre chargée selon la plage visible.
  const handleDesktopDatesSet = (info: DatesSetArg) => {
    applyVisibleRange(info.start, info.end);
    setDesktopVisibleRange({ start: info.start, end: info.end });
  };

  const isDesktopTodayVisible = !!desktopVisibleRange
    && new Date() >= desktopVisibleRange.start
    && new Date() < desktopVisibleRange.end;

  const isMonthView = mobileViewMode === 'dayGridMonth';

  // Label du jour sélectionné
  const mobileDayLabel = (() => {
    const raw = format(mobileSelectedDate, 'EEEE - d MMMM yyyy', { locale: fr });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  // État d'erreur (#39) : sans lui, un échec réseau affichait un calendrier
  // vide — indistinguable d'une semaine sans événement.
  if (isEventsError && events.length === 0) {
    return <PageErrorState subject="l'agenda" error={eventsError as Error | null} onRetry={() => refetchEvents()} />;
  }

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

        {/* ── MOBILE : bandeau jours + label (masqué en vue mois) ── */}
        {!isMonthView && (
          <div
            data-tutorial-id="agenda-mobile-day-strip"
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
          <div
            data-tutorial-id="agenda-mobile-calendar"
            className="md:hidden mobile-calendar flex-1 overflow-hidden pb-[calc(64px+env(safe-area-inset-bottom))]"
          >
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
              events={allCalendarEvents}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
              height="100%"
              locale="fr"
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              scrollTime={calendarScrollTime}
              now={calendarNow}
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
              eventResize={handleEventResize}
              eventReceive={handleEventReceive}
              unselectAuto={true}
              unselectCancel=".modal-overlay,.modal-content,input,textarea,select,button,.fc-event,[data-radix-popper-content-wrapper]"
              datesSet={handleMobileDatesSet}
              eventContent={(eventInfo) =>
                renderEventInner(eventInfo.event.title, eventInfo.event.extendedProps?.createdBy as string | undefined, false)
              }
              eventClassNames={(arg) => [
                'rounded-lg shadow-sm border-0 cursor-pointer',
                conflictIds.has(arg.event.id) ? 'event-conflict' : '',
              ]}
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
                events={allCalendarEvents}
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
                scrollTime={calendarScrollTime}
                now={calendarNow}
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
                eventResize={handleEventResize}
                eventReceive={handleEventReceive}
                datesSet={handleDesktopDatesSet}
                unselectAuto={true}
                unselectCancel=".modal-overlay,.modal-content,input,textarea,select,button,.fc-event,[data-radix-popper-content-wrapper]"
                eventContent={(eventInfo) =>
                  renderEventInner(eventInfo.event.title, eventInfo.event.extendedProps?.createdBy as string | undefined, true)
                }
                eventClassNames={(arg) => [
                  'rounded-lg shadow-sm border-0 cursor-pointer hover:shadow-md transition-all hover:scale-105',
                  conflictIds.has(arg.event.id) ? 'event-conflict' : '',
                ]}
              />
              <style>{`
                .dark .fc-theme-standard td.fc-day:hover,
                .dark .fc-theme-standard .fc-timegrid-col:hover { background-color: rgba(255,255,255,0.06) !important; }
                .dark .fc-theme-standard td.fc-day,
                .dark .fc-theme-standard .fc-timegrid-col { background-color: transparent !important; }
                .fc-event { transition: all 0.2s ease; }
                .fc-event:hover { transform: scale(1.02); z-index: 999; }
                /* Conflit d'horaires (#21) : liseré d'alerte discret */
                .fc-event.event-conflict { box-shadow: inset 4px 0 0 #ef4444, 0 1px 2px rgba(0,0,0,0.1); }
              `}</style>
            </div>
          </div>
        </motion.div>
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
        />
      )}

      {/* Revue des créneaux de tâche terminés (feature 2) */}
      <AgendaSlotReviewModal
        slot={currentReviewSlot}
        remaining={overdueSlots.length}
        tzPref={tzPref}
        onValidate={handleSlotValidate}
        onPostpone={handleSlotPostpone}
        onDelete={handleSlotDelete}
        onSnooze={handleSlotSnooze}
      />

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
