import { test, expect } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Chauffer le serveur de démo pour WebKit, un préalable, pas un test
 * ═══════════════════════════════════════════════════════════════════
 *
 * 🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'ASSERTE (PRESQUE) RIEN.
 *
 * C-78 fait entrer le project `mobile-safari` (iPhone 12, WebKit) dans la CI,
 * après trois mois où il n'était joué par aucun workflow. Rejoué depuis un
 * poste le 2026-09-14, il échouait massivement, et **la cause n'était pas le
 * produit** :
 *
 *   sept des neuf premiers échecs étaient des attentes de FIXTURE qui
 *   expirent, le CTA « Essayer la démo gratuite » de la landing n'étant pas
 *   visible dans les 30 s contre un serveur Vite de DÉVELOPPEMENT.
 *
 * La même page, même moteur WebKit, même appareil émulé, chargée depuis la
 * PRODUCTION, rend `load` en **2 159 ms avec zéro requête en vol**, et son CTA
 * visible en moins de 6 s, mesuré 358 × 56 px. Ce qui est lent, c'est la
 * compilation à la demande des sources par Vite, pas l'application.
 *
 * ❌ **La mauvaise réponse aurait été de monter les timeouts** jusqu'à ce que
 *    ça passe : ça déplace le seuil sans nommer la cause, et ça rend le
 *    détecteur muet le jour où un écran est VRAIMENT lent.
 * ✅ **La bonne réponse est de payer ce coût ici, une fois, sous un nom qui le
 *    dit**, avant que le moindre parcours ne commence. C'est exactement ce que
 *    `e2e/stubbed/_warmup.spec.ts` fait déjà pour le serveur du port 3210, et
 *    ce fichier en est le jumeau pour le serveur de démo du port 3000.
 *
 * ⚠️ **Ce coût ne se voit PAS toujours en CI, et c'est ce qui le rend
 * traître.** `workers: 1` et `fullyParallel: false` font tourner les projects
 * l'un après l'autre : quand `chromium` passe avant, il a déjà chauffé le
 * serveur du port 3000, et `mobile-safari` n'en paie rien. Le jour où l'on
 * joue `mobile-safari` SEUL (ce que fait n'importe qui en local, et ce que
 * ferait un workflow dédié), la facture entière retombe sur son premier cas.
 * Un préalable explicite est la seule forme qui ne dépende pas de l'ordre.
 *
 * Ce fichier est le `dependencies` du project `mobile-safari` : s'il échoue,
 * les parcours ne sont pas joués, et c'est voulu. Un serveur qui ne sert pas
 * la landing et le tableau de bord n'a rien à mesurer.
 */
test.describe('Préalable, chauffer le serveur de démo pour WebKit', () => {
  // Ce préalable a le droit d'être long : c'est précisément son objet. Il
  // reste borné, pour qu'un serveur réellement cassé échoue au lieu de pendre.
  test.describe.configure({ timeout: 900_000 });

  test('la landing et le tableau de bord compilent et s’affichent', async ({ page, context }) => {
    await context.clearCookies();

    // 🔴 Les deux clés sont posées AVANT le rendu utile, comme dans
    // `e2e/fixtures.ts`, et pour la même raison mesurée : sur mobile le bandeau
    // cookies est ancré en bas sur TOUTE la largeur (`left-4 right-4`,
    // z-[200]) et recouvre le CTA démo, ce qui faisait échouer les 27 tests
    // mobile-safari dans la fixture (« <aside aria-label="Bannière cookies">
    // subtree intercepts pointer events »).
    // 🔴 Le timeout est EXPLICITE, et c'est tout l'objet de ce fichier.
    // `page.goto` retombe sinon sur son defaut de 30 s, intenable contre un
    // serveur qui compile la landing pour la premiere fois : le prealable
    // echouait alors AVANT d'avoir chauffe quoi que ce soit, ce qui est le
    // comble pour une chauffe. Mesure du 2026-09-15, serveur froid : 1,1 min
    // et « page.goto: Timeout was reached » sur cette ligne meme.
    //
    // 🔴 `domcontentloaded`, JAMAIS le `load` par defaut. Remesure le meme
    // jour : meme avec 180 000 ms, l'attente de `load` sur la landing EXPIRE
    // sous WebKit alors que la page est rendue et interactive depuis
    // longtemps. `load` attend la derniere ressource subordonnee, et rien ne
    // garantit qu'elle arrive. La disponibilite reelle est mesuree juste
    // apres, sur le CTA, qui est un signal du PRODUIT et non du reseau.
    await page.goto('/', { timeout: 180_000, waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.setItem('cosmo_cookie_consent', 'refused');
        localStorage.setItem('cosmo_demo_bridge_snooze', String(Date.now() + 86_400_000));
      } catch { /* ignore */ }
    });

    // ── 1. La landing : `LandingPage` lazy + GSAP, le plus gros des deux ──
    //
    // Cinq tentatives, et pas une seule : chaque re-empaquetage de Vite
    // recharge la page, ce qui ANNULE la navigation en cours. Ce n'est pas une
    // attente plus longue qu'il faut, c'est une nouvelle tentative. Même
    // raisonnement que `gotoStubbed`, mesuré le 2026-09-08 sur l'autre serveur.
    const cta = page.getByRole('button', { name: /essayer.*sans inscription/i }).first();
    let vue = false;
    for (let essai = 0; essai < 5 && !vue; essai += 1) {
      try {
        // 🔴 Le `goto` est DANS le `try`, et ce n'est pas un detail de style :
        // c'est LUI qui leve « Navigation is interrupted by another
        // navigation » quand Vite se re-empaquette. Laisse dehors, la boucle
        // de retentatives ne rattrapait pas le seul echec qu'elle existe pour
        // rattraper, et le prealable mourait a la premiere interruption.
        await page.goto('/', { timeout: 180_000, waitUntil: 'domcontentloaded' });
        await cta.waitFor({ state: 'visible', timeout: 120_000 });
        vue = true;
      } catch {
        // Un re-empaquetage a recharge la page : on retente, on n'attend pas
        // plus longtemps.
      }
    }
    expect(vue, 'Le CTA demo de la landing doit finir par s afficher').toBe(true);

    // ── 2. Le tableau de bord : `DashboardPage` lazy + recharts ──
    await page.evaluate(() => window.scrollTo(0, 0));
    try {
      await cta.click({ timeout: 60_000 });
    } catch {
      // Le clic peut avoir DÉCLENCHÉ la navigation puis échouer quand même, la
      // page se démontant sous les vérifications post-clic de Playwright.
      if (!/\/dashboard/.test(page.url())) await cta.dispatchEvent('click');
    }
    await page.waitForURL(/\/dashboard/, { timeout: 120_000 });

    // ⚠️ On attend le titre que la taille courante rend RÉELLEMENT : sous
    // 768 px, le « Bonjour, <prénom> » est `hidden md:block` et le h1 est LA
    // DATE. Attendre `/bonjour/i` ici serait structurellement impossible à
    // tenir sur un viewport mobile, et c'est le défaut qui a rendu le project
    // `mobile-safari` intégralement rouge jusqu'au 2026-09-06.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/\d/, {
      timeout: 180_000,
    });
  });
});
