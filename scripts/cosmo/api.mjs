// Couche métier pure. Contraintes :
//   - reçoit toujours un `client` en paramètre (jamais de singleton importé)
//   - ne lit ni process.env ni process.argv
//   - n'écrit rien sur stdout/stderr
// C'est cette couche, et elle seule, qu'un futur serveur MCP réutilisera :
// chaque fonction exportée correspond à un tool.
import { CosmoApiError, CosmoNotFoundError, CosmoValidationError } from './errors.mjs';

/**
 * Colonnes de `tasks`. Duplique volontairement TASK_LIST_COLUMNS du
 * repository applicatif (on ne veut pas de chaîne de build TS dans scripts/).
 * Le test anti-dérive de api.test.mjs casse si les deux divergent.
 */
export const TASK_COLUMNS =
  'id,name,priority,category,deadline,estimated_time,created_at,updated_at,bookmarked,completed,completed_at,subtasks,kr_id,recurrence,is_collaborative,pending_invites,user_id';

/**
 * Date locale YYYY-MM-DD. `en-CA` est la convention du projet : elle évite la
 * classe de bugs où toISOString() décale d'un jour en soirée.
 */
export function todayLocal(now = new Date()) {
  return now.toLocaleDateString('en-CA');
}

/** Enveloppe une erreur PostgREST. Ne jamais laisser fuiter l'objet brut. */
function unwrap({ data, error }) {
  if (error) throw new CosmoApiError(error.message, error.code);
  return data;
}

function mapTaskFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    category: row.category ?? '',
    deadline: row.deadline ?? '',
    estimatedTime: row.estimated_time,
    bookmarked: row.bookmarked ?? false,
    completed: row.completed ?? false,
    completedAt: row.completed_at ?? undefined,
    krId: row.kr_id ?? undefined,
    recurrence: row.recurrence ?? 'none',
    createdAt: row.created_at,
  };
}

/** Défauts documentés dans le spec §4. */
export const DEFAULT_TASK = { priority: 3, estimatedTime: 30 };

/**
 * Catégorie par défaut = la première de l'utilisateur. On refuse de créer une
 * tâche sans catégorie : `category` est non-optionnel dans le modèle domaine,
 * et une chaîne vide produirait des tâches non classables dans l'app.
 */
async function defaultCategoryName(client) {
  const rows =
    unwrap(await client.from('categories').select('*').order('name', { ascending: true })) ?? [];
  if (rows.length === 0) {
    throw new CosmoValidationError(
      'Aucune categorie sur ce compte : precise --category, ou cree une categorie dans l app.'
    );
  }
  return rows[0].name;
}

/**
 * Liste les tâches. La RLS restreint déjà à l'utilisateur courant : pas de
 * filtre user_id nécessaire ici (contrairement à `events`, voir listEvents).
 */
export async function listTasks(client, { completed, category, deadlineBefore, limit } = {}) {
  let query = client.from('tasks').select(TASK_COLUMNS);
  if (completed !== undefined) query = query.eq('completed', completed);
  if (category) query = query.eq('category', category);
  if (deadlineBefore) query = query.lte('deadline', deadlineBefore);
  query = query.order('deadline', { ascending: true }).order('priority', { ascending: false });
  if (limit) query = query.limit(limit);
  const rows = unwrap(await query) ?? [];
  return rows.map(mapTaskFromRow);
}

/**
 * Crée une tâche. N'émet jamais `user_id` : la colonne est posée côté serveur
 * depuis auth.uid(). C'est la même frontière de sécurité que mapTaskToDb.
 */
export async function createTask(client, input, { now = new Date() } = {}) {
  const name = (input?.name ?? '').trim();
  if (!name) throw new CosmoValidationError('Le nom de la tache est obligatoire.');

  const category = input.category ?? (await defaultCategoryName(client));
  const deadline = input.deadline === undefined ? todayLocal(now) : input.deadline;
  const row = {
    name,
    priority: input.priority ?? DEFAULT_TASK.priority,
    category,
    deadline: deadline ? deadline : null,
    estimated_time: input.estimatedTime ?? DEFAULT_TASK.estimatedTime,
    bookmarked: false,
    completed: false,
    recurrence: input.recurrence ?? 'none',
  };
  if (input.description !== undefined) row.description = input.description;
  if (input.krId) row.kr_id = input.krId;

  const data = unwrap(await client.from('tasks').insert(row).select(TASK_COLUMNS).single());
  return mapTaskFromRow(data);
}

