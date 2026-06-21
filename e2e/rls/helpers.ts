// ═══════════════════════════════════════════════════════════════════
// Helpers du harnais de tests RLS d'intégration.
//
// Modèle : un client ADMIN (service_role, bypass RLS) sert UNIQUEMENT à
// créer/supprimer des utilisateurs de test. Toutes les assertions de
// lecture/écriture passent par des clients UTILISATEUR (anon key + JWT du
// user), seuls capables d'exercer la RLS. Ne JAMAIS lire les données sous
// service_role dans une assertion — ça contournerait ce qu'on teste.
// ═══════════════════════════════════════════════════════════════════
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    'RLS harness: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY requis ' +
      '(via `supabase status -o env` en local, ou secrets/CI).',
  );
}

export const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

let counter = 0;

/** Crée un utilisateur confirmé et renvoie un client authentifié (JWT user). */
export async function createTestUser(): Promise<TestUser> {
  const stamp = `${Date.now()}_${counter++}`;
  const email = `rls_${stamp}@example.com`;
  const password = `Pw_${stamp}_aA1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser a échoué : ${error?.message ?? 'no user'}`);
  }

  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`signIn a échoué : ${signInError.message}`);
  }

  return { id: data.user.id, email, password, client };
}

/** Supprime les utilisateurs de test (cascade ON DELETE → purge leurs lignes). */
export async function deleteTestUsers(...users: (TestUser | undefined)[]): Promise<void> {
  for (const u of users) {
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
}

/** Insère une tâche minimale possédée par `user` (deadline NOT NULL). */
export async function insertTask(user: TestUser, name = 'RLS test task') {
  const { data, error } = await user.client
    .from('tasks')
    .insert({ user_id: user.id, name, deadline: new Date().toISOString() })
    .select('id')
    .single();
  if (error || !data) throw new Error(`insertTask a échoué : ${error?.message ?? 'no row'}`);
  return data.id as string;
}
