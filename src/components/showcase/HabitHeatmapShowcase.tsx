import React from 'react';
import { Flame, CheckCircle, Circle, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Static demo data (Habit Table replication) ─────────────────────
type Habit = {
  id: string;
  name: string;
  color: string;
  estimatedTime: number;
  completions: Record<string, boolean>; // yyyy-mm-dd → done
};

// Reference "today" for the showcase
const TODAY = new Date('2026-04-26');
TODAY.setHours(0, 0, 0, 0);

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Build 7-day window ending today
const DAYS_COUNT = 7;
const days = (() => {
  const arr: {
    date: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
    isFuture: boolean;
  }[] = [];
  const start = new Date(TODAY);
  start.setDate(TODAY.getDate() - DAYS_COUNT + 1);
  for (let i = 0; i < DAYS_COUNT; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push({
      date: toIso(d),
      dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: d.toDateString() === TODAY.toDateString(),
      isFuture: d > TODAY,
    });
  }
  return arr;
})();

// Static completions per habit: array of booleans aligned with `days`
const buildCompletions = (pattern: boolean[]): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  days.forEach((d, i) => {
    if (pattern[i]) out[d.date] = true;
  });
  return out;
};

const HABITS: Habit[] = [
  {
    id: 'h1',
    name: 'Méditation matinale',
    color: '#3B82F6',
    estimatedTime: 15,
    completions: buildCompletions([true, true, true, false, true, true, true]),
  },
  {
    id: 'h2',
    name: 'Lecture du soir',
    color: '#8B5CF6',
    estimatedTime: 30,
    completions: buildCompletions([true, false, true, true, false, true, false]),
  },
  {
    id: 'h3',
    name: 'Hydratation (2L/j)',
    color: '#10B981',
    estimatedTime: 5,
    completions: buildCompletions([true, true, true, true, true, true, true]),
  },
  {
    id: 'h4',
    name: 'Sport 3×/semaine',
    color: '#F59E0B',
    estimatedTime: 60,
    completions: buildCompletions([false, true, false, false, true, false, true]),
  },
  {
    id: 'h5',
    name: 'Journal de gratitude',
    color: '#EC4899',
    estimatedTime: 10,
    completions: buildCompletions([true, true, false, true, true, false, true]),
  },
  {
    id: 'h6',
    name: 'Apprentissage langue',
    color: '#EF4444',
    estimatedTime: 20,
    completions: buildCompletions([true, false, true, true, true, true, false]),
  },
];

const calculateStreak = (completions: Record<string, boolean>): number => {
  const completed = Object.entries(completions)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
    .reverse();
  if (completed.length === 0) return 0;
  const today = toIso(TODAY);
  const yest = new Date(TODAY);
  yest.setDate(TODAY.getDate() - 1);
  const yestStr = toIso(yest);
  if (completed[0] !== today && completed[0] !== yestStr) return 0;
  let streak = 1;
  for (let i = 1; i < completed.length; i++) {
    const diff = Math.round(
      (new Date(completed[i - 1]).getTime() - new Date(completed[i]).getTime()) / 86400000
    );
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

const PERIODS = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'all', label: 'Tout' },
];

