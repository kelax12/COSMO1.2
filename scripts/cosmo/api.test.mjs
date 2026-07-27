import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  TASK_COLUMNS, todayLocal, listTasks,
  createTask, completeTask, DEFAULT_TASK,
  listHabitsToday, markHabitDone,
  listUpcomingEvents, listOkrs,
  reopenTask, updateTask, deleteTask,
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
    delete: (...a) => (calls.push(['delete', ...a]), chain),
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
    await createTask(client, { name: 'X' }, { userId: 'u1' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].category).toBe('Perso');
  });

  it('leve une erreur explicite si l utilisateur n a aucune categorie', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await expect(createTask(client, { name: 'X' }, { userId: 'u1' })).rejects.toThrow(/categorie/i);
  });

  it('applique les defauts documentes', async () => {
    const client = makeFakeClient({ data: { id: 'n1', name: 'X' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso' }, { now: new Date(2026, 6, 27), userId: 'u1' });
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

  // La policy RLS `tasks` a un WITH CHECK (auth.uid() = user_id) et la colonne
  // n'a pas de DEFAULT : il FAUT envoyer user_id. La frontiere de securite
  // n'est donc pas « ne jamais l'envoyer » mais « le prendre de la session
  // verifiee, jamais de l'entree appelante » — comme le fait le repository
  // applicatif (supabase.repository.ts:206).
  it('pose le user_id de la session et ignore celui fourni en entree', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await createTask(
      client,
      { name: 'X', category: 'Perso', userId: 'pirate' },
      { userId: 'session-user' }
    );
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].user_id).toBe('session-user');
  });

  it('refuse d ecrire sans userId de session plutot que d envoyer un NULL', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await expect(createTask(client, { name: 'X', category: 'Perso' })).rejects.toThrow(/session/i);
    expect(client.calls.some(([m]) => m === 'insert')).toBe(false);
  });

  it('transforme une echeance vide en NULL (colonne timestamp)', async () => {
    const client = makeFakeClient({ data: { id: 'n1' }, error: null });
    await createTask(client, { name: 'X', category: 'Perso', deadline: '' }, { userId: 'u1' });
    const insert = client.calls.find(([m]) => m === 'insert');
    expect(insert[1].deadline).toBeNull();
  });
});

describe('completeTask', () => {
  it('pose completed ET completed_at', async () => {
    const client = makeFakeClient({ data: { id: 't1', completed: true }, error: null });
    const now = new Date(2026, 6, 27, 19, 12);
    await completeTask(client, 't1', { now });
    const update = client.calls.find(([m]) => m === 'update');
    // completed_at est un instant complet (cf. describe « horodatage »).
    expect(update[1]).toMatchObject({ completed: true, completed_at: now.toISOString() });
  });

  it('cible bien la tache demandee', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await completeTask(client, 't1');
    expect(client.calls).toContainEqual(['eq', 'id', 't1']);
  });
});

describe('listHabitsToday', () => {
  it('annote chaque habitude avec doneToday', async () => {
    const client = makeFakeClient({
      data: [
        { id: 'h1', name: 'Sport', completions: { '2026-07-27': true }, estimated_time: 30 },
        { id: 'h2', name: 'Lecture', completions: {}, estimated_time: 20 },
      ],
      error: null,
    });
    const habits = await listHabitsToday(client, { now: new Date(2026, 6, 27) });
    expect(habits[0]).toMatchObject({ id: 'h1', name: 'Sport', doneToday: true });
    expect(habits[1]).toMatchObject({ id: 'h2', name: 'Lecture', doneToday: false });
  });

  it('tolere completions absent', async () => {
    const client = makeFakeClient({ data: [{ id: 'h1', name: 'X' }], error: null });
    const habits = await listHabitsToday(client, { now: new Date(2026, 6, 27) });
    expect(habits[0].doneToday).toBe(false);
  });
});

describe('markHabitDone', () => {
  it('appelle la RPC toggle_habit_completion quand l habitude n est pas faite', async () => {
    const client = makeFakeClient({ data: [{ id: 'h1', name: 'Sport', completions: {} }], error: null });
    await markHabitDone(client, 'h1', { now: new Date(2026, 6, 27) });
    expect(client.calls).toContainEqual([
      'rpc', 'toggle_habit_completion', { p_habit_id: 'h1', p_date: '2026-07-27' },
    ]);
  });

  it('est idempotent : n appelle PAS la RPC si deja faite (sinon elle decocherait)', async () => {
    const client = makeFakeClient({
      data: [{ id: 'h1', name: 'Sport', completions: { '2026-07-27': true } }],
      error: null,
    });
    const result = await markHabitDone(client, 'h1', { now: new Date(2026, 6, 27) });
    expect(client.calls.some(([m]) => m === 'rpc')).toBe(false);
    expect(result.alreadyDone).toBe(true);
  });

  it('ne fait jamais de update direct sur completions (TOCTOU-1)', async () => {
    const client = makeFakeClient({ data: [{ id: 'h1', completions: {} }], error: null });
    await markHabitDone(client, 'h1', { now: new Date(2026, 6, 27) });
    expect(client.calls.some(([m]) => m === 'update')).toBe(false);
  });
});

