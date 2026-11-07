import { test, expect, type Page } from '@playwright/test';
import { parseUserAgent } from '../../src/lib/traffic-ua';

/**
 * Contrôle de fumée de la PRODUCTION, rejoué après chaque mise en ligne
 * (`.github/workflows/smoke-prod.yml`, constat CI-02 de l'audit du 2026-11-06).
 *
 * POURQUOI : Vercel publiait chaque push de `main` en ~40 s, sans attendre la CI
 * (porte de deploiement depuis le 2026-11-07 : seul un noyau vert part)
 * (docs/DEPLOYMENT.md § Rollback). Avant ce fichier, rien ne regardait le site
 * APRÈS la mise en ligne : `uptime.yml` lit du HTML avec curl, il n'exécute pas
 * le bundle. Un bundle qui plante au démarrage rend un HTML parfait et une page
 * morte, et seul un navigateur le voit.
 *
 * ❌ HORS de `playwright.config.ts` : ce fichier ne s'appelle pas `*.spec.ts`
 * exprès, pour qu'aucun project du job `e2e` ne le ramasse (il frapperait la
 * production depuis chaque PR). Il a sa config, `playwright.smoke.config.ts`,
 * sans `webServer`, et se lance à la main :
 *
 *   npx playwright test -c e2e/smoke/playwright.smoke.config.ts
 *   SMOKE_BASE_URL=https://autre.exemple npx playwright test -c e2e/smoke/playwright.smoke.config.ts
 *
 * LECTURE SEULE. Aucune connexion, aucune saisie, aucun clic qui écrit, aucun
 * compte. Les seules requêtes non GET partent vers `/api/collect`, et elles ne
 * peuvent PAS créer de hit d'audience, voir plus bas.
 *
 * 🔴 ABSENCE DE HIT D'AUDIENCE, trois verrous indépendants (lecture de
 * `api/collect.ts` et `src/lib/traffic.ts`, 2026-11-06) :
 *   1. `traffic.ts` n'envoie rien sans consentement « accepted ». Un contexte
 *      neuf n'en a pas et ce fichier ne clique jamais sur le bandeau : la page
 *      n'émet donc aucun `sendBeacon` de toute façon.
 *   2. Toute requête de la page vers `/api/collect` est servie localement par
 *      `context.route` (204) : elle ne quitte pas le navigateur.
 *   3. La seule requête qui atteint vraiment le collecteur (la sonde ci-dessous)
 *      porte un user-agent de robot. `collect.ts` répond 204 AVANT de lire
 *      `SUPABASE_SECRET_KEY` et d'appeler `track_hit` quand `parseUserAgent(ua).bot`
 *      est vrai. Ce fichier importe ce même `parseUserAgent` depuis le dépôt et
 *      REFUSE d'envoyer la sonde si l'UA n'y est plus reconnu comme robot : un
 *      futur resserrement de `BOT_RE` casse ce test au lieu de créer des hits.
 */

/** Contient `bot`, `monitor` et `headless` : trois motifs de `BOT_RE`, pas un seul. */
const SMOKE_UA = 'COSMO-smoke-bot/1.0 (+https://github.com/kelax12/COSMO1.2; monitor; headless)';

test.use({ userAgent: SMOKE_UA });

/**
 * Erreurs de console tolérées. Toute entrée doit dire POURQUOI.
 *
 * · Les deux 401 Supabase : `src/main.tsx` (~l.179) préchauffe la connexion par un
 *   `fetch` SANS `apikey` vers `/auth/v1/health` et `/rest/v1/`. GoTrue et PostgREST
 *   répondent 401, c'est leur preuve de vie (docs/DEPLOYMENT.md § 9), et Chrome
 *   journalise tout 4xx de ressource en « error ». Mesuré en production le
 *   2026-11-06. Ancrées sur l'hôte Supabase ET le chemin : un 401 ailleurs échoue.
 */
const CONSOLE_ALLOWLIST: readonly RegExp[] = [
  /status of 401.*\.supabase\.co\/auth\/v1\/health\)$/,
  /status of 401.*\.supabase\.co\/rest\/v1\/\)$/,
];

interface Probe {
  consoleErrors: string[];
  pageErrors: string[];
  badAssets: string[];
  collectRequests: string[];
}

/** Branche les sondes sur la page AVANT toute navigation. */
async function arm(page: Page): Promise<Probe> {
  const probe: Probe = { consoleErrors: [], pageErrors: [], badAssets: [], collectRequests: [] };

  // Verrou 2 : rien ne part vers le collecteur depuis la page.
  await page.context().route('**/api/collect', (route) => route.fulfill({ status: 204 }));

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Le texte d'un « Failed to load resource » ne porte pas l'URL : elle est dans la location.
    const line = `${msg.text()} (${msg.location().url})`;
    if (CONSOLE_ALLOWLIST.some((re) => re.test(line))) return;
    probe.consoleErrors.push(line);
  });
  page.on('pageerror', (err) => probe.pageErrors.push(err.message));
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/collect') probe.collectRequests.push(req.method());
  });
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (url.pathname.startsWith('/assets/') && res.status() >= 400) {
      probe.badAssets.push(`${res.status()} ${url.pathname}`);
    }
  });
  return probe;
}

