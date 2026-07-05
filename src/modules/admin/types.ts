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
}
