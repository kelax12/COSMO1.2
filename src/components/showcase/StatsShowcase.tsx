import React from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_DATA = [
  { label: 'LUN', tasks: 95, events: 60, okrs: 40, habits: 25 },
  { label: 'MAR', tasks: 130, events: 90, okrs: 0, habits: 45 },
  { label: 'MER', tasks: 80, events: 120, okrs: 80, habits: 30 },
  { label: 'JEU', tasks: 160, events: 45, okrs: 40, habits: 60 },
  { label: 'VEN', tasks: 110, events: 75, okrs: 0, habits: 45 },
  { label: 'SAM', tasks: 45, events: 30, okrs: 0, habits: 20 },
  { label: 'DIM', tasks: 30, events: 15, okrs: 0, habits: 15 },
];

const LEGEND = [
  { key: 'tasks', label: 'Tâches', color: '#3B82F6' },
  { key: 'events', label: 'Agenda', color: '#EF4444' },
  { key: 'okrs', label: 'OKR', color: '#22C55E' },
  { key: 'habits', label: 'Habitudes', color: '#EAB308' },
];

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl text-xs min-w-[140px]">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: p.color }} />
            <span className="text-slate-300">{LEGEND.find(l => l.key === p.name)?.label ?? p.name}</span>
          </div>
          <span className="font-mono font-bold text-white">{fmtMin(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-white/10 mt-2 pt-2 flex justify-between">
        <span className="text-slate-400 font-semibold">Total</span>
        <span className="font-mono font-bold text-white">{fmtMin(total)}</span>
      </div>
    </div>
  );
};

const StatsShowcase: React.FC = () => (
  <div className="w-full rounded-2xl overflow-hidden bg-slate-800/80 border border-white/10 shadow-2xl p-5">
    {/* Header */}
    <div className="flex items-center justify-between mb-5">
      <div>
        <h3 className="text-white font-bold text-base">Répartition du temps</h3>
        <p className="text-slate-500 text-xs mt-0.5">7 derniers jours</p>
      </div>
      <div className="flex items-center gap-3">
        {LEGEND.map(l => (
          <div key={l.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: l.color }} />
            <span className="text-slate-400 text-xs font-medium">{l.label}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Chart */}
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={CHART_DATA} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.15} stroke="#fff" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fontWeight: 600, fill: '#94A3B8' }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="tasks"  stackId="a" fill="#3B82F6" radius={[0,0,0,0]} />
        <Bar dataKey="events" stackId="a" fill="#EF4444" radius={[0,0,0,0]} />
        <Bar dataKey="okrs"   stackId="a" fill="#22C55E" radius={[0,0,0,0]} />
        <Bar dataKey="habits" stackId="a" fill="#EAB308" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>

    {/* Summary row */}
    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
      {LEGEND.map(l => {
        const total = CHART_DATA.reduce((s, d) => s + (d as Record<string, number>)[l.key], 0);
        return (
          <div key={l.key} className="text-center">
            <p className="text-xs font-bold" style={{ color: l.color }}>{fmtMin(total)}</p>
            <p className="text-slate-500 text-xs mt-0.5">{l.label}</p>
          </div>
        );
      })}
    </div>
  </div>
);

export default StatsShowcase;
