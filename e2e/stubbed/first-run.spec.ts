import { test, expect } from '@playwright/test';
import { installSupabaseStub, type SupabaseStub } from '../supabase-stub';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-27 — `FirstRunSetup` : le parcours, pas seulement les unites
 * ═══════════════════════════════════════════════════════════════════
 *
 * L'ecran d'accueil du premier compte avait 25 tests unitaires et AUCUN
 * parcours. Ce n'etait pas un oubli : sa garde commence par `!isDemo`
 * (`shouldOfferFirstRun`), et toute la suite E2E tourne en mode demo. Il
 * fallait d'abord un harnais capable de servir l'app HORS demo — c'est
 * `e2e/supabase-stub.ts` et le project `supabase-stub`.
 *
 * Ce que ces cas verifient, et que les unites ne pouvaient pas verifier :
 *  • que la garde s'ouvre VRAIMENT sur un compte vide, avec le vrai
 *    enchainement `getSession` → `get_my_tasks` → montage de l'ecran ;
 *  • que chaque etape ECRIT AU MOMENT ou elle est validee, ce qui est la
 *    regle non negociable de cet ecran (« ne jamais differer les creations a
 *    la derniere etape ») — ici mesure sur les requetes reellement parties ;
 *  • qu'une premiere tache part SANS echeance, la seconde regle de l'ecran ;
 *  • qu'il ne revient pas au rechargement suivant.
 */

const TASK_QUESTION = /qu'avez-vous a faire cette semaine/i;
const HABIT_QUESTION = /une habitude que vous voulez tenir/i;
const OKR_QUESTION = /un objectif pour les trois prochains mois/i;

/** Prepare le stub, ouvre `/dashboard`, rend le stub au test. */
async function openDashboard(
  page: import('@playwright/test').Page,
  tasks: unknown[] = [],
): Promise<SupabaseStub> {
  const stub = await installSupabaseStub(page);
  // Le compte est vide par defaut : c'est la condition meme de l'accueil.
  stub.reply('rpc/get_my_tasks', tasks);
  // ⚠️ `domcontentloaded`, jamais le `load` par defaut : le canal Realtime
  // ouvre un WebSocket vers l'hote stub, qui ne resout pas et se rouvre en
  // boucle. La page est parfaitement utilisable, mais `load` n'arrive jamais —
  // mesure du 2026-09-05 : `page.goto` expirait a 120 s sur une page rendue
  // depuis 25 s.
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  return stub;
}

