import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable, EventReceiveArg } from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, CreateEventInput, UpdateEventInput, CalendarEvent } from '@/modules/events';
import { useCategories } from '@/modules/categories';
import { ChevronLeft, ChevronRight, Calendar, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import TaskSidebar from '../components/TaskSidebar';
import EventModal from '../components/EventModal';
import { motion, AnimatePresence } from 'framer-motion';

const AgendaPage: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════
  // EVENTS - Depuis le module events (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: events = [] } = useEvents();
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  const [currentView, setCurrentView] = useState('timeGridWeek');
  const [showTaskSidebar, setShowTaskSidebar] = useState(() => window.innerWidth >= 768);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{start: string;end: string;} | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const calendarRef = useRef<FullCalendar>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const categoriesRef = useRef(categories);
  const [zoomLevel, setZoomLevel] = useState(3);
  const zoomDurations = ['00:05:00', '00:10:00', '00:15:00', '00:30:00', '01:00:00'];

  const getInitialScrollTime = () => {
    const now = new Date();
    const hour = now.getHours();
    const scrollHour = Math.max(0, hour - 4);
    return `${scrollHour.toString().padStart(2, '0')}:00:00`;
  };

  const handleZoomIn = () => {
    if (zoomLevel > 0) {
      setZoomLevel(prev => prev - 1);
      setCalendarKey(prev => prev + 1);
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel < zoomDurations.length - 1) {
      setZoomLevel(prev => prev + 1);
      setCalendarKey(prev => prev + 1);
    }
  };

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  // Initialization effect for external dragging
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
                categoryName: categoriesRef.current.find(c => c.id === taskData.category)?.name || 'Sans catégorie'
              }
            };
          }
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [showTaskSidebar, categories, events]);

  // Robust cleanup effect that ensures drag survives sidebar unmounting
  useEffect(() => {
    if (!showTaskSidebar && !isDraggingTask && draggableRef.current) {
      try { draggableRef.current.destroy(); } catch { /* ignore destroy errors */ }
      draggableRef.current = null;
    }
  }, [showTaskSidebar, isDraggingTask]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().updateSize();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [showTaskSidebar]);

  useEffect(() => {
    if (!isDraggingTask) return;

    const handleMove = (x: number) => {
const sidebarWidth = sidebarRef.current?.offsetWidth || 224;
if (x > sidebarWidth && window.innerWidth < 768) {
setShowTaskSidebar(false);
}
};

    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingTask) handleMove(e.clientX);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', () => setIsDraggingTask(false));
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', () => setIsDraggingTask(false));
    };
  }, [isDraggingTask]);

  const handleViewChange = (newView: string) => {
    setCurrentView(newView);
    setCalendarKey((prev) => prev + 1);

    setTimeout(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().changeView(newView);
      }
    }, 100);
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const start = selectInfo.start;
    const end = selectInfo.end;

    setSelectedTimeSlot({
      start: start.toISOString(),
      end: end.toISOString()
    });
    setShowAddEventModal(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const eventId = clickInfo.event.id;
    const taskId = clickInfo.event.extendedProps?.taskId;
    const event = events.find((e) => e.id === eventId || (taskId && e.taskId === taskId));
    if (event) {
      setSelectedEvent(event);
      setShowEditEventModal(true);
    }
  };

  const handleEventDrop = (dropInfo: EventDropArg) => {
    const eventId = dropInfo.event.id;
    const taskId = dropInfo.event.extendedProps?.taskId;
    const event = events.find((e) => e.id === eventId || (taskId && e.taskId === taskId));
    if (!event) return;
    
    const newStart = dropInfo.event.start?.toISOString();
    const newEnd = dropInfo.event.end ? dropInfo.event.end.toISOString() : new Date((dropInfo.event.start?.getTime() ?? Date.now()) + 60 * 60 * 1000).toISOString();

    if (!newStart) return;

    updateEventMutation.mutate({
      id: event.id,
      updates: {
        start: newStart,
        end: newEnd
      }
    });
  };

  const handleEventReceive = (receiveInfo: EventReceiveArg) => {
    const eventData = receiveInfo.event;
    const newEvent: CreateEventInput = {
      title: eventData.title,
      start: eventData.start?.toISOString() ?? new Date().toISOString(),
      end: eventData.end ?
        eventData.end.toISOString() :
        new Date((eventData.start?.getTime() ?? Date.now()) + (eventData.extendedProps.estimatedTime as number) * 60 * 1000).toISOString(),
      color: eventData.backgroundColor ?? undefined,
      notes: `Priorité: ${eventData.extendedProps.priority} | Catégorie: ${eventData.extendedProps.categoryName}`,
      taskId: eventData.extendedProps.taskId as string
    };

    const isDuplicate = events.some((e) =>
      newEvent.taskId && e.taskId === newEvent.taskId ||
      e.title === newEvent.title && e.start === newEvent.start && e.end === newEvent.end
    );
    
    if (isDuplicate) {
      receiveInfo.event.remove();
      return;
    }

    createEventMutation.mutate(newEvent);
  };

  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: '#ffffff',
    extendedProps: {
      notes: event.notes,
      taskId: event.taskId
    }
  }));

  const handleAddEvent = (eventData: CreateEventInput) => {
    createEventMutation.mutate({
      ...eventData,
      taskId: eventData.taskId || undefined
    });

    setShowAddEventModal(false);
    setSelectedTimeSlot(null);

    setTimeout(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().unselect();
      }
    }, 100);
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

  const handleOpenAddModal = () => {
    setSelectedTimeSlot(null);
    setShowAddEventModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddEventModal(false);
    setSelectedTimeSlot(null);

    setTimeout(() => {
      if (calendarRef.current) {
        calendarRef.current.getApi().unselect();
      }
    }, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex overflow-hidden"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}>

      {/* Task Sidebar & Backdrop for Mobile */}
      <AnimatePresence mode="wait">
        {showTaskSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
                onClick={() => setShowTaskSidebar(false)}
                className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-[1px]"
              />
              
              <motion.div
                ref={sidebarRef}
                layoutRoot
                initial={{ x: -400, opacity: 0, width: 0 }}
                animate={{ x: 0, opacity: 1, width: 'auto' }}
                exit={{ x: -400, opacity: 0, width: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed md:relative inset-y-0 left-0 z-50 md:z-40 flex overflow-hidden flex-shrink-0 shadow-2xl md:shadow-none"
                onAnimationComplete={() => {
                  if (calendarRef.current) {
                    calendarRef.current.getApi().updateSize();
                  }
                }}>
                <TaskSidebar 
                  onClose={() => setShowTaskSidebar(false)} 
                  onDragStart={() => {
                    if (window.innerWidth < 768) {
                      setIsDraggingTask(true);
                    }
                  }}
                />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="px-4 py-3 border-b"
          style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>

            <div className="flex items-center justify-between gap-2">

              {/* ── Gauche : bouton Tâches ── */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTaskSidebar(!showTaskSidebar)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm shrink-0 border ${
                  showTaskSidebar ? 'shadow-md' : ''
                }`}
                style={{
                  backgroundColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-bg))',
                  borderColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-border))',
                  color: showTaskSidebar ? 'white' : 'rgb(var(--color-text-primary))'
                }}>
                <Calendar size={18} />
                <span className="font-medium text-sm lg:text-base">Tâches</span>
              </motion.button>

              {/* ── Centre : Zoom → Vue → Navigation ── */}
              <div className="flex items-center gap-2 lg:gap-3">

                {/* Zoom */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleZoomIn}
                    disabled={zoomLevel === 0}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}>
                    <ZoomIn size={18} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleZoomOut}
                    disabled={zoomLevel === zoomDurations.length - 1}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === zoomDurations.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}>
                    <ZoomOut size={18} />
                  </motion.button>
                </div>

                {/* Sélecteur de vue — style Dashboard */}
                <div className="flex gap-1 p-1 rounded-xl border"
                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
                  {(['timeGridDay', 'timeGridWeek', 'dayGridMonth'] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => handleViewChange(view)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none whitespace-nowrap ${
                        currentView === view
                          ? 'bg-[rgb(var(--color-accent))] text-white shadow-sm monochrome:bg-white monochrome:text-zinc-900'
                          : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                      }`}>
                      {view === 'timeGridDay' ? 'Jour' : view === 'timeGridWeek' ? 'Semaine' : 'Mois'}
                    </button>
                  ))}
                </div>

                {/* Navigation période < > */}
                <div className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().prev()}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronLeft size={18} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().next()}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronRight size={18} />
                  </motion.button>
                </div>
              </div>

              {/* ── Droite : bouton Nouveau ── */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenAddModal}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 monochrome:shadow-white/10 transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black shrink-0 whitespace-nowrap"
              >
                <Plus size={18} />
                <span className="font-medium text-sm lg:text-base">Nouveau</span>
              </motion.button>

            </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 p-2 lg:p-6 min-w-0 overflow-hidden">

          <div className="rounded-xl shadow-lg border h-full w-full overflow-hidden" style={{ backgroundColor: 'rgb(var(--calendar-bg))', borderColor: 'rgb(var(--calendar-border))' }}>
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
                eventLongPressDelay={50}
                selectLongPressDelay={50}
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                slotLabelFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }}
                slotDuration={zoomDurations[zoomLevel]}
                slotLabelInterval={zoomLevel === zoomDurations.length - 1 ? "02:00:00" : "01:00:00"}
                snapDuration={zoomDurations[zoomLevel]}
                select={handleDateSelect}
                eventClick={handleEventClick}
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
                .dark .fc-theme-standard .fc-timegrid-col:hover {
                  background-color: rgba(255, 255, 255, 0.06) !important;
                }
                .dark .fc-theme-standard td.fc-day,
                .dark .fc-theme-standard .fc-timegrid-col {
                  background-color: transparent !important;
                }
                .fc-event {
                  transition: all 0.2s ease;
                }
                .fc-event:hover {
                  transform: scale(1.02);
                  z-index: 999;
                }
              `}</style>
            </div>
          </div>
        </motion.div>
      </div>
  
        {showAddEventModal &&
          <EventModal
            mode="add"
            isOpen={showAddEventModal}
            onClose={handleCloseAddModal}
            task={{
              id: '',
              name: '',
              priority: 3,
              category: 'blue',
              deadline: '',
              estimatedTime: 60,
              createdAt: '',
              bookmarked: false,
              completed: false
            }}
            onAddEvent={handleAddEvent}
            prefilledTimeSlot={selectedTimeSlot || undefined}
          />
        }
  
        {showEditEventModal && selectedEvent &&
          <EventModal
            mode="edit"
            isOpen={showEditEventModal}
            onClose={() => {
              setShowEditEventModal(false);
              setSelectedEvent(null);
            }}
            event={selectedEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        }
    </motion.div>
  );
};

export default AgendaPage;
