import { test as base, expect, Page, Locator } from '@playwright/test';

/**
 * Fixture commune : démarre chaque test en mode démo authentifié sur /dashboard.
 *
 * Le mode démo est instantané (pas de réseau Supabase, seed local), parfait
 * pour les tests E2E. On clique le bouton "Essayer maintenant, sans
 * inscription" sur la landing, puis on attend que le dashboard soit affiché.
 *
 * Note : si l'onboarding overlay s'affiche (premier loginDemo), on le ferme
 * pour ne pas interférer avec les assertions du test.
 */
/**
 * `page.goto` qui survit à un re-empaquetage de Vite.
 *
 * 🔴 D'OÙ ÇA VIENT (C-78, 2026-09-15). En faisant entrer le project
 * `mobile-safari` dans la CI, les premiers cas échouaient dans cette fixture
 * même, sur deux modes de défaillance QUI NE SONT PAS DES DÉFAUTS PRODUIT :
 *
 *   · `page.goto: Timeout was reached`, le défaut de `page.goto` est **30 s**,
 *     intenable contre un serveur de développement qui compile la landing
 *     (lazy + GSAP) pour la première fois ;
 *   · `Navigation to "/" is interrupted by another navigation to "/"`, Vite
 *     découvre une dépendance, se ré-empaquette et **recharge la page**, ce qui
 *     annule la navigation en cours.
 *
 * 🔴 ET SURTOUT : `waitUntil: 'domcontentloaded'`, JAMAIS le `'load'` par
 * défaut. Mesuré le 2026-09-15 sur WebKit : `page.goto('/')` a dépassé
 * **180 000 ms** en attendant `load` sur la landing, une page qui était
 * pourtant rendue et interactive depuis longtemps. C'est le même piège que
 * celui déjà rencontré le 2026-09-05 sur le harnais hors mode démo, où `load`
 * n'arrivait jamais.
 *
 * ❌ Ne jamais « corriger » ça en montant encore le timeout : `load` attend la
 *    dernière ressource subordonnée, et rien ne garantit qu'elle arrive. La
 *    vraie attente de disponibilité est faite JUSTE APRÈS, sur le CTA de la
 *    landing, qui est un signal du produit et non du réseau.
 *
 * ❌ La mauvaise réponse serait de monter les timeouts jusqu'à ce que ça
 *    passe : le second cas n'est pas une question d'attente, la navigation est
 *    ANNULÉE et n'aboutira jamais, quelle que soit la patience.
 * ✅ La bonne réponse est de RETENTER, et de le borner.
 *
 * ⚠️ Cette tolérance ne masque aucune lenteur réelle du produit : un serveur
 * qui ne sert pas la page épuise les trois tentatives et le test échoue. Et
 * c'est le project `mobile-safari-warmup` qui paie le gros de la compilation,
 * une fois, sous un nom qui le dit.
 */
export async function gotoTolerant(page: Page, url: string): Promise<void> {
  let derniere: unknown;
  for (let essai = 0; essai < 3; essai += 1) {
    try {
      await page.goto(url, { timeout: 180_000, waitUntil: 'domcontentloaded' });
      return;
    } catch (e) {
      derniere = e;
      // Une navigation interrompue laisse la page sur un état intermédiaire :
      // on retente immédiatement, sans attendre davantage.
    }
  }
  throw derniere;
}

