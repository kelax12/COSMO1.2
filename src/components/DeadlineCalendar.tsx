import React, { useState, useMemo } from 'react';
import { usePendingTasks, Task } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import TaskModal from './TaskModal';

const DeadlineCalendar: React.FC = () => {
  // Use new module for tasks (read-only)
  const { data: tasks = [], isLoading } = usePendingTasks();
  // Use new module for categories
  const { data: categories = [] } = useCategories();
  const isMobile = useIsMobile();
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'agenda'>(isMobile ? 'agenda' : 'week');

  // Force agenda view if user shrinks to mobile while in week/month
  React.useEffect(() => {
    if (isMobile && currentView !== 'agenda') {
      setCurrentView('agenda');
    }
  }, [isMobile, currentView]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasksById = new Map(tasks.map((t) => [t.id, t]));

  const deadlineEvents = tasks.map(task => ({
    id: task.id,
    title: task.name,
    date: new Date(task.deadline),
    backgroundColor: getCategoryColor(task.category),
    priority: task.priority,
    category: task.category,
    estimatedTime: task.estimatedTime,
  }));

  const openTaskFromEventId = (id: string) => {
    const task = tasksById.get(id);
    if (task) setSelectedTask(task);
  };

  function getCategoryColor(category: string) {
    return categories.find(cat => cat.id === category)?.color || '#6B7280';
  }

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7;
    
    const days = [];
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return deadlineEvents.filter(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'week' || currentView === 'agenda') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'week' || currentView === 'agenda') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // Agenda view: group events by day for the visible week, only show days with deadlines
  const agendaDays = useMemo(() => {
    const days = getWeekDays(currentDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return days.map((day) => {
      const dayEvents = deadlineEvents
        .filter((e) => e.date.toDateString() === day.toDateString())
        .sort((a, b) => b.priority - a.priority);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const isOverdue = dayStart < now;
      return { date: day, events: dayEvents, isOverdue };
    });
  }, [currentDate, deadlineEvents]);

  const totalAgendaEvents = agendaDays.reduce((sum, d) => sum + d.events.length, 0);

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const formatWeekRange = (date: Date) => {
    const days = getWeekDays(date);
    const start = days[0];
    const end = days[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    }
    return `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);

  if (isLoading) {
    return (
      <div className="rounded-2xl border overflow-hidden transition-colors" style={{
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))'
      }}>
        <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
          <div className="animate-pulse h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        </div>
        <div className="p-4 animate-pulse">
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden transition-colors" style={{
      backgroundColor: 'rgb(var(--color-surface))',
      borderColor: 'rgb(var(--color-border))'
    }}>
      <div className="p-3 sm:p-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest truncate" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Calendrier des deadlines
          </p>
          <button
            onClick={goToToday}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            style={{
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-secondary))'
            }}
            aria-label="Revenir à aujourd'hui"
          >
            Aujourd'hui
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2 justify-between sm:justify-start">
            <button
              onClick={navigatePrev}
              aria-label="Période précédente"
              className="min-w-11 min-h-11 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'rgb(var(--color-text-secondary))' }} />
            </button>
            <h2 className="text-sm sm:text-lg font-semibold capitalize flex-1 sm:flex-none sm:min-w-[200px] text-center" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {currentView === 'month' ? formatMonth(currentDate) : formatWeekRange(currentDate)}
            </h2>
            <button
              onClick={navigateNext}
              aria-label="Période suivante"
              className="min-w-11 min-h-11 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5" style={{ color: 'rgb(var(--color-text-secondary))' }} />
            </button>
          </div>

          <div className="inline-flex self-stretch sm:self-auto rounded-xl p-1 gap-1" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
            <button
              onClick={() => setCurrentView('agenda')}
              aria-label="Vue Agenda"
              aria-pressed={currentView === 'agenda'}
              className={`min-h-11 flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                currentView === 'agenda'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
              style={{ color: currentView === 'agenda' ? '#fff' : 'rgb(var(--color-text-secondary))' }}
            >
              <Clock className="w-4 h-4" />
              <span>Agenda</span>
            </button>
            <button
              onClick={() => setCurrentView('week')}
              aria-label="Vue Semaine"
              aria-pressed={currentView === 'week'}
              className={`hidden sm:flex min-h-11 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                currentView === 'week'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
              style={{ color: currentView === 'week' ? '#fff' : 'rgb(var(--color-text-secondary))' }}
            >
              <Calendar className="w-4 h-4" />
              <span>Sem.</span>
            </button>
            <button
              onClick={() => setCurrentView('month')}
              aria-label="Vue Mois"
              aria-pressed={currentView === 'month'}
              className={`hidden sm:flex min-h-11 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                currentView === 'month'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
              style={{ color: currentView === 'month' ? '#fff' : 'rgb(var(--color-text-secondary))' }}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Mois</span>
            </button>
          </div>
        </div>
      </div>

      {currentView === 'agenda' ? (
        <div className="divide-y" style={{ borderColor: 'rgb(var(--color-border))' }}>
          {totalAgendaEvents === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'rgb(var(--color-text-muted))' }} />
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Aucune deadline cette semaine
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
                Profitez-en pour planifier de nouvelles tâches !
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {agendaDays
                .filter((d) => d.events.length > 0)
                .map(({ date, events, isOverdue }) => (
                  <motion.div
                    key={date.toISOString()}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ borderColor: 'rgb(var(--color-border))' }}
                    className="border-b last:border-b-0"
                  >
                    {/* Day header — sticky-feeling pill */}
                    <div className={`flex items-center gap-3 px-4 py-3 ${isToday(date) ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}>
                      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 ${
                        isToday(date)
                          ? 'bg-blue-500 text-white'
                          : isOverdue
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      style={{ color: isToday(date) ? '#fff' : isOverdue ? undefined : 'rgb(var(--color-text-primary))' }}
                      >
                        <span className="text-[10px] font-semibold uppercase leading-none">
                          {dayNames[(date.getDay() + 6) % 7]}
                        </span>
                        <span className="text-lg font-bold leading-none mt-0.5">
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold capitalize truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {isToday(date)
                            ? "Aujourd'hui"
                            : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: isOverdue ? '#ef4444' : 'rgb(var(--color-text-muted))' }}>
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                          {events.length} {events.length === 1 ? 'tâche' : 'tâches'}
                          {isOverdue && ' en retard'}
                        </p>
                      </div>
                    </div>

                    {/* Tasks list for the day */}
                    <div className="px-3 pb-3 space-y-2">
                      {events.map((event) => (
                        <motion.button
                          key={event.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openTaskFromEventId(event.id)}
                          className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:shadow-md transition-all border min-h-[60px]"
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            borderColor: 'rgb(var(--color-border))'
                          }}
                        >
                          {/* Color bar */}
                          <div
                            className="w-1 self-stretch rounded-full shrink-0"
                            style={{ backgroundColor: event.backgroundColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                              {event.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                              <span className="px-1.5 py-0.5 rounded font-bold" style={{
                                backgroundColor: `${event.backgroundColor}20`,
                                color: event.backgroundColor
                              }}>
                                P{event.priority}
                              </span>
                              <span>{event.estimatedTime}min</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgb(var(--color-text-muted))' }} />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          )}
        </div>
      ) : currentView === 'week' ? (
        <div>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
            {weekDays.map((day, idx) => (
              <div 
                key={idx} 
                className={`p-4 text-center border-r last:border-r-0 ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                style={{ borderColor: 'rgb(var(--color-border))' }}
              >
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  {dayNames[idx]}
                </div>
                <div className={`text-2xl font-bold ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : ''}`} style={{ color: isToday(day) ? undefined : 'rgb(var(--color-text-primary))' }}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 min-h-[300px]">
            {weekDays.map((day, idx) => {
              const dayEvents = getEventsForDate(day);
              return (
                <div 
                  key={idx} 
                  className={`p-2 border-r last:border-r-0 ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  style={{ borderColor: 'rgb(var(--color-border))' }}
                >
                  <div className="space-y-2">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => openTaskFromEventId(event.id)}
                        className="p-2 rounded-lg text-white text-xs font-medium shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        style={{ backgroundColor: event.backgroundColor }}
                        title={`${event.title}\nPriorité: ${event.priority}\nTemps: ${event.estimatedTime}min`}
                      >
                        <div className="truncate font-semibold">{event.title}</div>
                        <div className="opacity-80 text-[10px] mt-1">P{event.priority}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
            {dayNames.map((name, idx) => (
              <div 
                key={idx} 
                className="p-3 text-center text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgb(var(--color-text-muted))' }}
              >
                {name}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {monthDays.map(({ date, isCurrentMonth }, idx) => {
              const dayEvents = getEventsForDate(date);
              return (
                <div 
                  key={idx} 
                  className={`min-h-[70px] sm:min-h-[100px] p-1.5 sm:p-2 border-r border-b last:border-r-0 ${
                    !isCurrentMonth ? 'opacity-40' : ''
                  } ${isToday(date) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  style={{ borderColor: 'rgb(var(--color-border))' }}
                >
                  <div className={`text-sm font-medium mb-2 ${isToday(date) ? 'text-blue-600 dark:text-blue-400' : ''}`} style={{ color: isToday(date) ? undefined : 'rgb(var(--color-text-primary))' }}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        onClick={() => openTaskFromEventId(event.id)}
                        className="px-2 py-1 rounded text-white text-[10px] font-medium truncate cursor-pointer hover:opacity-90"
                        style={{ backgroundColor: event.backgroundColor }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] font-medium" style={{ color: 'rgb(var(--color-text-muted))' }}>
                        +{dayEvents.length - 2} autres
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 border-t" style={{ borderColor: 'rgb(var(--color-border))' }}>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: `${category.color}15`,
                color: category.color
              }}
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </div>
          ))}
        </div>
      </div>
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
};

export default DeadlineCalendar;
