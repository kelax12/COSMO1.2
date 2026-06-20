// Statistiques — refonte « test » centrée UX (desktop). La heatmap devient un
// SÉLECTEUR de période par manipulation directe : clic = ancre, 2ᵉ clic = plage ;
// toute la page recalcule sur la sélection. Drill-down jour + insights auto.
// 100% custom, réutilise les hooks + calculateWorkTimeForPeriod. Page d'origine
// inchangée ; light/dark intacts.
import { useMemo, useState } from 'react';
import { FlaskConical, Lock, ListTodo, CalendarClock, Repeat, RotateCcw, MousePointerClick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTasks } from '@/modules/tasks';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import { useHabits } from '@/modules/habits';
import { useBilling } from '@/modules/billing/billing.context';
import PremiumGateModal from '@/components/PremiumGateModal';
import { formatTime, formatTimeShort } from '@/pages/statistics/format';
import {
  computeDailyTotals, computeAllocation, weekdayRhythm, buildInsights, dayDetail, dayKey,
  type DayCell,
} from './insights';

const HEATMAP_DAYS = 112;
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ALLOC = [
  { key: 'tasks', label: 'Tâches', color: '#3b82f6' },
  { key: 'agenda', label: 'Agenda', color: '#ef4444' },
  { key: 'habits', label: 'Habitudes', color: '#eab308' },
  { key: 'okr', label: 'OKR', color: '#22c55e' },
] as const;
const ACCENT = '#8b5cf6';
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${a})`; };
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// ── Heatmap interactive (sélecteur de plage) ────────────────────────────────
function InteractiveHeatmap({
  cells, selStart, selEnd, anchor, onPick, hoverCell, setHoverCell,
}: {
  cells: DayCell[];
  selStart: Date; selEnd: Date; anchor: Date | null;
  onPick: (d: Date) => void;
  hoverCell: DayCell | null;
  setHoverCell: (c: DayCell | null) => void;
}) {
  const max = Math.max(...cells.map((c) => c.minutes), 1);
  const cell = 15, gap = 3;
  const firstWdMon = (cells[0].date.getDay() + 6) % 7;
  const cols = Math.ceil((firstWdMon + cells.length) / 7);
  const w = cols * (cell + gap), h = 7 * (cell + gap);
  const level = (m: number) => (m === 0 ? 0 : Math.min(4, Math.ceil((m / max) * 4)));
  const fill = (m: number) => (m === 0 ? rgba('#ffffff', 0.06) : rgba(ACCENT, 0.2 + (level(m) / 4) * 0.8));
  const s0 = startOfDay(selStart).getTime(), e0 = endOfDay(selEnd).getTime();
  const inSel = (d: Date) => d.getTime() >= s0 && d.getTime() <= e0;

  return (
    <div className="relative overflow-x-auto pb-1">
      <svg width={w} height={h} className="min-w-full">
        {cells.map((c, i) => {
          const col = Math.floor((firstWdMon + i) / 7);
          const row = (c.date.getDay() + 6) % 7;
          const selected = inSel(c.date);
          const isAnchor = anchor && sameDay(anchor, c.date);
          return (
            <rect
              key={c.key}
              x={col * (cell + gap)} y={row * (cell + gap)}
              width={cell} height={cell} rx={3}
              fill={fill(c.minutes)}
              stroke={isAnchor ? '#fff' : selected ? rgba(ACCENT, 0.9) : 'transparent'}
              strokeWidth={isAnchor ? 2 : selected ? 1.5 : 0}
              className="cursor-pointer"
              onClick={() => onPick(c.date)}
              onMouseEnter={() => setHoverCell(c)}
              onMouseLeave={() => setHoverCell(null)}
            />
          );
        })}
      </svg>
      {hoverCell && (
        <div className="bg-popover text-popover-foreground border-border pointer-events-none absolute left-2 top-2 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg">
          <div className="text-muted-foreground">{hoverCell.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <div className="font-bold">{hoverCell.minutes > 0 ? formatTime(hoverCell.minutes) : 'Rien'}</div>
        </div>
      )}
    </div>
  );
}

function Donut({ alloc }: { alloc: ReturnType<typeof computeAllocation> }) {
  const size = 150, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const total = alloc.total || 1; let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={rgba('#ffffff', 0.06)} />
        {ALLOC.map((a) => {
          const val = alloc[a.key]; if (val <= 0) return null;
          const frac = val / total; const dash = `${frac * c} ${c}`; const offset = -acc * c; acc += frac;
          return <circle key={a.key} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={a.color} strokeDasharray={dash} strokeDashoffset={offset} />;
        })}
      </svg>
      <div className="grid gap-1.5">
        {ALLOC.map((a) => {
          const val = alloc[a.key]; const pct = alloc.total > 0 ? Math.round((val / alloc.total) * 100) : 0;
          return (
            <div key={a.key} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="w-20">{a.label}</span>
              <span className="text-muted-foreground tabular-nums">{formatTimeShort(val)} · {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRESETS = [{ d: 7, label: '7 j' }, { d: 30, label: '30 j' }, { d: 90, label: '90 j' }];

export default function StatisticsPageTest() {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  const { data: habits = [] } = useHabits();
  const { isPremium } = useBilling();
  const [gateOpen, setGateOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const data = useMemo(() => ({ tasks, events, habits, okrs }), [tasks, events, habits, okrs]);
  const cells = useMemo(() => computeDailyTotals(data, now, HEATMAP_DAYS), [data, now]);

  // Sélection par défaut : 30 derniers jours.
  const defStart = useMemo(() => { const d = new Date(now); d.setDate(d.getDate() - 29); return startOfDay(d); }, [now]);
  const [selStart, setSelStart] = useState(defStart);
  const [selEnd, setSelEnd] = useState(() => endOfDay(now));
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [hoverCell, setHoverCell] = useState<DayCell | null>(null);

  const pick = (d: Date) => {
    if (!anchor) { setAnchor(d); setSelStart(startOfDay(d)); setSelEnd(endOfDay(d)); return; }
    const a = anchor.getTime() <= d.getTime() ? anchor : d;
    const b = anchor.getTime() <= d.getTime() ? d : anchor;
    setSelStart(startOfDay(a)); setSelEnd(endOfDay(b)); setAnchor(null);
  };
  const applyPreset = (days: number) => {
    const s = new Date(now); s.setDate(s.getDate() - (days - 1));
    setSelStart(startOfDay(s)); setSelEnd(endOfDay(now)); setAnchor(null);
  };

  const alloc = useMemo(() => computeAllocation(data, selStart, selEnd), [data, selStart, selEnd]);
  const rhythm = useMemo(() => weekdayRhythm(cells, selStart, selEnd), [cells, selStart, selEnd]);
  const insights = useMemo(() => buildInsights(data, cells, selStart, selEnd), [data, cells, selStart, selEnd]);
  const isSingleDay = sameDay(selStart, selEnd);
  const detail = useMemo(() => (isSingleDay ? dayDetail(data, selStart) : null), [isSingleDay, data, selStart]);
  const maxRhythm = Math.max(...rhythm, 1);

  const rangeLabel = isSingleDay
    ? selStart.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : `${selStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${selEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

  const premium = isPremium();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <div className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-medium">
          <FlaskConical className="size-3.5" aria-hidden="true" /> Mode test
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Statistiques</h1>
        <p className="text-muted-foreground mt-1 text-sm">Explore ton rythme : clique un jour, ou deux pour définir une période.</p>
      </div>

      {!premium ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="bg-amber-500/15 text-amber-500 flex size-12 items-center justify-center rounded-xl"><Lock className="size-6" aria-hidden="true" /></div>
            <h3 className="text-lg font-semibold">Analyses détaillées</h3>
            <p className="text-muted-foreground max-w-sm text-sm">Accède à l'exploration interactive avec un compte Premium.</p>
            <Button type="button" size="lg" onClick={() => setGateOpen(true)}>Débloquer — pub ou abonnement</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {/* Heatmap sélecteur */}
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Rythme — 16 semaines</CardTitle>
                <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-xs">
                  <MousePointerClick className="size-3.5" aria-hidden="true" />
                  {anchor ? 'Clique un 2ᵉ jour pour clore la période…' : 'Sélection :'} <span className="text-foreground font-medium">{rangeLabel}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {PRESETS.map((p) => (
                  <Button key={p.d} type="button" variant="outline" size="sm" onClick={() => applyPreset(p.d)}>{p.label}</Button>
                ))}
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Réinitialiser (30 j)" onClick={() => applyPreset(30)}>
                  <RotateCcw aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <InteractiveHeatmap cells={cells} selStart={selStart} selEnd={selEnd} anchor={anchor} onPick={pick} hoverCell={hoverCell} setHoverCell={setHoverCell} />
              <div className="text-muted-foreground mt-3 flex items-center justify-end gap-1.5 text-xs">
                <span>Moins</span>
                {[0, 1, 2, 3, 4].map((l) => <span key={l} className="size-3 rounded-[3px]" style={{ backgroundColor: l === 0 ? rgba('#ffffff', 0.06) : rgba(ACCENT, 0.2 + (l / 4) * 0.8) }} />)}
                <span>Plus</span>
              </div>
            </CardContent>
          </Card>

          {/* Total sélection + insights */}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader><CardTitle>Où part ton temps · <span className="text-muted-foreground font-normal">{rangeLabel}</span></CardTitle></CardHeader>
              <CardContent>
                {alloc.total > 0 ? <Donut alloc={alloc} /> : <p className="text-muted-foreground py-6 text-center text-sm">Aucun temps sur cette sélection.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Insights</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {insights.map((t, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg px-3 py-2 text-sm">{t}</div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Drill-down jour OU rythme hebdo */}
          {isSingleDay && detail ? (
            <Card>
              <CardHeader><CardTitle>Détail du {rangeLabel}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <DetailCol icon={ListTodo} title="Tâches complétées" color="#3b82f6" items={detail.tasks.map((t) => t.name)} />
                <DetailCol icon={CalendarClock} title="Agenda" color="#ef4444" items={detail.events.map((e) => `${e.time} · ${e.title}`)} />
                <DetailCol icon={Repeat} title="Habitudes" color="#eab308" items={detail.habits.map((h) => h.name)} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Rythme par jour de semaine</CardTitle></CardHeader>
              <CardContent>
                <div className="flex h-40 items-end justify-between gap-2">
                  {rhythm.map((m, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t" style={{ height: `${(m / maxRhythm) * 100}%`, backgroundColor: ACCENT, minHeight: m > 0 ? 4 : 0 }} title={formatTimeShort(m)} />
                      </div>
                      <span className="text-muted-foreground text-xs">{WEEKDAYS[i]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <PremiumGateModal isOpen={gateOpen} onClose={() => setGateOpen(false)} featureName="les analyses détaillées" />
    </div>
  );
}

function DetailCol({ icon: Icon, title, color, items }: { icon: typeof ListTodo; title: string; color: string; items: string[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" style={{ color }} />
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="outline" className="ml-auto">{items.length}</Badge>
      </div>
      <Separator className="mb-2" />
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">—</p>
      ) : (
        <ul className="grid gap-1">
          {items.map((it, i) => <li key={i} className="text-muted-foreground truncate text-sm">{it}</li>)}
        </ul>
      )}
    </div>
  );
}
