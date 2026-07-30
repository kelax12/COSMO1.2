import { test, expect, type Page } from '@playwright/test';

/**
 * Routing localisé (phase 2 i18n) — le contrat que `basename` doit tenir.
 *
 * Ces tests portent sur des URLS et des attributs, jamais sur des libellés :
 * les catalogues anglais sont encore partiels et retombent sur le français, donc
 * asserter du texte donnerait un test qui casse à chaque traduction ajoutée.
 *
 * Rappel de l'invariant vérifié ici : **la locale est une fonction pure de
 * l'URL finale**. Pas de préfixe ⇒ français, toujours.
 */

/** Vide la préférence de langue — sinon un test précédent oriente le suivant. */
async function withoutStoredLocale(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem('cosmo_locale');
    } catch {
      /* navigation privée stricte */
    }
  });
}

/**
 * Marqueur stable de la page 404 : son `<h1>`.
 *
 * Un `getByText(/404/)` matcherait n'importe quel « 404 » de la landing ou du
 * blog — un test qui passe pour la mauvaise raison est pire qu'un test absent.
 */
const notFoundHeading = (page: Page) =>
  page.getByRole('heading', { name: /page introuvable/i });

/** Force la langue annoncée par le navigateur, pour tester la détection auto. */
async function withNavigatorLanguage(page: Page, language: string) {
  await page.addInitScript((lang) => {
    Object.defineProperty(navigator, 'languages', { get: () => [lang], configurable: true });
    Object.defineProperty(navigator, 'language', { get: () => lang, configurable: true });
  }, language);
}

test.describe('préfixe de locale', () => {
  test('la racine reste en français pour un visiteur francophone', async ({ page }) => {
    await withoutStoredLocale(page);
    await withNavigatorLanguage(page, 'fr-FR');
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('un visiteur anglophone est redirigé vers /en/ depuis la racine', async ({ page }) => {
    // C'est LE point de détection automatique : la racine, au premier passage.
    await withoutStoredLocale(page);
    await withNavigatorLanguage(page, 'en-US');
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(new URL(page.url()).pathname).toBe('/en/');
  });

  test('/fr/... est canonicalisé sans préfixe', async ({ page }) => {
    // Deux URLs pour un même contenu = duplicate content, et `hreflang` ne peut
    // désigner qu'une seule version.
    await withoutStoredLocale(page);
    await withNavigatorLanguage(page, 'fr-FR');
    await page.goto('/fr/a-propos');

    expect(new URL(page.url()).pathname).toBe('/a-propos');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('un lien profond français reste français chez un anglophone', async ({ page }) => {
    // L'absence de préfixe signifie « français », même si le visiteur préfère
    // l'anglais : sinon un lien partagé n'afficherait pas le contenu annoncé.
    await withoutStoredLocale(page);
    await withNavigatorLanguage(page, 'en-US');
    await page.goto('/a-propos');

    expect(new URL(page.url()).pathname).toBe('/a-propos');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('une préférence enregistrée oriente la racine', async ({ page }) => {
    await withNavigatorLanguage(page, 'fr-FR');
    await page.addInitScript(() => window.localStorage.setItem('cosmo_locale', 'en'));
    await page.goto('/');

    expect(new URL(page.url()).pathname).toBe('/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('slugs publics localisés', () => {
  test('/en/about répond', async ({ page }) => {
    await page.goto('/en/about');

    expect(new URL(page.url()).pathname).toBe('/en/about');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  test('/en/a-propos tombe en 404', async ({ page }) => {
    // Une seule URL canonique par langue et par page : le slug français ne doit
    // pas répondre sous le préfixe anglais.
    await page.goto('/en/a-propos');
    await expect(notFoundHeading(page)).toBeVisible({ timeout: 10_000 });
  });

  test('les liens applicatifs héritent du préfixe sans être réécrits', async ({ page }) => {
    // C'est tout l'intérêt de `basename` : les 162 `Link`/`navigate` absolus de
    // l'app se préfixent seuls. Une régression ici ferait retomber
    // silencieusement l'utilisateur en français.
    await page.goto('/en/about');
    const internalHref = await page
      .locator('a[href^="/en/"], a[href="/en"]')
      .first()
      .getAttribute('href');
    expect(internalHref).toMatch(/^\/en(\/|$)/);
  });
});

test.describe('segments qui ne sont pas des locales', () => {
  test('une locale connue mais non ouverte tombe en 404', async ({ page }) => {
    // `/es/` avant la phase 6 : on ne prétend pas la servir.
    await page.goto('/es/tasks');
    await expect(notFoundHeading(page)).toBeVisible({ timeout: 10_000 });
  });

  test('un token d’invitation n’est pas pris pour un préfixe', async ({ page }) => {
    // Avaler ce chemin casserait le parcours d'acquisition par lien de partage.
    //
    // On n'assertit PAS que l'URL reste `/invite/...` : `InvitePage` consomme le
    // token puis redirige de son plein gré (login/signup si déconnecté). Ce qui
    // prouve que la route a bien été atteinte, c'est l'absence de 404.
    await page.goto('/invite/e2e-token-inexistant');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
    await expect(notFoundHeading(page)).toHaveCount(0);
  });
});
