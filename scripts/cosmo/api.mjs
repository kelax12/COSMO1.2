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
