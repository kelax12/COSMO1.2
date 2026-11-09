import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { ITasksRepository, ToggleCompleteResult, type TaskPageParams } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskDependency } from './types';
import { TaskRow, TaskDbInput, mapTaskFromDb, mapTaskToDb } from './mappers';
import { PaginatedResult, DEFAULT_PAGE_SIZE, assertValidCursor } from '@/lib/pagination.types';
import { fetchAllByCursor } from '@/lib/fetch-all-pages';
import {
  type TaskQuery, type TaskCursor, isEmptyTaskQuery, wantsCompleted, escapeLikePattern, assertSupportedTaskQuery,
} from './task-query';
import type { CreateOptions } from '@/lib/restore-id';
import { dayEndInTz, dayStartISOInTz } from '@/lib/timezone';

/** Fields the client is allowed to set on insert (user_id is added server-side from auth.uid()). */
type TaskDbCreateInput = Omit<TaskDbInput, 'user_id'> & { user_id: string };

/**
 * Colonnes minimales pour les lectures de LISTE (audit scalabilité — réduction
 * payload). Exclut volontairement `description` (texte long) et
 * `collaborator_validations` (JSONB) : aucune vue liste ne les consomme — le
 * détail complet passe par `getById` (select '*') que la TaskModal utilise.
 * Source unique pour getAll/getByDate/getFiltered → pas de drift de colonnes.
 * Ne PAS y ajouter une colonne sans vérifier qu'un consommateur de liste la lit.
 */
const TASK_LIST_COLUMNS =
  'id,name,priority,category,deadline,estimated_time,created_at,updated_at,bookmarked,completed,completed_at,subtasks,kr_id,recurrence,is_collaborative,pending_invites,user_id,status,health' as const;

/** Taille d'une page de clé quand on enchaîne tout un sous-ensemble (listAll). */
const LIST_ALL_PAGE_SIZE = 1000;

/** Ce que `applyQuery` appelle sur un constructeur PostgREST. */
interface TaskFilterBuilder {
  eq(column: string, value: unknown): TaskFilterBuilder;
  gte(column: string, value: unknown): TaskFilterBuilder;
  lt(column: string, value: unknown): TaskFilterBuilder;
  lte(column: string, value: unknown): TaskFilterBuilder;
  ilike(column: string, pattern: string): TaskFilterBuilder;
  in(column: string, values: readonly unknown[]): TaskFilterBuilder;
  is(column: string, value: null): TaskFilterBuilder;
}

