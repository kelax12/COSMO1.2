import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable, type EventReceiveArg } from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { ChevronLeft, ChevronRight, Plus, ListChecks, Clock, CalendarClock } from 'lucide-react';
import {
  useMemberEventsWindow,
  useCreateMemberEvent,
  useUpdateMemberEvent,
  useDeleteMemberEvent,
  getMasterId,
  type CalendarEvent,
} from '@/modules/events';
import { useTeamTasks, useTeamProjects, useCreateTeamTask, type TeamTask } from '@/modules/team-projects';
import { useOrgTeamMembers } from '@/modules/org-teams';
import { useOrgMembers } from '@/modules/organizations';
import EventModal, { type EventModalMode } from '@/components/EventModal';
import {
  buildCalendarEvents,
  getInitialScrollTime,
  defaultEventsWindow,
  bufferedWindow,
  taskEventDurationMinutes,
} from '@/pages/agenda/calendar-events';
import { PRIORITY_META, isTaskOverdue, sortOpenTasks } from './team-projects.helpers';
import type { OrgMember } from '@/modules/organizations';
import TeamTaskModal from './TeamTaskModal';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface MemberAgendaBodyProps {
  member: OrgMember;
}

type ViewName = 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth';

// Les libelles viennent du catalogue au RENDU : une constante de module
// serait figee au premier import (cf. src/i18n/catalog.ts).
const VIEW_LABEL_KEYS = {
  timeGridDay: 'common.agendaDay',
  timeGridWeek: 'common.agendaWeek',
  dayGridMonth: 'common.agendaMonth',
} as const satisfies Record<ViewName, KeyOf<'org'>>;

const VIEW_ORDER: ViewName[] = ['timeGridDay', 'timeGridWeek', 'dayGridMonth'];

// Couleur (hex) d'un projet — pour colorer l'événement issu d'une tâche d'équipe.
const PROJECT_HEX: Record<string, string> = {
  blue: '#3b82f6', indigo: '#6366f1', purple: '#a855f7', pink: '#ec4899',
  red: '#ef4444', amber: '#f59e0b', green: '#10b981', teal: '#14b8a6', slate: '#64748b',
};

/**
 * CORPS de l'agenda d'un subordonné — barre d'outils, tâches à planifier,
 * calendrier et modales, SANS overlay ni en-tête (item #18).
 *
 * ⚠️ FullCalendar mesure son conteneur au montage : ce corps ne doit être
 * monté que lorsque son onglet est actif, sinon il calcule sa hauteur dans un
 * conteneur masqué et rend une grille écrasée. Son hôte doit aussi lui donner
 * une hauteur DÉFINIE (`height="100%"` remonte jusqu'à un parent dimensionné).
 */
