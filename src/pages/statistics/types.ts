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

export interface KeyResultHistory {
  date: string;
  increment: number;
}
