import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  TASK_COLUMNS, todayLocal, listTasks,
  createTask, completeTask, DEFAULT_TASK,
} from './api.mjs';
import { CosmoValidationError } from './errors.mjs';

/**
 * Faux client Supabase : chaque méthode de chaînage se retourne elle-même,
 * et le résultat final est `await`-able via then(). Enregistre les appels
 * pour qu'on puisse asserter les filtres envoyés.
 */
function makeFakeClient(result = { data: [], error: null }) {
  const calls = [];
  const chain = {
    select: (...a) => (calls.push(['select', ...a]), chain),
    eq: (...a) => (calls.push(['eq', ...a]), chain),
    gte: (...a) => (calls.push(['gte', ...a]), chain),
    lte: (...a) => (calls.push(['lte', ...a]), chain),
    order: (...a) => (calls.push(['order', ...a]), chain),
    limit: (...a) => (calls.push(['limit', ...a]), chain),
    insert: (...a) => (calls.push(['insert', ...a]), chain),
    update: (...a) => (calls.push(['update', ...a]), chain),
    single: (...a) => (calls.push(['single', ...a]), chain),
    then: (resolve) => resolve(result),
  };
  return {
    calls,
    from: (table) => (calls.push(['from', table]), chain),
    rpc: (...a) => (calls.push(['rpc', ...a]), chain),
  };
}

describe('TASK_COLUMNS — garde anti-derive', () => {
  it('correspond exactement a TASK_LIST_COLUMNS du repository applicatif', () => {
    const repoPath = path.resolve(process.cwd(), 'src/modules/tasks/supabase.repository.ts');
    const source = fs.readFileSync(repoPath, 'utf8');
    const match = source.match(/TASK_LIST_COLUMNS[^'"`]*['"`]([^'"`]+)['"`]/);
    expect(match, 'TASK_LIST_COLUMNS introuvable dans le repository').not.toBeNull();

    const appColumns = match[1].split(',').map((c) => c.trim()).sort();
    const cliColumns = TASK_COLUMNS.split(',').map((c) => c.trim()).sort();
    expect(cliColumns).toEqual(appColumns);
  });
});

describe('todayLocal', () => {
  it('produit une date locale au format YYYY-MM-DD', () => {
    const value = todayLocal(new Date(2026, 6, 27, 23, 30));
    expect(value).toBe('2026-07-27');
  });

  it('utilise la date LOCALE et non UTC en fin de journee', () => {
    // 23h30 le 27 en local peut être le 28 en UTC. La convention du projet
    // (en-CA) doit renvoyer le 27 — c'est la classe de bugs timezone déjà
    // éradiquée dans l'app.
    const late = new Date(2026, 6, 27, 23, 59, 59);
    expect(todayLocal(late)).toBe('2026-07-27');
  });
});

describe('listTasks', () => {
  it('selectionne les colonnes canoniques et trie par echeance', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listTasks(client, {});
    expect(client.calls).toContainEqual(['from', 'tasks']);
    expect(client.calls).toContainEqual(['select', TASK_COLUMNS]);
    expect(client.calls.some(([m, col]) => m === 'order' && col === 'deadline')).toBe(true);
  });

  it('filtre sur completed quand l option est fournie', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listTasks(client, { completed: false });
    expect(client.calls).toContainEqual(['eq', 'completed', false]);
  });

  it('ne filtre pas sur completed quand l option est absente', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listTasks(client, {});
    expect(client.calls.some(([m, col]) => m === 'eq' && col === 'completed')).toBe(false);
  });

  it('mappe les colonnes snake_case vers le domaine', async () => {
    const row = {
      id: 't1', name: 'Ecrire le plan', priority: 2, category: 'Travail',
      deadline: '2026-07-27', estimated_time: 45, bookmarked: false,
      completed: false, completed_at: null, kr_id: null, recurrence: 'none',
    };
    const client = makeFakeClient({ data: [row], error: null });
    const tasks = await listTasks(client, {});
    expect(tasks[0]).toMatchObject({
      id: 't1', name: 'Ecrire le plan', estimatedTime: 45, completed: false, recurrence: 'none',
    });
  });
});

describe('createTask', () => {
  it('refuse un nom vide sans appeler le reseau', async () => {
    const client = makeFakeClient();
    await expect(createTask(client, { name: '   ' })).rejects.toThrow(CosmoValidationError);
    expect(client.calls).toHaveLength(0);
  });

  it('retombe sur la premiere categorie de l utilisateur quand aucune n est fournie', async () => {
    const client = makeFakeClient({ data: [{ id: 'c1', name: 'Perso' }], error: null });
    await createTask(client, { name: 'X' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].category).toBe('Perso');
  });

  it('leve une erreur explicite si l utilisateur n a aucune categorie', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await expect(createTask(client, { name: 'X' })).rejects.toThrow(/categorie/i);
  });

  it('applique les defauts documentes', async () => {
    const client = makeFakeClient({ data: { id: 'n1', name: 'X' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso' }, { now: new Date(2026, 6, 27) });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1]).toMatchObject({
      name: 'X',
      category: 'Perso',
      priority: DEFAULT_TASK.priority,
      estimated_time: DEFAULT_TASK.estimatedTime,
      deadline: '2026-07-27',
      bookmarked: false,
      completed: false,
      recurrence: 'none',
    });
  });

  it('n envoie JAMAIS user_id (frontiere anti-mass-assignment)', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso', userId: 'pirate' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1]).not.toHaveProperty('user_id');
  });

  it('transforme une echeance vide en NULL (colonne timestamp)', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso', deadline: '' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].deadline).toBeNull();
  });
});

describe('completeTask', () => {
  it('pose completed ET completed_at', async () => {
    const client = makeFakeClient({ data: { id: 't1', completed: true }, error: null });
    await completeTask(client, 't1', { now: new Date(2026, 6, 27) });
    const update = client.calls.find(([m]) => m === 'update');
    expect(update[1]).toMatchObject({ completed: true, completed_at: '2026-07-27' });
  });

  it('cible bien la tache demandee', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await completeTask(client, 't1');
    expect(client.calls).toContainEqual(['eq', 'id', 't1']);
  });
});
