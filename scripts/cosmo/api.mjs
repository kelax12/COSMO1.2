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
 * Crée une tâche.
 *
 * `user_id` DOIT être envoyé : la policy RLS de `tasks` porte un
 * `WITH CHECK (auth.uid() = user_id)` et la colonne n'a pas de DEFAULT — un
 * insert sans user_id est rejeté. La frontière de sécurité n'est donc pas
 * « ne jamais l'émettre » mais « le prendre de la session vérifiée, jamais de
 * `input` », exactement comme le repository applicatif
 * (src/modules/tasks/supabase.repository.ts:206).
 */
export async function createTask(client, input, { now = new Date(), userId } = {}) {
  const name = (input?.name ?? '').trim();
  if (!name) throw new CosmoValidationError('Le nom de la tache est obligatoire.');
  if (!userId) {
    throw new CosmoValidationError(
      'userId de session manquant : impossible de creer une tache (RLS tasks).'
    );
  }

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
    // Depuis la session, jamais depuis `input` : c'est ça, la garde
    // anti-mass-assignment.
    user_id: userId,
  };
  if (input.description !== undefined) row.description = input.description;
  if (input.krId) row.kr_id = input.krId;

  const data = unwrap(await client.from('tasks').insert(row).select(TASK_COLUMNS).single());
  return mapTaskFromRow(data);
}

/**
 * Coche une tâche.
 *
 * `completed_at` reçoit un INSTANT complet (`toISOString`), pas une date seule :
 * c'est ce que fait l'app (src/modules/tasks/hooks.ts:338), et `sortCompletedTasks`
 * trie les tâches terminées en comparant cette chaîne. Une date seule est
 * coercee a minuit, ce qui melangeait l'ordre des taches cochees via le CLI.
 */
export async function completeTask(client, taskId, { now = new Date() } = {}) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');
  const data = unwrap(
    await client
      .from('tasks')
      .update({ completed: true, completed_at: now.toISOString() })
      .eq('id', taskId)
      .select(TASK_COLUMNS)
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
      .select(TASK_COLUMNS)
      .single()
  );
  return mapTaskFromRow(data);
}

/**
 * Champs modifiables via le CLI. Whitelist explicite : tout ce qui n'est pas
 * ici est ignoré. `user_id` en est absent par construction — c'est la même
 * frontière anti-mass-assignment que `mapTaskToDb`.
 */
const UPDATABLE_FIELDS = {
  name: (v) => ['name', String(v).trim()],
  description: (v) => ['description', v],
  priority: (v) => ['priority', v],
  category: (v) => ['category', v],
  // Chaîne vide = « pas d'échéance » → NULL (la colonne est un timestamp).
  deadline: (v) => ['deadline', v ? v : null],
  estimatedTime: (v) => ['estimated_time', v],
  bookmarked: (v) => ['bookmarked', v],
  recurrence: (v) => ['recurrence', v],
  krId: (v) => ['kr_id', v ? v : null],
};

/**
 * Modifie une tâche existante. Refuse un patch vide plutôt que d'envoyer un
 * UPDATE sans effet, et refuse un nom vidé — `name` est non-optionnel dans le
 * modèle domaine.
 */
export async function updateTask(client, taskId, patch = {}) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');

  const row = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const mapper = UPDATABLE_FIELDS[key];
    if (!mapper) continue;
    const [column, mapped] = mapper(value);
    row[column] = mapped;
  }

  if (Object.keys(row).length === 0) {
    throw new CosmoValidationError(
      `Aucun champ modifiable fourni. Champs acceptes : ${Object.keys(UPDATABLE_FIELDS).join(', ')}.`
    );
  }
  if (row.name !== undefined && row.name === '') {
    throw new CosmoValidationError('Le nom d une tache ne peut pas etre vide.');
  }

  const data = unwrap(
    await client.from('tasks').update(row).eq('id', taskId).select(TASK_COLUMNS).single()
  );
  return mapTaskFromRow(data);
}

/**
 * Supprime définitivement une tâche.
 *
 * Irréversible : la RLS empêche de toucher aux tâches d'autrui, mais rien ne
 * rattrape une suppression de la sienne. Le garde-fou vit dans cli.mjs, qui
 * exige `--confirm`. On renvoie la tâche telle qu'elle était pour que
 * l'appelant puisse afficher ce qui a disparu.
 */
export async function deleteTask(client, taskId) {
  if (!taskId) throw new CosmoValidationError('Identifiant de tache manquant.');

  const existing = unwrap(await client.from('tasks').select(TASK_COLUMNS).eq('id', taskId));
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
