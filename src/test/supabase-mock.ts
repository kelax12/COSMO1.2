// ═══════════════════════════════════════════════════════════════════
// Mock Supabase chaînable pour les tests de repositories (Phase 1 audit
// 2026-06-10). Reproduit la surface utilisée par les repos :
//   supabase.from(table).select(...).eq(...).order(...).range(...) → thenable
//   supabase.from(table).insert(...).select().single() → thenable
//   supabase.rpc(name, args) / supabase.auth.getUser() / getSession()
//
// Usage dans un test :
//   import { supabaseMock } from '@/test/supabase-mock';
//   vi.mock('@/lib/supabase', () => ({
//     supabase: (await import('@/test/supabase-mock')).supabaseMock.client,
//   }));  // ⚠️ factory async : vi.mock(path, async () => ...)
//   beforeEach(() => supabaseMock.reset());
//   supabaseMock.queueTable('tasks', { data: [row] });
//   ... appeler le repo ... puis asserter via supabaseMock.callsFor('tasks').
//
// Chaque .method(args) est ENREGISTRÉ (table, méthode, args) — les tests
// assertent la chaîne réelle envoyée à PostgREST (colonnes select, filtres
// eq/or, range), pas seulement le résultat. C'est ce qui fait de ces tests
// une garde anti-régression sécurité (trim colonnes, cursor validé, etc.).
// ═══════════════════════════════════════════════════════════════════
import { vi } from 'vitest';

export interface QueryResult {
  data?: unknown;
  error?: { message?: string; code?: string; details?: string } | null;
  count?: number | null;
}

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface RecordedQuery {
  table: string;
  calls: RecordedCall[];
}

const DEFAULT_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'me@test.dev' };

class SupabaseMock {
  /**
   * Requêtes `.from()` uniquement, dans l'ordre d'exécution.
   * Les chaînes construites sur une RPC vont dans `rpcQueries` — plusieurs
   * tests assertent « zéro accès direct à la table », il ne faut donc pas les
   * mélanger.
   */
  queries: RecordedQuery[] = [];
  /** Chaînes `.select()/.order()/.range()` construites sur une RPC SETOF. */
  rpcQueries: RecordedQuery[] = [];
  /** Tous les appels rpc dans l'ordre. */
  rpcCalls: Array<{ fn: string; args: unknown }> = [];
  /** Utilisateur retourné par auth.getUser()/getSession() (null = déconnecté). */
  user: { id: string; email?: string } | null = { ...DEFAULT_USER };

  private tableResults = new Map<string, QueryResult[]>();
  private rpcResults = new Map<string, QueryResult[]>();

  readonly client = {
    from: vi.fn((table: string) => this.buildQuery(table, this.tableResults, this.queries)),
    // Une RPC PostgREST qui renvoie `SETOF <table>` se filtre, s'ordonne et se
    // pagine exactement comme une table (`.select().order().range()`) — c'est
    // ce qu'utilise `SupabaseTasksRepository.getAll` via `get_my_tasks()`
    // (mig. 085). Le mock renvoie donc le MÊME builder chaînable/thenable que
    // `from()`, de sorte que `await supabase.rpc(...)` (appel simple) et
    // `supabase.rpc(...).select().range()` fonctionnent tous les deux.
    rpc: vi.fn((fn: string, args?: unknown) => {
      this.rpcCalls.push({ fn, args });
      return this.buildQuery(fn, this.rpcResults, this.rpcQueries);
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: this.user }, error: null })),
      getSession: vi.fn(async () => ({
        data: { session: this.user ? { user: this.user } : null },
        error: null,
      })),
    },
  };

  /** Programme le résultat de la PROCHAINE requête sur `table` (FIFO). */
  queueTable(table: string, result: QueryResult): void {
    const list = this.tableResults.get(table) ?? [];
    list.push(result);
    this.tableResults.set(table, list);
  }

  /** Programme le résultat du prochain appel rpc `fn` (FIFO). */
  queueRpc(fn: string, result: QueryResult): void {
    const list = this.rpcResults.get(fn) ?? [];
    list.push(result);
    this.rpcResults.set(fn, list);
  }

  /**
   * Chaîne d'appels de la n-ième requête (défaut: première) sur `table`.
   * `table` accepte aussi un nom de RPC SETOF (ex. 'get_my_tasks').
   */
  callsFor(table: string, index = 0): RecordedCall[] {
    const matching = [...this.queries, ...this.rpcQueries].filter((q) => q.table === table);
    return matching[index]?.calls ?? [];
  }

  /** Args du premier appel `method` sur la n-ième requête de `table`. */
  argsOf(table: string, method: string, index = 0): unknown[] | undefined {
    return this.callsFor(table, index).find((c) => c.method === method)?.args;
  }

  reset(): void {
    this.queries = [];
    this.rpcQueries = [];
    this.rpcCalls = [];
    this.tableResults.clear();
    this.rpcResults.clear();
    this.user = { ...DEFAULT_USER };
    this.client.from.mockClear();
    this.client.rpc.mockClear();
    this.client.auth.getUser.mockClear();
    this.client.auth.getSession.mockClear();
  }

  private buildQuery(
    table: string,
    queue: Map<string, QueryResult[]>,
    sink: RecordedQuery[],
  ): unknown {
    const result = shiftOrDefault(queue, table);
    const rec: RecordedQuery = { table, calls: [] };
    sink.push(rec);

    const resolved = {
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    };

    const target: Record<PropertyKey, unknown> = {
      // Le builder Supabase est un thenable : `await query` déclenche then().
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolved).then(onFulfilled, onRejected),
    };

    const proxy: object = new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        // Symboles (inspection, Symbol.toStringTag…) : ne pas chaîner.
        if (typeof prop !== 'string') return undefined;
        return (...args: unknown[]) => {
          rec.calls.push({ method: prop, args });
          return proxy;
        };
      },
    });
    return proxy;
  }
}

function shiftOrDefault(map: Map<string, QueryResult[]>, key: string): QueryResult {
  const list = map.get(key);
  if (list && list.length > 0) return list.shift() as QueryResult;
  return { data: null, error: null };
}

/** Singleton partagé — chaque fichier de test appelle reset() en beforeEach. */
export const supabaseMock = new SupabaseMock();
