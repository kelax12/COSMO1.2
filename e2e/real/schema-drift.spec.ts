import { test, expect, loginViaUi, createTaskViaUi, tasksList, reload } from './helpers';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Deux écarts entre une base REJOUÉE et celle que l'application attend
 * ═══════════════════════════════════════════════════════════════════
 *
 * Trouvés par la première exécution de `e2e-supabase` (2026-11-06) : la pile
 * locale rejoue les migrations de `supabase/migration/` sur une base vierge, et
 * l'application construite pour la production n'y pouvait pas écrire deux choses
 * qu'elle écrit en production, où les contraintes avaient été assouplies HORS
 * migration. Corrigés par la mig. 249 (`tasks`) et la mig. 250
 * (`friend_requests`), relues au catalogue de production le 2026-11-13.
 * Ces deux tests gardent la base rejouée alignée sur l'application.
 *
 * ❌ Ne jamais relâcher ces assertions pour passer au vert : le correctif est une
 * migration, prouvée en transaction annulée puis appliquée.
 */

// 1 · `tasks.deadline` est NOT NULL et `tasks.priority` est limitée à 1..5
// (`001_tasks.sql`). L'écran de création n'exige que le NOM (échéance facultative,
// `validation.ts`) et envoie `deadline: null` et `priority: 0` : la base répondait
// 23502 « null value in column "deadline" » (puis `tasks_priority_check`), et la
// modale affiche « Erreur lors de la création ».
test('créer une tâche SANS échéance par l\'écran (mig. 249)', async ({ page, makeAccount }) => {
  const account = await makeAccount('drift-task');
  await loginViaUi(page, account);
  const name = `Tâche sans échéance ${Date.now()}`;
  await createTaskViaUi(page, name);
  await reload(page);
  await expect(tasksList(page).getByText(name, { exact: true }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 });
});

// 2 · `friend_requests.user_id` était NOT NULL depuis `007_friends.sql`, et
// `012_friend_requests_align.sql` ne le retire que « si la colonne existe encore »
// sans jamais la rendre nullable. L'insertion du module `friends` n'envoie que
// `sender_id` : refusée (23502) sur une base rejouée, donc AUCUNE demande d'ami
// (ni partage de tâche qui en dépend, mig. 036) ne peut partir.
test('envoyer une demande d\'ami sans user_id (mig. 250)', async ({ makeAccount }) => {
  const alice = await makeAccount('drift-alice');
  const bob = await makeAccount('drift-bob');
  const { error } = await alice.client
    .from('friend_requests')
    .insert([{ email: bob.email, status: 'pending', sent_at: new Date().toISOString(), sender_id: alice.id }])
    .select()
    .single();
  expect(error, error?.message).toBeNull();
});
