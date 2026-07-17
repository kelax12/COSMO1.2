import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  useMemberEventsWindow,
  useCreateMemberEvent,
  useUpdateMemberEvent,
  useDeleteMemberEvent,
  getMasterId,
  type CalendarEvent,
} from '@/modules/events';
import EventModal, { type EventModalMode } from '@/components/EventModal';
import {
  buildCalendarEvents,
  getInitialScrollTime,
  defaultEventsWindow,
  bufferedWindow,
} from '@/pages/agenda/calendar-events';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface MemberAgendaSheetProps {
  member: OrgMember;
  onClose: () => void;
}

type ViewName = 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth';

const VIEW_LABELS: { id: ViewName; label: string }[] = [
  { id: 'timeGridDay', label: 'Jour' },
  { id: 'timeGridWeek', label: 'Semaine' },
  { id: 'dayGridMonth', label: 'Mois' },
];

/**
 * Agenda complet d'un subordonné (mode entreprise) — même expérience que la
 * page Agenda personnelle : sélection de plage, glisser-déposer, redimension,
 * et EventModal réutilisé tel quel. Réservé à la hiérarchie du membre (RLS
 * `events_manager_*`, mig. 077). Plein écran (portal).
 */
const MemberAgendaSheet = ({ member, onClose }: MemberAgendaSheetProps) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<ViewName>('timeGridWeek');
  const [title, setTitle] = useState('');
  const [eventsWindow, setEventsWindow] = useState(() => defaultEventsWindow());

  const { data: events = [] } = useMemberEventsWindow(member.userId, eventsWindow.start, eventsWindow.end);
  const createEvent = useCreateMemberEvent(member.userId);
  const updateEvent = useUpdateMemberEvent(member.userId);
  const deleteEvent = useDeleteMemberEvent(member.userId);

  // Modales (mêmes états que la page Agenda).
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const applyVisibleRange = useCallback((rangeStart: Date, rangeEnd: Date) => {
    const next = bufferedWindow(rangeStart, rangeEnd);
    setEventsWindow((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  const handleDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    applyVisibleRange(arg.start, arg.end);
  };

  const calendarEvents = buildCalendarEvents(events) as EventInput[];

  // ── Handlers (parité page Agenda) ──────────────────────────────────
  const handleSelect = (selectInfo: DateSelectArg) => {
    setSelectedSlot({ start: selectInfo.start.toISOString(), end: selectInfo.end.toISOString() });
    setAddOpen(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const masterId = getMasterId(clickInfo.event.id);
    const ev = events.find((e) => e.id === masterId);
    if (ev) {
      setSelectedEvent(ev);
      setEditOpen(true);
    }
  };

  const handleEventDrop = (info: EventDropArg) => {
    const masterId = getMasterId(info.event.id);
    if (masterId.includes('::')) { info.revert(); return; }
    const start = info.event.start?.toISOString();
    const end = info.event.end?.toISOString() ?? start;
    if (!start) { info.revert(); return; }
    updateEvent.mutate({ id: masterId, updates: { start, end } });
  };

  const handleEventResize = (info: EventResizeDoneArg) => {
    const masterId = getMasterId(info.event.id);
    const start = info.event.start?.toISOString();
    const end = info.event.end?.toISOString();
    if (!start || !end) { info.revert(); return; }
    updateEvent.mutate({ id: masterId, updates: { start, end } });
  };

  const handleAddEvent = (data: { title: string; start: string; end: string; color: string; notes?: string; recurrence?: CalendarEvent['recurrence']; recurrenceDays?: number[] }) => {
    createEvent.mutate({
      title: data.title, start: data.start, end: data.end, color: data.color,
      notes: data.notes, recurrence: data.recurrence, recurrenceDays: data.recurrenceDays,
    });
    setAddOpen(false);
    setSelectedSlot(null);
    setTimeout(() => calendarRef.current?.getApi().unselect(), 50);
  };

  const handleUpdateEvent = (eventId: string, data: { title: string; start: string; end: string; color: string; notes?: string; recurrence?: CalendarEvent['recurrence']; recurrenceDays?: number[] }) => {
    updateEvent.mutate({ id: eventId, updates: { ...data } });
    setEditOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent.mutate(eventId);
    setEditOpen(false);
    setSelectedEvent(null);
  };

  const changeView = (v: ViewName) => {
    setView(v);
    calendarRef.current?.getApi().changeView(v);
  };
  const nav = (dir: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (dir === 'prev') api.prev();
    else if (dir === 'next') api.next();
    else api.today();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-[rgb(var(--color-background))] flex flex-col">
      {/* En-tête */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[rgb(var(--color-border))] shrink-0">
        <MemberAvatar avatar={member.avatar} name={member.displayName} size={36} />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate inline-flex items-center gap-1.5">
            <CalendarDays size={15} className="text-indigo-500" aria-hidden="true" />
            Agenda de {member.displayName}
          </h2>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            Vous gérez cet agenda — ajoutez, déplacez ou modifiez ses événements.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'agenda"
          className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {/* Barre de navigation */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-[rgb(var(--color-border))] shrink-0 flex-wrap">
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => nav('prev')} aria-label="Période précédente" className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nav('today')} className="px-3 h-8 rounded-lg text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]">
            Aujourd'hui
          </button>
          <button type="button" onClick={() => nav('next')} aria-label="Période suivante" className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] capitalize px-1">{title}</span>
        <div className="ml-auto inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5">
          {VIEW_LABELS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => changeView(v.id)}
              aria-pressed={view === v.id}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === v.id ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendrier */}
      <div className="flex-1 min-h-0 p-2 sm:p-4 overflow-hidden">
        <div className="h-full w-full rounded-xl border border-[rgb(var(--color-border))] overflow-hidden p-2 sm:p-4" style={{ backgroundColor: 'rgb(var(--calendar-bg))' }}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            events={calendarEvents}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={false}
            weekends={true}
            height="100%"
            locale="fr"
            firstDay={1}
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
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            datesSet={handleDatesSet}
            unselectAuto={true}
            unselectCancel=".modal-overlay,.modal-content,input,textarea,select,button,.fc-event,[data-radix-popper-content-wrapper]"
            eventContent={(eventInfo) => (
              <div className="h-full w-full flex items-center justify-center p-1 text-xs cursor-pointer">
                <div className="font-medium text-white truncate text-center leading-tight">{eventInfo.event.title}</div>
              </div>
            )}
            eventClassNames={() => ['rounded-lg shadow-sm border-0 cursor-pointer hover:shadow-md transition-all']}
          />
        </div>
      </div>

      {/* Modale d'ajout — EventModal réutilisé tel quel */}
      {addOpen && (
        <EventModal
          mode={'add' as EventModalMode}
          isOpen={addOpen}
          onClose={() => { setAddOpen(false); setSelectedSlot(null); }}
          task={{ id: '', name: '', priority: 3, category: 'blue', deadline: '', estimatedTime: 60, createdAt: '', bookmarked: false, completed: false }}
          onAddEvent={handleAddEvent}
          prefilledTimeSlot={selectedSlot || undefined}
        />
      )}

      {/* Modale d'édition */}
      {editOpen && selectedEvent && (
        <EventModal
          mode={'edit' as EventModalMode}
          isOpen={editOpen}
          onClose={() => { setEditOpen(false); setSelectedEvent(null); }}
          event={selectedEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}
    </div>,
    document.body,
  );
};

export default MemberAgendaSheet;
