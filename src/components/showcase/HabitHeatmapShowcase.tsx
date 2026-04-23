import React, { useMemo } from 'react';
import { Flame, TrendingUp } from 'lucide-react';

const HABITS_STATIC = [
  { name: 'Méditation Matinale', icon: '🧘', color: '#3B82F6', rate: 0.85, streak: 21 },
  { name: 'Lecture du soir', icon: '📚', color: '#8B5CF6', rate: 0.72, streak: 8 },
  { name: 'Hydratation (2L/j)', icon: '💧', color: '#10B981', rate: 0.91, streak: 34 },
  { name: 'Sport 3×/semaine', icon: '🏋️', color: '#F59E0B', rate: 0.68, streak: 5 },
];

const WEEKS = 18;
const DAYS = 7;
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function buildCompletions(rate: number, habitIdx: number): boolean[][] {
  const grid: boolean[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: boolean[] = [];
    for (let d = 0; d < DAYS; d++) {
      const dayOffset = (WEEKS - 1 - w) * 7 + (DAYS - 1 - d);
      const cellDate = new Date(TODAY);
      cellDate.setDate(cellDate.getDate() - dayOffset);
      if (cellDate > TODAY) {
        week.push(false);
      } else {
        week.push(seededRandom(habitIdx * 1000 + w * 7 + d) < rate);
      }
    }
    grid.push(week);
  }
  return grid;
}

const HabitHeatmapShowcase: React.FC = () => {
  const grids = useMemo(() =>
    HABITS_STATIC.map((h, i) => buildCompletions(h.rate, i)),
    []
  );

  return (
    <div className="w-full space-y-3">
      {HABITS_STATIC.map((habit, hi) => (
        <div
          key={hi}
          className="rounded-2xl bg-slate-800/80 border border-white/10 px-4 py-3 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-lg leading-none">{habit.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{habit.name}</p>
                <p className="text-slate-500 text-xs">{Math.round(habit.rate * 100)}% ce mois</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-orange-400 text-xs font-bold">
                <Flame size={13} className="fill-orange-400" />
                {habit.streak}
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: habit.color }}>
                <TrendingUp size={12} />
                {Math.round(habit.rate * 100)}%
              </div>
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-[3px]">
            {grids[hi].map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((done, di) => {
                  const dayOffset = (WEEKS - 1 - wi) * 7 + (DAYS - 1 - di);
                  const isFuture = dayOffset < 0;
                  return (
                    <div
                      key={di}
                      className="w-3 h-3 rounded-[2px] flex-shrink-0"
                      style={{
                        backgroundColor: isFuture
                          ? 'transparent'
                          : done
                          ? habit.color
                          : 'rgba(255,255,255,0.06)',
                        opacity: isFuture ? 0 : done ? 1 : 0.7,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HabitHeatmapShowcase;
