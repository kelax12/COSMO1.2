// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : champs personnalisés et leurs valeurs (mig. 197).
//
// Isolé du reste de `supabase.repository.test.ts` exprès, le 2026-10-02 :
// une autre session retire ces cinq méthodes. Le jour où elles disparaissent,
// SUPPRIMER CE FICHIER, rien d'autre. Elles pèsent 5 fonctions sur 306 dans
// le glob `src/modules/**/supabase.repository.ts`, toutes couvertes ici :
// leur départ ne fait pas tomber le seuil.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { SupabaseOrgConfigRepository } from './supabase.repository';

const repo = new SupabaseOrgConfigRepository();
const DB_ERROR = { message: 'boom', code: '42P01' };
const FIELD_COLUMNS = 'id, org_id, project_id, name, kind, options, position';
const fieldRow = { id: 'f1', org_id: 'org1', project_id: null, name: 'Client', kind: 'select', options: ['A', 'B'], position: 0 };

beforeEach(() => supabaseMock.reset());

describe('SupabaseOrgConfigRepository — champs personnalisés (mig. 197)', () => {
  it('getCustomFields: scopé org_id, options null → []', async () => {
    supabaseMock.queueTable('team_custom_fields', { data: [fieldRow, { ...fieldRow, id: 'f2', kind: 'text', options: null }] });
    const list = await repo.getCustomFields('org1');
    expect(supabaseMock.argsOf('team_custom_fields', 'select')).toEqual([FIELD_COLUMNS]);
    expect(supabaseMock.argsOf('team_custom_fields', 'eq')).toEqual(['org_id', 'org1']);
    expect(list[0]).toEqual({ id: 'f1', orgId: 'org1', projectId: null, name: 'Client', kind: 'select', options: ['A', 'B'], position: 0 });
    expect(list[1].options).toEqual([]);
  });

  it('createCustomField: options gardées pour select, vidées pour tout autre type', async () => {
    supabaseMock.queueTable('team_custom_fields', { data: fieldRow });
    await repo.createCustomField('org1', { projectId: null, name: ' Client ', kind: 'select', options: ['A'] });
    expect(supabaseMock.argsOf('team_custom_fields', 'insert')).toEqual([{
      org_id: 'org1', project_id: null, name: 'Client', kind: 'select', options: ['A'],
    }]);

    supabaseMock.queueTable('team_custom_fields', { data: fieldRow });
    await repo.createCustomField('org1', { projectId: 'p1', name: 'N', kind: 'number', options: ['ignoré'] });
    expect((supabaseMock.argsOf('team_custom_fields', 'insert', 1)?.[0] as { options: string[] }).options).toEqual([]);

    supabaseMock.queueTable('team_custom_fields', { data: fieldRow });
    await repo.createCustomField('org1', { projectId: null, name: 'S', kind: 'select' });
    expect((supabaseMock.argsOf('team_custom_fields', 'insert', 2)?.[0] as { options: string[] }).options).toEqual([]);
  });

  it('deleteCustomField: delete par id', async () => {
    supabaseMock.queueTable('team_custom_fields', { data: null });
    await repo.deleteCustomField('f1');
    expect(supabaseMock.argsOf('team_custom_fields', 'eq')).toEqual(['id', 'f1']);
  });

  it('champs: normalisent les erreurs DB', async () => {
    supabaseMock.queueTable('team_custom_fields', { error: DB_ERROR });
    await expect(repo.getCustomFields('org1')).rejects.toBeTruthy();
    supabaseMock.queueTable('team_custom_fields', { error: DB_ERROR });
    await expect(repo.createCustomField('org1', { projectId: null, name: 'x', kind: 'text' })).rejects.toBeTruthy();
    supabaseMock.queueTable('team_custom_fields', { error: DB_ERROR });
    await expect(repo.deleteCustomField('f1')).rejects.toBeTruthy();
  });

  it('getTaskFieldValues: lecture par task_id (tête de PK), mappée', async () => {
    supabaseMock.queueTable('team_task_field_values', { data: [{ task_id: 't1', field_id: 'f1', value: 'A' }] });
    const values = await repo.getTaskFieldValues('t1');
    expect(supabaseMock.argsOf('team_task_field_values', 'eq')).toEqual(['task_id', 't1']);
    expect(values).toEqual([{ taskId: 't1', fieldId: 'f1', value: 'A' }]);
  });

  it('setTaskFieldValue: upsert sans org_id (déduit par le trigger)', async () => {
    supabaseMock.queueTable('team_task_field_values', { data: null });
    await repo.setTaskFieldValue('t1', 'f1', 42);
    expect(supabaseMock.argsOf('team_task_field_values', 'upsert')).toEqual([
      { task_id: 't1', field_id: 'f1', value: 42 },
      { onConflict: 'task_id,field_id' },
    ]);
  });

  it('setTaskFieldValue: null efface la valeur au lieu d écrire null', async () => {
    supabaseMock.queueTable('team_task_field_values', { data: null });
    await repo.setTaskFieldValue('t1', 'f1', null);
    const calls = supabaseMock.callsFor('team_task_field_values');
    expect(calls.map((c) => c.method)).toEqual(['delete', 'eq', 'eq']);
    expect(calls[1].args).toEqual(['task_id', 't1']);
    expect(calls[2].args).toEqual(['field_id', 'f1']);
  });

  it('valeurs: normalisent les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_field_values', { error: DB_ERROR });
    await expect(repo.getTaskFieldValues('t1')).rejects.toBeTruthy();
    supabaseMock.queueTable('team_task_field_values', { error: DB_ERROR });
    await expect(repo.setTaskFieldValue('t1', 'f1', true)).rejects.toBeTruthy();
  });
});
