// ═══════════════════════════════════════════════════════════════════
// RLS — shared_tasks : on ne peut PAS s'auto-accorder l'accès à la tâche
// d'autrui. Couvre le chemin qui a déjà cassé la prod (récursion 42P17,
// mig. 045) côté frontière de confiance.
//
// La policy `shared_tasks_insert` (045) exige :
//   auth.uid() = shared_by  AND  owns_task(task_id)  AND  (amitié OU demande pending)
// On vérifie ici que l'absence de propriété/d'amitié bloque bien l'INSERT.
// (Le happy-path « un collaborateur ami LIT bien la tâche » nécessite le flux
//  d'acceptation d'ami complet — à ajouter une fois le harnais vert en CI.)
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUsers, insertTask, TestUser } from './helpers';

describe('RLS — shared_tasks insert boundary', () => {
  let alice: TestUser; // propriétaire de la tâche
  let bob: TestUser; // attaquant : pas ami, pas propriétaire
  let aliceTaskId: string;

  beforeAll(async () => {
    alice = await createTestUser();
    bob = await createTestUser();
    aliceTaskId = await insertTask(alice, 'Alice task to protect');
  });

  afterAll(async () => {
    await deleteTestUsers(alice, bob);
  });

  it("Bob ne peut pas s'accorder l'accès à la tâche d'Alice (shared_by = Bob, owns_task=false)", async () => {
    const { error } = await bob.client
      .from('shared_tasks')
      .insert({ task_id: aliceTaskId, friend_id: bob.id, shared_by: bob.id });
    // WITH CHECK échoue (owns_task(aliceTask) = false pour Bob) → erreur RLS.
    expect(error).not.toBeNull();
    // Et rien n'a été inséré : Bob ne voit toujours pas la tâche.
    const { data } = await bob.client.from('tasks').select('id').eq('id', aliceTaskId);
    expect(data).toHaveLength(0);
  });

  it("Bob ne peut pas usurper shared_by = Alice (auth.uid() != shared_by)", async () => {
    const { error } = await bob.client
      .from('shared_tasks')
      .insert({ task_id: aliceTaskId, friend_id: bob.id, shared_by: alice.id });
    expect(error).not.toBeNull(); // auth.uid()=Bob ≠ shared_by=Alice → bloqué
  });

  it("Alice (propriétaire) sans amitié ne peut pas non plus partager (garde amitié/pending)", async () => {
    const { error } = await alice.client
      .from('shared_tasks')
      .insert({ task_id: aliceTaskId, friend_id: bob.id, shared_by: alice.id });
    // owns_task = true, shared_by = Alice, MAIS aucune amitié ni demande pending
    // Alice→Bob → la 3e condition de la policy échoue.
    expect(error).not.toBeNull();
  });
});
