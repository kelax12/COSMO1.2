// Types du dashboard admin (/admin) — miroir camelCase du jsonb retourné
// par la RPC get_admin_stats() (migration 056).

/** Point d'une série quotidienne. `day` au format 'YYYY-MM-DD' (UTC serveur). */
export interface DailyPoint {
  day: string;
  count: number;
}

export interface AdminTotals {
  users: number;
  activeToday: number;
  active7d: number;
  inactive7dPlus: number;
  inactive30dPlus: number;
}

export interface AdminAdoption {
  tasksUsers: number;
  habitsUsers: number;
  eventsUsers: number;
  okrsUsers: number;
}

export interface AdminActivation {
  activated: number;
  total: number;
}

export interface AdminTasksCompletion {
  completed: number;
  total: number;
}

export interface AdminCollaboration {
  sharers: number;
  usersWithFriends: number;
  acceptedRequests: number;
}

export interface RetentionCohort {
  week: string; // lundi de la semaine d'inscription, 'YYYY-MM-DD'
  signups: number;
  retained: number;
}

export interface AdminStickiness {
  dau: number;
  mau: number;
}

export interface AdminDemoStats {
  visitors: number;
  converted: number;
  conversionPct: number;
}

export interface AdminUsageStats {
  tasks: number;
  habits: number;
  events: number;
  okrs: number;
  sharedTasks: number;
}

export interface AdminStats {
  generatedAt: string;
  totals: AdminTotals;
  signupsByDay: DailyPoint[];
  dau: DailyPoint[];
  demo: AdminDemoStats;
  usage: AdminUsageStats;
  signupsByProvider: Record<string, number>;
  adoption: AdminAdoption;
  activation24h: AdminActivation;
  tasksCompletion: AdminTasksCompletion;
  collaboration: AdminCollaboration;
  retentionJ7: RetentionCohort[];
  stickiness: AdminStickiness;
}
