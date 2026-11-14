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
import { SupabaseHabitsRepository } from '@/modules/habits/supabase.repository';
import { SupabaseEventsRepository } from '@/modules/events/supabase.repository';
import { SupabaseOKRsRepository } from '@/modules/okrs/supabase.repository';
import { SupabaseKRCompletionsRepository } from '@/modules/kr-completions/supabase.repository';
import { SupabaseStatsRepository } from '@/modules/stats/supabase.repository';
import { SupabaseTeamProjectsRepository } from '@/modules/team-projects/supabase.repository';
import { SupabaseTeamOKRsRepository } from '@/modules/team-okrs/supabase.repository';
import { SupabaseTeamCategoriesRepository } from '@/modules/team-categories/supabase.repository';
import { SupabaseTeamListsRepository } from '@/modules/team-lists/supabase.repository';
import { SupabaseFriendsRepository } from '@/modules/friends/supabase.repository';
import { SupabaseOrganizationsRepository } from '@/modules/organizations/supabase.repository';
import { orgBillingContract } from '@/test/contracts/__test__/org-billing.contract';
import { getOrgSubscription } from '@/modules/billing/org-billing.repository';
import {
  deleteOrgBillingContact,
  getOrgBillingContact,
  getOrgBillingHistory,
  saveOrgBillingContact,
} from '@/modules/billing/org-billing-account.repository';
import { tasksContract } from '@/test/contracts/__test__/tasks.contract';
import { categoriesContract } from '@/test/contracts/__test__/categories.contract';
import { listsContract } from '@/test/contracts/__test__/lists.contract';
import { okrsContract } from '@/test/contracts/__test__/okrs.contract';
import { habitsContract } from '@/test/contracts/__test__/habits.contract';
import { eventsContract } from '@/test/contracts/__test__/events.contract';
import { teamTasksContract } from '@/test/contracts/__test__/team-tasks.contract';
import { teamOkrsContract } from '@/test/contracts/__test__/team-okrs.contract';
import { teamCategoriesContract } from '@/test/contracts/__test__/team-categories.contract';
import { teamListsContract } from '@/test/contracts/__test__/team-lists.contract';
import { friendsContract } from '@/test/contracts/__test__/friends.contract';
import { organizationsContract } from '@/test/contracts/__test__/organizations.contract';
import { teamProjectsContract } from '@/test/contracts/__test__/team-projects.contract';

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

// PAR-01 et PAR-02 (priorité 0 et échéance NULL refusées par la mig. 001)
// sont corrigées par la mig. 249 : plus aucune divergence déclarée ici.
tasksContract(SIDE, async () => ({ repo: new SupabaseTasksRepository() }));
categoriesContract(SIDE, async () => ({ repo: new SupabaseCategoriesRepository() }));
listsContract(SIDE, async () => ({ repo: new SupabaseListsRepository() }));
habitsContract(SIDE, async () => ({ repo: new SupabaseHabitsRepository(), stats: new SupabaseStatsRepository() }));
eventsContract(SIDE, async () => {
  const tasks = new SupabaseTasksRepository();
  return {
    repo: new SupabaseEventsRepository(),
    // `events.task_id` est une clé étrangère : la tâche liée doit exister.
    newTaskId: async () =>
      (await tasks.create({ name: 'Tâche de l’agenda', priority: 2, category: '', deadline: new Date().toISOString(), estimatedTime: 30, bookmarked: false, completed: false })).id,
  };
});
okrsContract(SIDE, async () => ({
  okrs: new SupabaseOKRsRepository(),
  krCompletions: new SupabaseKRCompletionsRepository(),
  stats: new SupabaseStatsRepository(),
}));

teamTasksContract(SIDE, async () => ({ repo: new SupabaseTeamProjectsRepository(), orgId, userId: user.id }));
// PAR-03 (corrigée dans `SupabaseTeamOKRsRepository.create` : un `created_at`
// distinct par KR du lot) : le cas d'ordre pose six KR, donc il ne passerait par
// hasard qu'une fois sur 720 si la divergence revenait.
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

