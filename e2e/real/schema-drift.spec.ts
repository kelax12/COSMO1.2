import { test, expect, loginViaUi, createTaskViaUi, tasksList, reload } from './helpers';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Deux écarts entre une base REJOUÉE et celle que l'application attend
 * ═══════════════════════════════════════════════════════════════════
 *
 * Trouvés par la première exécution de `e2e-supabase` (2026-11-06) : la pile
 * locale rejoue les migrations de `supabase/migration/` sur une base vierge, et
 * l'application construite pour la production ne peut pas y écrire deux choses
 * qu'elle écrit en production. Les deux colonnes ont été assouplies EN PROD hors
 * migration (« le schéma a évolué via le tableau de bord », cf. l'en-tête de
 * `012_friend_requests_align.sql` et `007_out_of_band_columns.sql`), donc la
 * production ne casse pas. Mais toute base reconstruite depuis le dépôt
 * (restauration, préproduction, nouvelle région) refuse ces écritures.
 *
 * ❌ Ne jamais relâcher ces assertions pour passer au vert : le correctif est une
 * migration (`ALTER COLUMN ... DROP NOT NULL`), à prouver en BEGIN/ROLLBACK puis
 * à appliquer. Retirer `test.fixme` dès qu'elle est posée.
 */

// 1 · `tasks.deadline` est NOT NULL depuis `001_tasks.sql`. L'écran de création
// n'exige que le NOM (échéance facultative, `validation.ts`) et envoie
// `deadline: null` : la base répond 23502 « null value in column "deadline" »,
// et la modale affiche « Erreur lors de la création ».
test.fixme('créer une tâche SANS échéance par l\'écran (tasks.deadline NOT NULL sur base rejouée)', async ({ page, makeAccount }) => {
  const account = await makeAccount('drift-task');
  await loginViaUi(page, account);
  const name = `Tâche sans échéance ${Date.now()}`;
  await createTaskViaUi(page, name);
  await reload(page);
  await expect(tasksList(page).getByText(name, { exact: true }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 });
});

// 2 · `friend_requests.user_id` est NOT NULL depuis `007_friends.sql`, et
// `012_friend_requests_align.sql` ne le retire que « si la colonne existe encore »
// sans jamais la rendre nullable. L'insertion du module `friends` n'envoie que
// `sender_id` : refusée (23502) sur une base rejouée, donc AUCUNE demande d'ami
// (ni partage de tâche qui en dépend, mig. 036) ne peut partir.
test.fixme('envoyer une demande d\'ami (friend_requests.user_id NOT NULL sur base rejouée)', async ({ makeAccount }) => {
  const alice = await makeAccount('drift-alice');
  const bob = await makeAccount('drift-bob');
  const { error } = await alice.client
    .from('friend_requests')
    .insert([{ email: bob.email, status: 'pending', sent_at: new Date().toISOString(), sender_id: alice.id }])
    .select()
    .single();
  expect(error, error?.message).toBeNull();
});
