// Accès aux stats admin — RPC get_admin_stats() (migration 056).
// La frontière de sécurité est côté serveur (RAISE 42501 si non-admin) ;
// ici on ne fait que mapper le jsonb snake_case → camelCase (whitelist
// champ par champ, jamais de spread) et traduire le 42501 en
// AdminForbiddenError pour que la page redirige silencieusement.
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { AdminStats, DailyPoint } from './types';

/** Signal de routing (compte non admin) — jamais toasté ni affiché. */
export class AdminForbiddenError extends Error {
  constructor() {
    super('forbidden');
    this.name = 'AdminForbiddenError';
  }
}

interface RawDailyPoint {
  day?: string;
  count?: number;
}

interface RawAdminStats {
  generated_at?: string;
  totals?: {
    users?: number;
    active_today?: number;
    active_7d?: number;
    inactive_7d_plus?: number;
  };
  signups_by_day?: RawDailyPoint[];
  dau?: RawDailyPoint[];
  demo?: { visitors?: number; converted?: number; conversion_pct?: number };
  usage?: {
    tasks?: number;
    habits?: number;
    events?: number;
    okrs?: number;
    shared_tasks?: number;
  };
}

function mapDailyPoints(raw: RawDailyPoint[] | undefined): DailyPoint[] {
  return (raw ?? []).map((p) => ({ day: p.day ?? '', count: p.count ?? 0 }));
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) {
    if (error.code === '42501') throw new AdminForbiddenError();
    throw normalizeApiError(error);
  }
  const raw = (data ?? {}) as RawAdminStats;
  return {
    generatedAt: raw.generated_at ?? '',
    totals: {
      users: raw.totals?.users ?? 0,
      activeToday: raw.totals?.active_today ?? 0,
      active7d: raw.totals?.active_7d ?? 0,
      inactive7dPlus: raw.totals?.inactive_7d_plus ?? 0,
    },
    signupsByDay: mapDailyPoints(raw.signups_by_day),
    dau: mapDailyPoints(raw.dau),
    demo: {
      visitors: raw.demo?.visitors ?? 0,
      converted: raw.demo?.converted ?? 0,
      conversionPct: Number(raw.demo?.conversion_pct ?? 0),
    },
    usage: {
      tasks: raw.usage?.tasks ?? 0,
      habits: raw.usage?.habits ?? 0,
      events: raw.usage?.events ?? 0,
      okrs: raw.usage?.okrs ?? 0,
      sharedTasks: raw.usage?.shared_tasks ?? 0,
    },
  };
}
