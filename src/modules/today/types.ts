// ═══════════════════════════════════════════════════════════════════
// Module today — vue « Aujourd'hui » unifiée (item #29)
//
// Un collaborateur membre d'une organisation a DEUX listes de tâches sans
// jonction : `tasks` (perso, /tasks) et `team_tasks` (équipe,
// /entreprise?tab=projects). Aucun écran ne répondait à « qu'est-ce que je
// dois faire aujourd'hui ? ».
//
// 🔴 On ne fusionne PAS les deux tables. Leurs règles de sécurité, cycles de
// vie et fonctionnalités diffèrent (récurrence serveur d'un côté, triggers de
// statut de l'autre), et une migration qui les fusionnerait serait
// irréversible sur une base sans PITR. L'unification est une vue de LECTURE.
// ═══════════════════════════════════════════════════════════════════

/** Origine d'un élément — détermine à qui appartient l'écriture. */
export type TodaySource = 'personal' | 'team';

/** Élément d'agenda unifié — vue de LECTURE, jamais persistée. */
export interface TodayItem {
  id: string;
  source: TodaySource;
  name: string;
  /** Date locale `YYYY-MM-DD`, ou null si aucune. */
  deadline: string | null;
  done: boolean;
  /** 1..5 (1 = plus urgent côté perso ; voir `todayOrder`). */
  priority: number;
  /** Contexte affiché : nom de liste (perso) ou de projet (équipe). */
  contextLabel: string | null;
  /** Ouvre l'écran d'origine — jamais d'édition inline dans cette vue. */
  href: string;
  /** Échéance strictement antérieure à aujourd'hui. */
  overdue: boolean;
}
