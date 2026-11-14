// Couche métier pure. Contraintes :
//   - reçoit toujours un `client` en paramètre (jamais de singleton importé)
//   - ne lit ni process.env ni process.argv
//   - n'écrit rien sur stdout/stderr
// C'est cette couche, et elle seule, qu'un futur serveur MCP réutilisera :
// chaque fonction exportée correspond à un tool.
import { CosmoApiError, CosmoNotFoundError, CosmoValidationError } from './errors.mjs';
import { dayKeyFromStoredDeadline, deadlineEndOfDay, deadlineToTimestamp } from './deadline.mjs';

/** = TASK_LIST_COLUMNS du repository applicatif (garde anti-dérive : api.test.mjs). */
export const TASK_COLUMNS =
  'id,name,priority,category,estimated_time,created_at,updated_at,bookmarked,completed,completed_at,subtasks,kr_id,recurrence,is_collaborative,pending_invites,user_id,status,health';

// Colonnes d'échéance présentes (DAT-01), comme src/modules/tasks/deadline-columns.ts.
const columnsByClient = new WeakMap();
async function columnExists(client, column) {
  const { error } = await client.from('tasks').select(column).limit(0);
  return !error ? true : ['42703', 'PGRST204'].includes(error.code ?? '') ? false : null;
}

export async function deadlineColumns(client) {
  if (columnsByClient.has(client)) return columnsByClient.get(client);
  const day = await columnExists(client, 'due_date');
  const instant = await columnExists(client, 'deadline');
  if (day === null || instant === null || (!day && !instant)) return { day: !!day, instant: !day };
  const cols = { day, instant };
  columnsByClient.set(client, cols);
  return cols;
}

export const taskColumns = (cols) => `${TASK_COLUMNS},${cols.day ? 'due_date' : 'deadline'}`;
const deadlineFields = (day, cols) => ({
  ...(cols.day ? { due_date: day || null } : {}),
  ...(cols.instant ? { deadline: day ? deadlineToTimestamp(day) : null } : {}),
});

/** Date locale YYYY-MM-DD (`en-CA`, jamais toISOString qui décale en soirée). */
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
    deadline: row.due_date !== undefined ? (row.due_date ?? '') : dayKeyFromStoredDeadline(row.deadline),
    estimatedTime: row.estimated_time,
    bookmarked: row.bookmarked ?? false,
    completed: row.completed ?? false,
    completedAt: row.completed_at ?? undefined,
    krId: row.kr_id ?? undefined,
    recurrence: row.recurrence ?? 'none',
    createdAt: row.created_at,
    // Hors liste allégée : peuplée par les seuls `select('*')`.
    description: row.description ?? undefined,
  };
}

/** Défauts documentés dans le spec §4. */
export const DEFAULT_TASK = { priority: 3, estimatedTime: 30 };

/** Catégories de l'utilisateur (id + nom), triées par nom. */
export async function listCategories(client) {
  const rows =
    unwrap(await client.from('categories').select('*').order('name', { ascending: true })) ?? [];
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color }));
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nom ou UUID → UUID de `categories.id` (un nom écrit tel quel ferait une tâche orpheline). */
async function resolveCategoryId(client, wanted) {
  const categories = await listCategories(client);
  if (categories.length === 0) {
    throw new CosmoValidationError(
      'Aucune categorie sur ce compte : cree-en une dans l app avant d ajouter une tache.'
    );
  }

  if (wanted === undefined || wanted === null || wanted === '') return categories[0].id;
  if (UUID_PATTERN.test(wanted)) return wanted;

  const match = categories.find((c) => c.name.toLowerCase() === String(wanted).trim().toLowerCase());
  if (!match) {
    throw new CosmoValidationError(
      `Categorie inconnue : « ${wanted} ». Valeurs possibles : ${categories.map((c) => c.name).join(', ')}.`
    );
  }
  return match.id;
}

/** Liste les tâches (la RLS borne à l'utilisateur). `full` : `select('*')`, description comprise. */
export async function listTasks(client, { completed, category, deadlineBefore, limit, full } = {}) {
  const cols = await deadlineColumns(client);
  let query = client.from('tasks').select(full ? '*' : taskColumns(cols));
  if (completed !== undefined) query = query.eq('completed', completed);
  // Résolu seulement si fourni : sans valeur, la résolution rendrait la catégorie par défaut.
  if (category) query = query.eq('category', await resolveCategoryId(client, category));
  // Borne haute incluse ; l'ancienne colonne attend un instant.
  const column = cols.day ? 'due_date' : 'deadline';
  if (deadlineBefore) query = query.lte(column, cols.day ? deadlineBefore : deadlineEndOfDay(deadlineBefore));
  query = query.order(column, { ascending: true }).order('priority', { ascending: false });
  if (limit) query = query.limit(limit);
  const rows = unwrap(await query) ?? [];
  return rows.map(mapTaskFromRow);
}

/** Une tâche complète, `description` incluse (`select('*')`). */
export async function getTask(client, taskId) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');
  const rows = unwrap(await client.from('tasks').select('*').eq('id', taskId));
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new CosmoNotFoundError(`Tache introuvable : ${taskId}`);
  return mapTaskFromRow(row);
}