/**
 * Coche une tâche. Pose `completed_at` en plus de `completed` : ne poser que
 * le booléen fausserait les statistiques et le dashboard.
 */
export async function completeTask(client, taskId, { now = new Date() } = {}) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');
  const data = unwrap(
    await client
      .from('tasks')
      .update({ completed: true, completed_at: todayLocal(now) })
      .eq('id', taskId)
      .select(TASK_COLUMNS)
      .single()
  );
  return mapTaskFromRow(data);
}

function mapHabitFromRow(row, dayKey) {
  const completions = row.completions || {};
  return {
    id: row.id,
    name: row.name,
    estimatedTime: row.estimated_time,
    color: row.color,
    icon: row.icon,
    completions,
    doneToday: completions[dayKey] === true,
  };
}

/** Habitudes de l'utilisateur, annotées de leur état du jour. */
export async function listHabitsToday(client, { now = new Date() } = {}) {
  const dayKey = todayLocal(now);
  const rows = unwrap(await client.from('habits').select('*').order('name', { ascending: true })) ?? [];
  return rows.map((row) => mapHabitFromRow(row, dayKey));
}

/**
 * Marque une habitude comme faite aujourd'hui.
 *
 * Passe par la RPC atomique `toggle_habit_completion` (mig. 023, TOCTOU-1) :
 * jamais de SELECT→mutate→UPDATE, qui perdrait les écritures concurrentes.
 * Comme la RPC est un *toggle*, on lit d'abord l'état : sans ce garde, appeler
 * la commande deux fois décocherait l'habitude.
 */
export async function markHabitDone(client, habitId, { now = new Date() } = {}) {
  if (!habitId) throw new CosmoValidationError('Identifiant d habitude manquant.');
  const dayKey = todayLocal(now);

  const rows = unwrap(await client.from('habits').select('*').eq('id', habitId)) ?? [];
  const current = rows[0];
  if (!current) throw new CosmoNotFoundError(`Habitude introuvable : ${habitId}`);

  if ((current.completions || {})[dayKey] === true) {
    return { ...mapHabitFromRow(current, dayKey), alreadyDone: true };
  }

  const data = unwrap(
    await client.rpc('toggle_habit_completion', { p_habit_id: habitId, p_date: dayKey })
  );
  return { ...mapHabitFromRow(data, dayKey), alreadyDone: false };
}

/**
 * Événements à venir de l'utilisateur.
 *
 * Le filtre `user_id` est OBLIGATOIRE : depuis la mig. 077 la policy RLS de
 * `events` expose aussi l'agenda des membres de l'équipe. S'en remettre à la
 * seule RLS mélangerait l'agenda perso et celui des collègues.
 */
export async function listUpcomingEvents(client, { userId, now = new Date(), days = 7 } = {}) {
  if (!userId) {
    throw new CosmoValidationError(
      'userId requis : la RLS events expose aussi l agenda de l equipe (mig. 077).'
    );
  }
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const rows =
    unwrap(
      await client
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', now.toISOString())
        .lte('start_time', until.toISOString())
        .order('start_time', { ascending: true })
    ) ?? [];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    allDay: row.all_day ?? false,
  }));
}

/**
 * OKR en LECTURE SEULE. Faire progresser un KR imposerait d'insérer
 * atomiquement dans le journal append-only `kr_completions` (sinon le
 * graphique « KR réalisés » du dashboard reste à 0). Cette logique vit dans
 * les repositories applicatifs et ne doit pas être dupliquée ici.
 */
export async function listOkrs(client) {
  const okrRows = unwrap(await client.from('okrs').select('*').order('created_at', { ascending: false })) ?? [];
  return okrRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    progress: row.progress,
    completed: row.completed,
  }));
}

/** Key results d'un OKR, pour rattacher une tâche via kr_id. */
export async function listKeyResults(client, okrId) {
  if (!okrId) throw new CosmoValidationError('Identifiant d OKR manquant.');
  const rows = unwrap(await client.from('key_results').select('*').eq('okr_id', okrId)) ?? [];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    unit: row.unit,
    currentValue: row.current_value,
    targetValue: row.target_value,
    completed: row.completed,
  }));
}
