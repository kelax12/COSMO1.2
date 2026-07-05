// Charts recharts du dashboard admin — SEUL fichier de la zone admin qui
// importe recharts (règle P-2 : chargé via React.lazy depuis AdminPage,
// le chunk vendor-charts reste hors critical path).
import React from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
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