export const MemberAgendaBody = ({ member }: MemberAgendaBodyProps) => {
  const { t } = useT('org');
  const calendarRef = useRef<FullCalendar>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const [view, setView] = useState<ViewName>('timeGridWeek');
  const [title, setTitle] = useState('');
  /**
   * Volet « tâches à planifier ». Il occupe 240 px : sur un écran de 375 px il
   * ne laisserait que 100 px au calendrier — un onglet Agenda qui ne montre pas
   * l'agenda (mesuré au navigateur, item #18). Il démarre donc fermé sous `sm`,
   * et les deux volets y sont exclusifs : celui qu'on ouvre prend tout.
   *
   * `window.innerWidth` plutôt que `useIsMobile()` : ce hook renvoie `false` au
   * premier rendu puis se corrige, ce qui ferait monter le calendrier à 100 px
   * avant de le corriger — exactement la mesure ratée que FullCalendar garde.
   */
  const [showTasks, setShowTasks] = useState(() => window.innerWidth >= 640);
  const [eventsWindow, setEventsWindow] = useState(() => defaultEventsWindow());

  const { data: events = [] } = useMemberEventsWindow(member.userId, eventsWindow.start, eventsWindow.end);
  const createEvent = useCreateMemberEvent(member.userId);
  const updateEvent = useUpdateMemberEvent(member.userId);
  const deleteEvent = useDeleteMemberEvent(member.userId);

  // Tâches d'équipe à planifier + couleur de leur projet. Visibles si assignées
  // nommément AU membre, OU si son projet appartient à une équipe dont le
  // membre fait partie (pas besoin d'assignation individuelle — l'agenda pro
  // reflète la charge de toute l'équipe, pas seulement « ses » tâches).
  const { data: allTeamTasks = [] } = useTeamTasks(member.orgId);
  const { data: projects = [] } = useTeamProjects(member.orgId);
  const { data: teamMembers = [] } = useOrgTeamMembers(member.orgId);
  const { data: orgMembers = [] } = useOrgMembers(member.orgId);
  const createTask = useCreateTeamTask(member.orgId);
  const [creatingTask, setCreatingTask] = useState(false);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  const projectColorHex = useCallback(
    (projectId: string) => PROJECT_HEX[projects.find((p) => p.id === projectId)?.color ?? 'blue'] ?? PROJECT_HEX.blue,
    [projects],
  );
  const memberTeamIds = useMemo(
    () => new Set(teamMembers.filter((tm) => tm.userId === member.userId).map((tm) => tm.teamId)),
    [teamMembers, member.userId],
  );
  const memberTasks = useMemo(
    () => sortOpenTasks(allTeamTasks.filter((t) => {
      if (t.completed) return false;
      if (t.assigneeIds.includes(member.userId)) return true;
      const projectTeamId = projects.find((p) => p.id === t.projectId)?.teamId;
      return !!projectTeamId && memberTeamIds.has(projectTeamId);
    })),
    [allTeamTasks, member.userId, projects, memberTeamIds],
  );

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

  // ── Drag & drop des tâches d'équipe vers le calendrier ─────────────
  useEffect(() => {
    if (!showTasks) return;
    const timer = setTimeout(() => {
      const container = document.getElementById('member-external-events');
      if (container && !draggableRef.current) {
        draggableRef.current = new Draggable(container, {
          itemSelector: '.member-external-event',
          longPressDelay: 250,
          eventData: (el) => {
            const task = JSON.parse(el.getAttribute('data-task') || '{}');
            const color = projectColorHex(task.projectId);
            return {
              title: task.name,
              duration: { minutes: taskEventDurationMinutes(task.estimatedTime) },
              backgroundColor: color,
              borderColor: color,
              textColor: '#ffffff',
            };
          },
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [showTasks, memberTasks, projectColorHex]);

  useEffect(() => () => { try { draggableRef.current?.destroy(); } catch { /* ignore */ } draggableRef.current = null; }, []);

  const handleEventReceive = (info: EventReceiveArg) => {
    const ev = info.event;
    const start = ev.start?.toISOString() ?? new Date().toISOString();
    const end = ev.end?.toISOString() ?? new Date(new Date(start).getTime() + 60 * 60000).toISOString();
    createEvent.mutate({ title: ev.title, start, end, color: ev.backgroundColor || '#6366f1' });
    // Retire l'événement temporaire de FullCalendar : la mutation ajoute le vrai.
    info.event.remove();
  };

  // ── Handlers (parité page Agenda) ──────────────────────────────────
  const handleSelect = (selectInfo: DateSelectArg) => {
    setSelectedSlot({ start: selectInfo.start.toISOString(), end: selectInfo.end.toISOString() });
    setAddOpen(true);
  };

  const openNewEvent = () => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60000);
    setSelectedSlot({ start: start.toISOString(), end: end.toISOString() });
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

  return (
    <>
      {/* Barre d'outils — couleurs alignées sur l'agenda classique */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-[rgb(var(--color-border))] shrink-0 flex-wrap">
        {/* Toggle sidebar tâches */}
        <button
          type="button"
          onClick={() => setShowTasks((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border shadow-sm transition-all shrink-0"
          style={{
            backgroundColor: showTasks ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-bg))',
            borderColor: showTasks ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-border))',
            color: showTasks ? 'white' : 'rgb(var(--color-text-primary))',
          }}
        >
          <ListChecks size={16} aria-hidden="true" /> {t('agendaSheet.tasksTitle')}
        </button>

        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => nav('prev')} aria-label={t('agendaSheet.prevPeriod')} className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:text-blue-600 transition-colors">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nav('today')} className="px-3 h-8 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:text-blue-600 hover:border-[rgb(var(--color-accent-solid-hover))]/60 transition-colors">
            {t('agendaSheet.today')}
          </button>
          <button type="button" onClick={() => nav('next')} aria-label={t('agendaSheet.nextPeriod')} className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:text-blue-600 transition-colors">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] capitalize px-1 hidden sm:inline">{title}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Sélecteur de vue — couleur accent comme l'agenda classique */}
          <div className="flex gap-1 p-1 rounded-xl border border-[rgb(var(--color-border))]" style={{ backgroundColor: 'rgb(var(--color-surface))' }}>
            {VIEW_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => changeView(id)}
                aria-pressed={view === id}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  view === id
                    ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-sm'
                    : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                }`}
              >
                {t(VIEW_LABEL_KEYS[id])}
              </button>
            ))}
          </div>
          {/* Bouton « Nouveau » — dégradé bleu identique à l'agenda classique */}
          <button
            type="button"
            onClick={openNewEvent}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-blue-500/25 transition-all bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] shrink-0"
          >
            <Plus size={18} aria-hidden="true" />
            <span className="font-medium text-sm">{t('agendaSheet.new')}</span>
          </button>
        </div>
      </div>

      {/* Corps : sidebar tâches + calendrier */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {showTasks && (
          <aside
            className="w-full sm:w-60 lg:w-72 shrink-0 sm:border-r border-[rgb(var(--color-border))] flex flex-col"
            style={{ backgroundColor: 'rgb(var(--nav-bg))' }}
          >
            <div className="p-4 border-b border-[rgb(var(--color-border))] flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('agendaSheet.teamTasks')}</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                  {t('agendaSheet.dragHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatingTask(true)}
                aria-label={t('agendaSheet.addTaskFor', { name: member.displayName })}
                title={t('agendaSheet.addTask')}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
            <div id="member-external-events" className="flex-1 overflow-y-auto p-3 space-y-2">
              {memberTasks.length === 0 ? (
                <p className="text-xs text-[rgb(var(--color-text-muted))] text-center py-8">
                  {t('agendaSheet.noTasks')}
                </p>
              ) : (
                memberTasks.map((task: TeamTask) => {
                  const color = projectColorHex(task.projectId);
                  const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
                  const overdue = isTaskOverdue(task);
                  return (
                    <div
                      key={task.id}
                      className="member-external-event rounded-lg p-2.5 border bg-[rgb(var(--color-surface))] cursor-move hover:shadow-md transition-shadow select-none"
                      style={{ borderColor: 'rgb(var(--color-border))', borderLeft: `4px solid ${color}`, touchAction: 'pan-y' }}
                      data-task={JSON.stringify({ id: task.id, name: task.name, projectId: task.projectId, estimatedTime: task.estimatedTime, priority: task.priority })}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} title={priority.label} aria-hidden="true" />
                        <span className="text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{task.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[rgb(var(--color-text-muted))]">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} aria-hidden="true" /> {task.estimatedTime && task.estimatedTime > 0 ? `${task.estimatedTime} min` : '1 h'}
                        </span>
                        {task.deadline && (
                          <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
                            <CalendarClock size={11} aria-hidden="true" /> {task.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Calendrier */}
        <div className={`flex-1 min-w-0 p-2 sm:p-4 overflow-hidden ${showTasks ? 'hidden sm:block' : ''}`}>
          <div className="h-full w-full rounded-xl border border-[rgb(var(--color-border))] overflow-hidden p-2 sm:p-4" style={{ backgroundColor: 'rgb(var(--calendar-bg))' }}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view}
              headerToolbar={false}
              events={calendarEvents}
              editable={true}
              droppable={true}
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
              eventReceive={handleEventReceive}
              datesSet={handleDatesSet}
              unselectAuto={true}
              unselectCancel=".modal-overlay,.modal-content,input,textarea,select,button,[data-radix-popper-content-wrapper]"
              eventContent={(eventInfo) => (
                <div className="h-full w-full flex items-center justify-center p-1 text-xs cursor-pointer">
                  <div className="font-medium text-white truncate text-center leading-tight">{eventInfo.event.title}</div>
                </div>
              )}
              eventClassNames={() => ['rounded-lg shadow-sm border-0 cursor-pointer hover:shadow-md transition-all']}
            />
          </div>
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
          enterprisePublic
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
          enterprisePublic
        />
      )}

      {creatingTask && (
        <TeamTaskModal
          isCreating
          projects={activeProjects.length > 0 ? activeProjects : projects}
          members={orgMembers}
          defaultProjectId={(activeProjects[0] ?? projects[0])?.id}
          defaultAssigneeIds={[member.userId]}
          onCreate={(input) => createTask.mutateAsync(input)}
          onClose={() => setCreatingTask(false)}
        />
      )}
    </>
  );
};
