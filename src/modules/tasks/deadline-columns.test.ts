import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { deadlineColumns, setDeadlineColumnsForTests, BEFORE_MIGRATION_251 } from './deadline-columns';
import { probeTaskColumn } from './supabase.repository';

const missing = { error: { code: '42703', message: 'column does not exist' } };

beforeEach(() => {
  supabaseMock.reset();
  setDeadlineColumnsForTests(null);
});

// La sonde réelle du repository ; ses deux requêtes partent dans cet ordre :
// `due_date`, puis `deadline`.
describe('deadlineColumns : la base dit dans quel état de la bascule DAT-01 on est', () => {
  it('avant la mig. 251 : deadline seule', async () => {
    supabaseMock.queueTable('tasks', missing);
    await expect(deadlineColumns(probeTaskColumn)).resolves.toEqual({ day: false, instant: true });
  });

  it('entre 251 et 253 : les deux colonnes', async () => {
    await expect(deadlineColumns(probeTaskColumn)).resolves.toEqual({ day: true, instant: true });
  });

  it('après 253 : due_date seule', async () => {
    supabaseMock.queueTable('tasks', {});
    supabaseMock.queueTable('tasks', missing);
    await expect(deadlineColumns(probeTaskColumn)).resolves.toEqual({ day: true, instant: false });
  });

  it('les sondes ne lisent aucune ligne et ne partent qu une fois par session', async () => {
    await deadlineColumns(probeTaskColumn);
    await deadlineColumns(probeTaskColumn);
    expect(supabaseMock.queries).toHaveLength(2);
    expect(supabaseMock.argsOf('tasks', 'limit')).toEqual([0]);
  });

  it('une sonde en échec réseau : forme d avant la 251, et rien de mémorisé', async () => {
    supabaseMock.queueTable('tasks', { error: { code: '', message: 'Failed to fetch' } });
    await expect(deadlineColumns(probeTaskColumn)).resolves.toEqual(BEFORE_MIGRATION_251);
    await expect(deadlineColumns(probeTaskColumn)).resolves.toEqual({ day: true, instant: true });
  });
});