export const test = base.extend<{ demoPage: Page }>({
  demoPage: async ({ page, context }, use) => {
    // 1. État propre, clear cookies + storage Supabase + flags démo
    //    (sinon RootRoute redirige immédiatement vers /dashboard si session
    //     déjà active, et le CTA "Essayer maintenant" n'existe pas).
    await context.clearCookies();
    await gotoTolerant(page, '/');
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
    //    pas, d'où un échec 100 % mobile.
    //    'refused' = option la plus respectueuse (aucun cookie non essentiel).
    //    Cette clé est préservée par clearDemoStorage() (PRESERVE_KEYS), elle
    //    survit donc au loginDemo() qui balaye le reste des clés cosmo_*.
    //    Neutraliser aussi le pont démo → compte : il apparaît au bout de 90 s
    //    d'usage démo OU à la 3ᵉ création, en carte ancrée en bas (au-dessus de
    //    la MobileTabBar). Un test long ou qui crée 3 entités le verrait
    //    surgir et intercepter des clics, exactement le mode d'échec que la
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
    await gotoTolerant(page, '/');

    // 2. Cliquer le CTA démo principal
    //    Le bouton a aria-label "Essayer la démo sans inscription"
    //    et un texte visible "Essayer maintenant, sans inscription"
    //    30 s : la LandingPage est lazy-loadée et animée par GSAP ; au premier
    //    test d'un serveur Vite froid son rendu dépasse largement 10 s.
    const demoBtn = page.getByRole('button', { name: /essayer.*sans inscription/i }).first();
    // 🔴 Une seconde chance, bornée. Sous WebKit en CI, la landing (lazy,
    // animée) n'avait parfois toujours pas peint son CTA à 30 s : deux tests
    // instables le 2026-10-09, réussis au retry. Recharger reprend un rendu
    // bloqué ; un serveur qui ne sert vraiment pas la page échoue toujours.
    try {
      await demoBtn.waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      await gotoTolerant(page, '/');
      await demoBtn.waitFor({ state: 'visible', timeout: 30_000 });
    }
    // Deux faux positifs d'actionnabilité se cumulent sur la landing :
    //   - « element is not stable » : les animations GSAP d'entrée bougent
    //     encore le CTA quand Playwright vérifie sa position ;
    //   - « <header> subtree intercepts pointer events » : le `scrolling into
    //     view` de Playwright amène le CTA SOUS le header sticky
    //     (`sticky top-0 z-50`), qui capte alors le clic.
    // On remonte en haut pour dégager le header, puis on retombe si besoin sur
    // un dispatch direct. `{ force: true }` ne suffit PAS ici : il saute le
    // test d'interception mais tape toujours au point central, c'est-à-dire
    // sur le header, et la navigation n'avait donc jamais lieu.
    await page.evaluate(() => window.scrollTo(0, 0));
    try {
      await demoBtn.click({ timeout: 15_000 });
    } catch {
      // Le clic peut avoir DÉCLENCHÉ la navigation puis rejeté quand même
      // (la page se démonte sous les vérifications post-clic de Playwright).
      // Sans ce garde, on relançait un clic sur un bouton déjà disparu, qui
      // n'aboutit jamais et bloque le test jusqu'au timeout (observé : 60 s
      // à 2 min figés au lieu d'un échec net).
      if (!/\/dashboard/.test(page.url())) {
        await demoBtn.dispatchEvent('click');
      }
    }

    // 3. Attendre le dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    // Le dashboard est lazy-loadé et son h1 « Bonjour » a une animation d'opacité
    // (cf. audit-a11y A-9). Au tout premier test (démarrage à froid du serveur
    // Vite), le rendu peut dépasser le timeout par défaut de 5 s → flake. 20 s
    // absorbent le cold start sans masquer un vrai problème (les autres tests,
    // serveur chaud, passent bien en dessous).
    //    45 s : au tout premier test d'un serveur froid, Vite compile encore
    //    le DashboardPage lazy (+ recharts) pendant que l'animation joue.
    //
    // 🔴 LE TITRE N'EST PAS LE MÊME AUX DEUX TAILLES, et cette fixture a
    //    longtemps supposé le contraire. Le « Bonjour, <prénom> » du dashboard
    //    est écrit `hidden md:block` (DashboardPage.tsx) : sous 768 px le h1
    //    est LA DATE, choix produit délibéré et commenté à sa source. Attendre
    //    `/bonjour/i` était donc STRUCTURELLEMENT impossible à tenir sur un
    //    viewport mobile, la fixture y échouait au bout de 45 s, avant le
    //    moindre test, sur tous les specs à la fois.
    //
    //    Mesuré le 2026-09-06 : le h1 rendu en 390 px est « dimanche 6 sept. ».
    //    C'est ce qui rendait le project `mobile-safari` intégralement rouge,
    //    et ce qui empêchait `e2e/reduced-motion-sheets.spec.ts` de mesurer
    //    `MobileMoreSheet`, la seule feuille dont on sache qu'elle a vraiment
    //    été cassée.
    //
    // ❌ Ne pas « corriger » ça en acceptant n'importe quel h1 : un h1 vide ou
    //    celui d'une autre page passerait, et la fixture cesserait de prouver
    //    qu'on est bien arrivé sur le dashboard rendu. On attend le titre que
    //    la taille courante rend RÉELLEMENT.
    const isMobileViewport = (page.viewportSize()?.width ?? 1280) < 768;
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      isMobileViewport ? /\d/ : /bonjour/i,
      { timeout: 45_000 },
    );

    // 4. Skip onboarding général + tutoriels par page
    //    L'overlay onboarding est posé 500ms après loginDemo() et bloque
    //    tous les clics. Les tutoriels page (Tasks/Habits/OKR/Agenda) se
    //    déclenchent à l'arrivée sur leur page respective.
    //    On marque tout comme "vu" dans localStorage pour neutraliser.
    await page.evaluate(() => {
      try {
        localStorage.removeItem('cosmo_onboarding_pending');
        // Désormais 2 flags par page (desktop + mobile), neutraliser les deux
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
 * Case de complétion d'une tâche, sélecteurs valables sur les DEUX viewports.
 *
 * Les deux implémentations ont divergé sémantiquement lors de la refonte
 * mobile et n'ont plus AUCUN rôle ARIA commun :
 *   - desktop (`task-table/list.tsx`)  : role="checkbox" + aria-checked
 *   - mobile  (`task-table/TaskCard.tsx`) : <button> + aria-pressed
 * En revanche elles partagent le même `aria-label`, c'est donc le seul
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
 * Si le clic vient d'ouvrir un menu déroulant (Radix `role="menu"`), clique
 * le premier item.
 *
 * Cas réel : « Entreprise », la démo place l'utilisateur dans DEUX
 * organisations (Nova Studio + Atelier Lune, cf. `organizations/local.repository.ts`),
 * donc `NavItemLink` (Layout.tsx) rend un `role="button"` déclenchant un
 * `DropdownMenu` de choix d'organisation, PAS un `<a>` de navigation directe -
 * sur desktop ET mobile, c'est le comportement voulu (plusieurs organisations
 * → il faut choisir). Peu importe laquelle pour un test qui vérifie juste que
 * `/entreprise` rend sans erreur : le premier item convient.
 */
async function clickThroughOrgMenuIfAny(page: Page): Promise<void> {
  const menuItem = page.getByRole('menuitem').first();
  if (await menuItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await menuItem.click();
  }
}

/**
 * Navigation SPA viewport-aware : clique le lien ou bouton VISIBLE (sidebar
 * desktop ou tab bar mobile). `.first()` seul peut résoudre un contrôle caché
 * par le CSS responsive (sidebar `hidden` sur mobile) → timeout. Sur mobile,
 * les sections absentes de la tab bar (OKR, Statistiques…) vivent dans le
 * sheet « Plus », on l'ouvre d'abord. On privilégie le clic (il teste au
 * passage que le contrôle de nav existe et pointe au bon endroit) plutôt que
 * page.goto().
 * NB : le mode démo SURVIT à un full reload (`cosmo_demo_active`, cf.
 * app-mode.store.ts), l'ancien avertissement « goto = perte du mode démo »
 * était périmé ; goto reste utilisable pour une route sans lien de nav.
 */
/**
 * Un élément « visible » au sens de Playwright (boîte non vide, pas
 * `visibility: hidden`) n'est pas forcément ATTEIGNABLE : hors de l'écran,
 * recouvert, ou dans un panneau garé à côté. On le vérifie au point exact où
 * le clic tomberait.
 *
 * 🔴 2026-09-23 · sous `mobile-safari` en CI, `navTo` choisissait un lien
 * « Paramètres » vu comme visible mais que personne ne pouvait toucher, et
 * attendait 10 s qu'il le devienne (18 cas instables, 1 échec, run
 * `35826477521`). Sur téléphone, le vrai chemin passe par la feuille « Plus ».
 */
async function isReachable(target: Locator): Promise<boolean> {
  return target
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (r.width === 0 || r.height === 0) return false;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit));
    })
    .catch(() => false);
}

