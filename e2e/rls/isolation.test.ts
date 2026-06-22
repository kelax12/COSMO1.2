// ═══════════════════════════════════════════════════════════════════
// RLS — isolation cross-user des données métier (audit dette §9.2).
//
// Invariant fondamental documenté (CLAUDE.md / SECURITY.md) : toute table
// métier porte une policy `auth.uid() = user_id`. Ce test prouve la
// CONSÉQUENCE observable : Bob ne LIT jamais les lignes d'Alice, sur chaque
// table, via un client utilisateur (jamais service_role dans une assertion).
//
// On documente ainsi en tests la frontière de confiance qui n'existait
// jusqu'ici qu'en SQL — c'est exactement la dette « logique en 3 lieux ».
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUsers, insertTask, TestUser } from './helpers';

describe('RLS — isolation cross-user', () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceTaskId: string;

  beforeAll(async () => {
    alice = await createTestUser();
    bob = await createTestUser();
    aliceTaskId = await insertTask(alice, 'Donnée privée Alice');
    // Seed minimal sur d'autres tables possédées par Alice.
    await alice.client.from('habits').insert({ user_id: alice.id, name: 'Habit Alice' });
    await alice.client.from('okrs').insert({ user_id: alice.id, title: 'OKR Alice' });
    await alice.client
      .from('events')
      .insert({ user_id: alice.id, title: 'Event Alice', start: new Date().toISOString() });
  });

  afterAll(async () => {
    await deleteTestUsers(alice, bob);
  });

  it('Bob ne lit aucune tâche, habitude, okr ou event d’Alice', async () => {
    for (const table of ['tasks', 'habits', 'okrs', 'events'] as const) {
      const { data, error } = await bob.client.from(table).select('id');
      // Pas d'erreur (la requête est permise) mais zéro ligne d'Alice renvoyée.
      expect(error, `${table} select`).toBeNull();
      expect(data ?? [], `${table} rows`).toHaveLength(0);
    }
  });

  it("Bob ne peut pas UPDATE la tâche d'Alice par son id", async () => {
    const { data } = await bob.client
      .from('tasks')
      .update({ name: 'pwned' })
      .eq('id', aliceTaskId)
      .select('id');
    // RLS USING (auth.uid()=user_id) → aucune ligne ne matche pour Bob.
    expect(data ?? []).toHaveLength(0);
    // Et la valeur côté Alice est intacte.
    const { data: aliceView } = await alice.client
      .from('tasks')
      .select('name')
      .eq('id', aliceTaskId)
      .single();
    expect(aliceView?.name).toBe('Donnée privée Alice');
  });

  it("Bob ne peut pas DELETE la tâche d'Alice", async () => {
    await bob.client.from('tasks').delete().eq('id', aliceTaskId);
    const { data: stillThere } = await alice.client
      .from('tasks')
      .select('id')
      .eq('id', aliceTaskId);
    expect(stillThere ?? []).toHaveLength(1);
  });

  it('Bob ne peut pas usurper user_id à l’INSERT (mass-assignment / faille V1)', async () => {
    const { error } = await bob.client
      .from('tasks')
      .insert({ user_id: alice.id, name: 'tâche posée chez Alice', deadline: new Date().toISOString() });
    // WITH CHECK (auth.uid()=user_id) → INSERT au nom d'Alice refusé.
    expect(error).not.toBeNull();
  });
});
