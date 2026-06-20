// Dashboard — refonte « test » AUDACIEUSE (desktop). Repensé autour de la
// journée : capture rapide, anneau de focus, timeline unifiée (events + tâches),
// bande de streaks d'habitudes. Réutilise UNIQUEMENT les hooks (aucune logique
// métier nouvelle, aucun widget d'origine réutilisé). DashboardPage inchangée.
import { useMemo, useState } from 'react';
import { FlaskConical, Plus, Check, CalendarClock, ListTodo, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks, useToggleTaskComplete, useCreateTask } from '@/modules/tasks';
import { useHabits, useToggleHabitCompletion } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useKRCompletions } from '@/modules/kr-completions';
import { useCategories } from '@/modules/categories';
import { computeStatCards } from './stats';
import { buildTodayTimeline, computeDailyFocus, computeStreak, dayKey } from './insights';

// ── Anneau radial de focus ──────────────────────────────────────────────────
function FocusRing({ pct, size = 168 }: { pct: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="text-muted" stroke="currentColor" opacity={0.25} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        stroke="hsl(var(--primary))"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ── Mini sparkline (tendance 7j) ────────────────────────────────────────────
function Spark({ data, color }: { data: { value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 96, h = 28;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d.value / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPageTest() {
  const { user } = useAuth();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: events = [] } = useEvents();
  const { data: krCompletions = [] } = useKRCompletions();
  const { data: categories = [] } = useCategories();
  const toggleTask = useToggleTaskComplete();
  const toggleHabit = useToggleHabitCompletion();
  const createTask = useCreateTask();

  const now = useMemo(() => new Date(), []);
  const today = dayKey(now);
  const [capture, setCapture] = useState('');

  const focus = useMemo(() => computeDailyFocus(tasks, habits, now), [tasks, habits, now]);
  const timeline = useMemo(() => buildTodayTimeline(events, tasks, now), [events, tasks, now]);
  const momentum = useMemo(() => computeStatCards('jour', tasks, events, habits, krCompletions, today), [tasks, events, habits, krCompletions, today]);

  const submitCapture = () => {
    const name = capture.trim();
    if (!name) return;
    const eod = new Date(now); eod.setHours(23, 59, 59, 0);
    createTask.mutate(
      { name, priority: 3, category: categories[0]?.id ?? '', deadline: eod.toISOString(), estimatedTime: 30, bookmarked: false, completed: false },
      { onSuccess: () => setCapture('') }
    );
  };

  const greeting = (() => {
    const h = now.getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      {/* En-tête */}
      <div className="mb-6">
        <div className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-medium">
          <FlaskConical className="size-3.5" aria-hidden="true" /> Mode test
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {user?.name ?? 'Utilisateur'}
        </h1>
      </div>

      {/* Hero : capture rapide + anneau de focus */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="flex flex-col justify-center">
          <CardContent className="py-6">
            <p className="text-muted-foreground mb-2 text-sm font-medium">Capture rapide</p>
            <div className="flex items-center gap-2">
              <Input
                value={capture}
                placeholder="Qu'as-tu à faire ? Tape et Entrée…"
                className="h-11 text-base"
                onChange={(e) => setCapture(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCapture(); }}
              />
              <Button type="button" size="lg" className="h-11" disabled={!capture.trim()} onClick={submitCapture}>
                <Plus aria-hidden="true" /> Ajouter
              </Button>
            </div>
            {/* Momentum 7 jours */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {momentum.map((m) => (
                <div key={m.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</span>
                    <Spark data={m.chartData} color={m.color} />
                  </div>
                  <span className="text-muted-foreground text-xs">{m.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:w-72">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="relative">
              <FocusRing pct={focus.pct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black tabular-nums">{focus.pct}%</span>
                <span className="text-muted-foreground text-xs">de la journée</span>
              </div>
            </div>
            <div className="flex gap-4 text-center text-xs">
              <div>
                <div className="text-foreground text-sm font-semibold">{focus.tasksDone}/{focus.tasksTotal}</div>
                <div className="text-muted-foreground">tâches</div>
              </div>
              <div>
                <div className="text-foreground text-sm font-semibold">{focus.habitsDone}/{focus.habitsTotal}</div>
                <div className="text-muted-foreground">habitudes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Corps : timeline du jour + streaks habitudes */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Timeline unifiée */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden="true" /> Aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Rien de prévu aujourd'hui. Profite-en ou capture une tâche ci-dessus.</p>
            ) : (
              <ol className="relative ml-1 border-l pl-4">
                {timeline.map((item) => (
                  <li key={item.id} className="relative mb-3 last:mb-0">
                    <span
                      className="bg-background absolute -left-[21px] top-1 size-2.5 rounded-full ring-2"
                      style={{ color: item.color ?? 'hsl(var(--primary))', backgroundColor: item.color ?? 'hsl(var(--primary))' }}
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">{item.timeLabel}</span>
                      {item.kind === 'task' ? (
                        <button
                          type="button"
                          onClick={() => toggleTask.mutate(item.id.replace('task-', ''))}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', item.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                            {item.completed && <Check className="size-3" aria-hidden="true" />}
                          </span>
                          <span className={cn('truncate text-sm', item.completed && 'text-muted-foreground line-through')}>{item.title}</span>
                          <ListTodo className="text-muted-foreground ml-auto size-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate text-sm font-medium">{item.title}</span>
                          <CalendarClock className="text-muted-foreground ml-auto size-3.5 shrink-0" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Streaks d'habitudes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-4" aria-hidden="true" /> Habitudes &amp; séries
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {habits.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Aucune habitude.</p>}
            {habits.map((h) => {
              const doneToday = !!h.completions[today];
              const streak = computeStreak(h.completions, now);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHabit.mutate({ id: h.id, date: today })}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                    doneToday ? 'border-transparent' : 'border-border hover:bg-muted'
                  )}
                  style={doneToday ? { backgroundColor: (h.color || '#6366f1') + '22' } : undefined}
                >
                  <span
                    className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-white transition', !doneToday && 'opacity-30')}
                    style={{ backgroundColor: h.color || '#6366f1' }}
                  >
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.name}</span>
                  {streak > 0 && (
                    <span className="text-amber-500 inline-flex items-center gap-0.5 text-xs font-semibold">
                      <Flame className="size-3.5" aria-hidden="true" /> {streak}
                    </span>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