test.describe('C-27 — accueil du premier compte (FirstRunSetup)', () => {
  test('un compte vide est accueilli, et chaque etape ecrit au moment ou elle est validee', async ({
    page,
  }) => {
    const stub = await openDashboard(page);

    // ── Etape 1 : les taches ──────────────────────────────────────
    const dialog = page.getByRole('dialog', { name: /bienvenue dans cosmo/i });
    await expect(dialog).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: TASK_QUESTION })).toBeVisible();

    const taskField = page.getByLabel(TASK_QUESTION);
    await taskField.fill('Rappeler le comptable');
    await page.getByRole('button', { name: /^ajouter$/i }).click();
    // La seconde reste dans le CHAMP, sans passer par « Ajouter » : personne ne
    // devrait avoir a cliquer « Ajouter » pour que sa reponse existe.
    await taskField.fill('Relire le devis');
    await page.getByRole('button', { name: /^continuer$/i }).click();

    await expect(page.getByRole('heading', { name: HABIT_QUESTION })).toBeVisible();
    // Mesure sur les requetes PARTIES, pas sur un etat React : c'est la seule
    // facon de prouver que la creation n'a pas ete differee a la fin.
    //
    // ⚠️ `expect.poll` et non une lecture seche : l'ecran avance des que React
    // a commite l'etape suivante, or la mutation part APRES (elle attend
    // `getCurrentUser()`). Lire tout de suite mesurait donc systematiquement
    // zero — un test qui aurait echoue pour une raison qui n'est pas la sienne.
    await expect.poll(() => stub.writesTo('tasks').length, { timeout: 10_000 }).toBe(2);
    const taskWrites = stub.writesTo('tasks');
    const created = taskWrites.map((w) => (w.body as Array<Record<string, unknown>>)[0]);
    expect(created.map((r) => r.name)).toEqual(['Rappeler le comptable', 'Relire le devis']);
    // ❌ Aucune echeance : la personne a donne un intitule, pas une date. En
    // inventer une ferait apparaitre sa toute premiere tache « en retard ».
    for (const row of created) {
      expect(row.deadline ?? null).toBeNull();
    }

    // ── Etape 2 : l'habitude ──────────────────────────────────────
    await page.getByLabel(HABIT_QUESTION).fill('Marcher 30 minutes');
    await page.getByRole('button', { name: /^continuer$/i }).click();

    await expect(page.getByRole('heading', { name: OKR_QUESTION })).toBeVisible();
    await expect.poll(() => stub.writesTo('habits').length, { timeout: 10_000 }).toBe(1);
    const habitWrites = stub.writesTo('habits');
    expect((habitWrites[0].body as Array<Record<string, unknown>>)[0].name).toBe(
      'Marcher 30 minutes',
    );

    // ── Etape 3 : l'objectif, puis la sortie ──────────────────────
    await page.getByLabel(OKR_QUESTION).fill('Lancer la v2 du produit');
    await page.getByLabel(/resultat cle/i).fill('Publier la page de vente');
    await page.getByRole('button', { name: /entrer dans cosmo/i }).click();

    await expect(dialog).toBeHidden();
    await expect.poll(() => stub.writesTo('okrs').length, { timeout: 10_000 }).toBe(1);
    const okrWrites = stub.writesTo('okrs');
    const okr = (okrWrites[0].body as Array<Record<string, unknown>>)[0];
    expect(okr.title).toBe('Lancer la v2 du produit');
    expect(JSON.stringify(okr.key_results ?? okr.keyResults ?? '')).toContain(
      'Publier la page de vente',
    );

    // Le drapeau est pose a la SORTIE, jamais a l'entree.
    expect(await page.evaluate(() => localStorage.getItem('cosmo_first_run_done'))).toBe('1');
  });

  test('un accueil deja vu ne revient pas au rechargement', async ({ page }) => {
    const stub = await openDashboard(page);
    const dialog = page.getByRole('dialog', { name: /bienvenue dans cosmo/i });
    await expect(dialog).toBeVisible({ timeout: 45_000 });

    // On sort par la croix, sans rien creer : l'ecran entier est passable.
    await page.getByRole('button', { name: /passer l'accueil/i }).click();
    await expect(dialog).toBeHidden();
    // On laisse volontairement passer du temps : une ecriture fautive part en
    // quelques dizaines de millisecondes, et une assertion instantanee sur
    // « rien n'est parti » est vraie avant meme que quoi que ce soit puisse
    // partir. C'est le meme piege que le `tail -1` de `restore-drill`.
    await page.waitForTimeout(1_000);
    expect(stub.writes.filter((w) => ['tasks', 'habits', 'okrs'].includes(w.path))).toHaveLength(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(dialog).toBeHidden();
  });

  test('passer les trois etapes ne cree rien du tout', async ({ page }) => {
    const stub = await openDashboard(page);
    await expect(page.getByRole('dialog', { name: /bienvenue dans cosmo/i })).toBeVisible({
      timeout: 45_000,
    });

    for (const heading of [TASK_QUESTION, HABIT_QUESTION, OKR_QUESTION]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await page.getByRole('button', { name: /passer cette etape/i }).click();
    }

    await expect(page.getByRole('dialog', { name: /bienvenue dans cosmo/i })).toBeHidden();
    await page.waitForTimeout(1_000);
    expect(stub.writes.filter((w) => ['tasks', 'habits', 'okrs'].includes(w.path))).toHaveLength(0);
  });

  test('un compte qui a deja une tache n est PAS accueilli', async ({ page }) => {
    // La garde est `taskCount === 0`, pas « compte recent » : quelqu'un qui se
    // connecte sur un second appareil a deja des taches, et le drapeau, lui,
    // est local.
    await openDashboard(page, [
      {
        id: 'stub-existing-task',
        name: 'Une tache qui existait deja',
        priority: 3,
        category: '',
        deadline: null,
        estimated_time: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bookmarked: false,
        completed: false,
        completed_at: null,
        subtasks: [],
        kr_id: null,
        recurrence: null,
        is_collaborative: false,
        pending_invites: [],
        user_id: '00000000-0000-4000-8000-0000000000e2',
      },
    ]);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('dialog', { name: /bienvenue dans cosmo/i })).toBeHidden();
  });

  test('TEMOIN — aucune requete n a quitte le stub vers un vrai projet Supabase', async ({
    page,
  }) => {
    // 🔴 Ce cas ne teste pas le produit : il teste le HARNAIS. Le job `e2e` de
    // la CI injecte `VITE_SUPABASE_URL` depuis les secrets, et Vite fait primer
    // `process.env` sur `.env.e2e-stub` : le jour ou ce secret est renseigne,
    // ce serveur pointerait un projet REEL et ces tests iraient y parler avec
    // une session forgee. La surcharge `env` du webServer l'empeche ; ce cas
    // est ce qui le dit si elle saute.
    const stub = await openDashboard(page);
    await expect(page.getByRole('dialog', { name: /bienvenue dans cosmo/i })).toBeVisible({
      timeout: 45_000,
    });
    // On laisse l'app finir ses lectures d'ouverture avant de conclure.
    await page.waitForTimeout(2_000);
    expect(stub.foreignSupabaseCalls).toEqual([]);
    // Et le stub, lui, a bien vu passer le trafic de l'app : sans cette
    // seconde moitié, « aucune fuite » serait vrai parce que RIEN n'est parti,
    // ce qui est le mode d'échec que ce dépôt appelle « une garde qui répond
    // sans mesurer ».
    expect(stub.writes.map((w) => w.path)).toContain('rpc/get_my_tasks');
  });
});