const HabitTableShowcase: React.FC = () => {
  // Hardcoded surface tokens to match landing page dark theme
  const surface = 'rgba(30, 41, 59, 0.85)';
  const hoverBg = 'rgba(255,255,255,0.04)';
  const border = 'rgba(255,255,255,0.08)';
  const textPrimary = '#F1F5F9';
  const textSecondary = '#94A3B8';
  const textMuted = '#64748B';
  const accent = '#3B82F6';

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-2xl"
      style={{ backgroundColor: surface, borderColor: border }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 border-b"
        style={{ backgroundColor: hoverBg, borderColor: border }}
      >
        <div className="flex flex-row justify-between items-center gap-3">
          <h2 className="text-base font-semibold" style={{ color: textPrimary }}>
            Tableau de suivi
          </h2>

          {/* Period nav */}
          <div className="flex items-center gap-1.5">
            <button
              className="p-1.5 rounded-md border cursor-default"
              style={{ color: textSecondary, borderColor: border }}
            >
              <ChevronLeft size={14} />
            </button>
            <div
              className="text-xs font-medium min-w-[110px] text-center"
              style={{ color: textPrimary }}
            >
              Semaine du 20 avr.
            </div>
            <button
              className="p-1.5 rounded-md border cursor-default"
              style={{ color: textMuted, borderColor: border }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Period selector */}
          <div
            className="flex items-center rounded-lg p-0.5 shadow-sm border"
            style={{ backgroundColor: surface, borderColor: border }}
          >
            {PERIODS.map((opt) => (
              <div
                key={opt.value}
                className="px-2.5 py-1 rounded-md text-xs font-medium cursor-default"
                style={{
                  backgroundColor: opt.value === 'week' ? '#2563EB' : 'transparent',
                  color: opt.value === 'week' ? 'white' : textSecondary,
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b" style={{ borderColor: border }}>
            <tr>
              <th
                className="text-left p-3 font-semibold sticky left-0 z-20 min-w-[180px] border-r"
                style={{
                  color: textSecondary,
                  backgroundColor: surface,
                  borderColor: border,
                }}
              >
                Habitude
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className="text-center p-2 font-medium min-w-[44px]"
                  style={{ color: textSecondary }}
                >
                  <div className="text-[10px] mb-1" style={{ color: textMuted }}>
                    {day.dayName}
                  </div>
                  <div
                    className={`text-xs ${day.isToday ? 'font-bold' : ''}`}
                    style={{ color: day.isToday ? accent : textPrimary }}
                  >
                    {day.dayNumber}
                  </div>
                </th>
              ))}
              <th
                className="text-center p-3 font-semibold min-w-[70px] border-l"
                style={{ color: textSecondary, borderColor: border }}
              >
                Série
              </th>
            </tr>
          </thead>
          <tbody>
            {HABITS.map((habit, index) => (
              <tr
                key={habit.id}
                className="border-b"
                style={{
                  borderColor: border,
                  backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}
              >
                <td
                  className="p-3 sticky left-0 z-10 border-r"
                  style={{
                    borderColor: border,
                    backgroundColor: index % 2 === 0 ? surface : 'rgba(30, 41, 59, 0.92)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: habit.color }}
                    />
                    <div className="min-w-0">
                      <div
                        className="font-medium truncate text-sm leading-tight"
                        style={{ color: textPrimary }}
                      >
                        {habit.name}
                      </div>
                      <div
                        className="text-xs flex items-center gap-2 mt-0.5"
                        style={{ color: textSecondary }}
                      >
                        <span>{habit.estimatedTime} min</span>
                      </div>
                    </div>
                  </div>
                </td>
                {days.map((day) => {
                  const isCompleted = habit.completions[day.date];
                  return (
                    <td key={day.date} className="p-1 text-center">
                      <div
                        className="w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto"
                        style={{
                          backgroundColor: isCompleted
                            ? '#2563EB'
                            : day.isFuture
                            ? 'transparent'
                            : day.isToday
                            ? 'rgba(37, 99, 235, 0.08)'
                            : 'transparent',
                          borderColor: isCompleted
                            ? '#2563EB'
                            : day.isToday
                            ? '#2563EB'
                            : day.isFuture
                            ? 'transparent'
                            : border,
                          color: isCompleted ? 'white' : textSecondary,
                        }}
                      >
                        {isCompleted ? (
                          <CheckCircle size={14} />
                        ) : day.isFuture ? (
                          <Circle size={12} className="opacity-10" />
                        ) : (
                          <Circle size={14} className="opacity-30" />
                        )}
                      </div>
                    </td>
                  );
                })}
                <td
                  className="p-3 text-center border-l"
                  style={{ borderColor: border }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Flame size={14} className="text-orange-500" />
                    <span className="font-semibold text-sm" style={{ color: textPrimary }}>
                      {calculateStreak(habit.completions)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HabitTableShowcase;
