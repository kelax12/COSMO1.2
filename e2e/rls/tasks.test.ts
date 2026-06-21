// ═══════════════════════════════════════════════════════════════════
// RLS — isolation des tâches entre utilisateurs.
// Garantie n°1 de l'audit : A ne lit/modifie/supprime JAMAIS les tâches de B.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUsers, insertTask, TestUser } from './helpers';

describe('RLS — tasks isolation', () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceTaskId: string;

  beforeAll(async () => {
    alice = await createTestUser();
    bob = await createTestUser();
    aliceTaskId = await insertTask(alice, 'Alice secret task');
  });

  afterAll(async () => {
    await deleteTestUsers(alice, bob);
  });

  it("Alice voit sa propre tâche", async () => {
    const { data, error } = await alice.client.from('tasks').select('id').eq('id', aliceTaskId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("Bob ne voit PAS la tâche d'Alice (SELECT filtré par RLS)", async () => {
    const { data, error } = await bob.client.from('tasks').select('id').eq('id', aliceTaskId);
    expect(error).toBeNull(); // RLS ne lève pas d'erreur : elle filtre
    expect(data).toHaveLength(0);
  });

  it("Bob ne voit aucune tâche d'Alice via un SELECT large", async () => {
    const { data } = await bob.client.from('tasks').select('id');
    expect((data ?? []).some((t) => t.id === aliceTaskId)).toBe(false);
  });

  it("Bob ne peut pas modifier la tâche d'Alice", async () => {
    await bob.client.from('tasks').update({ name: 'hacked by Bob' }).eq('id', aliceTaskId);
    // Vérifié côté propriétaire : le nom n'a pas changé.
    const { data } = await alice.client.from('tasks').select('name').eq('id', aliceTaskId).single();
    expect(data?.name).toBe('Alice secret task');
  });

  it("Bob ne peut pas supprimer la tâche d'Alice", async () => {
    await bob.client.from('tasks').delete().eq('id', aliceTaskId);
    const { data } = await alice.client.from('tasks').select('id').eq('id', aliceTaskId);
    expect(data).toHaveLength(1); // toujours là
  });
});
