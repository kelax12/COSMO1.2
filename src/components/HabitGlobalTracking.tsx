import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHabits } from '@/modules/habits';
import { Button } from '@/components/ui/button';

type PeriodType = 'week' | 'month' | 'all';

const periodOptions: { value: PeriodType; label: string; days: number }[] = [
  { value: 'week', label: 'Semaine', days: 7 },
  { value: 'month', label: 'Mois', days: 30 },
  { value: 'all', label: 'Tout', days: 0 },
];

const getSuccessColor = (percentage: number): string => {
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

const HabitGlobalTracking: React.FC = () => {
  const { data: habits = [] } = useHabits();
  const [period, setPeriod] = useState<PeriodType>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [globalPage, setGlobalPage] = useState(0);
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');

  const getOldestHabitDate = (): Date => {
    if (habits.length === 0) return new Date();
    let oldest = new Date();
    oldest.setHours(0, 0, 0, 0);
    habits.forEach((h) => {
      if (h.createdAt) {
        const d = new Date(h.createdAt);
        d.setHours(0, 0, 0, 0);
        if (d < oldest) oldest = d;
      }
    });
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 7);
    sevenAgo.setHours(0, 0, 0, 0);
    return oldest > sevenAgo ? sevenAgo : oldest;
  };

  const generateDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { date: string; dayNumber: number; isToday: boolean; isFuture: boolean }[] = [];

    let startDate: Date;
    let dayCount: number;

    if (period === 'all') {
      startDate = getOldestHabitDate();
      startDate.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      dayCount = Math.max(1, Math.ceil((end.getTime() - startDate.getTime()) / 86400000));
    } else {
      const opt = periodOptions.find((p) => p.value === period);
      dayCount = opt?.days || 7;
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
        dayNumber: date.getDate(),
        isToday: date.toDateString() === today.toDateString(),
        isFuture: date > today,
      });
    }
    return days;
  };

  const days = generateDays();

  const getDailyPercentage = (date: string): number => {
    if (habits.length === 0) return 0;
    const filtered = selectedHabitId === 'all' ? habits : habits.filter((h) => h.id === selectedHabitId);
    const active = filtered.filter((h) => {
      const created = h.createdAt ? h.createdAt.split('T')[0] : '';
      return !created || date >= created;
    });
    if (active.length === 0) return 0;
    return Math.round((active.filter((h) => h.completions[date]).length / active.length) * 100);
  };

  const navigatePeriod = (dir: 'prev' | 'next') => {
    const d = new Date(currentDate);
    if (period === 'week') d.setDate(currentDate.getDate() + (dir === 'next' ? 7 : -7));
    else if (period === 'month') d.setMonth(currentDate.getMonth() + (dir === 'next' ? 1 : -1));
    setCurrentDate(d);
    setGlobalPage(0);
  };

  const canNavigateNext = (): boolean => {
    if (period === 'all') return false;
    const next = new Date(currentDate);
    if (period === 'week') next.setDate(currentDate.getDate() + 7);
    else next.setMonth(currentDate.getMonth() + 1);
    return next <= new Date();
  };

  const getPeriodLabel = (): string => {
    if (period === 'week')
      return `Semaine du ${currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    if (period === 'month')
      return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return 'Depuis la création';
  };

  if (habits.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Créez des habitudes pour voir le suivi global
        </p>
      </div>
    );
  }

  const itemsPerRow = typeof window !== 'undefined' && window.innerWidth < 768 ? 7 : 10;
  const rows: typeof days[] = [];
  for (let i = days.length; i > 0; i -= itemsPerRow) {
    rows.push(days.slice(Math.max(0, i - itemsPerRow), i));
  }
  const maxRowsPerPage = 6;
  const totalPages = Math.ceil(rows.length / maxRowsPerPage);
  const currentPageRows = rows.slice(globalPage * maxRowsPerPage, (globalPage + 1) * maxRowsPerPage);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 p-4 md:p-6 border-b transition-colors"
        style={{ backgroundColor: 'rgb(var(--color-hover))', borderColor: 'rgb(var(--color-border))' }}
      >
        <div>
          <h3 className="text-base md:text-lg font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
            Suivi Global
          </h3>
          <p className="text-[10px] md:text-sm mt-0.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {selectedHabitId === 'all'
              ? 'Complétion moyenne par jour'
              : `Suivi pour : ${habits.find((h) => h.id === selectedHabitId)?.name}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {period !== 'all' && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigatePeriod('prev')}
                className="border"
                style={{ color: 'rgb(var(--color-text-secondary))', borderColor: 'rgb(var(--color-border))' }}
              >
                <ChevronLeft size={18} />
              </Button>
              <div
                className="text-xs font-medium min-w-[100px] md:min-w-[120px] text-center"
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                {getPeriodLabel()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigatePeriod('next')}
                disabled={!canNavigateNext()}
                className="border"
                style={{
                  color: canNavigateNext() ? 'rgb(var(--color-text-secondary))' : 'rgb(var(--color-text-muted))',
                  borderColor: 'rgb(var(--color-border))',
                }}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )}

          <div
            className="flex items-center rounded-lg p-1 border transition-colors"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
          >
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPeriod(opt.value);
                  if (opt.value !== 'all') setCurrentDate(new Date());
                  setGlobalPage(0);
                }}
                className="px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: period === opt.value ? '#2563EB' : 'transparent',
                  color: period === opt.value ? 'white' : 'rgb(var(--color-text-secondary))',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-primary))',
            }}
          >
            <option value="all">Toutes les habitudes</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="p-4 rounded-b-xl overflow-x-auto hide-scrollbar"
        style={{ backgroundColor: 'rgb(var(--color-surface-elevated, var(--color-surface)))' }}
      >
        <div className="space-y-4">
          {currentPageRows.map((rowDays, rowIndex) => (
            <div key={rowIndex} className="flex justify-between w-full px-2">
              {rowDays.map((day) => {
                const active = habits.filter((h) => {
                  const created = h.createdAt ? h.createdAt.split('T')[0] : '';
                  return !created || day.date >= created;
                });
                if (active.length === 0) {
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg opacity-20 bg-slate-300" />
                      <div
                        className={`text-[9px] md:text-[10px] ${
                          day.isToday ? 'font-bold text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        {day.dayNumber}
                      </div>
                    </div>
                  );
                }
                const pct = getDailyPercentage(day.date);
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-default shadow-sm border"
                      style={{
                        backgroundColor: getSuccessColor(pct),
                        opacity: day.isFuture ? 0.2 : 1,
                        borderColor: day.isToday ? '#2563EB' : 'transparent',
                        borderWidth: day.isToday ? '2px' : '0',
                      }}
                      title={`${day.dayNumber}: ${pct}%`}
                    >
                      <span className="text-[10px] md:text-xs font-bold text-white">{pct}%</span>
                    </div>
                    <div
                      className={`text-[9px] md:text-[10px] ${
                        day.isToday ? 'font-bold text-blue-600' : 'text-slate-500'
                      }`}
                    >
                      {day.dayNumber}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setGlobalPage((p) => Math.max(0, p - 1))}
                disabled={globalPage === 0}
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                <ChevronLeft size={20} />
              </Button>
              <span className="text-xs font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                {globalPage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setGlobalPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={globalPage === totalPages - 1}
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                <ChevronRight size={20} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HabitGlobalTracking;
