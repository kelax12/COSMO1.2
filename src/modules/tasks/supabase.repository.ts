import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { TaskRow, TaskDbInput, mapTaskFromDb, mapTaskToDb } from './mappers';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE, assertValidCursor } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';

/** Fields the client is allowed to set on insert (user_id is added server-side from auth.uid()). */
type TaskDbCreateInput = Omit<TaskDbInput, 'user_id'> & { user_id: string };

export class SupabaseTasksRepository implements ITasksRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const db = supabase;
    // Exclude `description` (long text, not shown in list) and
    // `collaborator_validations` (JSONB, only needed in TaskModal detail view).
    // getById() keeps select('*') so TaskModal always has the full payload.
    // Auto-pagination (range) : plus de troncature silencieuse au-delà de 500
    // (cf. fetch-all-pages.ts). `id` en tiebreak pour un ordre stable entre pages.
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await db
        .from('tasks')
        .select('id,name,priority,category,deadline,estimated_time,created_at,bookmarked,completed,completed_at,is_collaborative,pending_invites,user_id')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return data || [];
    });

    return this.enrichSharedBy(warnIfTruncated(rows, MAX_ROWS, 'tasks').map(mapTaskFromDb));
  }

  /**
   * RLS renvoie au destinataire les tâches qu'on lui a partagées (owner ≠ moi)
   * mêlées à ses propres tâches. La table `tasks` n'a pas de colonne pour le
   * partageur, donc on résout son nom via `profiles.display_name` et on pose
   * `sharedBy` + `isCollaborative` pour que l'UI puisse marquer la tâche comme
   * « reçue ». Sans amis/tâches partagées : zéro requête supplémentaire.
   */
  private async enrichSharedBy(tasks: Task[]): Promise<Task[]> {
    if (!supabase) return tasks;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return tasks;

    const ownerIds = [
      ...new Set(
        tasks
          .filter((t) => t.userId && t.userId !== user.id)
          .map((t) => t.userId as string)
      ),
    ];
    if (ownerIds.length === 0) return tasks;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', ownerIds);

    const nameById = new Map(
      (profiles || []).map((p) => [
        p.id as string,
        ((p.display_name as string | null) || (p.email as string | null) || 'Un ami'),
      ])
    );

    return tasks.map((t) =>
      t.userId && t.userId !== user.id
        ? { ...t, isCollaborative: true, sharedBy: nameById.get(t.userId) || 'Un ami' }
        : t
    );
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Task>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // +1 pour détecter s'il y a une page suivante

    // Applique le cursor si fourni (pagination cursor-based)
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
      data: await this.enrichSharedBy(items.map(mapTaskFromDb)),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at : null,
    };
  }

  async getById(id: string): Promise<Task | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    if (!data) return null;
    return (await this.enrichSharedBy([mapTaskFromDb(data)]))[0];
  }

  async getByDate(date: string): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const targetDate = date.split('T')[0];
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .gte('deadline', startOfDay)
      .lte('deadline', endOfDay)
      .order('deadline', { ascending: true });

    if (error) throw normalizeApiError(error);
    return this.enrichSharedBy((data || []).map(mapTaskFromDb));
  }

  async getFiltered(filters: TaskFilters): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase.from('tasks').select('*');

    if (filters.completed !== undefined) {
      query = query.eq('completed', filters.completed);
    }

    if (filters.bookmarked !== undefined) {
      query = query.eq('bookmarked', filters.bookmarked);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.priorityMin !== undefined) {
      query = query.gte('priority', filters.priorityMin);
    }

    if (filters.priorityMax !== undefined) {
      query = query.lte('priority', filters.priorityMax);
    }

    if (filters.deadlineBefore) {
      query = query.lte('deadline', filters.deadlineBefore);
    }

    if (filters.deadlineAfter) {
      query = query.gte('deadline', filters.deadlineAfter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return this.enrichSharedBy((data || []).map(mapTaskFromDb));
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateTaskInput): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput: TaskDbCreateInput = { ...mapTaskToDb(input), user_id: user.id };

    const { data, error } = await supabase
      .from('tasks')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapTaskFromDb(data);
  }

  async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = mapTaskToDb(updates);

    const { data, error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapTaskFromDb(data);
  }

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  async toggleComplete(id: string): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    // Atomic flip via RPC (migration 023, faille TOCTOU-3). Ancien code :
    // SELECT * → !completed → UPDATE — race possible avec un toggle
    // concurrent (l'utilisateur double-clic, deux tabs ouverts, etc.).
    const { data, error } = await supabase.rpc('toggle_task_complete', {
      p_task_id: id,
    });
    if (error) throw normalizeApiError(error);
    return mapTaskFromDb(data as TaskRow);
  }

  async toggleBookmark(id: string): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('toggle_task_bookmark', {
      p_task_id: id,
    });
    if (error) throw normalizeApiError(error);
    return mapTaskFromDb(data as TaskRow);
  }

}
