import { test, expect } from '@playwright/test';
import { installSupabaseStub } from '../supabase-stub';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-45 — un retour OAuth servi ailleurs que sur le `redirectTo` demande
 * ═══════════════════════════════════════════════════════════════════
 *
 * `loginWithGoogle` demande a GoTrue un `redirectTo` complet : prefixe de
 * locale + destination validee (`?redirect=/org-invite/<token>`, garde R-04).
 * GoTrue n'honore cette valeur que si la « Redirect URL allow list » du
 * projet Supabase la couvre. Sinon il ne refuse pas : il SUBSTITUE le Site
 * URL. La connexion reussit, l'invitation se perd, et rien ne le dit.
 *
 * Ces deux cas prouvent le comportement dans le VRAI produit, hors mode demo,
 * la ou la sonde tourne : une session s'ouvre pendant qu'une intention de
 * redirection est en attente, et l'ecran n'est pas celui qu'on avait demande.
 *
 * 🔴 Le second cas est le TEMOIN, et il n'est pas decoratif : sans lui, une
 * sonde qui crierait a chaque connexion passerait le premier.
 */

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0';
const INTENT_KEY = 'cosmo_oauth_redirect_intent';

/** Pose une intention de redirection AVANT que l'app boote. */
async function pendingIntent(page: import('@playwright/test').Page, url: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        sessionStorage.setItem(key as string, JSON.stringify({ url: value, at: Date.now() }));
      } catch {
        /* le test echouera plus loin, avec un message parlant */
      }
    },
    [INTENT_KEY, url],
  );
}

test.describe('C-45 — la destination perdue ne se perd plus en silence', () => {
  test('atterrissage sur le Site URL alors qu’une invitation etait demandee : ca se voit', async ({
    page,
  }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_tasks', []);

    const logged: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') logged.push(m.text());
    });

    // Ce que `loginWithGoogle` avait demande…
    await pendingIntent(page, `http://127.0.0.1:3210/en/org-invite/${TOKEN}`);
    // …et ce que GoTrue a servi a la place, faute d'allow list.
    await page.goto('/dashboard');

    await expect(page.getByText(/destination perdue/i)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/rouvrez votre lien d.invitation/i)).toBeVisible();

    const report = logged.find((line) => line.includes('redirectTo'));
    expect(report, 'la console doit nommer la cause probable').toBeTruthy();
    expect(report).toContain('allow list');
    // Le jeton a usage unique ne part ni en console ni dans Sentry.
    expect(report).not.toContain(TOKEN);
    expect(report).toContain(':token');

    // L'intention est consommee : un rechargement ne re-accuse pas.
    expect(await page.evaluate((k) => sessionStorage.getItem(k), INTENT_KEY)).toBeNull();
  });

  test('TEMOIN — un atterrissage conforme ne dit rien du tout', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_tasks', []);

    // 🔴 Ce temoin ne pouvait PAS echouer avant le 2026-09-08, et il a ete pris
    //    en train de passer sous sabotage (`compareOAuthLanding` renvoyant un
    //    ecart pour TOUT atterrissage, y compris conforme). Deux raisons, et
    //    elles se cumulaient :
    //      • `toHaveCount(0)` est une attente qui REESSAIE jusqu'a reussir. Le
    //        toast Sonner s'efface tout seul en ~3 s : l'assertion le laissait
    //        simplement expirer, puis constatait l'absence qu'elle avait
    //        attendue. Mesure sous sabotage : count=1 de t=0 a t=2,5 s, count=0
    //        a partir de t=3 s — le test lisait la seconde moitie.
    //      • Rien ne prouvait que la sonde avait TOURNE. « Rien ne s'affiche »
    //        ne distingue pas une sonde silencieuse d'une sonde jamais appelee.
    //
    //    D'ou les deux changements ci-dessous : on ANCRE sur une preuve
    //    d'execution, et on ENREGISTRE les apparitions au lieu de les attendre.
    const logged: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') logged.push(m.text());
    });

    // Enregistre tout texte de toast jamais apparu. Un observateur voit le
    // passage ; une assertion d'absence, elle, ne voit que l'instant ou elle
    // regarde — et un toast qui dure 3 s se rate a une seconde pres.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as Record<string, unknown>).__toastsVus = seen;
      new MutationObserver(() => {
        const el = document.querySelector('[data-sonner-toaster]');
        const text = el?.textContent?.trim();
        if (text) seen.push(text);
      }).observe(document.documentElement, { childList: true, subtree: true });
    });

    await pendingIntent(page, 'http://127.0.0.1:3210/dashboard');
    await page.goto('/dashboard');

    // ANCRE : la sonde consomme l'intention dans TOUS les cas, conforme ou non.
    // Tant que la cle n'est pas retombee a null, elle n'a pas tourne, et toute
    // conclusion tiree d'un ecran vide parlerait d'un ecran pas encore boote.
    await expect
      .poll(() => page.evaluate((k) => sessionStorage.getItem(k), INTENT_KEY), {
        timeout: 45_000,
      })
      .toBeNull();

    // La sonde a tourne, et elle n'a rien dit. Les deux assertions portent sur
    // des donnees DEJA collectees : aucune ne peut se satisfaire en attendant.
    expect(logged.filter((line) => line.includes('redirectTo'))).toEqual([]);
    const toasts = await page.evaluate(
      () => ((window as unknown as Record<string, unknown>).__toastsVus as string[]) ?? []
    );
    expect(toasts.join(' | ')).not.toMatch(/destination perdue/i);
  });
});
