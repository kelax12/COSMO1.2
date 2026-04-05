import React, { useState } from 'react';
import { usePendingTasks } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid } from 'lucide-react';

const DeadlineCalendar: React.FC = () => {
  // Use new module for tasks (read-only)
  const { data: tasks = [], isLoading } = usePendingTasks();
  // Use new module for categories
  const { data: categories = [] } = useCategories();
  const [currentView, setCurrentView] = useState<'month' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const deadlineEvents = tasks.map(task => ({
    id: task.id,
    title: task.name,
    date: new Date(task.deadline),
    backgroundColor: getCategoryColor(task.category),
    priority: task.priority,
    category: task.category,
    estimatedTime: task.estimatedTime,
  }));

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
    if (currentView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

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
      <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <button
              onClick={navigatePrev}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'rgb(var(--color-text-secondary))' }} />
            </button>
            <h2 className="text-base sm:text-lg font-semibold capitalize min-w-[150px] sm:min-w-[200px] text-center" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {currentView === 'week' ? formatWeekRange(currentDate) : formatMonth(currentDate)}
            </h2>
            <button
              onClick={navigateNext}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" style={{ color: 'rgb(var(--color-text-secondary))' }} />
            </button>
          </div>
          
          <div className="inline-flex self-center sm:self-auto rounded-xl p-1 gap-1" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
            <button
              onClick={() => setCurrentView('week')}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                currentView === 'week' 
                  ? 'bg-blue-500 text-white shadow-md' 
                  : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
              style={{
                color: currentView === 'week' ? '#fff' : 'rgb(var(--color-text-secondary))'
              }}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden xs:inline">Semaine</span>
              <span className="xs:hidden">Sem.</span>
            </button>
            <button
              onClick={() => setCurrentView('month')}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                currentView === 'month' 
                  ? 'bg-blue-500 text-white shadow-md' 
                  : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
              style={{
                color: currentView === 'month' ? '#fff' : 'rgb(var(--color-text-secondary))'
              }}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Mois</span>
            </button>
          </div>
        </div>
      </div>

      {currentView === 'week' ? (
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
                  className={`min-h-[100px] p-2 border-r border-b last:border-r-0 ${
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
                        className="px-2 py-1 rounded text-white text-[10px] font-medium truncate"
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
    </div>
  );
};

export default DeadlineCalendar;