test.describe('fumée production', () => {
  test('landing : 200, h1 rendu, aucune erreur JS, actifs chargés', async ({ page, request }) => {
    const probe = await arm(page);

    const response = await page.goto('/', { waitUntil: 'load' });
    expect(response?.status(), 'statut HTTP de la landing').toBe(200);

    // Le prérendu pose un `h1`, l'hydratation le garde. Une page morte sans
    // bundle ou un bundle qui plante au démarrage le laisse sans texte, ou le
    // remplace par l'écran d'erreur, qui n'en a pas.
    const h1 = page.locator('h1').first();
    await expect(h1, 'le h1 de la landing').toBeVisible({ timeout: 15_000 });
    expect((await h1.innerText()).trim().length, 'texte du h1').toBeGreaterThan(5);

    // Fenêtre de 3 s pour que les chunks différés (`lazy`) partent et échouent.
    // Pas `networkidle` : Realtime et la préconnexion Supabase l'empêchent d'arriver.
    await page.waitForTimeout(3_000);

    // Les actifs référencés par la page répondent, et ne sont pas du HTML
    // déguisé : la règle de réécriture de `vercel.json` exclut `/assets/`, mais
    // un déploiement partiel rend une 404 ou la coquille selon l'ordre.
    const assets = await page.evaluate(() => {
      const urls = new Set<string>();
      document
        .querySelectorAll<HTMLScriptElement>('script[src]')
        .forEach((el) => urls.add(el.src));
      document
        .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href], link[rel="modulepreload"][href]')
        .forEach((el) => urls.add(el.href));
      return [...urls].filter((u) => new URL(u).pathname.startsWith('/assets/'));
    });
    expect(assets.length, 'références /assets/* dans la page').toBeGreaterThan(0);
    for (const url of assets) {
      const res = await request.get(url);
      expect(res.status(), `statut de ${url}`).toBe(200);
      expect(res.headers()['content-type'] ?? '', `type de ${url}`).not.toMatch(/text\/html/);
    }

    expect(probe.badAssets, 'actifs /assets/* en erreur').toEqual([]);
    expect(probe.pageErrors, 'exceptions JS non rattrapées').toEqual([]);
    expect(probe.consoleErrors, 'erreurs console').toEqual([]);
    // Verrou 1 : sans consentement, la page n'a rien à envoyer au collecteur.
    expect(probe.collectRequests, 'requêtes de la page vers /api/collect').toEqual([]);
  });

  test('connexion : la page s\'affiche avec son formulaire, sans l\'utiliser', async ({ page }) => {
    const probe = await arm(page);

    const response = await page.goto('/login', { waitUntil: 'load' });
    expect(response?.status(), 'statut HTTP de /login').toBe(200);

    // Marqueurs structurels, jamais un libellé : le texte se traduit et se réécrit.
    await expect(page.locator('input[type="email"]').first(), 'champ e-mail').toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]').first(), 'champ mot de passe').toBeVisible();
    await expect(page.locator('form button[type="submit"]').first(), 'bouton de validation').toBeVisible();

    expect(probe.badAssets, 'actifs /assets/* en erreur').toEqual([]);
    expect(probe.pageErrors, 'exceptions JS non rattrapées').toEqual([]);
    expect(probe.consoleErrors, 'erreurs console').toEqual([]);
    expect(probe.collectRequests, 'requêtes de la page vers /api/collect').toEqual([]);
  });

  test('api/collect : la fonction répond, sans rien écrire', async ({ request, baseURL }) => {
    expect(baseURL, 'baseURL').toBeTruthy();
    const origin = new URL(baseURL as string).origin;

    // Sans corps ni écriture possible : méthode refusée.
    const get = await request.get('/api/collect');
    expect(get.status(), 'GET /api/collect').toBe(405);

    // Une autre origine est refusée avant même la lecture du corps.
    const foreign = await request.post('/api/collect', {
      headers: { Origin: 'https://origine-etrangere.invalid', 'Content-Type': 'application/json' },
      data: { kind: 'view', path: '/smoke' },
    });
    expect(foreign.status(), 'POST d\'une autre origine').toBe(403);

    // Verrou 3 : la sonde ne part que si le dépôt reconnaît bien l'UA comme robot.
    expect(
      parseUserAgent(SMOKE_UA).bot,
      'SMOKE_UA doit rester reconnu comme robot par src/lib/traffic-ua.ts',
    ).toBe(true);
    const bot = await request.post('/api/collect', {
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      data: { kind: 'view', path: '/smoke-ignore' },
    });
    // 204 « robot ignoré » : la fonction est déployée et tourne. Un 503 ou un
    // 502 ici voudrait dire que le collecteur a tenté d'écrire, donc que l'UA
    // n'a pas été reconnu : dans ce cas le test échoue ET la ligne a pu partir.
    expect(bot.status(), 'POST robot même origine').toBe(204);
  });
});
