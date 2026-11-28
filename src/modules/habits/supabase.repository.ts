import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { IHabitsRepository } from './repository';
import type { CreateOptions } from '@/lib/restore-id';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { HabitRow, mapHabitFromDb, mapHabitToDb } from './mappers';
import { checkedDays } from './completion-days';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE, assertValidCursor } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';
import { asInsert } from '@/lib/db-contract';

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

/**
 * Colonnes lues après une écriture directe sur `habits` : TOUTES sauf
 * `completions`. L'historique vit dans `habit_completions` (mig. 248, DAT-02) ;
 * la colonne JSONB n'est plus ni lue ni écrite par le client (elle ne subsiste
 * que comme miroir de transition, retirée par la 256).
 */
const HABIT_COLUMNS =
  'id, name, description, frequency, estimated_time, color, icon, created_at, user_id, scheduled_days, schedule_history' as const;

/** Lignes par INSERT dans `habit_completions` : un « Annuler » rejoue au plus ~400 jours. */
const COMPLETION_INSERT_CHUNK = 500;

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
      const page: HabitRow[] = data || [];
      return page;
    });

    // Map snake_case to camelCase
    return warnIfTruncated(rows, MAX_ROWS, 'habits').map(mapHabitFromDb);
  }

  /**
   * Page de la liste, par la même RPC bornée que `fetchHabits` (mig. 119/248) :
   * `completions` = jours cochés de la fenêtre, agrégats serveur sur tout
   * l'historique. Jamais `.from('habits')` : la colonne JSONB n'est plus lue.
   *
   * Aucun appelant aujourd'hui : capacité d'interface (cf. `tasks/hooks.ts`).
   */
  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Habit>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    // Filtre AVANT `.select()` : sur une RPC, seul le builder de filtres porte `.or()`.
    let filtered = supabase.rpc('get_my_habits', { p_days: HABIT_WINDOW_DAYS, p_today: localToday() });
    if (params.cursor && params.cursorDate) {
      assertValidCursor(params.cursor, params.cursorDate);
      filtered = filtered.or(
        `created_at.lt.${params.cursorDate},and(created_at.eq.${params.cursorDate},id.lt.${params.cursor})`
      );
    }
    const { data, error } = await filtered
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (error) throw normalizeApiError(error);

    const rows: HabitRow[] = data || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];

    return {
      data: items.map(mapHabitFromDb),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at ?? null : null,
    };
  }

  async createHabit(input: CreateHabitInput, options?: CreateOptions): Promise<Habit> {
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // L'historique ne passe JAMAIS par la colonne `completions` : il s'écrit
    // dans `habit_completions` plus bas (DAT-02). `mapHabitToDb` ne l'émet pas.
    //
    // `options.restoreId` ne vient JAMAIS d'un payload de formulaire : c'est un
    // second argument, reserve aux « Annuler » (R-08). La whitelist
    // `mapHabitToDb` et le `user_id` pose depuis la session sont inchanges.
    const dbInput = asInsert<'habits'>({
      ...mapHabitToDb(input),
      user_id: user.id,
      ...(options?.restoreId ? { id: options.restoreId } : {}),
    });

    const { data, error } = await supabase
      .from('habits')
      .insert([dbInput])
      .select(HABIT_COLUMNS)
      .single();

    if (error) throw normalizeApiError(error);

    const days = checkedDays(input.completions);
    for (let i = 0; i < days.length; i += COMPLETION_INSERT_CHUNK) {
      const rows = days
        .slice(i, i + COMPLETION_INSERT_CHUNK)
        .map((day) => ({ habit_id: data.id, user_id: user.id, day }));
      const { error: insertError } = await supabase.from('habit_completions').insert(rows);
      if (insertError) {
        // Pas d'habitude à moitié restaurée : on retire celle qu'on vient de créer.
        await supabase.from('habits').delete().eq('id', data.id);
        throw normalizeApiError(insertError);
      }
    }

    return mapHabitFromDb({
      ...data,
      completions: Object.fromEntries(days.map((day) => [day, true])),
    });
  }

  async updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit> {
    const dbUpdates = mapHabitToDb(updates);
    
    const { data, error } = await supabase
      .from('habits')
      .update(dbUpdates)
      .eq('id', id)
      .select(HABIT_COLUMNS)
      .single();

    if (error) throw normalizeApiError(error);
    // Sans `completions` : la ligne rendue n'en porte pas (l'historique est dans
    // `habit_completions`). Le hook invalide la liste, qui relit la RPC bornée.
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
