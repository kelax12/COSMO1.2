// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// TÉMOIN V14.1 (constat PER-01) : 6 000 tâches, toutes accessibles.
//
// Avant : `getAll()` chargeait par pages de 1 000 jusqu'à 5 000 lignes
// (`fetchAllPages`, `MAX_ROWS`). Les 1 000 suivantes manquaient à l'écran ;
// un toast et un événement Sentry signalaient la troncature, rien de plus.
//
// Ce fichier joue les DEUX côtés :
//   • la démo, sur un vrai localStorage de 6 000 tâches ;
//   • Supabase, sur le client simulé, page de clé après page de clé ;
// et garde le témoin de l'ancien comportement : la même source lue par
// `fetchAllPages` s'arrête à 5 000. Si quelqu'un rebranche une lecture
// plafonnée sur ces chemins, les assertions « 6 000 » rougissent.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { LocalStorageTasksRepository } from './local.repository';
import { SupabaseTasksRepository } from './supabase.repository';
import { loadWorkingSet, workingSetSince } from './working-set';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';
import type { Task } from './types';
import type { ITasksRepository } from './repository';

const TOTAL = 6000;
const ACTIVE = 400; // le travail en cours ; le reste est terminé depuis longtemps
const NOW = new Date('2026-11-09T12:00:00.000Z');

const pad = (n: number, w: number) => String(n).padStart(w, '0');
/** UUID valide et ordonné : l'ordre de clé est alors lisible dans les tests. */
const uuid = (i: number) => `00000000-0000-4000-8000-${pad(i, 12)}`;
/** Une tâche par minute, en remontant le temps : created_at strictement décroissant. */
const createdAt = (i: number) => new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString();

function makeTask(i: number): Task {
  const done = i >= ACTIVE;
  return {
    id: uuid(i),
    name: `Tâche ${i}`,
    priority: (i % 5) + 1,
    category: '',
    deadline: '',
    estimatedTime: 15,
    createdAt: createdAt(i),
    bookmarked: false,
    completed: done,
    // Terminées il y a plus d'un an : hors du jeu de travail, dans l'archive.
    completedAt: done ? '2025-01-01T08:00:00.000Z' : undefined,
  };
}

async function walkArchive(repo: ITasksRepository, limit: number): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  let cursorDate: string | undefined;
  for (;;) {
    const page = await repo.getPage({ query: { status: 'completed' }, limit, cursor, cursorDate });
    ids.push(...page.data.map((t) => t.id));
    if (!page.hasMore) return ids;
    cursor = page.nextCursor!;
    cursorDate = page.nextCursorDate!;
  }
}

describe('V14.1 · 6 000 tâches en démo (localStorage)', () => {
  const tasks = Array.from({ length: TOTAL }, (_, i) => makeTask(i));

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('cosmo_demo_tasks', JSON.stringify(tasks));
  });

  it('témoin de l’ancien comportement : une lecture plafonnée en perd 1 000', async () => {
    const sorted = [...tasks];
    const capped = await fetchAllPages(async (from, to) => sorted.slice(from, to + 1));
    expect(MAX_ROWS).toBe(5000);
    expect(capped).toHaveLength(5000); // ← ce que l'écran recevait avant
  });

  it('getAll et count rendent les 6 000', async () => {
    const repo = new LocalStorageTasksRepository();
    expect(await repo.getAll()).toHaveLength(TOTAL);
    expect(await repo.count()).toBe(TOTAL);
  });

  it('le jeu de travail contient TOUTES les non terminées', async () => {
    const repo = new LocalStorageTasksRepository();
    const working = await loadWorkingSet(repo, NOW);
    expect(working.filter((t) => !t.completed)).toHaveLength(ACTIVE);
    expect(working.every((t) => !t.completed || (t.completedAt ?? '') >= workingSetSince(NOW))).toBe(true);
  });

  it('l’archive se parcourt jusqu’au bout : 5 600 terminées, ni doublon ni trou', async () => {
    const repo = new LocalStorageTasksRepository();
    const ids = await walkArchive(repo, 500);
    expect(ids).toHaveLength(TOTAL - ACTIVE);
    expect(new Set(ids).size).toBe(TOTAL - ACTIVE);
    expect(await repo.count({ status: 'completed' })).toBe(TOTAL - ACTIVE);
  });
});

describe('V14.1 · 6 000 tâches côté Supabase (client simulé)', () => {
  const rows = Array.from({ length: TOTAL }, (_, i) => {
    const t = makeTask(TOTAL - 1 - i); // ordre de la RPC : created_at décroissant
    return {
      id: t.id, name: t.name, priority: t.priority, category: null, deadline: null,
      estimated_time: 15, created_at: t.createdAt, bookmarked: false, completed: t.completed,
      completed_at: t.completedAt ?? null,
      user_id: '11111111-1111-4111-8111-111111111111', // = utilisateur simulé
    };
  });

  beforeEach(() => supabaseMock.reset());

  it('getAll enchaîne les pages de clé jusqu’à la dernière : 6 000 lignes', async () => {
    // Pages de 1 000 + 1 ligne témoin de suite ; la 6ᵉ est incomplète.
    for (let from = 0; from < TOTAL; from += 1000) {
      supabaseMock.queueRpc('get_my_tasks', { data: rows.slice(from, from + 1001) });
    }
    const repo = new SupabaseTasksRepository();
    const all = await repo.getAll();
    expect(all).toHaveLength(TOTAL);
    expect(new Set(all.map((t) => t.id)).size).toBe(TOTAL);
    expect(supabaseMock.rpcCalls.filter((c) => c.fn === 'get_my_tasks')).toHaveLength(6);
    // Le curseur de la 2ᵉ page est la 1 000ᵉ ligne : created_at puis id.
    const last = rows[999];
    expect(supabaseMock.argsOf('get_my_tasks', 'or', 1)?.[0]).toBe(
      `created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`,
    );
    // Aucune page n'est lue par décalage : plus de `.range()`.
    expect(supabaseMock.argsOf('get_my_tasks', 'range')).toBeUndefined();
  });

  it('count passe par un HEAD compté, sans transférer une ligne', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: null, count: TOTAL });
    const repo = new SupabaseTasksRepository();
    expect(await repo.count({ status: 'completed' })).toBe(TOTAL);
    expect(supabaseMock.rpcCalls[0]).toMatchObject({ fn: 'get_my_tasks' });
    expect(supabaseMock.argsOf('get_my_tasks', 'eq')).toEqual(['completed', true]);
  });
});
