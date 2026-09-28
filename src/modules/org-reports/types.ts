// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Rapports d'activité (mig. 202)
// ═══════════════════════════════════════════════════════════════════
//
// Un rapport dit ce qui a été FAIT, jamais ce qui a été modifié ou attribué.
// Chaque journée est figée par le serveur à 00:00 (fuseau de l'organisation) ;
// une période (semaine, mois, libre) est l'agrégat de ses journées.

/** Périmètre d'un rapport : toute l'entreprise, ou une équipe. */
export type ReportScope = { kind: 'org' } | { kind: 'team'; teamId: string };

export interface ReportTask {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  /** Qui l'a terminée : l'auteur du passage à « terminé », sinon le premier assigné. */
  byId: string | null;
  byName: string | null;
  /** ISO. */
  at: string;
}

export interface ReportProject {
  id: string;
  name: string;
  color: string | null;
  done: number;
  total: number;
  completedToday: number;
  /** Avancement (%) avant et après la période. */
  before: number;
  after: number;
}

export interface ReportKr {
  id: string;
  title: string;
  okrTitle: string;
  unit: string | null;
  value: number;
  target: number;
  /** null = premier rapport sans point d'étape antérieur. */
  before: number | null;
  after: number;
  completed: boolean;
}

export interface ReportEvent {
  userId: string;
  userName: string | null;
  title: string;
  start: string;
  end: string;
}

export interface ReportTeamLine {
  id: string;
  name: string;
  color: string | null;
  tasksDone: number;
}

/** Contenu figé d'une journée (miroir du `payload` de la mig. 202, version 1). */
export interface ActivityReportPayload {
  version: number;
  tasks: ReportTask[];
  projects: ReportProject[];
  krs: ReportKr[];
  events: ReportEvent[];
  /** Rapport d'entreprise seulement : une ligne par équipe. */
  teams: ReportTeamLine[];
  /** Plus de 1 000 tâches ce jour-là : la liste est un extrait. */
  truncated: boolean;
}

export interface DailyActivityReport {
  /** Date locale 'YYYY-MM-DD'. */
  day: string;
  payload: ActivityReportPayload;
}

/** Une période agrégée, prête à peindre. */
export interface AggregatedReport {
  from: string;
  to: string;
  /** Nombre de journées générées dans la période. */
  daysCovered: number;
  tasks: ReportTask[];
  projects: ReportProject[];
  krs: ReportKr[];
  events: ReportEvent[];
  teams: ReportTeamLine[];
  truncated: boolean;
}
