import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { IHabitsRepository } from './repository';
import type { CreateOptions } from '@/lib/restore-id';
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

/**
 * « Aujourd'hui » du point de vue de l'UTILISATEUR, au format `YYYY-MM-DD`.
 *
 * ⚠️ À passer à TOUTE fonction serveur qui juge une série ou une complétion.
 *
 * La base est en UTC, et les clés de `completions` sont écrites en date LOCALE
 * (`toLocaleDateString('en-CA')`, même convention que `streak.ts` et que le
 * `p_date` du toggle). Laisser le serveur décider avec `CURRENT_DATE` donnait
 * un chiffre FAUX hors UTC, et c'est lui qui gagnait puisque `habitStreak()`
 * préfère la valeur serveur :
 *   • Amériques, de ~19 h à minuit local : série affichée à ZÉRO ;
 *   • Europe, de 00 h à 02 h : cocher faisait BAISSER le compteur.
 * Mesuré, puis corrigé par la mig. 122.
 */
const localToday = (): string => new Date().toLocaleDateString('en-CA');

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
        .rpc('get_my_habits', { p_days: HABIT_WINDOW_DAYS, p_today: localToday() })
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

  /**
   * ⚠️ PIÈGE DE PAYLOAD, à lire avant de brancher cette méthode.
   *
   * Elle lit `.from('habits').select('*')`, donc `completions` ENTIER — la
   * chose exacte que `fetchHabits` ci-dessus évite via `get_my_habits`
   * (mig. 119, ~280 ko par ouverture pour 20 habitudes à trois ans). Elle ne
   * renvoie pas non plus les quatre agrégats calculés serveur, donc une série
   * dérivée d'ici plafonnerait à la fenêtre affichée.
   *
   * Aucun appelant aujourd'hui : c'est une capacité d'interface, gardée
   * volontairement comme sur les autres modules (cf. la note de
   * `modules/tasks/hooks.ts`, étape 3 de la pagination). La brancher telle
   * quelle rouvrirait la mig. 119 : il faudra d'abord une RPC paginée bornée.
   */
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

  async createHabit(input: CreateHabitInput, options?: CreateOptions): Promise<Habit> {
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // `options.restoreId` ne vient JAMAIS d'un payload de formulaire : c'est un
    // second argument, reserve aux « Annuler » (R-08). La whitelist
    // `mapHabitToDb` et le `user_id` pose depuis la session sont inchanges.
    const dbInput = {
      ...mapHabitToDb(input),
      user_id: user.id,
      ...(options?.restoreId ? { id: options.restoreId } : {}),
    };

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
    // Bascule atomique via RPC (mig. 023, faille TOCTOU-1) : la lecture et
    // l'écriture tiennent dans UN statement sous verrou de ligne. Ne jamais
    // revenir à SELECT → mutate JS → UPDATE, un autre onglet écrirait entre
    // les deux et perdrait ses changements.
    //
    // ⚡ `_v2` (mig. 121) : la v1 renvoyait `RETURNS public.habits`, donc la
    // ligne ENTIÈRE avec tout l'historique de `completions`, à CHAQUE coche
    // (~14 ko à trois ans). La v2 renvoie la même forme que `get_my_habits` :
    // ligne bornée + agrégats calculés sur l'historique entier.
    //
    // C'est ce qui permet au hook d'écrire directement la ligne fraîche dans
    // le cache au lieu d'invalider toute la liste — la v1 déclenchait un
    // `get_my_habits()` COMPLET après chaque clic, pour retrouver un état
    // qu'on venait de calculer.
    const { data, error } = await supabase.rpc('toggle_habit_completion_v2', {
      p_habit_id: id,
      p_date: date,
      p_days: HABIT_WINDOW_DAYS,
      p_today: localToday(),
    });

    if (error) throw normalizeApiError(error);
    // `RETURNS TABLE` → PostgREST renvoie un tableau, là où la v1 renvoyait
    // un objet. Une seule ligne par construction (filtrée sur l'id).
    const row = (Array.isArray(data) ? data[0] : data) as HabitRow | undefined;
    if (!row) throw makeApiError('not_found');
    return mapHabitFromDb(row);
  }

}
