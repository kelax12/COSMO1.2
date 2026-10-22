// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { exportAllCSV, exportTaskDependenciesCSV } from './csv-export';
import type { Task, TaskDependency } from '@/modules/tasks';
import { SupabaseTasksRepository } from '@/modules/tasks/supabase.repository';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';

// ═══════════════════════════════════════════════════════════════════
// Portabilité (RGPD art. 20) : les DÉPENDANCES entre tâches personnelles
// ═══════════════════════════════════════════════════════════════════
//
// `task_dependencies` (mig. 132) est saisie par la personne : « je ne peux
// pas rédiger l'article tant que l'interview n'est pas transcrite ». Elle a
// été déclarée « dette reconnue » dans `check-portability-export.mjs` du
// 2026-08-30 au 2026-10-22 : l'export rendait les tâches sans le graphe qui
// les ordonne. Ces tests exigent le fichier, et son contenu.

/** Chaque téléchargement déclenché : nom de fichier et texte. */
const telecharges: { name: string; text: Promise<string> }[] = [];

beforeEach(() => {
  telecharges.length = 0;
  supabaseMock.reset();
  localStorage.clear();
  let dernierBlob: Blob | null = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    dernierBlob = b as Blob;
    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    telecharges.push({ name: this.download, text: dernierBlob!.text() });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const tache = (id: string, name: string): Task => ({
  id,
  name,
  priority: 3,
  category: 'c1',
  deadline: '',
  estimatedTime: 30,
  completed: false,
  bookmarked: false,
  isCollaborative: false,
  collaborators: [],
  createdAt: '2026-10-01T00:00:00.000Z',
} as unknown as Task);

const taches = [tache('t-interview', 'Transcrire interview'), tache('t-article', 'Rédiger article')];
const deps: TaskDependency[] = [{ taskId: 't-article', dependsOnId: 't-interview' }];

describe('export des dépendances entre tâches (mig. 132)', () => {
  it('exportTaskDependenciesCSV : une ligne par arête, identifiants ET noms des deux tâches', async () => {
    exportTaskDependenciesCSV(deps, taches);

    expect(telecharges).toHaveLength(1);
    expect(telecharges[0].name).toMatch(/^cosmo-dependances-\d{4}-\d{2}-\d{2}\.csv$/);
    const lignes = (await telecharges[0].text).replace(/^\uFEFF/, '').split('\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toBe('t-article,Rédiger article,t-interview,Transcrire interview');
  });

  it('une tâche absente de la liste ne fait pas disparaître l’arête : le nom reste vide', async () => {
    exportTaskDependenciesCSV([{ taskId: 'x', dependsOnId: 't-interview' }], taches);
    const lignes = (await telecharges[0].text).replace(/^\uFEFF/, '').split('\n');
    expect(lignes[1]).toBe('x,,t-interview,Transcrire interview');
  });

  it('exportAllCSV livre le fichier des dépendances avec les autres', async () => {
    vi.useFakeTimers();
    exportAllCSV({
      tasks: taches,
      taskDependencies: deps,
      habits: [],
      events: [],
      okrs: [],
      categories: [],
      lists: [],
      profile: { id: 'u1', name: 'A', email: 'a@example.com' },
    });
    vi.runAllTimers();

    expect(telecharges).toHaveLength(8);
    const fichier = telecharges.find((d) => d.name.startsWith('cosmo-dependances-'));
    expect(fichier).toBeDefined();
    expect(await fichier!.text).toContain('t-article,Rédiger article,t-interview,Transcrire interview');
  });
});

// Le fichier ne vaut que ce que le repository lui donne : on rejoue la chaîne
// réelle, de la lecture du graphe au CSV, pour les deux modes.
describe('chaîne repository → fichier des dépendances', () => {
  it('production : les arêtes lues dans `task_dependencies` sortent dans le CSV', async () => {
    supabaseMock.queueTable('task_dependencies', {
      data: [{ task_id: 't-article', depends_on_id: 't-interview' }],
    });
    const lues = await new SupabaseTasksRepository().getDependencies();

    exportTaskDependenciesCSV(lues, taches);
    expect(await telecharges[0].text).toContain('t-article,Rédiger article,t-interview,Transcrire interview');
  });

  it('démo : une dépendance posée dans le repository local sort dans le CSV', async () => {
    const repo = new LocalStorageTasksRepository();
    const [a, b] = await repo.getAll();
    await repo.addDependency(a.id, b.id);

    exportTaskDependenciesCSV(await repo.getDependencies(), await repo.getAll());
    const lignes = (await telecharges[0].text).replace(/^\uFEFF/, '').split('\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toContain(`${a.id},`);
    expect(lignes[1]).toContain(`,${b.id},`);
  });
});
