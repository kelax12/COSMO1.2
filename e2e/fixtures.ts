import { test as base, expect, Page } from '@playwright/test';

/**
 * Fixture commune : démarre chaque test en mode démo authentifié sur /dashboard.
 *
 * Le mode démo est instantané (pas de réseau Supabase, seed local) — parfait
 * pour les tests E2E. On clique le bouton "Essayer maintenant — sans
 * inscription" sur la landing, puis on attend que le dashboard soit affiché.
 *
 * Note : si l'onboarding overlay s'affiche (premier loginDemo), on le ferme
 * pour ne pas interférer avec les assertions du test.
 */
export const test = base.extend<{ demoPage: Page }>({
  demoPage: async ({ page, context }, use) => {
    // 1. État propre — clear cookies + storage Supabase + flags démo
    //    (sinon RootRoute redirige immédiatement vers /dashboard si session
    //     déjà active, et le CTA "Essayer maintenant" n'existe pas).
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* ignore */ }
    });
    // 1bis. Neutraliser la bannière cookies AVANT le rendu de la landing.
    //    `localStorage.clear()` ci-dessus la fait réapparaître à chaque test ;
    //    or sur mobile elle est ancrée en bas sur TOUTE la largeur
    //    (`left-4 right-4`, z-[200]) et recouvre le CTA démo → le clic était
    //    intercepté par son sous-arbre et les 27 tests mobile-safari
    //    échouaient dans la fixture (« <aside aria-label="Bannière cookies">
    //    subtree intercepts pointer events »). Sur desktop elle est réduite à
    //    une carte en bas à droite (`sm:left-auto sm:max-w-sm`) et ne gênait
    //    pas — d'où un échec 100 % mobile.
    //    'refused' = option la plus respectueuse (aucun cookie non essentiel).
    //    Cette clé est préservée par clearDemoStorage() (PRESERVE_KEYS), elle
    //    survit donc au loginDemo() qui balaye le reste des clés cosmo_*.
    //    Neutraliser aussi le pont démo → compte : il apparaît au bout de 90 s
    //    d'usage démo OU à la 3ᵉ création, en carte ancrée en bas (au-dessus de
    //    la MobileTabBar). Un test long ou qui crée 3 entités le verrait
    //    surgir et intercepter des clics — exactement le mode d'échec que la
    //    bannière cookies a déjà provoqué sur les 27 tests mobile-safari.
    //    Comme `cosmo_cookie_consent`, cette clé est dans PRESERVE_KEYS : elle
    //    survit au clearDemoStorage() du loginDemo().
    await page.evaluate(() => {
      try {
        localStorage.setItem('cosmo_cookie_consent', 'refused');
        localStorage.setItem('cosmo_demo_bridge_snooze', String(Date.now() + 86_400_000));
      } catch { /* ignore */ }
    });

    // Reload pour repartir d'une LandingPage propre
    await page.goto('/');

    // 2. Cliquer le CTA démo principal
    //    Le bouton a aria-label "Essayer la démo sans inscription"
    //    et un texte visible "Essayer maintenant — sans inscription"
    //    30 s : la LandingPage est lazy-loadée et animée par GSAP ; au premier
    //    test d'un serveur Vite froid son rendu dépasse largement 10 s.
    const demoBtn = page.getByRole('button', { name: /essayer.*sans inscription/i }).first();
    await demoBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await demoBtn.click();

    // 3. Attendre le dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    // Le dashboard est lazy-loadé et son h1 « Bonjour » a une animation d'opacité
    // (cf. audit-a11y A-9). Au tout premier test (démarrage à froid du serveur
    // Vite), le rendu peut dépasser le timeout par défaut de 5 s → flake. 20 s
    // absorbent le cold start sans masquer un vrai problème (les autres tests,
    // serveur chaud, passent bien en dessous).
    //    45 s : au tout premier test d'un serveur froid, Vite compile encore
    //    le DashboardPage lazy (+ recharts) pendant que l'animation joue.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/bonjour/i, { timeout: 45_000 });

    // 4. Skip onboarding général + tutoriels par page
    //    L'overlay onboarding est posé 500ms après loginDemo() et bloque
    //    tous les clics. Les tutoriels page (Tasks/Habits/OKR/Agenda) se
    //    déclenchent à l'arrivée sur leur page respective.
    //    On marque tout comme "vu" dans localStorage pour neutraliser.
    await page.evaluate(() => {
      try {
        localStorage.removeItem('cosmo_onboarding_pending');
        // Désormais 2 flags par page (desktop + mobile) — neutraliser les deux
        for (const page of ['tasks', 'agenda', 'habits', 'okr']) {
          localStorage.setItem(`cosmo_tutorial_seen_${page}_desktop`, '1');
          localStorage.setItem(`cosmo_tutorial_seen_${page}_mobile`, '1');
          // Ancien flag (rétro-compat avec versions précédentes)
          localStorage.setItem(`cosmo_tutorial_seen_${page}`, '1');
        }
        // Neutralise le wiggle d'invite au swipe de la 1ʳᵉ TaskCard mobile
        // (animation x de 1,7 s qui rendrait les tests de gestes flaky).
        localStorage.setItem('cosmo_swipe_hint_anim_seen', '1');
      } catch { /* ignore */ }
    });

    // Si l'onboarding overlay est déjà visible (apparu pendant les 500ms),
    // on le ferme explicitement
    const onboardingDialog = page.locator('[role="dialog"][aria-labelledby="onb-title"]');
    if (await onboardingDialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.getByRole('button', { name: /passer le tutoriel/i }).click();
      await onboardingDialog.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await use(page);
  },
});

