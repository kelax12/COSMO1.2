import { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ListTodo, CheckCircle2, AlertTriangle, Target } from 'lucide-react';
import { isPast, isToday, parseISO } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useTeamTasks } from '@/modules/team-projects';
import { useTeamOKRs, type TeamKeyResult } from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';

interface TeamOverviewTabProps {
  orgId: string;
  members: OrgMember[];
}

const chartConfig = {
  open: { label: 'Tâches ouvertes', color: '#6366f1' },
} satisfies ChartConfig;

const firstName = (name: string) => name.split(' ')[0];

const krProgress = (kr: TeamKeyResult): number => {
  if (kr.completed) return 1;
  if (kr.targetValue <= 0) return 0;
  return Math.max(0, Math.min(1, kr.currentValue / kr.targetValue));
};

const StatCard = ({ Icon, label, value, tone }: { Icon: typeof ListTodo; label: string; value: string; tone: string }) => (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${tone}`}>
      <Icon size={18} aria-hidden="true" />
    </div>
    <p className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">{value}</p>
    <p className="text-xs text-[rgb(var(--color-text-muted))]">{label}</p>
  </div>
);

/**
 * Tableau de bord de l'équipe — dérivé côté client des tâches et OKR de l'org :
 * charge par membre, retards, taux de complétion, progression OKR moyenne.
 */
const TeamOverviewTab = ({ orgId, members }: TeamOverviewTabProps) => {
  const { data: tasks = [] } = useTeamTasks(orgId);
  const { data: okrs = [] } = useTeamOKRs(orgId);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const overdue = tasks.filter((t) => {
      if (t.completed || !t.deadline) return false;
      const d = parseISO(t.deadline);
      return isPast(d) && !isToday(d);
    });
    const allKRs = okrs.flatMap((o) => o.keyResults);
    const okrProgress = allKRs.length
      ? Math.round((allKRs.reduce((s, kr) => s + krProgress(kr), 0) / allKRs.length) * 100)
      : 0;
    return {
      total,
      completed,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      overdue,
      okrProgress,
    };
  }, [tasks, okrs]);

  // Charge par membre : tâches ouvertes assignées (barres triées desc).
  const loadByMember = useMemo(() => {
    const openByAssignee = new Map<string, number>();
    for (const t of tasks) {
      if (t.completed || !t.assigneeId) continue;
      openByAssignee.set(t.assigneeId, (openByAssignee.get(t.assigneeId) ?? 0) + 1);
    }
    return members
      .map((m) => ({ name: firstName(m.displayName), open: openByAssignee.get(m.userId) ?? 0 }))
      .sort((a, b) => b.open - a.open);
  }, [tasks, members]);

  return (
    <div className="space-y-5">
      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard Icon={ListTodo} label="Tâches au total" value={String(stats.total)} tone="bg-blue-500/10 text-blue-500" />
        <StatCard Icon={CheckCircle2} label="Complétées" value={`${stats.completionRate}%`} tone="bg-green-500/10 text-green-500" />
        <StatCard Icon={AlertTriangle} label="En retard" value={String(stats.overdue.length)} tone="bg-red-500/10 text-red-500" />
        <StatCard Icon={Target} label="Progression OKR" value={`${stats.okrProgress}%`} tone="bg-indigo-500/10 text-indigo-500" />
      </div>

      {/* Charge par membre */}
      <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-4">Charge par membre (tâches ouvertes)</h3>
        {loadByMember.every((d) => d.open === 0) ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))] py-6 text-center">Aucune tâche ouverte assignée.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={loadByMember} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeOpacity={0.4} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={70} tick={{ fontSize: 11, fontWeight: 600 }} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="open" fill="var(--color-open)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </div>

      {/* Retards */}
      {stats.overdue.length > 0 && (
        <div className="rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/50 dark:bg-red-900/10 p-4">
          <h3 className="text-sm font-bold text-red-600 dark:text-red-400 mb-3 inline-flex items-center gap-1.5">
            <AlertTriangle size={15} aria-hidden="true" /> Tâches en retard ({stats.overdue.length})
          </h3>
          <ul className="space-y-1.5">
            {stats.overdue.slice(0, 6).map((t) => {
              const assignee = members.find((m) => m.userId === t.assigneeId);
              return (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--color-text-primary))] truncate">{t.name}</span>
                  {assignee && <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0 ml-3">{firstName(assignee.displayName)}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TeamOverviewTab;
