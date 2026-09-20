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

/** Point d'une série quotidienne ventilée par canal d'acquisition (mig. 099). */
export interface SourceDailyPoint {
  day: string;
  /** Canal normalisé (`?ref=`), ou 'unknown' si l'inscription n'est pas attribuée. */
  source: string;
  count: number;
}

/** Activation 48 h : globale + ventilée par canal (mig. 099). */
export interface AdminActivation48h extends AdminActivation {
  bySource: Record<string, AdminActivation>;
}

/** Rétention J+7 d'un canal, sur les seules cohortes dont la fenêtre est écoulée. */
export interface SourceRetention {
  signups: number;
  retained: number;
}

/**
 * Organisations. L'objectif « 10 Entreprise » se compte en `with3plusMembers` :
 * une org à 1 membre est un compte perso avec un chapeau.
 */
export interface AdminOrgs {
  total: number;
  with3plusMembers: number;
  created30d: number;
  with3plusMembers30d: number;
}

/**
 * Compteurs du support (C-110, mig. 150).
 *
 * 🔴 `awaiting` et `oldestAwaitingDays` sont les deux chiffres qui comptent.
 * Un volume seul dirait « on reçoit cinq rapports par semaine » sans dire
 * qu'aucun n'a jamais reçu de réponse — et un canal de support qu'on
 * n'instrumente pas ne se distingue pas d'un canal que personne n'utilise.
 *
 * ⚠️ `answered`, `resolved` et `medianResponseHours` restent à zéro tant que
 * personne ne pose `first_response_at` : la réponse part d'une boîte mail que
 * ce dépôt ne lit pas. Un zéro ici veut dire « non renseigné », pas
 * « instantané ».
 */
export interface AdminSupport {
  received: number;
  received30d: number;
  answered: number;
  resolved: number;
  awaiting: number;
  oldestAwaitingDays: number;
  medianResponseHours: number;
  byCategory: Record<string, number>;
  byDay: DailyPoint[];
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
  // ── v3 (mig. 099) — pack acquisition ───────────────────────────────
  signupsBySource: Record<string, number>;
  signupsBySourceByDay: SourceDailyPoint[];
  activation48h: AdminActivation48h;
  retentionD7BySource: Record<string, SourceRetention>;
  orgs: AdminOrgs;
  // ── C-110 (mig. 150) — le support, enfin compté ────────────────────
  //
  // ⚠️ `null` tant que la mig. 150 n'est pas APPLIQUÉE en production : la RPC
  // `get_support_stats` n'existe alors pas, et le dépôt a déjà payé une
  // migration commitée et dormante pendant dix-sept jours (C-77). Le `null`
  // est donc une valeur ATTENDUE, que la console affiche comme telle — pas un
  // zéro, qui se lirait « aucun rapport ».
  support: AdminSupport | null;
}
