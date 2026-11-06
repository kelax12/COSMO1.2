import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Harnais des parcours contre une VRAIE base Supabase locale (TST-03)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ce que ces parcours prouvent, et que ni la démo (`localStorage`) ni le stub
 * (`e2e/supabase-stub.ts`) ne peuvent prouver : que l'application, telle que
 * construite pour la production, ecrit et relit VRAIMENT dans Postgres, avec
 * la RLS, les triggers et les RPC des migrations.
 *
 * 🔴 LA PILE EST LOCALE, ET SEULEMENT ELLE. `assertLocalStack` refuse de
 * tourner contre un autre hote que 127.0.0.1 / localhost : ni un vrai compte,
 * ni le projet de production ne peuvent etre touches par erreur. Les comptes
 * sont crees par les tests (adresse `@example.com` horodatee) et supprimes a
 * la fin de chaque cas.
 *
 * ⚠️ La cle `service_role` ne sert QU'A creer et supprimer des comptes de test
 * (comme `e2e/rls/helpers.ts`). Toute assertion de lecture passe par le
 * navigateur, ou par un client authentifie du compte concerne (RLS exercee).
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function assertLocalStack(): void {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      'e2e/real : SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY requis ' +
        '(`supabase status -o env` sur la pile locale, cf. .github/workflows/e2e-supabase.yml).',
    );
  }
  const host = new URL(SUPABASE_URL).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]') {
    throw new Error(
      `e2e/real : refus de tourner contre « ${host} ». Ces parcours creent et suppriment ` +
        'des comptes : ils ne visent QUE la pile locale (127.0.0.1).',
    );
  }
}
assertLocalStack();

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Client service_role : preparation de donnees de test UNIQUEMENT (jamais une assertion). */
export const adminClient: SupabaseClient = admin;

export interface Account {
  id: string;
  email: string;
  password: string;
  name: string;
  /** Client authentifie de CE compte : la RLS s'y applique comme en production. */
  client: SupabaseClient;
}

/** Client d'un compte existant, authentifie par mot de passe. */
export async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email} : ${error.message}`);
  return client;
}

let counter = 0;
const stamp = () => `${Date.now().toString(36)}${(counter += 1)}${Math.random().toString(36).slice(2, 5)}`;

/** Adresse et mot de passe jetables, conformes a la politique (12+ caracteres). */
export function freshCredentials(label: string) {
  const s = stamp();
  return {
    email: `e2e.${label}.${s}@example.com`,
    password: `E2e-Pw-${s}-aA1!`,
    name: `E2e ${label} ${s}`,
  };
}

/** Cree un compte CONFIRME sur la pile locale (aucune boite mail en jeu). */
export async function createAccount(label: string): Promise<Account> {
  const { email, password, name } = freshCredentials(label);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(`createUser ${email} : ${error?.message ?? 'aucun compte'}`);
  const client = await signInClient(email, password);
  return { id: data.user.id, email, password, name, client };
}

/** Supprime un compte (cascade) ; ne leve jamais, c'est un nettoyage. */
export async function removeAccountById(id: string): Promise<void> {
  await admin.auth.admin.deleteUser(id).catch(() => undefined);
}

/** Retrouve l'id d'un compte par adresse (compte cree par l'interface). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users.find((u) => u.email === email)?.id ?? null;
}

/**
 * Drapeaux posés avant le premier rendu : bannière cookies refusée, accueil du
 * premier compte et tutoriels de page « vus », pont démo reporté. Sans eux, une
 * surface modale recouvrirait le parcours testé (cf. `e2e/fixtures.ts`).
 */
const NEUTRALISE = `
  try {
    localStorage.setItem('cosmo_cookie_consent', 'refused');
    localStorage.setItem('cosmo_first_run_done', '1');
    localStorage.setItem('cosmo_demo_bridge_snooze', String(Date.now() + 86400000));
    localStorage.setItem('cosmo_swipe_hint_anim_seen', '1');
    for (const p of ['tasks', 'agenda', 'habits', 'okr']) {
      localStorage.setItem('cosmo_tutorial_seen_' + p + '_desktop', '1');
      localStorage.setItem('cosmo_tutorial_seen_' + p + '_mobile', '1');
      localStorage.setItem('cosmo_tutorial_seen_' + p, '1');
    }
  } catch (e) {}