export async function navTo(page: Page, name: RegExp, urlPattern: RegExp): Promise<void> {
  // Premier lien de ce nom qui soit réellement ATTEIGNABLE, pas seulement le
  // premier du DOM : un lien injoignable peut précéder un lien valable (la
  // barre d'onglets du bas vient après le reste de la page).
  const candidats = page.getByRole('link', { name }).filter({ visible: true });
  let visibleLink: Locator | null = null;
  const nbCandidats = await candidats.count().catch(() => 0);
  for (let i = 0; i < nbCandidats; i++) {
    if (await isReachable(candidats.nth(i))) { visibleLink = candidats.nth(i); break; }
  }
  if (visibleLink) {
    try {
      await visibleLink.click({ timeout: 10_000 });
    } catch {
      // Même garde que le CTA démo (cf. plus haut) : le premier clic peut
      // avoir abouti et navigué avant de rejeter, sans ce check, le clic
      // forcé retente sur un lien déjà démonté et bloque jusqu'au timeout.
      if (urlPattern.test(page.url())) return;
      // WebKit/Windows : les animations continues (curseur TextType, charts)
      // font flapper le check « stable » de Playwright sur la tab bar fixe.
      // Le lien est visible et cliquable, on force le dispatch. Timeout
      // explicite : un `force` sans timeout hérite du timeout du TEST entier
      // et un lien redevenu inaccessible entre-temps bloquait jusqu'à 2 min
      // au lieu d'échouer proprement.
      await visibleLink.click({ force: true, timeout: 10_000 });
    }
    await clickThroughOrgMenuIfAny(page);
    await page.waitForURL(urlPattern);
    return;
  }

  // Pas de <a> visible : sur desktop, certaines entrées de nav (Entreprise
  // avec plusieurs organisations démo) sont un role="button" qui ouvre un
  // menu au lieu de naviguer directement, cf. clickThroughOrgMenuIfAny.
  const visibleButton = page.getByRole('button', { name }).filter({ visible: true }).first();
  if (await visibleButton.isVisible().catch(() => false)) {
    // ⚠️ Ce déclencheur peut se DÉTACHER en boucle : le trigger d'organisation
    // est re-rendu par les données de nav qui arrivent (notifications d'org,
    // badges), et Playwright re-résout alors indéfiniment jusqu'au timeout
    // (« element was detached from the DOM, retrying », échec mobile-safari
    // observé sur /entreprise). Un échec ici n'est donc PAS une preuve que la
    // nav est cassée : on retombe sur le sheet « Plus », qui est le chemin
    // légitime sur mobile de toute façon.
    try {
      await visibleButton.click({ timeout: 10_000 });
      await clickThroughOrgMenuIfAny(page);
      await page.waitForURL(urlPattern, { timeout: 10_000 });
      return;
    } catch {
      if (urlPattern.test(page.url())) return;
      // Le clic a pu ouvrir le menu d'organisation avant d'échouer : un menu
      // Radix resté ouvert capterait le clic suivant sur « Plus ».
      await page.keyboard.press('Escape').catch(() => {});
      // On continue vers le chemin mobile ci-dessous.
    }
  }

  // Mobile : la section est dans le sheet « Plus » de la MobileTabBar.
  // Les items du sheet sont des <button> (navigate()), pas des <a>, sauf
  // « Entreprise » multi-org, qui est elle aussi un déclencheur de menu.
  // 🔴 2026-09-23 · ce clic n'avait AUCUN délai propre : quand WebKit juge le
  // bouton instable (la barre d'onglets anime ses badges), il héritait du délai
  // du TEST entier, 120 s, et le cas mourait sur « page fermée » (run
  // `35847722505`, /statistics). Même délai et même repli que les autres clics
  // de cette fonction.
  const plus = page.getByRole('button', { name: /plus d'options/i }).filter({ visible: true }).first();
  try {
    await plus.click({ timeout: 15_000 });
  } catch {
    await plus.click({ force: true, timeout: 10_000 });
  }
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
  // L'item peut ne pas être encore VISIBLE quand la feuille l'est : sous WebKit
  // elle glisse à ~1 image/s, et le clic forcé ci-dessous expirait sur un
  // élément jamais trouvé (instable le 2026-10-10). On l'attend d'abord.
  await sheetItem.waitFor({ state: 'visible', timeout: 20_000 });
  try {
    await sheetItem.click({ timeout: 10_000 });
  } catch {
    if (urlPattern.test(page.url())) return;
    // Même repli que le chemin par lien : sous WebKit, la feuille peut encore
    // s'animer (mesuré sur un poste : ~1 image/s), et le test « stable » de
    // Playwright n'aboutit jamais sur un élément qui glisse. L'élément est
    // résolu et visible ; on force le dispatch, avec un délai explicite.
    await sheetItem.click({ force: true, timeout: 10_000 });
  }
  await clickThroughOrgMenuIfAny(page);
  await page.waitForURL(urlPattern);
}

// ═══════════════════════════════════════════════════════════════════
// Navigation de l'espace entreprise, sur les DEUX tailles d'écran
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Depuis la navigation du 2026-09-23 (livrée sur main par b96aff02), une
// section = une route, et on l'atteint
// par DEUX composants distincts selon la largeur :
//   - `md` et plus : `OrgSideNav`, un `<nav>` de LIENS à droite de la page ;
//   - en dessous : `OrgSectionSwitcher`, un bouton `[data-org-section-switcher]`
//     qui ouvre une feuille `[data-org-section-sheet]` de BOUTONS.
// Les specs entreprise ne connaissaient que les liens desktop : sous
// `mobile-safari` (390 px), le `<nav>` n'est pas rendu du tout (il vit dans un
// emplacement que `Layout` ne pose pas sur mobile), et chaque cas expirait à
// 2 min sur `getByRole('navigation').getByRole('link')` (run 36866415723 :
// huit des neuf échecs entreprise propres à WebKit).
//
// ⚠️ Ancrer le libellé au DÉBUT (`/^projets/i`) : le badge de nouveautés entre
// dans le nom accessible (« Projets 3 nouveautés »).

const ORG_NAV = /sections de l.entreprise/i;

/** Attend que l'une des deux navigations soit peinte, et dit laquelle. */
async function orgNavKind(page: Page): Promise<'desktop' | 'mobile'> {
  const switcher = page.locator('[data-org-section-switcher]');
  const nav = page.getByRole('navigation', { name: ORG_NAV });
  // ⚠️ `filter({ visible: true })` est indispensable : sur desktop, le
  // sélecteur mobile est DANS le DOM (`md:hidden`), avant le `<nav>`, et
  // `.first()` le choisissait pour attendre qu'il devienne visible.
  await expect(switcher.or(nav).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  return (await switcher.isVisible()) ? 'mobile' : 'desktop';
}

/** Ouvre une section de l'espace entreprise, comme une personne le ferait. */
export async function openOrgSection(page: Page, label: RegExp): Promise<void> {
  if ((await orgNavKind(page)) === 'desktop') {
    const nav = page.getByRole('navigation', { name: ORG_NAV });
    // Visitée puis quittée, la carte se REPLIE hors de l'écran (comportement
    // voulu du 2026-09-23) : ses liens restent « visibles » pour Playwright
    // mais le clic tombe sur la page. On la rouvre par sa zone d'approche,
    // le chemin clavier et tactile (`Afficher la navigation`).
    if ((await nav.getAttribute('data-collapsed')) === 'true') {
      await nav.getByRole('button', { name: /^afficher la navigation/i }).click();
      await expect(nav).toHaveAttribute('data-collapsed', 'false');
    }
    await nav.getByRole('link', { name: label }).click();
    return;
  }
  await page.locator('[data-org-section-switcher]').click();
  const sheet = page.locator('[data-org-section-sheet]');
  const item = sheet.getByRole('button', { name: label });
  // Même repli que `navTo` : sous WebKit la feuille glisse encore, et le test
  // « stable » de Playwright n'aboutissait jamais (181 essais, puis délai du
  // TEST entier, 120 s : instable le 2026-10-09). Délai propre, puis clic forcé
  // sur un élément résolu et visible.
  // 🔴 Et un clic ne compte que si la feuille se REFERME : un clic forcé
  // pendant qu'elle glisse encore pouvait tomber sans effet, la feuille
  // restant ouverte (instable le 2026-10-10). Une seconde tentative, pas plus.
  for (let essai = 0; essai < 2; essai += 1) {
    // Le premier clic a pu agir et la feuille se refermer lentement : on ne
    // reclique pas un élément qui n'est plus là.
    if (essai > 0 && !(await item.isVisible().catch(() => false))) break;
    try {
      await item.click({ timeout: 15_000 });
    } catch {
      await item.click({ force: true, timeout: 10_000 });
    }
    const fermee = await expect(sheet)
      .toHaveCount(0, { timeout: 5_000 })
      .then(() => true, () => false);
    if (fermee) return;
  }
  await expect(sheet).toHaveCount(0, { timeout: 10_000 });
}

/**
 * La section est-elle PROPOSÉE à ce compte ? Sur mobile, ouvre la feuille pour
 * le vérifier, puis la referme (Échap, `useModalA11y`).
 */
export async function expectOrgSectionOffered(page: Page, label: RegExp): Promise<void> {
  if ((await orgNavKind(page)) === 'desktop') {
    await expect(page.getByRole('navigation', { name: ORG_NAV }).getByRole('link', { name: label })).toBeVisible();
    return;
  }
  await page.locator('[data-org-section-switcher]').click();
  const sheet = page.locator('[data-org-section-sheet]');
  await expect(sheet.getByRole('button', { name: label })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0, { timeout: 10_000 });
}

/**
 * Referme la bulle de PREMIER affichage d'un rôle, si elle est ouverte.
 *
 * `RoleTerm` (71f65211) ouvre la définition d'un rôle d'elle-même, une fois par
 * appareil, au premier affichage du terme. C'est voulu : un repère qu'on
 * congédie. Mais sur un écran étroit le popover (288 px) couvre les commandes
 * voisines et prend le tap destiné à l'une d'elles. Un cas qui agit à côté d'un
 * rôle fraîchement affiché la referme donc d'abord, comme une personne.
 */
export async function dismissFirstSightBubble(page: Page): Promise<void> {
  const bubble = page.locator('[data-slot="popover-content"][data-state="open"]');
  // Elle s'ouvre au montage du rôle, juste après le titre : lui laisser paraître.
  await bubble.first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  if ((await bubble.count()) === 0) return;
  await page.keyboard.press('Escape');
  await expect(bubble).toHaveCount(0, { timeout: 5_000 });
}
