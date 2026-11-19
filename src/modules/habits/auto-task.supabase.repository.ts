import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import type { HabitAutoTask, IHabitAutoTaskRepository } from './auto-task.repository';

interface HabitAutoTaskRow {
  habit_id: string;
  category: string | null;
  last_day: string | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Table `habit_auto_tasks` (mig. 265), RLS propriétaire seul. */
export class SupabaseHabitAutoTaskRepository implements IHabitAutoTaskRepository {
  async list(): Promise<HabitAutoTask[]> {
    const { data, error } = await supabase
      .from('habit_auto_tasks')
      .select('habit_id, category, last_day');
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as HabitAutoTaskRow[]).map((r) => ({
      habitId: r.habit_id,
      category: r.category,
      lastDay: r.last_day,
    }));
  }

  async enable(habitId: string, category: string | null): Promise<void> {
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // `last_day` hors du payload : réactiver ne recrée pas la tâche du jour.
    const { error } = await supabase
      .from('habit_auto_tasks')
      .upsert({ habit_id: habitId, user_id: user.id, category }, { onConflict: 'habit_id,user_id' });
    if (error) throw normalizeApiError(error);
  }

  async disable(habitId: string): Promise<void> {
    const { error } = await supabase.from('habit_auto_tasks').delete().eq('habit_id', habitId);
    if (error) throw normalizeApiError(error);
  }

  async claimDay(habitId: string, day: string): Promise<boolean> {
    if (!DAY_RE.test(day)) throw makeApiError('invalid_input');
    // UPDATE conditionnel : la base tranche entre deux onglets ou deux appareils.
    const { data, error } = await supabase
      .from('habit_auto_tasks')
      .update({ last_day: day })
      .eq('habit_id', habitId)
      .or(`last_day.is.null,last_day.lt.${day}`)
      .select('habit_id');
    if (error) throw normalizeApiError(error);
    return (data ?? []).length > 0;
  }
}