const recipients: TestUser[] = [];
afterAll(async () => {
  await deleteTestUsers(...recipients);
});
friendsContract(
  SIDE,
  async () => ({
  repo: new SupabaseFriendsRepository(),
  // Un vrai compte par demande : le destinataire est résolu par le trigger `trg_set_receiver_id`.
  recipient: async () => {
    const other = await createTestUser();
    recipients.push(other);
    return other.email;
  },
  }),
);
organizationsContract(SIDE, async () => ({ repo: new SupabaseOrganizationsRepository(), userId: user.id }));
teamProjectsContract(SIDE, async () => ({ repo: new SupabaseTeamProjectsRepository(), orgId }));

// Facturation d'organisation (hors Stripe). Le décor passe par service_role ; le
// contrat lit et écrit sous le JWT du joueur. Le quota de sièges se lit par la
// RPC `org_seats_allowed`, que la démo rejoue en TS (`effectiveQuota`).
const billingExtras: TestUser[] = [];
afterAll(async () => {
  await deleteTestUsers(...billingExtras);
});
function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}
const ok = (r: { error: unknown }): void => {
  if (r.error) throw r.error;
};
let billingStamp = 0;
async function insertOrg(ownerId: string): Promise<string> {
  const row = must(
    await admin
      .from('organizations')
      .insert({ name: 'Org facturation', owner_id: ownerId, join_code: `fact-${Date.now()}-${billingStamp++}` })
      .select('id')
      .single(),
  );
  ok(await admin.from('organization_members').insert({ org_id: row.id, user_id: ownerId, role: 'admin' }));
  return row.id as string;
}
orgBillingContract(SIDE, async () => {
  const flag = must(await admin.from('billing_flags').select('enabled').eq('key', 'enterprise_seat_limit').maybeSingle());
  if ((flag as { enabled?: boolean } | null)?.enabled !== true) {
    throw new Error('billing_flags.enterprise_seat_limit doit être armé (mig. 224) pour jouer le quota');
  }
  return {
    port: {
      getSubscription: (id) => getOrgSubscription(id),
      getHistory: (id) => getOrgBillingHistory(id),
      getContact: (id) => getOrgBillingContact(id),
      saveContact: (id, input) => saveOrgBillingContact(id, input, user.id),
      deleteContact: (id) => deleteOrgBillingContact(id),
      seatsAllowed: async (id) => {
        const { data, error } = await user.client.rpc('org_seats_allowed', { p_org: id });
        if (error) throw error;
        return data as boolean;
      },
    },
    newOrg: async (scenario = { members: 1 }) => {
      const id = await insertOrg(user.id);
      while (billingExtras.length < scenario.members - 1) billingExtras.push(await createTestUser());
      const extra = billingExtras.slice(0, scenario.members - 1).map((u) => ({ org_id: id, user_id: u.id, role: 'member' }));
      if (extra.length) ok(await admin.from('organization_members').insert(extra));
      if (scenario.subscription) {
        const s = scenario.subscription;
        ok(
          await admin.from('org_subscriptions').insert({
            org_id: id,
            tier_key: s.tierKey,
            max_members: s.maxMembers,
            status: s.status,
            billing_interval: s.billingInterval ?? 'monthly',
            cancel_at_period_end: s.cancelAtPeriodEnd ?? false,
            started_at: s.startedAt ?? null,
            purchased_by: user.id,
          }),
        );
      }
      return id;
    },
    seedPayments: async (orgId, rows) => {
      for (const r of rows) {
        const stamp = `${Date.now()}_${billingStamp++}`;
        ok(
          await admin.from('payment_records').insert({
            stripe_event_id: `evt_contrat_${stamp}`,
            event_type: r.eventType,
            stripe_invoice_id: `in_contrat_${stamp}`,
            org_id: orgId,
            amount_cents: r.amountCents,
            currency: 'eur',
            occurred_at: new Date(Date.now() - r.daysAgo * 86_400_000).toISOString(),
            payload: { number: r.number ?? null, billing_reason: r.reason ?? null },
          }),
        );
      }
    },
    foreignOrg: async () => {
      const owner = await createTestUser();
      billingExtras.push(owner);
      const id = await insertOrg(owner.id);
      ok(await admin.from('organization_members').insert({ org_id: id, user_id: user.id, role: 'member' }));
      ok(await admin.from('org_billing_contacts').insert({ org_id: id, name: null, email: 'proprio@example.com' }));
      return {
        orgId: id,
        contactEmail: async () => {
          const row = must(await admin.from('org_billing_contacts').select('email').eq('org_id', id).maybeSingle());
          return (row as { email: string } | null)?.email ?? null;
        },
      };
    },
  };
});