`;

export const test = base.extend<{ makeAccount: (label: string) => Promise<Account>; trackAccount: (id: string) => void }>({
  context: async ({ context }, use) => {
    await context.addInitScript(NEUTRALISE);
    await use(context);
  },
  // Playwright exige un motif de destructuration, meme vide (une `_fixtures` echoue a l'analyse).
  // eslint-disable-next-line no-empty-pattern
  trackAccount: async ({}, use) => {
    // Comptes crees par l'INTERFACE : supprimes aussi, une fois le cas termine.
    const ids: string[] = [];
    await use((id) => { ids.push(id); });
    for (const id of ids) await removeAccountById(id);
  },
  makeAccount: async ({ trackAccount }, use) => {
    await use(async (label) => {
      const account = await createAccount(label);
      trackAccount(account.id);
      return account;
    });
  },
});

export { expect };

/**
 * Session navigateur ISOLEE (autre contexte : autre stockage, autre compte).
 * L'appelant referme `page.context()` en fin de cas.
 */
export async function newSession(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', baseURL });
  await context.addInitScript(NEUTRALISE);
  return context.newPage();
}

/** Connexion par l'ecran `/login`, comme une personne. */
export async function loginViaUi(page: Page, who: { email: string; password: string }): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-email').fill(who.email);
  await page.locator('#auth-password').fill(who.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
}

/** Navigation sans attendre `load` : Realtime rouvre un WebSocket en boucle. */
export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

/** Recharge la page : le cache React Query masque sinon l'absence de persistance. */
export async function reload(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Aucun toast d'erreur : une ecriture refusee par la RLS en produit un. */
export async function expectNoErrorToast(page: Page): Promise<void> {
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
}

// ─── Parcours d'interface partages ────────────────────────────────

/** Cree une tache par la modale (bureau 1280 px), puis referme la modale. */
export async function createTaskViaUi(page: Page, name: string): Promise<void> {
  await goto(page, '/tasks');
  await page
    .getByRole('button', { name: /^créer une (nouvelle )?tâche$/i })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 });
  const dialog = page.getByRole('dialog', { name: /créer une nouvelle tâche/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: /nom de la tâche/i }).first().fill(name);
  await dialog.getByRole('button', { name: /^créer( la tâche)?$/i }).filter({ visible: true }).first().click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: name })).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: /^annuler$/i }).filter({ visible: true }).first().click();
  await expect(dialog).toBeHidden();
}

/**
 * Tache posee en base par le client authentifie du compte, avec une echeance.
 *
 * 🔴 Une echeance est donnee exprès : sur une base REJOUEE depuis les migrations,
 * `tasks.deadline` est NOT NULL, alors que l'application envoie `null` pour
 * une tache sans echeance (cf. `schema-drift.spec.ts`). Les parcours qui ne
 * testent pas la creation partent donc d'une tache deja ecrite.
 */
export async function seedTask(account: Account, name: string): Promise<string> {
  const { data, error } = await account.client
    .from('tasks')
    .insert([{
      name, priority: 0, category: null, deadline: new Date(Date.now() + 86_400_000).toISOString(),
      estimated_time: 0, bookmarked: false, completed: false, recurrence: 'none',
      is_collaborative: false, pending_invites: [], user_id: account.id,
    }])
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedTask : ${error?.message ?? 'aucune ligne'}`);
  return data.id as string;
}

/** La liste des taches, une fois peinte. */
export function tasksList(page: Page) {
  return page.locator('[data-tutorial-id="tasks-list"]');
}