/** Crée une tâche. `user_id` vient de la session vérifiée, jamais de `input` (RLS WITH CHECK). */
export async function createTask(client, input, { now = new Date(), userId } = {}) {
  const name = (input?.name ?? '').trim();
  if (!name) throw new CosmoValidationError('Le nom de la tache est obligatoire.');
  if (!userId) {
    throw new CosmoValidationError(
      'userId de session manquant : impossible de creer une tache (RLS tasks).'
    );
  }

  const category = await resolveCategoryId(client, input.category);
  const deadline = input.deadline === undefined ? todayLocal(now) : input.deadline;
  const cols = await deadlineColumns(client);
  const row = {
    name,
    priority: input.priority ?? DEFAULT_TASK.priority,
    category,
    ...deadlineFields(deadline, cols),
    estimated_time: input.estimatedTime ?? DEFAULT_TASK.estimatedTime,
    bookmarked: false,
    completed: false,
    recurrence: input.recurrence ?? 'none',
    user_id: userId,
  };
  if (input.description !== undefined) row.description = input.description;
  if (input.krId) row.kr_id = input.krId;

  // `select('*')` : la confirmation montre `description`.
  const data = unwrap(await client.from('tasks').insert(row).select('*').single());
  return mapTaskFromRow(data);
}

/** Coche une tâche ; `completed_at` est un INSTANT complet, comme l'app (tri des terminées). */
export async function completeTask(client, taskId, { now = new Date() } = {}) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');
  const data = unwrap(
    await client
      .from('tasks')
      .update({ completed: true, completed_at: now.toISOString() })
      .eq('id', taskId)
      .select(taskColumns(await deadlineColumns(client)))
      .single()
  );
  return mapTaskFromRow(data);
}

/** Ré-ouvre une tâche terminée. Efface `completed_at`, sinon elle resterait
 *  datée dans les statistiques alors qu'elle est de nouveau ouverte. */
export async function reopenTask(client, taskId) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');
  const data = unwrap(
    await client
      .from('tasks')
      .update({ completed: false, completed_at: null })
      .eq('id', taskId)
      .select(taskColumns(await deadlineColumns(client)))
      .single()
  );
  return mapTaskFromRow(data);
}

/** Champs modifiables : whitelist, sans `user_id` (même frontière que `mapTaskToDb`). */
const UPDATABLE_FIELDS = {
  name: (v) => ['name', String(v).trim()],
  description: (v) => ['description', v],
  priority: (v) => ['priority', v],
  category: (v) => ['category', v],
  // Chaîne vide = « pas d'échéance » → NULL. Colonnes posées dans updateTask.
  deadline: (v) => ['deadline', v || ''],
  estimatedTime: (v) => ['estimated_time', v],
  bookmarked: (v) => ['bookmarked', v],
  recurrence: (v) => ['recurrence', v],
  krId: (v) => ['kr_id', v ? v : null],
};

/** Modifie une tâche ; refuse un patch vide et un nom vidé. */
export async function updateTask(client, taskId, patch = {}) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');

  // Même piège qu'à la création : la colonne attend un UUID de categories.id.
  const resolved = { ...patch };
  if (resolved.category !== undefined) {
    resolved.category = await resolveCategoryId(client, resolved.category);
  }
  patch = resolved;

  const row = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const mapper = UPDATABLE_FIELDS[key];
    if (!mapper) continue;
    const [column, mapped] = mapper(value);
    if (column === 'deadline') Object.assign(row, deadlineFields(mapped, await deadlineColumns(client)));
    else row[column] = mapped;
  }

  if (Object.keys(row).length === 0) {
    throw new CosmoValidationError(
      `Aucun champ modifiable fourni. Champs acceptes : ${Object.keys(UPDATABLE_FIELDS).join(', ')}.`
    );
  }
  if (row.name !== undefined && row.name === '') {
    throw new CosmoValidationError('Le nom d une tache ne peut pas etre vide.');
  }

  // `select('*')`, pas TASK_COLUMNS : meme raison que createTask ci-dessus.
  const data = unwrap(
    await client.from('tasks').update(row).eq('id', taskId).select('*').single()
  );
  return mapTaskFromRow(data);
}

/** Supprime définitivement une tâche (`--confirm` exigé par cli.mjs) ; rend ce qui a disparu. */
export async function deleteTask(client, taskId) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');

  const existing = unwrap(
    await client.from('tasks').select(taskColumns(await deadlineColumns(client))).eq('id', taskId)
  );
  const row = Array.isArray(existing) ? existing[0] : existing;
  if (!row) throw new CosmoNotFoundError(`Tache introuvable : ${taskId}`);

  unwrap(await client.from('tasks').delete().eq('id', taskId));
  return mapTaskFromRow(row);
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
  // Champs alignés sur EventRow (src/modules/events/mappers.ts). Pas de
  // `all_day` : cette colonne n'existe pas sur `events`.
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    description: row.description,
    taskId: row.task_id,
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
