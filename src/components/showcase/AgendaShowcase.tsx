import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getDate = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const EVENTS = [
  { id: '1', title: 'Stand-up équipe', start: getDate(0, 9, 0), end: getDate(0, 9, 30), backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  { id: '2', title: 'Revue de sprint', start: getDate(0, 14, 0), end: getDate(0, 15, 30), backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  { id: '3', title: 'Session sport', start: getDate(1, 7, 0), end: getDate(1, 8, 0), backgroundColor: '#10B981', borderColor: '#10B981' },
  { id: '4', title: 'Call client Acme', start: getDate(1, 10, 30), end: getDate(1, 11, 30), backgroundColor: '#EF4444', borderColor: '#EF4444' },
  { id: '5', title: 'Deep work — Roadmap', start: getDate(2, 9, 0), end: getDate(2, 12, 0), backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  { id: '6', title: 'Déjeuner équipe', start: getDate(2, 12, 30), end: getDate(2, 13, 30), backgroundColor: '#EC4899', borderColor: '#EC4899' },
  { id: '7', title: 'Formation TypeScript', start: getDate(3, 14, 0), end: getDate(3, 16, 0), backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  { id: '8', title: 'Revue OKR mensuelle', start: getDate(4, 10, 0), end: getDate(4, 11, 0), backgroundColor: '#22C55E', borderColor: '#22C55E' },
];

const AgendaShowcase: React.FC = () => {
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-slate-800/80 border border-white/10 shadow-2xl [&_.fc]:text-xs [&_.fc-toolbar]:hidden [&_.fc-col-header-cell]:bg-slate-900/60 [&_.fc-col-header-cell]:text-slate-400 [&_.fc-timegrid-slot]:border-slate-700/50 [&_.fc-scrollgrid]:border-slate-700/30 [&_.fc-event]:rounded-md [&_.fc-event]:text-white [&_.fc-event-title]:font-medium [&_.fc-timegrid-now-indicator-line]:border-blue-500 [&_.fc-timegrid-now-indicator-arrow]:border-blue-500 [&_.fc]:bg-transparent [&_.fc-theme-standard_td]:border-slate-700/30 [&_.fc-theme-standard_th]:border-slate-700/30 [&_.fc-scrollgrid-sync-table]:bg-slate-800/40 [&_.fc-timegrid-axis]:bg-slate-900/40 [&_.fc-timegrid-slot-label]:text-slate-500 [&_.fc-day-today]:bg-blue-500/5">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        events={EVENTS}
        editable={false}
        selectable={false}
        headerToolbar={false}
        height={420}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        nowIndicator={true}
        locale="fr"
        firstDay={1}
        dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
        allDaySlot={false}
        eventDisplay="block"
        expandRows={true}
      />
    </div>
  );
};

export default AgendaShowcase;
