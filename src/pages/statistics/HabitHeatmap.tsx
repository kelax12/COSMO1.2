// ═══════════════════════════════════════════════════════════════════
// statistics/HabitHeatmap — calendrier de complétion des habitudes (26 sem.).
// Extrait verbatim de statistics/sections.tsx (god-component refactor).
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Habit } from '@/modules/habits';
import { getLocalDateString } from '../../lib/workTimeCalculator';

export const HabitHeatmap = React.memo<{ habits: Habit[]; now: Date; embedded?: boolean }>(({ habits, now, embedded = false }) => {
  const WEEKS = 26;
  const GAP = embedded ? 3 : 2;
  const MONTH_W = embedded ? 24 : 14;
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(embedded ? 28 : 13);
  const CELL = cellSize;

  useEffect(() => {
    if (embedded) return;
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w > 0) {
        const size = Math.min(42, Math.floor((w - 14 - 7 * 2) / 7));
        setCellSize(Math.max(13, size));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded]);

  const { weeks, monthLabelMap } = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - (WEEKS * 7 - 1));
    const dow = firstDay.getDay();
    firstDay.setDate(firstDay.getDate() + (dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow));

    const allCells: { date: Date; dateStr: string; completed: number; total: number; rate: number; isFuture: boolean }[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + i);
      const dateStr = getLocalDateString(date);
      const isFuture = date > today;

      const activeHabits = habits.filter(h => {
        if (!h.createdAt) return true;
        const created = new Date(h.createdAt);
        const cn = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        return date >= cn;
      });

      const completed = isFuture ? 0 : activeHabits.filter(h => h.completions[dateStr] === true).length;
      const rate = isFuture ? -1 : activeHabits.length > 0 ? completed / activeHabits.length : -1;
      allCells.push({ date, dateStr, completed, total: activeHabits.length, rate, isFuture });
    }

    const result: typeof allCells[] = [];
    for (let w = 0; w < WEEKS; w++) {
      result.push(allCells.slice(w * 7, (w + 1) * 7));
    }
    result.reverse();
    const mMap = new Map<number, string>();
    for (let w = 0; w < WEEKS; w++) {
      const firstOfMonth = result[w].find(c => c.date.getDate() === 1);
      if (firstOfMonth) {
        mMap.set(w, firstOfMonth.date.toLocaleDateString('fr-FR', { month: 'short' }));
      }
    }
    return { weeks: result, monthLabelMap: mMap };
  }, [habits, now]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [weeks]);

  const getCellColor = (rate: number) => {
    if (rate < 0) return 'transparent';
    if (rate === 0) return 'rgba(234,179,8,0.08)';
    if (rate <= 0.25) return 'rgba(234,179,8,0.30)';
    if (rate <= 0.5) return 'rgba(234,179,8,0.55)';
    if (rate <= 0.75) return 'rgba(234,179,8,0.78)';
    return '#EAB308';
  };

  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const renderTooltip = (cell: { completed: number; total: number; date: Date }) => (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
      style={{ backgroundColor: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
    >
      <div className="text-[10px] font-bold text-center">{cell.completed}/{cell.total}</div>
      <div className="text-[9px] font-normal text-center mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
        {cell.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </div>
    </div>
  );

  const legend = (
    <div className="flex items-center gap-1.5 mt-3 justify-end flex-shrink-0">
      <span className="text-[9px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>Moins</span>
      {[0, 0.26, 0.51, 0.76, 1].map((r, i) => (
        <div key={i} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: getCellColor(r), border: '1px solid rgba(234,179,8,0.15)', flexShrink: 0 }} />
      ))}
      <span className="text-[9px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>Plus</span>
    </div>
  );

  // Vertical layout (rows = weeks, cols = days)
  const grid = (scrollClass: string) => (
    <>
      {/* Day headers */}
      <div className="flex flex-shrink-0" style={{ gap: GAP, paddingLeft: MONTH_W + GAP, marginBottom: GAP }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ width: CELL, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-[8px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>{d}</span>
          </div>
        ))}
      </div>
      {/* Scrollable weeks (rows) */}
      <div ref={scrollRef} className={scrollClass}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', gap: GAP, alignItems: 'center', flexShrink: 0 }}>
              {/* Month label */}
              <div style={{ width: MONTH_W, height: CELL, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {monthLabelMap.has(wi) && (
                  <span className="text-[8px] font-semibold leading-none select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    {monthLabelMap.get(wi)}
                  </span>
                )}
              </div>
              {/* Day cells */}
              {week.map((cell, di) => (
                <div key={di} className="relative group" style={{ width: CELL, height: CELL, flexShrink: 0 }}>
                  <div
                    className="w-full h-full rounded-[3px] transition-transform duration-100 group-hover:scale-110"
                    style={{ backgroundColor: getCellColor(cell.rate), border: `1px solid ${cell.isFuture ? 'transparent' : 'rgba(234,179,8,0.15)'}` }}
                  />
                  {!cell.isFuture && cell.rate >= 0 && renderTooltip(cell)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {grid('overflow-y-auto flex-1 min-h-0')}
        {legend}
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>
        Calendrier de complétion
      </h3>
      <div ref={wrapperRef}>
        {grid('overflow-y-auto')}
      </div>
      {legend}
    </div>
  );
});
