// ═══════════════════════════════════════════════════════════════════
// RLS — `get_my_tasks()` : la RPC indexable n'ouvre AUCUNE fuite.
//
// POURQUOI CE FICHIER EXISTE (audit archi 2026-08-07, point C1)
//
// `getAll()` ne lit plus la table `tasks` directement : la policy
// `tasks_select_own_or_shared` est un OR qui empêchait Postgres d'utiliser
// `idx_tasks_user_id`, d'où un Seq Scan de la table GLOBALE à chaque
// chargement de liste (vérifié par EXPLAIN en prod). La lecture passe
// désormais par `get_my_tasks()`, qui exprime le même ensemble en UNION de
// deux branches indexables.
//
// ⚠️ Le point délicat : cette fonction est `SECURITY DEFINER`. Elle s'exécute
// donc avec les droits du propriétaire et **la RLS de `tasks` ne s'applique
// PAS à l'intérieur de son corps**. C'est précisément ce qui la rend rapide —
// et c'est aussi ce qui en fait une frontière de sécurité à part entière.
//
// Le seul rempart devient alors la logique du corps : le périmètre est dérivé
// de `auth.uid()`, la fonction ne prend AUCUN paramètre, et il n'existe donc
// aucune valeur qu'un attaquant puisse forger. Ces tests le prouvent contre
// une vraie base plutôt que de le supposer.
//
// Une régression ici serait invisible : l'application afficherait simplement
// « plus de tâches », sans erreur. D'où ces tests d'intégration, et non un
// test unitaire mocké.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { anonClient, createTestUser, deleteTestUsers, insertTask, TestUser } from './helpers';

interface TaskRow {
  id: string;
  user_id: string;
  name: string;
}

describe('RLS — get_my_tasks (RPC SECURITY DEFINER)', () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceTaskId: string;
  let bobTaskId: string;

  beforeAll(async () => {
    alice = await createTestUser();
    bob = await createTestUser();
    aliceTaskId = await insertTask(alice, 'Tache privee Alice');
    bobTaskId = await insertTask(bob, 'Tache privee Bob');
  });

  afterAll(async () => {
    await deleteTestUsers(alice, bob);
  });

  it('ne renvoie QUE mes tâches — jamais celles d\'un autre compte', async () => {
    const { data, error } = await alice.client.rpc('get_my_tasks');
    expect(error).toBeNull();

    const rows = (data ?? []) as TaskRow[];
    expect(rows.map((t) => t.id)).toContain(aliceTaskId);
    // LE test : la tâche de Bob ne doit apparaître sous aucune forme.
    expect(rows.map((t) => t.id)).not.toContain(bobTaskId);
    expect(rows.every((t) => t.user_id === alice.id)).toBe(true);
  });

  it('est symétrique : Bob ne voit pas davantage les tâches d\'Alice', async () => {
    const { data, error } = await bob.client.rpc('get_my_tasks');
    expect(error).toBeNull();

    const rows = (data ?? []) as TaskRow[];
    expect(rows.map((t) => t.id)).toContain(bobTaskId);
    expect(rows.map((t) => t.id)).not.toContain(aliceTaskId);
  });

  it('renvoie exactement le même ensemble qu\'un SELECT direct sous RLS', async () => {
    // Équivalence sémantique : la RPC est une optimisation de PLAN, pas un
    // changement de périmètre. Si les deux divergent un jour, c'est soit une
    // fuite, soit une perte de données — les deux sont graves.
    const viaRpc = await alice.client.rpc('get_my_tasks');
    const viaTable = await alice.client.from('tasks').select('id');

    const idsRpc = ((viaRpc.data ?? []) as TaskRow[]).map((t) => t.id).sort();
    const idsTable = ((viaTable.data ?? []) as { id: string }[]).map((t) => t.id).sort();

    expect(idsRpc).toEqual(idsTable);
  });

  it('ne renvoie rien à une session anonyme (auth.uid() IS NULL)', async () => {
    // La fonction est REVOKE pour `anon`. Deux issues acceptables : erreur de
    // permission, ou zéro ligne. Ce qui ne l'est pas : renvoyer les tâches de
    // quelqu'un. On teste le résultat, pas le mécanisme.
    const { data, error } = await anonClient.rpc('get_my_tasks');
    const rows = (data ?? []) as TaskRow[];
    expect(error !== null || rows.length === 0).toBe(true);
    expect(rows.map((t) => t.id)).not.toContain(aliceTaskId);
  });
});