describe('listUpcomingEvents', () => {
  it('filtre explicitement sur user_id (RLS mig. 077 renvoie aussi l equipe)', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listUpcomingEvents(client, { userId: 'me-123', now: new Date(2026, 6, 27) });
    expect(client.calls).toContainEqual(['eq', 'user_id', 'me-123']);
  });

  it('refuse de requeter sans userId plutot que de tout renvoyer', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await expect(listUpcomingEvents(client, {})).rejects.toThrow(CosmoValidationError);
    expect(client.calls).toHaveLength(0);
  });

  it('borne la fenetre a partir de maintenant et trie par start_time', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listUpcomingEvents(client, { userId: 'me', now: new Date(2026, 6, 27, 9, 0) });
    expect(client.calls.some(([m, col]) => m === 'gte' && col === 'start_time')).toBe(true);
    expect(client.calls.some(([m, col]) => m === 'order' && col === 'start_time')).toBe(true);
  });
});

describe('listOkrs', () => {
  it('lit les okrs et leurs key results', async () => {
    const client = makeFakeClient({
      data: [{ id: 'o1', title: 'Lancer COSMO', progress: 40, completed: false }],
      error: null,
    });
    const okrs = await listOkrs(client);
    expect(okrs[0]).toMatchObject({ id: 'o1', title: 'Lancer COSMO', progress: 40 });
  });

  it('n effectue aucune ecriture (OKR en lecture seule, journal kr_completions)', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await listOkrs(client);
    expect(client.calls.some(([m]) => m === 'insert' || m === 'update' || m === 'rpc')).toBe(false);
  });
});

describe('completeTask — horodatage', () => {
  it('pose un INSTANT complet, pas une date seule', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await completeTask(client, 't1', { now: new Date(Date.UTC(2026, 6, 27, 19, 12, 0)) });
    const update = client.calls.find(([m]) => m === 'update');
    // Une date seule ('2026-07-27') serait coercee a minuit et casserait
    // l'ordre de sortCompletedTasks cote app.
    expect(update[1].completed_at).toBe('2026-07-27T19:12:00.000Z');
    expect(update[1].completed_at).not.toBe('2026-07-27');
  });
});

describe('reopenTask', () => {
  it('remet completed a false ET efface completed_at', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await reopenTask(client, 't1');
    const update = client.calls.find(([m]) => m === 'update');
    expect(update[1]).toEqual({ completed: false, completed_at: null });
  });
});

describe('updateTask', () => {
  it('mappe les champs domaine vers les colonnes snake_case', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await updateTask(client, 't1', { name: 'Nouveau', estimatedTime: 90, priority: 5 });
    const update = client.calls.find(([m]) => m === 'update');
    expect(update[1]).toEqual({ name: 'Nouveau', estimated_time: 90, priority: 5 });
  });

  it('ignore les champs hors whitelist, dont user_id', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await updateTask(client, 't1', { name: 'X', userId: 'pirate', user_id: 'pirate', id: 'autre' });
    const update = client.calls.find(([m]) => m === 'update');
    expect(update[1]).toEqual({ name: 'X' });
  });

  it('transforme une echeance videe en NULL', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await updateTask(client, 't1', { deadline: '' });
    const update = client.calls.find(([m]) => m === 'update');
    expect(update[1].deadline).toBeNull();
  });

  it('refuse un patch vide au lieu d envoyer un UPDATE sans effet', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await expect(updateTask(client, 't1', {})).rejects.toThrow(CosmoValidationError);
    expect(client.calls.some(([m]) => m === 'update')).toBe(false);
  });

  it('refuse de vider le nom', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await expect(updateTask(client, 't1', { name: '   ' })).rejects.toThrow(/nom/i);
  });

  it('ignore les valeurs undefined sans les compter comme un patch', async () => {
    const client = makeFakeClient({ data: { id: 't1' }, error: null });
    await expect(updateTask(client, 't1', { name: undefined })).rejects.toThrow(CosmoValidationError);
  });
});

describe('deleteTask', () => {
  it('lit la tache avant de la supprimer, pour pouvoir l afficher', async () => {
    const client = makeFakeClient({ data: [{ id: 't1', name: 'A jeter' }], error: null });
    const removed = await deleteTask(client, 't1');
    const order = client.calls.map(([m]) => m);
    expect(order.indexOf('select')).toBeLessThan(order.indexOf('delete'));
    expect(removed.name).toBe('A jeter');
  });

  it('leve CosmoNotFoundError sans rien supprimer si la tache n existe pas', async () => {
    const client = makeFakeClient({ data: [], error: null });
    await expect(deleteTask(client, 'inconnu')).rejects.toThrow(/introuvable/i);
    expect(client.calls.some(([m]) => m === 'delete')).toBe(false);
  });
});
