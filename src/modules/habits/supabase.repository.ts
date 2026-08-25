import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IHabitsRepository } from './repository';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { HabitRow, mapHabitFromDb, mapHabitToDb } from './mappers';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE, assertValidCursor } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';

/**
 * Profondeur d'historique demandée à `get_my_habits()` (mig. 119).
 *
 * 400 jours = le plus petit seuil qui préserve une comparaison d'une année sur
 * l'autre, et le même que la rétention analytique de la mig. 114. Il couvre
 * largement le heatmap (26 semaines = 182 j) et toutes les vues datées.
 *
 * ⚠️ L'augmenter réintroduit le problème proportionnellement : +12,7 octets par
 * jour ajouté, par habitude. La RPC plafonne de toute façon à 3 650.
 */
const HABIT_WINDOW_DAYS = 400;

export class SupabaseHabitsRepository implements IHabitsRepository {
  async fetchHabits(): Promise<Habit[]> {
    // ⚡ Lecture via la RPC `get_my_habits()` et NON `.from('habits')` —
    // correctif de payload (mig. 119).
    //
    // `completions` est un JSONB qui gagnait une entrée PAR JOUR et PAR
    // HABITUDE, sans borne : 12,7 octets/jour mesurés en prod, soit ~14 ko par
    // habitude à trois ans et **~280 ko par ouverture de la page Habitudes**
    // pour 20 habitudes. La RPC ne renvoie que la fenêtre (400 j par défaut).
    //
    // ⚠️ Elle renvoie EN PLUS `streak_current`, `streak_best`,
    // `completions_total` et `first_completion_date`, calculés serveur sur
    // l'historique ENTIER. C'est ce qui rend la troncature acceptable : sans
    // eux, un utilisateur assidu depuis trois ans verrait sa série plafonner
    // à la fenêtre. Ne pas retirer la RPC en croyant « simplifier ».
    //
    // La table n'est PAS modifiée : rien n'est supprimé, c'est la lecture qui
    // est bornée (l'export CSV lit toujours tout).
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .rpc('get_my_habits', { p_days: HABIT_WINDOW_DAYS })
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data || []) as unknown as HabitRow[];
    });

    // Map snake_case to camelCase
    return warnIfTruncated(rows, MAX_ROWS, 'habits').map(mapHabitFromDb);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Habit>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    let query = supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (params.cursor && params.cursorDate) {
      assertValidCursor(params.cursor, params.cursorDate);
      query = query.or(
        `created_at.lt.${params.cursorDate},and(created_at.eq.${params.cursorDate},id.lt.${params.cursor})`
      );
    }

    const { data, error } = await query;
    if (error) throw normalizeApiError(error);

    const rows = data || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];

    return {
      data: items.map(mapHabitFromDb),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at : null,
    };
  }

  async getById(id: string): Promise<Habit | null> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? mapHabitFromDb(data) : null;
  }

  async createHabit(input: CreateHabitInput): Promise<Habit> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput = { ...mapHabitToDb(input), user_id: user.id };

    const { data, error } = await supabase
      .from('habits')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapHabitFromDb(data);
  }

  async updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit> {
    const dbUpdates = mapHabitToDb(updates);
    
    const { data, error } = await supabase
      .from('habits')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapHabitFromDb(data);
  }

  async deleteHabit(id: string): Promise<void> {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  async toggleCompletion(id: string, date: string): Promise<Habit> {
    // Atomic toggle via RPC (migration 023, faille TOCTOU-1). L'ancien code
    // faisait SELECT completions → mutate JS → UPDATE — un autre tab/device
    // pouvait écrire entre les deux et perdre ses changements.
    const { data, error } = await supabase.rpc('toggle_habit_completion', {
      p_habit_id: id,
      p_date: date,
    });

    if (error) throw normalizeApiError(error);
    return mapHabitFromDb(data as HabitRow);
  }

}
