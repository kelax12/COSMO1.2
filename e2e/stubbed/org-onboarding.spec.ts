import { test, expect } from '@playwright/test';
import { gotoStubbed, installSupabaseStub, STUB_USER_ID } from '../supabase-stub';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Accueil entreprise (2026-10-03) : le parcours, pas seulement les unités
 * ═══════════════════════════════════════════════════════════════════
 *
 * Même raison d'être que `first-run.spec.ts` : ces écrans ne s'ouvrent que
 * HORS mode démo (la mise en place suppose une vraie entreprise, l'accueil
 * membre se garde de la démo), donc aucune spec de la suite démo ne peut les
 * atteindre.
 *
 * Ce que ces cas vérifient, et que les unités ne pouvaient pas vérifier :
 *  • que la vidéo d'accueil s'ouvre au premier passage dans l'espace entreprise
 *    (l'assistant de mise en place qui demandait des infos a été retiré le
 *    2026-10-14) ;
 *  • qu'une personne est accueillie UNE fois, et pas à la
 *    visite suivante.
 *
 * ⚠️ Rien ici ne prouve le serveur (RLS, triggers) : cf. l'en-tête de
 * `e2e/supabase-stub.ts`.
 */

const ORG = {
  id: 'org-onb-1',
  name: 'Nova Studio',
  join_code: 'COSMO-7KQ2M9XA4B',
  owner_id: STUB_USER_ID,
  created_at: '2026-10-03T08:00:00Z',
};
const MEMBER_WELCOME = /bienvenue dans l'espace entreprise/i;

/**
 * Une ligne d'appartenance que les DEUX lectures de `organization_members`
 * comprennent (le stub répond par chemin) : la liste de mes entreprises lit
 * `role` + `organizations`, l'annuaire lit `user_id` + `joined_at`. L'accueil
 * membre ne vise que les arrivés depuis sa sortie (2026-10-03).
 */
const membership = (role: 'admin' | 'member') => [
  {
    role,
    organizations: ORG,
    org_id: ORG.id,
    user_id: STUB_USER_ID,
    joined_at: new Date().toISOString(),
    manager_id: null,
  },
];

/**
 * Piège de focus mesuré au clavier (2026-10-05) : vingt-cinq Tab, et le focus
 * ne quitte jamais la surface. `modal-a11y.guard` vérifie le CÂBLAGE de
 * `useModalA11y` ; ceci vérifie son EFFET, hors démo, là où vivent ces écrans.
 */
async function expectTabTrapped(page: import('@playwright/test').Page, dialog: import('@playwright/test').Locator) {
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inside, `Tab n°${i + 1} : le focus a quitté la surface`).toBe(true);
  }
}

test.describe('accueil entreprise (vidéo OrgWelcomeVideo)', () => {
  test('un membre est accueilli une fois dans l espace entreprise, pas à la visite suivante', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_org_inbox', {});
    stub.reply('organization_members', membership('member'));

    await gotoStubbed(page, '/entreprise', page.getByRole('dialog', { name: MEMBER_WELCOME }));
    await expect(page.locator('video[src="/videos/onboarding-entreprise-v2.mp4"]')).toBeAttached();
    // Focus d'entrée sur l'action, pas sur la croix : Entrée valide l'accueil.
    await expect(page.getByRole('button', { name: /^commencer/i })).toBeFocused();
    await expectTabTrapped(page, page.getByRole('dialog', { name: MEMBER_WELCOME }));
    // Échap emprunte le même chemin que « Commencer » : l'accueil est vu.
    // ⚠️ Focus ramené sur un bouton AVANT Échap. Après 25 Tab il peut être
    // dans les commandes NATIVES du lecteur, et Chromium ne laisse alors sortir
    // AUCUNE touche vers la page (mesuré le 2026-10-16 : Échap n'atteint ni
    // `document` ni `window`, même en capture). Aucun écouteur de page ne peut
    // l'entendre ; Tab, lui, ressort du lecteur. Rouge de `f74b0874` à `66a8505c`.
    await page.getByRole('button', { name: /^commencer/i }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toBeHidden();

    await page.reload({ waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Nova Studio' }).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toHaveCount(0);
  });

  // 🔴 Les deux cas suivants ont mis le job e2e de main au rouge le 2026-10-04
  // (run 37138213107) : la garde était relue à chaque rendu, et l'accueil
  // s'ouvrait APRÈS coup, une fois le paramètre retiré de l'URL (`?task=`
  // effacé quand la tâche est introuvable, `?tab=` réécrit en section). Il
  // couvrait alors l'écran visé et interceptait les clics de `delete-org` et
  // `refund`. La décision est désormais prise à l'arrivée, une fois.
  test('l accueil membre ne s ouvre pas par-dessus un lien profond, même après coup', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_org_inbox', {});
    stub.reply('organization_members', membership('member'));

    await gotoStubbed(page, '/entreprise/tasks?task=stub-task-1', page.getByRole('heading', { name: 'Nova Studio' }));
    // Le défaut se manifestait APRÈS le retrait du paramètre : on laisse à la
    // fiche introuvable le temps de se refermer avant de conclure.
    await page.waitForTimeout(4_000);
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toHaveCount(0);
  });

  test('une arrivée par ?tab= (ancien lien, retour de paiement) ne déclenche pas l accueil', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_org_inbox', {});
    stub.reply('organization_members', membership('admin'));

    await gotoStubbed(page, '/entreprise?tab=settings', page.getByRole('heading', { name: 'Nova Studio' }));
    await expect(page).toHaveURL(/\/entreprise\/settings/);
    await page.waitForTimeout(3_000);
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toHaveCount(0);
  });
});