export { expect };

/**
 * Case de complétion d'une tâche — sélecteurs valables sur les DEUX viewports.
 *
 * Les deux implémentations ont divergé sémantiquement lors de la refonte
 * mobile et n'ont plus AUCUN rôle ARIA commun :
 *   - desktop (`task-table/list.tsx`)  : role="checkbox" + aria-checked
 *   - mobile  (`task-table/TaskCard.tsx`) : <button> + aria-pressed
 * En revanche elles partagent le même `aria-label` — c'est donc le seul
 * contrat stable commun, et il est sémantique (pas un hook de test).
 *
 * ⚠️ Ne PAS revenir à `[role="checkbox"]` pour les tâches : ce sélecteur ne
 * matche que la <table> desktop (qui reste dans le DOM en `hidden md:block`),
 * d'où des « element(s) not found » sur mobile. Les HABITUDES, elles, portent
 * bien role="checkbox" sur les deux viewports.
 */
export const TASK_TOGGLE = '[aria-label^="Marquer comme"]';
/** Tâche NON complétée (le clic la compléterait). */
export const TASK_TOGGLE_UNCHECKED = '[aria-label="Marquer comme complétée"]';
/** Tâche complétée (le clic la ré-ouvrirait). */
export const TASK_TOGGLE_CHECKED = '[aria-label="Marquer comme non complétée"]';

/**
 * Navigation SPA viewport-aware : clique le lien VISIBLE (sidebar desktop ou
 * tab bar mobile). `.first()` seul peut résoudre un lien caché par le CSS
 * responsive (sidebar `hidden` sur mobile) → timeout. Sur mobile, les sections
 * absentes de la tab bar (OKR, Statistiques…) vivent dans le sheet « Plus » —
 * on l'ouvre d'abord. On privilégie le clic (il teste au passage que le lien de
 * nav existe et pointe au bon endroit) plutôt que page.goto().
 * NB : le mode démo SURVIT à un full reload (`cosmo_demo_active`, cf.
 * app-mode.store.ts) — l'ancien avertissement « goto = perte du mode démo »
 * était périmé ; goto reste utilisable pour une route sans lien de nav.
 */
export async function navTo(page: Page, name: RegExp, urlPattern: RegExp): Promise<void> {
  const visibleLink = page.getByRole('link', { name }).filter({ visible: true }).first();
  if (await visibleLink.isVisible().catch(() => false)) {
    try {
      await visibleLink.click({ timeout: 10_000 });
    } catch {
      // WebKit/Windows : les animations continues (curseur TextType, charts)
      // font flapper le check « stable » de Playwright sur la tab bar fixe.
      // Le lien est visible et cliquable — on force le dispatch.
      await visibleLink.click({ force: true });
    }
  } else {
    // Mobile : la section est dans le sheet « Plus » de la MobileTabBar.
    // Les items du sheet sont des <button> (navigate()), pas des <a>.
    await page.getByRole('button', { name: /plus d'options/i }).click();
    // ⚠️ Scoper au sheet est OBLIGATOIRE : la page reste montée DERRIÈRE lui et
    // ses propres contrôles matchent le même `name`. Le Dashboard a par exemple
    // un MobileCollapsible « OKR » qui arrivait avant l'item du sheet en ordre
    // DOM ; `.first()` le sélectionnait et le clic était intercepté par le
    // sheet posé au-dessus → timeout de 5 s (échec mobile-safari sur /okr).
    const sheet = page.locator('[data-mobile-more-sheet]');
    await sheet.waitFor({ state: 'visible', timeout: 10_000 });
    const sheetItem = sheet
      .getByRole('link', { name })
      .or(sheet.getByRole('button', { name }))
      .filter({ visible: true })
      .first();
    await sheetItem.click({ timeout: 10_000 });
  }
  await page.waitForURL(urlPattern);
}
