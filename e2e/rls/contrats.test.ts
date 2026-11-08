// ═══════════════════════════════════════════════════════════════════
// Suites de contrat, côté SUPABASE (V12.2, constat ARC-01).
//
// Les MÊMES fonctions que `src/test/contracts/demo.contract.test.ts`, jouées
// contre les classes `Supabase…Repository` de production, sur la base locale
// vierge du job `rls-integration` (toutes les migrations rejouées).
//
// 🔴 Les dépôts parlent sous le JWT d'un utilisateur de test AUTHENTIFIÉ (clé
// anon + session), donc la RLS est exercée. `service_role` ne sert qu'à poser
// le décor (créer le compte, l'organisation et son abonnement) et à le retirer,
// jamais à lire ni à écrire une donnée que le contrat vérifie.
//
// Une divergence trouvée de ce côté (la production a tort) est déclarée dans
// `divergences`, avec l'identifiant du constat : le cas est joué en `it.fails`.
// ═══════════════════════════════════════════════════════════════════
import { afterAll, beforeAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, createTestUser, deleteTestUsers, type TestUser } from './helpers';

// Le client `@/lib/supabase` de l'application est remplacé par celui de
// l'utilisateur de test : les dépôts de production n'ont rien d'autre à changer.
const holder = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const value = Reflect.get(holder.client, prop, holder.client) as unknown;
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(holder.client) : value;
      },
    },
  ),
}));

import { SupabaseTasksRepository } from '@/modules/tasks/supabase.repository';
import { SupabaseCategoriesRepository } from '@/modules/categories/supabase.repository';
import { SupabaseListsRepository } from '@/modules/lists/supabase.repository';
import { SupabaseOKRsRepository } from '@/modules/okrs/supabase.repository';
import { SupabaseKRCompletionsRepository } from '@/modules/kr-completions/supabase.repository';
import { SupabaseStatsRepository } from '@/modules/stats/supabase.repository';
import { SupabaseTeamProjectsRepository } from '@/modules/team-projects/supabase.repository';
import { SupabaseTeamOKRsRepository } from '@/modules/team-okrs/supabase.repository';
import { SupabaseTeamCategoriesRepository } from '@/modules/team-categories/supabase.repository';
import { SupabaseTeamListsRepository } from '@/modules/team-lists/supabase.repository';
import { tasksContract } from '@/test/contracts/__test__/tasks.contract';
import { categoriesContract } from '@/test/contracts/__test__/categories.contract';
import { listsContract } from '@/test/contracts/__test__/lists.contract';
import { okrsContract } from '@/test/contracts/__test__/okrs.contract';
import { teamTasksContract } from '@/test/contracts/__test__/team-tasks.contract';
import { teamOkrsContract } from '@/test/contracts/__test__/team-okrs.contract';
import { teamCategoriesContract } from '@/test/contracts/__test__/team-categories.contract';
import { teamListsContract } from '@/test/contracts/__test__/team-lists.contract';

const SIDE = 'Supabase (base locale, RLS)';

let user: TestUser;
let orgId: string;

beforeAll(async () => {
  user = await createTestUser();
  holder.client = user.client;

  // Décor entreprise : une organisation dont l'utilisateur est propriétaire et
  // admin, avec un abonnement actif (facturation entreprise appliquée).
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: 'Org contrats', owner_id: user.id, join_code: `contrat-${Date.now()}` })
    .select('id')
    .single();
  if (orgError) throw orgError;
  orgId = org.id as string;
  const { error: memberError } = await admin
    .from('organization_members')
    .insert({ org_id: orgId, user_id: user.id, role: 'admin' });
  if (memberError) throw memberError;
  const { error: subError } = await admin.from('org_subscriptions').upsert({
    org_id: orgId,
    tier_key: 't10',
    max_members: 10,
    status: 'active',
    purchased_by: user.id,
  });
  if (subError) throw subError;
});

afterAll(async () => {
  if (orgId) await admin.from('organizations').delete().eq('id', orgId);
  await deleteTestUsers(user);
});

tasksContract(SIDE, async () => ({ repo: new SupabaseTasksRepository() }));
categoriesContract(SIDE, async () => ({ repo: new SupabaseCategoriesRepository() }));
listsContract(SIDE, async () => ({ repo: new SupabaseListsRepository() }));
okrsContract(SIDE, async () => ({
  okrs: new SupabaseOKRsRepository(),
  krCompletions: new SupabaseKRCompletionsRepository(),
  stats: new SupabaseStatsRepository(),
}));

teamTasksContract(SIDE, async () => ({ repo: new SupabaseTeamProjectsRepository(), orgId, userId: user.id }));
teamOkrsContract(SIDE, async () => ({ repo: new SupabaseTeamOKRsRepository(), orgId, userId: user.id }));
teamCategoriesContract(SIDE, async () => ({ repo: new SupabaseTeamCategoriesRepository(), orgId }));
teamListsContract(SIDE, async () => {
  const projects = new SupabaseTeamProjectsRepository();
  const projectId = (await projects.createProject(orgId, { name: 'Projet des listes' })).id;
  return {
    repo: new SupabaseTeamListsRepository(),
    orgId,
    newTaskId: async () => (await projects.createTask(orgId, { projectId, name: 'Tâche rangée' })).id,
  };
});
