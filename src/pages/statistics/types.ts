// Types partagés entre StatisticsPage et ses sections — extraits verbatim.

export type StatSection = 'all' | 'tasks' | 'agenda' | 'okr' | 'habits';
export type TimePeriod = 'day' | 'week' | 'month' | 'year';

export interface WorkTimePeriodData {
  label: string;
  totalTime: number;
  details: {
    tasksTime: number;
    eventsTime: number;
    habitsTime: number;
    okrTime: number;
  };
}

// ⚠️ `KeyResultHistory` a ete SUPPRIME le 2026-09-02. Il decrivait un champ
// `kr.history` qui n'existe pas dans le modele et qu'aucun ecrivain ne pose :
// son seul effet etait de faire passer pour reelle une lecture qui rendait
// toujours zero. Le temps investi sur les OKR vient du journal
// `kr_completions` (cf. `src/lib/workTimeCalculator.ts`).
