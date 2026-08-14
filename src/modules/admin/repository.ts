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
    inactive_30d_plus?: number;
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
  signups_by_provider?: Record<string, number>;
  adoption?: {
    tasks_users?: number;
    habits_users?: number;
    events_users?: number;
    okrs_users?: number;
  };
  activation_24h?: { activated?: number; total?: number };
  tasks_completion?: { completed?: number; total?: number };
  collaboration?: {
    sharers?: number;
    users_with_friends?: number;
    accepted_requests?: number;
  };
  retention_j7?: Array<{ week?: string; signups?: number; retained?: number }>;
  stickiness?: { dau?: number; mau?: number };
  // ── v3 (mig. 099) ───────────────────────────────────────────────────
  signups_by_source?: Record<string, number>;
  signups_by_source_by_day?: Array<{ day?: string; source?: string; count?: number }>;
  activation_48h?: {
    activated?: number;
    total?: number;
    by_source?: Record<string, { activated?: number; total?: number }>;
  };
  retention_d7_by_source?: Record<string, { signups?: number; retained?: number }>;
  orgs?: {
    total?: number;
    with_3plus_members?: number;
    created_30d?: number;
    with_3plus_members_30d?: number;
  };
}

/** Mappe un Record<string, T> en normalisant chaque valeur (jamais de spread). */
function mapRecord<TRaw, TOut>(
  raw: Record<string, TRaw> | undefined,
  map: (value: TRaw) => TOut
): Record<string, TOut> {
  const out: Record<string, TOut> = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = map(value);
  return out;
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
      inactive30dPlus: raw.totals?.inactive_30d_plus ?? 0,
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
    signupsByProvider: raw.signups_by_provider ?? {},
    adoption: {
      tasksUsers: raw.adoption?.tasks_users ?? 0,
      habitsUsers: raw.adoption?.habits_users ?? 0,
      eventsUsers: raw.adoption?.events_users ?? 0,
      okrsUsers: raw.adoption?.okrs_users ?? 0,
    },
    activation24h: {
      activated: raw.activation_24h?.activated ?? 0,
      total: raw.activation_24h?.total ?? 0,
    },
    tasksCompletion: {
      completed: raw.tasks_completion?.completed ?? 0,
      total: raw.tasks_completion?.total ?? 0,
    },
    collaboration: {
      sharers: raw.collaboration?.sharers ?? 0,
      usersWithFriends: raw.collaboration?.users_with_friends ?? 0,
      acceptedRequests: raw.collaboration?.accepted_requests ?? 0,
    },
    retentionJ7: (raw.retention_j7 ?? []).map((c) => ({
      week: c.week ?? '',
      signups: c.signups ?? 0,
      retained: c.retained ?? 0,
    })),
    stickiness: {
      dau: raw.stickiness?.dau ?? 0,
      mau: raw.stickiness?.mau ?? 0,
    },
    signupsBySource: mapRecord(raw.signups_by_source, (n) => Number(n) || 0),
    signupsBySourceByDay: (raw.signups_by_source_by_day ?? []).map((p) => ({
      day: p.day ?? '',
      source: p.source ?? 'unknown',
      count: p.count ?? 0,
    })),
    activation48h: {
      activated: raw.activation_48h?.activated ?? 0,
      total: raw.activation_48h?.total ?? 0,
      bySource: mapRecord(raw.activation_48h?.by_source, (v) => ({
        activated: v?.activated ?? 0,
        total: v?.total ?? 0,
      })),
    },
    retentionD7BySource: mapRecord(raw.retention_d7_by_source, (v) => ({
      signups: v?.signups ?? 0,
      retained: v?.retained ?? 0,
    })),
    orgs: {
      total: raw.orgs?.total ?? 0,
      with3plusMembers: raw.orgs?.with_3plus_members ?? 0,
      created30d: raw.orgs?.created_30d ?? 0,
      with3plusMembers30d: raw.orgs?.with_3plus_members_30d ?? 0,
    },
  };
}

/**
 * Statut admin de l'utilisateur courant (RPC is_admin, mig. 056).
 * Ne doit JAMAIS bloquer l'UI : toute erreur ⇒ false silencieux.
 */
export async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
