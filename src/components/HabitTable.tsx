import React, { useState, useRef, useEffect } from 'react';
import { Clock, Flame, CheckCircle, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useHabits, useToggleHabitCompletion } from '@/modules/habits';

const colorOptions = [
{ value: 'blue', color: '#3B82F6' },
{ value: 'green', color: '#10B981' },
{ value: 'purple', color: '#8B5CF6' },
{ value: 'orange', color: '#F97316' },
{ value: 'red', color: '#EF4444' },
{ value: 'pink', color: '#EC4899' }];


type PeriodType = 'week' | 'month' | '3months' | 'all';

const HabitTable: React.FC = () => {
  const { data: habits = [] } = useHabits();
  const toggleMutation = useToggleHabitCompletion();
  const [period, setPeriod] = useState<PeriodType>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [globalPage, setGlobalPage] = useState(0);
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [period, habits]);

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const periodOptions = [
  { value: 'week' as PeriodType, label: 'Semaine', days: 7 },
  { value: 'month' as PeriodType, label: 'Mois', days: 30 },
  { value: 'all' as PeriodType, label: 'Tout', days: 0 }];


  const getOldestHabitDate = () => {
    if (habits.length === 0) return new Date();

    let oldestDate = new Date();
    oldestDate.setHours(0, 0, 0, 0);

    habits.forEach((habit) => {
      // Prendre en compte la date de création si elle existe
      if (habit.createdAt) {
        const createdDate = new Date(habit.createdAt);
        createdDate.setHours(0, 0, 0, 0);
        if (createdDate < oldestDate) {
          oldestDate = createdDate;
        }
      }

      const completionDates = Object.keys(habit.completions);
      if (completionDates.length > 0) {
        const habitOldestDate = new Date(Math.min(...completionDates.map((date) => parseLocalDate(date).getTime())));
        habitOldestDate.setHours(0, 0, 0, 0);
        if (habitOldestDate < oldestDate) {
          oldestDate = habitOldestDate;
        }
      }
    });

    // S'assurer qu'on montre au moins les 7 derniers jours même si c'est nouveau
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    if (oldestDate > sevenDaysAgo) {
      return sevenDaysAgo;
    }

    return oldestDate;
  };

  const generateDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];

    let startDate: Date;
    let dayCount: number;

    if (period === 'all') {
      startDate = getOldestHabitDate();
      startDate.setHours(0, 0, 0, 0);
      // S'assurer que le dernier jour est aujourd'hui
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      dayCount = Math.max(1, Math.ceil((todayEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      const selectedPeriod = periodOptions.find((p) => p.value === period);
      dayCount = selectedPeriod?.days || 7;

      // Pour toutes les périodes, le dernier jour visible est la date actuelle
      startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(currentDate.getDate() - dayCount + 1);
    }

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);

      days.push({
        date: date.toLocaleDateString('en-CA'),
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('fr-FR', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < today,
        isFuture: date > today
      });
    }

    return days;
  };

  const days = generateDays();

  const getDailyPercentage = (date: string) => {
    if (habits.length === 0) return 0;
    
    let filteredHabits = habits;
    if (selectedHabitId !== 'all') {
      filteredHabits = habits.filter(h => h.id === selectedHabitId);
    }

    const activeHabits = filteredHabits.filter((h) => {
      const createdDate = h.createdAt ? h.createdAt.split('T')[0] : '';
      return !createdDate || date >= createdDate;
    });
    
    if (activeHabits.length === 0) return 0;
    const completedCount = activeHabits.filter((h) => h.completions[date]).length;
    return Math.round(completedCount / activeHabits.length * 100);
  };

    const getSuccessColor = (percentage: number) => {
      if (percentage === 100) return '#2563EB';
      if (percentage >= 90) return '#064e3b';
      if (percentage >= 80) return '#059669';
      if (percentage >= 70) return '#10B981';
      if (percentage >= 60) return '#34d399';
      if (percentage >= 50) return '#d97706';
      if (percentage >= 40) return '#f59e0b';
      if (percentage >= 30) return '#ea580c';
      if (percentage >= 20) return '#c2410c';
      if (percentage >= 10) return '#dc2626';
      return '#991b1b';
    };

  const handleDayClick = (habitId: string, date: string) => {
    toggleMutation.mutate({ id: habitId, date });
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    switch (period) {
      case 'week':{
          newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
          break;
        }
      case 'month':{
          newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
          break;
        }
      case '3months':{
          newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 3 : -3));
          break;
        }
      default:
        return;
    }

    setCurrentDate(newDate);
  };

  const canNavigateNext = () => {
    if (period === 'all') return false;
    const today = new Date();
    const nextPeriodStart = new Date(currentDate);

    switch (period) {
      case 'week':
        nextPeriodStart.setDate(currentDate.getDate() + 7);
        break;
      case 'month':
        nextPeriodStart.setMonth(currentDate.getMonth() + 1);
        break;
      case '3months':
        nextPeriodStart.setMonth(currentDate.getMonth() + 3);
        break;
    }

    return nextPeriodStart <= today;
  };

  const getCurrentPeriodLabel = () => {
    switch (period) {
      case 'week':
        return `Semaine du ${currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
      case 'month':
        return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      case '3months': {
        const endDate = new Date(currentDate);
        endDate.setMonth(currentDate.getMonth() + 2);
        return `${currentDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
      }
      case 'all':
        return 'Depuis la création';
      default:
        return '';
    }
  };

  if (habits.length === 0) {
    return (
      <div className="rounded-xl shadow-sm border p-12 text-center transition-colors" style={{
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))'
      }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
          <Circle size={32} style={{ color: 'rgb(var(--color-text-muted))' }} />
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>Aucune habitude à afficher</h3>
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Créez des habitudes pour voir le tableau de suivi</p>
      </div>);

  }

  return (
    <>
      <div className="card overflow-hidden">
      <div className="p-4 md:p-6 border-b transition-colors" style={{
          backgroundColor: 'rgb(var(--color-hover))',
          borderColor: 'rgb(var(--color-border))'
        }}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>Tableau de suivi</h2>
            <p className="text-xs md:text-sm mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Vue d'ensemble de toutes vos habitudes</p>
          </div>
          
            {/* Navigation */}
            {period !== 'all' &&
            <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                <button
                onClick={() => navigatePeriod('prev')}
                className="p-1.5 md:p-2 rounded-lg transition-colors border md:border-0"
                style={{ 
                  color: 'rgb(var(--color-text-secondary))',
                  borderColor: 'rgb(var(--color-border))'
                }}>

                  <ChevronLeft size={18} />
                </button>
                <div className="text-xs md:text-sm font-medium min-w-[100px] md:min-w-[120px] text-center" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {getCurrentPeriodLabel()}
                </div>
                <button
                onClick={() => navigatePeriod('next')}
                disabled={!canNavigateNext()}
                className="p-1.5 md:p-2 rounded-lg transition-colors border md:border-0"
                style={{
                  color: canNavigateNext() ? 'rgb(var(--color-text-secondary))' : 'rgb(var(--color-text-muted))',
                  cursor: canNavigateNext() ? 'pointer' : 'not-allowed',
                  borderColor: 'rgb(var(--color-border))'
                }}>

                  <ChevronRight size={18} />
                </button>
              </div>
            }

            {/* Sélecteur de période */}
            <div className="flex items-center rounded-lg p-1 shadow-sm border transition-colors w-full md:w-auto" style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))'
            }}>
              {periodOptions.map((option) =>
              <button
                key={option.value}
                onClick={() => {
                  setPeriod(option.value);
                  if (option.value !== 'all') {
                    setCurrentDate(new Date());
                  }
                }}
                className="flex-1 md:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all"
                style={{
                  backgroundColor: period === option.value ? '#2563EB' : 'transparent',
                  color: period === option.value ? 'white' : 'rgb(var(--color-text-secondary))',
                  boxShadow: period === option.value ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
                }}
              >

                  {option.label}
                </button>
              )}
            </div>
        </div>
      </div>
      
      <div className="overflow-x-auto hide-scrollbar" ref={scrollContainerRef}>
        <table className="w-full border-collapse">
          <thead className="border-b transition-colors" style={{
              backgroundColor: 'rgb(var(--table-header-bg))',
              borderColor: 'rgb(var(--table-border))'
            }}>
            <tr>
                <th className="text-left p-3 md:p-4 font-semibold sticky left-0 z-20 min-w-[140px] md:min-w-[250px] border-r transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{
                    color: 'rgb(var(--table-header-text))',
                    backgroundColor: 'rgb(var(--table-header-bg))',
                    borderColor: 'rgb(var(--table-border))'
                  }}>
                  Habitude
                </th>
                  {days.map((day) =>
                  <th key={day.date} className="text-center p-2 font-medium min-w-[40px] md:min-w-[50px] transition-colors" style={{ color: 'rgb(var(--table-header-text))' }}>
                    <div className="text-[10px] md:text-xs mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>{day.dayName}</div>
                    <div className={`text-xs md:text-sm ${day.isToday ? 'font-bold' : ''}`} style={{
                      color: day.isToday ? 'rgb(var(--color-accent))' : 'rgb(var(--table-header-text))'
                    }}>
                      {day.dayNumber}
                    </div>
                    {(period === 'month' || period === 'all') &&
                      <div className="text-[9px] md:text-xs opacity-70" style={{ color: 'rgb(var(--color-text-muted))' }}>{day.monthName}</div>
                    }
                  </th>
                  )}
                  <th className="text-center p-3 md:p-4 font-semibold min-w-[60px] md:min-w-[80px] transition-colors border-l" style={{ 
                    color: 'rgb(var(--table-header-text))',
                    borderColor: 'rgb(var(--table-border))'
                  }}>
                    <Flame size={16} className="mx-auto md:hidden" />
                    <span className="hidden md:inline">Série</span>
                  </th>
              </tr>
            </thead>
          <tbody>
            {habits.map((habit, index) =>
              <tr key={habit.id} className="border-b transition-colors" style={{
                borderColor: 'rgb(var(--table-border))',
                backgroundColor: index % 2 === 0 ? 'rgb(var(--table-row-even))' : 'rgb(var(--table-row-odd))'
              }}>

                  <td className="p-2 md:p-4 sticky left-0 bg-inherit z-10 border-r transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ borderColor: 'rgb(var(--table-border))' }}>
                    <div className="flex items-center gap-1.5 md:gap-3">
                      <div
                        className="w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorOptions.find((c) => c.value === habit.color)?.color }} />

                      <div className="min-w-0">
                        <div className="font-medium truncate text-[11px] md:text-sm leading-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>{habit.name}</div>
                        <div className="hidden md:flex text-xs items-center gap-2 mt-0.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          <span>{habit.estimatedTime} min</span>
                        </div>
                      </div>
                    </div>
                  </td>
                    {days.map((day) => {
                    const isCompleted = habit.completions[day.date];
                    const createdDate = habit.createdAt ? habit.createdAt.split('T')[0] : '';
                    const isBeforeCreation = createdDate ? day.date < createdDate : false;

                    return (
                      <td key={day.date} className="p-1 md:p-2 text-center transition-colors">
                            <button
                          onClick={() => handleDayClick(habit.id, day.date)}
                          disabled={day.isFuture || isBeforeCreation}
                          className="w-7 h-7 md:w-8 md:h-8 rounded-lg border-1.5 md:border-2 transition-all flex items-center justify-center mx-auto"
                          style={{
                            backgroundColor: isCompleted ? '#2563EB' : day.isFuture || isBeforeCreation ? 'transparent' : day.isToday ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                            borderColor: isCompleted ? '#2563EB' : day.isToday ? '#2563EB' : day.isFuture || isBeforeCreation ? 'transparent' : 'rgb(var(--color-border))',
                            color: isCompleted ? 'white' : day.isFuture || isBeforeCreation ? 'rgb(var(--color-text-muted) / 0.2)' : 'rgb(var(--color-text-secondary))',
                            cursor: day.isFuture || isBeforeCreation ? 'not-allowed' : 'pointer',
                            opacity: isBeforeCreation ? 0.3 : 1
                          }}>

                              {isCompleted ?
                          <CheckCircle size={14} /> :
                          day.isFuture || isBeforeCreation ?
                          <Circle size={12} className="opacity-10" /> :

                          <Circle size={14} className="opacity-30 hover:opacity-100" />
                            }
                              </button>
                            </td>);


                    })}
                    <td className="p-3 md:p-4 text-center transition-colors border-l" style={{ borderColor: 'rgb(var(--table-border))' }}>
                      <div className="flex items-center justify-center gap-1">
                        <Flame size={14} className="text-orange-500 md:w-4 md:h-4" />
                        <span className="font-semibold text-xs md:text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>{habit.streak}</span>
                      </div>
                    </td>
                </tr>
                )}
            </tbody>
          </table>
          </div>
        </div>

      <div className="card overflow-hidden mt-6 md:mt-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 p-4 border-b transition-colors" style={{
          backgroundColor: 'rgb(var(--color-hover))',
          borderColor: 'rgb(var(--color-border))'
        }}>
          <div>
            <h3 className="text-base md:text-lg font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
              Suivi Global
            </h3>
            <p className="text-[10px] md:text-sm mt-0.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {selectedHabitId === 'all' 
                ? "Complétion moyenne par jour"
                : `Suivi pour : ${habits.find(h => h.id === selectedHabitId)?.name}`
              }
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              id="habit-filter"
              value={selectedHabitId}
              onChange={(e) => setSelectedHabitId(e.target.value)}
              className="w-full md:w-auto px-3 py-1.5 rounded-lg border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-primary))'
              }}
            >
              <option value="all">Toutes les habitudes</option>
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  {habit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
          <div className="p-4 rounded-xl overflow-x-auto hide-scrollbar" style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}>
            {(() => {
              const itemsPerRow = typeof window !== 'undefined' && window.innerWidth < 768 ? 7 : 10;
              const rows: typeof days[] = [];
              for (let i = days.length; i > 0; i -= itemsPerRow) {
                const start = Math.max(0, i - itemsPerRow);
                rows.push(days.slice(start, i));
              }
              
              const maxRowsPerPage = 6;
              const totalPages = Math.ceil(rows.length / maxRowsPerPage);
              const currentPageRows = rows.slice(globalPage * maxRowsPerPage, (globalPage + 1) * maxRowsPerPage);
            
            return (
              <div className="space-y-4">
                {currentPageRows.map((rowDays, rowIndex) => (
                  <div key={rowIndex} className="flex justify-between w-full px-2">
                    {rowDays.map((day) => {
                      const percentage = getDailyPercentage(day.date);
                      const color = getSuccessColor(percentage);
                      return (
                        <div key={day.date} className="flex flex-col items-center gap-1.5">
                          <div
                            className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-default shadow-sm border"
                            style={{ 
                              backgroundColor: color,
                              opacity: day.isFuture ? 0.2 : 1,
                              borderColor: day.isToday ? '#2563EB' : 'transparent',
                              borderWidth: day.isToday ? '2px' : '0'
                            }}
                            title={`${day.dayNumber}/${new Date(day.date).getMonth() + 1}: ${percentage}%`}
                          >
                            <span className="text-[10px] md:text-xs font-bold text-white">{percentage}%</span>
                          </div>
                          <div className={`text-[9px] md:text-[10px] ${day.isToday ? 'font-bold text-blue-600' : 'text-slate-500'}`}>
                            {day.dayNumber}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      onClick={() => setGlobalPage(p => Math.max(0, p - 1))}
                      disabled={globalPage === 0}
                      className="p-1.5 rounded-full transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={{ color: 'rgb(var(--color-text-secondary))' }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-xs font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      {globalPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setGlobalPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={globalPage === totalPages - 1}
                      className="p-1.5 rounded-full transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={{ color: 'rgb(var(--color-text-secondary))' }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
};

export default HabitTable;

