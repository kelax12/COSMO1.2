// ═══════════════════════════════════════════════════════════════════
// Exécution d'un plan d'import, et son annulation
//
// Sans React ni réseau : les écritures sont injectées (`ImportDeps`), ce qui
// rend le module testable et le laisse marcher en démo comme en production.
//
//   1. Les catégories, UNE PAR UNE, parents d'abord : un enfant a besoin de
//      l'id de son parent.
//   2. Les tâches, par lots de `concurrency` en parallèle : assez pour qu'un
//      import de quelques centaines de tâches tienne en secondes, pas assez
//      pour noyer l'API.
//   3. Une écriture qui échoue n'arrête rien : elle est listée à la fin.
//      Une catégorie refusée n'emporte pas ses tâches : elles naissent sans
//      catégorie, plutôt que perdues.
//
// L'annulation supprime les tâches créées, puis les catégories créées,
// enfants d'abord. Si une tâche résiste, les catégories restent : les
// supprimer DÉTACHERAIT cette tâche (clé étrangère SET NULL, mig. 145).
// ═══════════════════════════════════════════════════════════════════
import type { CreateTaskInput } from '@/modules/tasks';
import type { Category } from '@/modules/categories';
import { existingPathIndex, pathKey, type ImportPlan } from './plan';

/** Bornes de la garde zod (`task.schema.ts`) : au-delà, le serveur refuserait APRÈS coup. */
const MAX_NAME = 500;
const MAX_DESCRIPTION = 5000;
const MAX_SUBTASKS = 50;
const MAX_SUBTASK_NAME = 200;

export interface ImportDeps {
  createCategory: (input: { name: string; parentId: string | null }) => Promise<{ id: string }>;
  createTask: (input: CreateTaskInput) => Promise<{ id: string }>;
  deleteTask: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  /** `deadlineFromDayKey` : un jour → l'instant à stocker (R-01). */
  toDeadline: (dayKey: string) => string;
}

export interface ImportFailure { line: number; name: string; message: string }

export interface ImportResult {
  createdTaskIds: string[];
  createdCategoryIds: string[];
  failures: ImportFailure[];
  failedCategories: string[][];
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function pool<T>(items: readonly T[], concurrency: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await work(item);
    }
  });
  await Promise.all(workers);
}

export async function runImport(
  plan: ImportPlan,
  existing: readonly Category[],
  deps: ImportDeps,
  onProgress: (done: number, total: number) => void,
  concurrency = 4,
): Promise<ImportResult> {
  const index = existingPathIndex(existing);
  const result: ImportResult = { createdTaskIds: [], createdCategoryIds: [], failures: [], failedCategories: [] };

  for (const path of plan.categoriesToCreate) {
    const parentId = path.length > 1 ? index.get(pathKey(path.slice(0, -1))) : null;
    if (parentId === undefined) { result.failedCategories.push(path); continue; } // parent refusé
    try {
      const { id } = await deps.createCategory({ name: path[path.length - 1], parentId });
      index.set(pathKey(path), id);
      result.createdCategoryIds.push(id);
    } catch {
      result.failedCategories.push(path);
    }
  }

  const total = plan.tasks.length;
  let done = 0;
  onProgress(0, total);
  await pool(plan.tasks, concurrency, async (task) => {
    const input: CreateTaskInput = {
      name: task.name.slice(0, MAX_NAME),
      description: task.description ? task.description.slice(0, MAX_DESCRIPTION) : undefined,
      priority: task.priority,
      category: task.categoryPath.length ? index.get(pathKey(task.categoryPath)) ?? '' : '',
      deadline: task.dueDay ? deps.toDeadline(task.dueDay) : '',
      estimatedTime: 0,
      bookmarked: false,
      completed: task.completed,
      status: task.completed ? 'done' : 'todo',
      recurrence: task.recurrence,
      subtasks: task.subtasks.slice(0, MAX_SUBTASKS).map((name) => ({
        id: crypto.randomUUID(), name: name.slice(0, MAX_SUBTASK_NAME), completed: false,
      })),
    };
    try {
      const { id } = await deps.createTask(input);
      result.createdTaskIds.push(id);
    } catch (error) {
      result.failures.push({ line: task.line, name: task.name, message: messageOf(error) });
    }
    done++;
    onProgress(done, total);
  });

  result.failures.sort((a, b) => a.line - b.line);
  return result;
}

export async function undoImport(result: ImportResult, deps: ImportDeps, concurrency = 4): Promise<{ failed: number }> {
  let failed = 0;
  await pool(result.createdTaskIds, concurrency, async (id) => {
    try { await deps.deleteTask(id); } catch { failed++; }
  });
  if (failed > 0) return { failed };
  for (const id of [...result.createdCategoryIds].reverse()) {
    try { await deps.deleteCategory(id); } catch { failed++; }
  }
  return { failed };
}
