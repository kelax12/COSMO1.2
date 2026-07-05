// Charts recharts du dashboard admin — SEUL fichier de la zone admin qui
// importe recharts (règle P-2 : chargé via React.lazy depuis AdminPage,
// le chunk vendor-charts reste hors critical path).
import React from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export interface AdminChartPoint {
  label: string;
  [serie: string]: string | number;
}

/** Point simple label/valeur pour les barres et donuts des sections KPI. */
export interface LabeledValue {
  label: string;
  value: number;
  /** Détail affiché dans le tooltip (ex. « 7/19 utilisateurs »). */
  hint?: string;
}

const PALETTE = ['#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#ef4444', '#06b6d4'];

/** Tooltip minimal thémé CSS vars (pattern StatisticsPage). */
const SimpleTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: LabeledValue & { value: number } }>;
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg text-sm"
      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
    >
      <p className="text-xs mb-0.5 font-medium" style={{ color: 'rgb(var(--color-text-muted))' }}>{p.label}</p>
      <p className="font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{p.hint ?? p.value}</p>
    </div>
  );
};

const simpleTooltipContent = SimpleTooltip as unknown as React.ComponentProps<typeof ChartTooltip>['content'];

const barsConfig = { value: { label: 'Valeur', color: '#3b82f6' } } satisfies ChartConfig;

/** Barres horizontales de pourcentages (0-100). */
export const PercentBars: React.FC<{ data: LabeledValue[]; color?: string }> = ({ data, color = '#3b82f6' }) => (
  <ChartContainer config={barsConfig} className="h-[260px] w-full" style={{ aspectRatio: 'auto' }}>
    <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 0 }}>
      <CartesianGrid horizontal={false} />
      <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} />
      <YAxis type="category" dataKey="label" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
      <ChartTooltip cursor={false} content={simpleTooltipContent} />
      <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} maxBarSize={26} />
    </BarChart>
  </ChartContainer>
);

/** Barres verticales de volumes bruts. */
export const CountBars: React.FC<{ data: LabeledValue[]; color?: string }> = ({ data, color = '#3b82f6' }) => (
  <ChartContainer config={barsConfig} className="h-[260px] w-full" style={{ aspectRatio: 'auto' }}>
    <BarChart data={data} margin={{ left: 4, right: 12, top: 16, bottom: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} interval={0} />
      <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
      <ChartTooltip cursor={false} content={simpleTooltipContent} />
      <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={48}>
        {data.map((_, i) => (
          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </Bar>
    </BarChart>
  </ChartContainer>
);

/** Donut de répartition avec légende custom sous le graphe. */
export const Donut: React.FC<{ data: LabeledValue[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center">
      <ChartContainer config={barsConfig} className="h-[200px] w-full" style={{ aspectRatio: 'auto' }}>
        <PieChart>
          <ChartTooltip cursor={false} content={simpleTooltipContent} />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} strokeWidth={2} stroke="rgb(var(--color-surface))">
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {data.map((d, i) => (
          <span key={d.label} className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            {d.label} — <strong style={{ color: 'rgb(var(--color-text-primary))' }}>{d.value}</strong>
            {total > 0 && <span style={{ color: 'rgb(var(--color-text-muted))' }}>({Math.round((100 * d.value) / total)}%)</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

const signupsConfig = {
  nouveaux: { label: 'Nouveaux comptes', color: '#22c55e' },
  total: { label: 'Total comptes', color: '#3b82f6' },
} satisfies ChartConfig;

const dauConfig = {
  actifs: { label: 'Utilisateurs actifs', color: '#8b5cf6' },
} satisfies ChartConfig;

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

/** Croissance : total de comptes (aire cumulée) + nouveaux comptes (barres). */
export const SignupsChart: React.FC<{ data: AdminChartPoint[] }> = ({ data }) => (
  <ChartContainer config={signupsConfig} className="h-[260px] w-full" style={{ aspectRatio: 'auto' }}>
    <ComposedChart data={data} margin={{ left: 4, right: 12, top: 16, bottom: 0 }}>
      <defs>
        <linearGradient id="adminTotalFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.3} />
          <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" {...axisProps} minTickGap={24} />
      <YAxis {...axisProps} width={36} allowDecimals={false} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
      <Bar dataKey="nouveaux" fill="var(--color-nouveaux)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      <Area
        dataKey="total"
        type="monotone"
        fill="url(#adminTotalFill)"
        fillOpacity={1}
        stroke="var(--color-total)"
        strokeWidth={2.5}
        dot={false}
        activeDot={{ r: 5, strokeWidth: 2 }}
      />
    </ComposedChart>
  </ChartContainer>
);

/** Activité : utilisateurs actifs par période (DAU, zéro-fillé). */
export const DauChart: React.FC<{ data: AdminChartPoint[] }> = ({ data }) => (
  <ChartContainer config={dauConfig} className="h-[260px] w-full" style={{ aspectRatio: 'auto' }}>
    <ComposedChart data={data} margin={{ left: 4, right: 12, top: 16, bottom: 0 }}>
      <defs>
        <linearGradient id="adminDauFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--color-actifs)" stopOpacity={0.35} />
          <stop offset="95%" stopColor="var(--color-actifs)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" {...axisProps} minTickGap={24} />
      <YAxis {...axisProps} width={36} allowDecimals={false} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
      <Area
        dataKey="actifs"
        type="monotone"
        fill="url(#adminDauFill)"
        fillOpacity={1}
        stroke="var(--color-actifs)"
        strokeWidth={2.5}
        dot={false}
        activeDot={{ r: 5, strokeWidth: 2 }}
      />
    </ComposedChart>
  </ChartContainer>
);