export class SupabaseTasksRepository implements ITasksRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════
  async getAll(): Promise<Task[]> {
    return this.listAll({});
  }

  // ⚠️ Toutes les lectures de liste passent par la RPC `get_my_tasks()` et NON
  // `.from('tasks')` : c'est le correctif C1 de l'audit architecture 2026-08-07.
  //
  // La policy `tasks_select_own_or_shared` (mig. 049) est un OR entre une
  // égalité et un EXISTS : Postgres ne peut alors PAS utiliser
  // `idx_tasks_user_id` et fait un Seq Scan de la table GLOBALE, puis trie.
  // `get_my_tasks()` (mig. 085) exprime les deux ensembles en UNION de deux
  // branches indexables. PostgREST applique select/filtres/order/limit à une
  // RPC `SETOF` exactement comme à une table.
  //
  // V14.1 (PER-01) : plus de `fetchAllPages` plafonné à 5 000 lignes. Les
  // écrans lisent un SOUS-ENSEMBLE (`TaskQuery`), page par page ou en entier
  // quand il est borné par nature, et le compte vient de `count()`.

  /** Applique les filtres d'une `TaskQuery` (miroir : `matchesTaskQuery`). */
  private applyQuery<B>(builder: B, q: TaskQuery): B {
    // Typage volontairement minimal : les génériques de PostgREST, rappliqués
    // filtre après filtre, dépassent la profondeur d'instanciation de tsc.
    let b = builder as unknown as TaskFilterBuilder;
    if (q.status === 'active') b = b.eq('completed', false);
    if (wantsCompleted(q)) b = b.eq('completed', true);
    if (q.completedSince) b = b.gte('completed_at', q.completedSince);
    if (q.completedBefore) b = b.lt('completed_at', q.completedBefore);
    if (q.search) b = b.ilike('name', `%${escapeLikePattern(q.search)}%`);
    if (q.categories) {
      // `''` (sans catégorie) est NULL en base (`mapTaskToDb`) : cf.
      // `assertSupportedTaskQuery`, la démo refuse la même combinaison.
      assertSupportedTaskQuery(q);
      b = q.categories.includes('') ? b.is('category', null) : b.in('category', [...q.categories]);
    }
    if (q.priorities) b = b.in('priority', [...q.priorities]);
    if (q.ids) b = b.in('id', [...q.ids]);
    // Clés de jour → instants du fuseau retenu, sinon Postgres les caste en
    // minuit UTC et la borne glisse d'un jour (même règle que getFiltered).
    if (q.deadlineFrom) b = b.gte('deadline', dayStartISOInTz(q.deadlineFrom));
    if (q.deadlineTo) b = b.lte('deadline', dayEndInTz(q.deadlineTo).toISOString());
    return b as unknown as B;
  }

  /** Une page de clé, lignes brutes : la brique commune de getPage et listAll. */
  private async fetchKeysetPage(
    q: TaskQuery,
    limit: number,
    cursor: TaskCursor | null,
  ): Promise<{ rows: TaskRow[]; hasMore: boolean }> {
    if (!supabase) throw new Error('Supabase not configured');
    if (isEmptyTaskQuery(q)) return { rows: [], hasMore: false };
    let query = this.applyQuery(
      supabase
        .rpc('get_my_tasks')
        .select(TASK_LIST_COLUMNS)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      q,
    ).limit(limit + 1); // +1 pour savoir s'il y a une page suivante

    if (cursor) {
      // Validé AVANT d'être interpolé dans `.or()` (faille N6).
      assertValidCursor(cursor.id, cursor.createdAt);
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) throw normalizeApiError(error);
    const rows = (data || []) as unknown as TaskRow[];
    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }

  async listAll(query: TaskQuery = {}): Promise<Task[]> {
    const rows = await fetchAllByCursor<TaskRow, TaskCursor>(
      async (cursor) => {
        const page = await this.fetchKeysetPage(query, LIST_ALL_PAGE_SIZE, cursor);
        const last = page.rows[page.rows.length - 1];
        return {
          rows: page.rows,
          next: page.hasMore && last?.created_at ? { id: last.id, createdAt: last.created_at } : null,
        };
      },
      (a, b) => a.id === b.id && a.createdAt === b.createdAt,
    );
    return this.enrichSharedBy(rows.map(mapTaskFromDb));
  }

  async count(query: TaskQuery = {}): Promise<number> {
    if (!supabase) throw new Error('Supabase not configured');
    if (isEmptyTaskQuery(query)) return 0;
    // `head` : aucune ligne transférée, PostgREST rend le total dans
    // `Content-Range`. Même chemin indexable que les lectures (C1).
    const { count, error } = await this.applyQuery(
      supabase.rpc('get_my_tasks', undefined, { head: true, count: 'exact' }),
      query,
    );
    if (error) throw normalizeApiError(error);
    return count ?? 0;
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
    const user = await getCurrentUser();
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

  async getPage(params: TaskPageParams = {}): Promise<PaginatedResult<Task>> {
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    const cursor = params.cursor && params.cursorDate ? { id: params.cursor, createdAt: params.cursorDate } : null;
    const { rows, hasMore } = await this.fetchKeysetPage(params.query ?? {}, limit, cursor);
    const lastItem = rows[rows.length - 1];
    return {
      data: await this.enrichSharedBy(rows.map(mapTaskFromDb)),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at ?? null : null,
    };
  }

  /**
   * Boîte de réception : tâches reçues d'un ami et pas encore acceptées.
   *
   * Depuis la mig. 103,  ne renvoie plus que les partages
   * ACCEPTÉS — une tâche partagée n'apparaît donc plus dans le TaskTable du
   * destinataire avant qu'il ne l'accepte. Cette RPC dédiée est ce qui reste
   * pour la lui montrer et lui permettre d'accepter.
   */
  async getPendingSharedTasks(): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .rpc('get_pending_shared_tasks')
      .select(TASK_LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return this.enrichSharedBy(((data || []) as unknown as TaskRow[]).map(mapTaskFromDb));
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
    // La fenêtre est celle du jour VÉCU, pas du jour UTC. Les échéances sont
    // écrites à minuit dans le fuseau retenu (`deadlineFromDayKey`) : borner en
    // `…T00:00:00.000Z` faisait tomber hors fenêtre toute tâche du jour à l'est
    // de Greenwich, et y faisait entrer celle de la veille à l'ouest.
    const startOfDay = dayStartISOInTz(targetDate);
    const endOfDay = dayEndInTz(targetDate).toISOString();
    if (!startOfDay) return [];

    // Même chemin indexable que getAll (cf. C1). Sans cela, cette lecture
    // conservait le `Seq Scan` de la table globale : le filtre `deadline`
    // ne rattrape rien, puisque c'est le OR de la policy qui rend l'index
    // `idx_tasks_user_id` inutilisable, pas l'absence de prédicat.
    const { data, error } = await supabase
      .rpc('get_my_tasks')
      .select(TASK_LIST_COLUMNS)
      .gte('deadline', startOfDay)
      .lte('deadline', endOfDay)
      .order('deadline', { ascending: true });

    if (error) throw normalizeApiError(error);
    return this.enrichSharedBy(((data || []) as unknown as TaskRow[]).map(mapTaskFromDb));
  }

  async getFiltered(filters: TaskFilters): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // Même chemin indexable que getAll (cf. C1). `usePendingTasks` (consommé
    // par DeadlineCalendar et TasksSummary) passe par ici : c'était donc un
    // second Seq Scan de la table globale à chaque affichage du dashboard.
    let query = supabase.rpc('get_my_tasks').select(TASK_LIST_COLUMNS);

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

    // `deadlineBefore` / `deadlineAfter` sont des CLÉS DE JOUR ('YYYY-MM-DD'),
    // bornes incluses. Les convertir en instants du fuseau retenu, sinon
    // Postgres les caste en minuit UTC et la borne glisse d'un jour.
    if (filters.deadlineBefore) {
      query = query.lte('deadline', dayEndInTz(filters.deadlineBefore).toISOString());
    }

    if (filters.deadlineAfter) {
      query = query.gte('deadline', dayStartISOInTz(filters.deadlineAfter));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return this.enrichSharedBy(((data || []) as unknown as TaskRow[]).map(mapTaskFromDb));
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateTaskInput, options?: CreateOptions): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // `options.restoreId` ne vient JAMAIS d'un payload de formulaire :
    // c'est un second argument, reserve aux « Annuler » (R-08). La
    // whitelist `mapToDb` et le `user_id` pose depuis la session sont
    // inchanges.
    const dbInput: TaskDbCreateInput = {
      ...mapTaskToDb(input),
      user_id: user.id,
      ...(options?.restoreId ? { id: options.restoreId } : {}),
    };

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

  async toggleComplete(id: string, nextDeadline?: string | null): Promise<ToggleCompleteResult> {
    if (!supabase) throw new Error('Supabase not configured');
    // Bascule atomique via RPC (mig. 023, faille TOCTOU-3) — l'ancien
    // SELECT → !completed → UPDATE laissait passer un double-clic ou deux
    // onglets concurrents.
    //
    // v2 (mig. 086, audit archi H1) : la génération de l'occurrence récurrente
    // se fait dans la MÊME transaction, et est rendue idempotente par l'index
    // unique `ux_tasks_recurrence_parent`. Avant, c'était un `create()`
    // fire-and-forget côté client : perdu si l'onglet se fermait, dupliqué si
    // l'utilisateur décochait puis recochait.
    //
    // `p_next_deadline` est calculée par l'appelant : c'est l'INSTANT de minuit
    // du jour visé, dans le fuseau de l'utilisateur (mig. 133). Elle transitait
    // avant en date nue, que le SQL castait en timestamptz avec le fuseau du
    // serveur, donc UTC : l'occurrence suivante naissait la veille pour tout
    // décalage négatif (risque R-01). Le serveur ne juge jamais quel jour on
    // est — il ne connaît pas le fuseau de l'utilisateur.
    const { data, error } = await supabase.rpc('toggle_task_complete_v2', {
      p_task_id: id,
      p_next_deadline: nextDeadline ?? null,
    });
    if (error) throw normalizeApiError(error);
    const payload = data as { task: TaskRow; spawned: TaskRow | null };
    return {
      task: mapTaskFromDb(payload.task),
      spawned: payload.spawned ? mapTaskFromDb(payload.spawned) : null,
    };
  }

  async toggleBookmark(id: string): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('toggle_task_bookmark', {
      p_task_id: id,
    });
    if (error) throw normalizeApiError(error);
    return mapTaskFromDb(data as TaskRow);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DÉPENDANCES (mig. 132)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Lecture directe de la table, sans RPC de contournement — c'est ici la
   * bonne réponse, pas un oubli.
   *
   * La mig. 132 a délibérément DÉNORMALISÉ `user_id` sur l'arête plutôt que
   * de déléguer le périmètre à `tasks` : la policy est donc
   * `(SELECT auth.uid()) = user_id`, un prédicat qui ne dépend pas de la
   * ligne, hissé en InitPlan et servi par `idx_task_dependencies_user`. C'est
   * exactement ce que `get_my_tasks()` (mig. 085) doit reconstruire pour
   * `tasks`, dont la policy est un OR non indexable.
   */
  async getDependencies(): Promise<TaskDependency[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('task_dependencies')
      .select('task_id,depends_on_id');

    if (error) throw normalizeApiError(error);
    return (data || []).map((row) => ({
      taskId: (row as { task_id: string }).task_id,
      dependsOnId: (row as { depends_on_id: string }).depends_on_id,
    }));
  }

  /**
   * `user_id` n'est PAS envoyé : le trigger `validate_task_dependency` le
   * redérive du propriétaire de la tâche bloquée, et la policy vérifie
   * ensuite que c'est bien l'appelant. L'émettre depuis le client ouvrirait
   * la porte au mass-assignment que ce trigger existe précisément pour
   * fermer.
   */
  async addDependency(taskId: string, dependsOnId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('task_dependencies')
      .insert([{ task_id: taskId, depends_on_id: dependsOnId }]);

    if (error) throw normalizeApiError(error);
  }

  async removeDependency(taskId: string, dependsOnId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('task_id', taskId)
      .eq('depends_on_id', dependsOnId);

    if (error) throw normalizeApiError(error);
  }
}
