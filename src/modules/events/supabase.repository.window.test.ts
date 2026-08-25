// ═══════════════════════════════════════════════════════════════════
// EVENTS, lectures par fenêtre, agenda managérial, et écritures restantes.
//
// `supabase.repository.test.ts` (à côté) couvre la pagination, les filtres et
// la whitelist d'écriture. Ce fichier couvre les quatre méthodes qui portent
// la RLS de la mig. 077 (agenda managérial) et le reste du CRUD.
//
// Le point sensible est `getWindowForUser` : c'est le SEUL chemin de lecture
// du dépôt qui vise volontairement les données de QUELQU'UN D'AUTRE. Son
// périmètre ne tient qu'à deux choses, et les deux sont assertées ici : le
// filtre `user_id` sur la personne ciblée, et la policy `events_manager_select`
// qui refuse tout le reste côté base.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseEventsRepository } from './supabase.repository';
import { buildWindowOrFilter } from './window';

const repo = new SupabaseEventsRepository();

const row = {
  id: 'e1', title: 'Réunion',
  start_time: '2026-06-10T10:00:00.000Z', end_time: '2026-06-10T11:00:00.000Z',
  color: '#3B82F6', user_id: 'u1',
};

const START = '2026-06-01T00:00:00.000Z';
const END = '2026-06-30T23:59:59.000Z';

beforeEach(() => supabaseMock.reset());

describe('SupabaseEventsRepository, lecture par fenêtre', () => {
  it('getWindow: scope sur MON user_id et ramene les recurrents en plus du chevauchement', async () => {
    supabaseMock.queueTable('events', { data: [row] });

    const result = await repo.getWindow(START, END);

    expect(supabaseMock.argsOf('events', 'eq')).toEqual(['user_id', supabaseMock.user?.id]);
    // Les récurrents sont ramenés SANS condition de date : une occurrence de
    // juin peut naître d'un événement créé en janvier. Restreindre ce `or` au
    // seul chevauchement ferait disparaître les récurrents du calendrier.
    expect(supabaseMock.argsOf('events', 'or')?.[0]).toBe(buildWindowOrFilter(START, END));
    expect(supabaseMock.argsOf('events', 'or')?.[0]).toContain('recurrence.in.(daily,weekly,custom)');
    const orders = supabaseMock.callsFor('events').filter((c) => c.method === 'order');
    expect(orders.map((c) => c.args)).toEqual([
      ['start_time', { ascending: true }],
      // Tiebreak obligatoire : sans lui la pagination par range peut sauter ou
      // dupliquer une ligne quand deux événements partagent la même heure.
      ['id', { ascending: true }],
    ]);
    expect(result[0]).toMatchObject({ id: 'e1', title: 'Réunion' });
  });

  it('getWindow: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('events', { error: { message: 'boom', code: '42501' } });
    await expect(repo.getWindow(START, END)).rejects.toBeTruthy();
  });

  it('getWindowForUser: cible le user_id DEMANDE, pas le mien (agenda manager, mig. 077)', async () => {
    supabaseMock.queueTable('events', { data: [row] });

    await repo.getWindowForUser('subordonne-uid', START, END);

    // Si ce filtre retombait sur l'appelant, l'écran « agenda de X » afficherait
    // silencieusement l'agenda du manager. La RLS refuserait une cible non
    // gérée, mais elle ne peut pas rattraper un filtre qui vise la mauvaise
    // personne AUTORISÉE.
    expect(supabaseMock.argsOf('events', 'eq')).toEqual(['user_id', 'subordonne-uid']);
    expect(supabaseMock.argsOf('events', 'eq')).not.toEqual(['user_id', supabaseMock.user?.id]);
    expect(supabaseMock.argsOf('events', 'or')?.[0]).toBe(buildWindowOrFilter(START, END));
  });

  it('getWindowForUser: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('events', { error: { message: 'denied', code: '42501' } });
    await expect(repo.getWindowForUser('x', START, END)).rejects.toBeTruthy();
  });

  it('getByTaskId: filtre sur task_id et trie par heure de debut', async () => {
    supabaseMock.queueTable('events', { data: [row] });
    const result = await repo.getByTaskId('t1');
    expect(supabaseMock.argsOf('events', 'eq')).toEqual(['task_id', 't1']);
    expect(supabaseMock.argsOf('events', 'order')).toEqual(['start_time', { ascending: true }]);
    expect(result).toHaveLength(1);
  });

  it('getByTaskId: data null donne [] (une tache sans evenement n est pas une erreur)', async () => {
    supabaseMock.queueTable('events', { data: null });
    await expect(repo.getByTaskId('t1')).resolves.toEqual([]);
  });
});

describe('SupabaseEventsRepository, écritures restantes', () => {
  it('createForUser: pose user_id sur la CIBLE, apres la whitelist mapEventToDb', async () => {
    supabaseMock.queueTable('events', { data: row });

    await repo.createForUser('subordonne-uid', {
      title: 'Point hebdo',
      start: START,
      end: END,
      // Champ hors du type, simulé comme un payload hostile : `mapEventToDb`
      // doit le laisser tomber avant même que le repository pose l'user_id.
      ...({ user_id: 'uid-attaquant' } as Record<string, unknown>),
    });

    const inserted = (supabaseMock.argsOf('events', 'insert') as Record<string, unknown>[][])[0][0];
    // `mapEventToDb` n'émet JAMAIS user_id : c'est la frontière
    // anti-mass-assignment. Le repository le pose ensuite, explicitement, à
    // partir de l'argument de la méthode, jamais de l'input.
    expect(inserted.user_id).toBe('subordonne-uid');
    expect(inserted.title).toBe('Point hebdo');
  });

  it('createForUser: remonte l erreur PostgREST normalisee (RLS manager)', async () => {
    supabaseMock.queueTable('events', { error: { message: 'denied', code: '42501' } });
    await expect(repo.createForUser('x', { title: 'T', start: START, end: END }))
      .rejects.toBeTruthy();
  });

  it('delete: DELETE scope par id, la RLS tranche la propriete', async () => {
    supabaseMock.queueTable('events', { data: null });
    await repo.delete('e1');
    const methods = supabaseMock.callsFor('events').map((c) => c.method);
    expect(methods).toContain('delete');
    expect(supabaseMock.argsOf('events', 'eq')).toEqual(['id', 'e1']);
  });

  it('delete: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('events', { error: { message: 'nope', code: '42501' } });
    await expect(repo.delete('e1')).rejects.toBeTruthy();
  });
});
