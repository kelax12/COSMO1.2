// ═══════════════════════════════════════════════════════════════════
// Import de tâches : l'état de la fenêtre, de la lecture des fichiers à
// l'annulation. Le rendu vit dans `ImportTasksDialog`, la logique pure dans
// `@/lib/task-import`.
//
// Les écritures passent par les repositories (démo comme production), comme
// `TeamBulkAddDialog` : un import de 300 tâches par `useCreateTask` ferait
// 300 toasts et 300 mises à jour de cache. Les caches sont invalidés UNE fois,
// à la fin.
// ═══════════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCategoriesRepository, getTasksRepository } from '@/lib/repository.factory';
import { categoryKeys, DEFAULT_CATEGORY_COLOR, useCategories } from '@/modules/categories';
import { taskKeys } from '@/modules/tasks';
import { deadlineFromDayKey } from '@/lib/deadline';
import { parseCsv } from '@/lib/task-import/csv';
import { detectFormat } from '@/lib/task-import/detect';
import { parseTodoist, type ImportTexts } from '@/lib/task-import/todoist';
import { parseTickTick } from '@/lib/task-import/ticktick';
import { guessMapping, parseGeneric, type ColumnMapping } from '@/lib/task-import/generic';
import { buildImportPlan } from '@/lib/task-import/plan';
import { runImport, undoImport, type ImportDeps, type ImportResult } from '@/lib/task-import/execute';
import type { ImportSource, ParsedImport } from '@/lib/task-import/types';
import { useT } from '@/i18n/useT';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface LoadedFile {
  name: string;
  source: ImportSource;
  rows: string[][];
  mapping: ColumnMapping;
}

export type ImportStep = 'files' | 'mapping' | 'preview' | 'running' | 'done';

export function useTaskImport() {
  const { t } = useT('settings');
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [step, setStep] = useState<ImportStep>('files');
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [undo, setUndo] = useState<{ state: 'idle' | 'running' | 'done'; failed: number }>({ state: 'idle', failed: 0 });

  const texts: ImportTexts = useMemo(() => ({
    labels: (list) => t('import.labels', { list }),
    originalDue: (value) => t('import.originalDue', { value }),
  }), [t]);

  const parsed: ParsedImport[] = useMemo(() => files.map((f) => {
    if (f.source === 'todoist') return parseTodoist(f.rows, f.name, texts);
    if (f.source === 'ticktick') return parseTickTick(f.rows, f.name, texts);
    return parseGeneric(f.rows, f.mapping, f.name);
  }), [files, texts]);

  const plan = useMemo(() => buildImportPlan(parsed, categories, { includeCompleted }), [parsed, categories, includeCompleted]);
  const completedAvailable = useMemo(() => parsed.reduce((n, p) => n + p.tasks.filter((x) => x.completed).length, 0), [parsed]);

  const deps: ImportDeps = useMemo(() => {
    const tasksRepo = getTasksRepository();
    const categoriesRepo = getCategoriesRepository();
    const colorById = new Map(categories.map((c) => [c.id, c.color]));
    return {
      // Couleur héritée du parent, comme `useCreateCategory`.
      createCategory: ({ name, parentId }) => categoriesRepo.create({
        name, parentId, color: (parentId && colorById.get(parentId)) || DEFAULT_CATEGORY_COLOR,
      }),
      createTask: (input) => tasksRepo.create(input),
      deleteTask: (id) => tasksRepo.delete(id),
      deleteCategory: (id) => categoriesRepo.delete(id),
      toDeadline: (day) => deadlineFromDayKey(day),
    };
  }, [categories]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: categoryKeys.all });
  };

  const addFiles = async (list: FileList | File[]) => {
    const loaded: LoadedFile[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) { problems.push(t('import.tooBig', { name: file.name })); continue; }
      let rows: string[][] = [];
      try { rows = parseCsv(await file.text()); } catch { rows = []; }
      if (rows.length < 2) { problems.push(t('import.unreadable', { name: file.name })); continue; }
      const source = detectFormat(rows);
      loaded.push({ name: file.name, source, rows, mapping: source === 'generic' ? guessMapping(rows[0]) : {} });
    }
    setErrors(problems);
    if (loaded.length === 0) return;
    const next = [...files, ...loaded];
    setFiles(next);
    setStep(next.some((f) => f.source === 'generic') ? 'mapping' : 'preview');
  };

  const setMapping = (name: string, mapping: ColumnMapping) =>
    setFiles((prev) => prev.map((f) => (f.name === name ? { ...f, mapping } : f)));

  const start = async () => {
    setStep('running');
    setProgress({ done: 0, total: plan.tasks.length });
    const out = await runImport(plan, categories, deps, (done, total) => setProgress({ done, total }));
    setResult(out);
    setStep('done');
    refresh();
  };

  const undoAll = async () => {
    if (!result) return;
    setUndo({ state: 'running', failed: 0 });
    const { failed } = await undoImport(result, deps);
    setUndo({ state: 'done', failed });
    refresh();
  };

  const reset = () => {
    setStep('files'); setFiles([]); setErrors([]); setIncludeCompleted(false);
    setProgress({ done: 0, total: 0 }); setResult(null); setUndo({ state: 'idle', failed: 0 });
  };

  return {
    step, setStep, files, errors, parsed, plan, completedAvailable, includeCompleted, setIncludeCompleted,
    progress, result, undo, addFiles, setMapping, start, undoAll, reset,
  };
}
