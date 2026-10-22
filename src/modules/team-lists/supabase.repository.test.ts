import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { SupabaseTeamListsRepository } from './supabase.repository';

const repo = new SupabaseTeamListsRepository();
const DB_ERROR = { message: 'boom', code: '42P01' };
const LIST_COLUMNS = 'id, org_id, name, color, type, smart_rule, position';

const manualRow = { id: 'l1', org_id: 'org1', name: 'Sprint', color: '#00f', type: 'manual', smart_rule: null, position: 0 };
const smartRow = { id: 'l2', org_id: 'org1', name: 'En retard', color: '#f00', type: 'smart', smart_rule: 'overdue', position: 1 };

beforeEach(() => supabaseMock.reset());

describe('SupabaseTeamListsRepository — getLists (mig. 203)', () => {
  it('lit les listes par org_id puis la jonction des SEULES listes manuelles', async () => {
    supabaseMock.queueTable('team_lists', { data: [manualRow, smartRow] });
    supabaseMock.queueTable('team_list_tasks', {
      data: [{ list_id: 'l1', task_id: 't1' }, { list_id: 'l1', task_id: 't2' }],
    });
    const lists = await repo.getLists('org1');

    expect(supabaseMock.argsOf('team_lists', 'select')).toEqual([LIST_COLUMNS]);
    expect(supabaseMock.argsOf('team_lists', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_lists', 'order')).toEqual(['position', { ascending: true }]);
    expect(supabaseMock.argsOf('team_list_tasks', 'in')).toEqual(['list_id', ['l1']]);
    expect(supabaseMock.argsOf('team_list_tasks', 'limit')).toEqual([5000]);
    expect(lists).toEqual([
      { id: 'l1', orgId: 'org1', name: 'Sprint', color: '#00f', type: 'manual', position: 0, taskIds: ['t1', 't2'] },
      { id: 'l2', orgId: 'org1', name: 'En retard', color: '#f00', type: 'smart', smartRule: 'overdue', position: 1, taskIds: [] },
    ]);
  });

  it('aucune liste manuelle → pas de lecture de la jonction', async () => {
    supabaseMock.queueTable('team_lists', { data: [smartRow] });
    await repo.getLists('org1');
    expect(supabaseMock.queries.map((q) => q.table)).toEqual(['team_lists']);
  });

  it('data null → [], jonction null → listes vides', async () => {
    supabaseMock.queueTable('team_lists', { data: null });
    expect(await repo.getLists('org1')).toEqual([]);

    supabaseMock.queueTable('team_lists', { data: [manualRow] });
    supabaseMock.queueTable('team_list_tasks', { data: null });
    const [l] = await repo.getLists('org1');
    expect(l.taskIds).toEqual([]);
  });

  it('erreurs des deux lectures normalisées', async () => {
    supabaseMock.queueTable('team_lists', { error: DB_ERROR });
    await expect(repo.getLists('org1')).rejects.toBeTruthy();

    supabaseMock.queueTable('team_lists', { data: [manualRow] });
    supabaseMock.queueTable('team_list_tasks', { error: DB_ERROR });
    await expect(repo.getLists('org1')).rejects.toBeTruthy();
  });
});

describe('SupabaseTeamListsRepository — écritures', () => {
  it('createList: created_by = auth.uid, position = nombre de listes, type manuel par défaut', async () => {
    supabaseMock.queueTable('team_lists', { count: 3 });
    supabaseMock.queueTable('team_lists', { data: { ...manualRow, position: 3 } });
    const list = await repo.createList('org1', { name: ' Sprint ', color: '#00f' });

    expect(supabaseMock.argsOf('team_lists', 'select', 0)).toEqual(['id', { count: 'exact', head: true }]);
    expect(supabaseMock.argsOf('team_lists', 'eq', 0)).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_lists', 'insert', 1)).toEqual([{
      org_id: 'org1', name: 'Sprint', color: '#00f', type: 'manual', smart_rule: null,
      position: 3, created_by: supabaseMock.user?.id,
    }]);
    expect(list).toEqual({ id: 'l1', orgId: 'org1', name: 'Sprint', color: '#00f', type: 'manual', position: 3, taskIds: [] });
  });

  it('createList: liste intelligente, compte absent → position 0', async () => {
    supabaseMock.queueTable('team_lists', { count: null });
    supabaseMock.queueTable('team_lists', { data: smartRow });
    await repo.createList('org1', { name: 'En retard', color: '#f00', type: 'smart', smartRule: 'overdue' });
    const insert = supabaseMock.argsOf('team_lists', 'insert', 1)?.[0] as Record<string, unknown>;
    expect(insert.type).toBe('smart');
    expect(insert.smart_rule).toBe('overdue');
    expect(insert.position).toBe(0);
  });

  it('createList: déconnecté → not_authenticated, aucune requête', async () => {
    supabaseMock.user = null;
    await expect(repo.createList('org1', { name: 'x', color: '#000' })).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createList: erreur d insertion normalisée', async () => {
    supabaseMock.queueTable('team_lists', { count: 0 });
    supabaseMock.queueTable('team_lists', { error: DB_ERROR });
    await expect(repo.createList('org1', { name: 'x', color: '#000' })).rejects.toBeTruthy();
  });

  it('updateList: whitelist explicite (nom nettoyé, couleur, position), jamais org_id', async () => {
    supabaseMock.queueTable('team_lists', { data: null });
    // Champ hors contrat glissé par un appelant : la whitelist doit l'ignorer.
    const input = { name: ' Neuf ', color: '#0f0', position: 2, orgId: 'autre' };
    await repo.updateList('l1', input);
    expect(supabaseMock.argsOf('team_lists', 'update')).toEqual([{ name: 'Neuf', color: '#0f0', position: 2 }]);
    expect(supabaseMock.argsOf('team_lists', 'eq')).toEqual(['id', 'l1']);
  });

  it('updateList: patch vide → aucune requête', async () => {
    await repo.updateList('l1', {});
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('updateList: erreur normalisée', async () => {
    supabaseMock.queueTable('team_lists', { error: DB_ERROR });
    await expect(repo.updateList('l1', { color: '#000' })).rejects.toBeTruthy();
  });

  it('deleteList: delete par id, erreur normalisée', async () => {
    supabaseMock.queueTable('team_lists', { data: null });
    await repo.deleteList('l1');
    expect(supabaseMock.argsOf('team_lists', 'eq')).toEqual(['id', 'l1']);

    supabaseMock.queueTable('team_lists', { error: DB_ERROR });
    await expect(repo.deleteList('l1')).rejects.toBeTruthy();
  });

  it('addTask: upsert idempotent sur (list_id, task_id)', async () => {
    supabaseMock.queueTable('team_list_tasks', { data: null });
    await repo.addTask('l1', 't1');
    expect(supabaseMock.argsOf('team_list_tasks', 'upsert')).toEqual([
      { list_id: 'l1', task_id: 't1' },
      { onConflict: 'list_id,task_id', ignoreDuplicates: true },
    ]);

    supabaseMock.queueTable('team_list_tasks', { error: DB_ERROR });
    await expect(repo.addTask('l1', 't1')).rejects.toBeTruthy();
  });

  it('removeTask: delete filtré sur les deux colonnes de la clé', async () => {
    supabaseMock.queueTable('team_list_tasks', { data: null });
    await repo.removeTask('l1', 't1');
    expect(supabaseMock.callsFor('team_list_tasks')).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['list_id', 'l1'] },
      { method: 'eq', args: ['task_id', 't1'] },
    ]);

    supabaseMock.queueTable('team_list_tasks', { error: DB_ERROR });
    await expect(repo.removeTask('l1', 't1')).rejects.toBeTruthy();
  });
});
