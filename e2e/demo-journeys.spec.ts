import { test, expect, navTo, TASK_TOGGLE_UNCHECKED } from './fixtures';

/**
 * Parcours approfondis (audit 9/10 phase 4) — vont au-delà des smoke tests :
 * ils exercent une MUTATION réelle (toggle complétion) et la PERSISTANCE
 * (localStorage démo) à travers une navigation SPA.
 *
 * Règles fixtures respectées : navigation par NavLink uniquement (jamais
 * page.goto → full reload qui casse le mode démo), toasts d'erreur détectés
 * via [data-sonner-toast][data-type="error"].
 *
 * Sélecteurs stables : marqueurs data-tutorial-id (contrat documenté
 * CLAUDE.md « Ne pas renommer sans grep ») + rôles ARIA (les checkboxes
 * custom portent role=checkbox + aria-checked — faille A-1/A-2).
 *
 * Anti-flake : les assertions de toggle sont basées sur le COMPTAGE des
 * checkboxes non cochées — un `.first()` se re-résout vers un AUTRE élément
 * quand la liste se réordonne après mutation (AnimatePresence), un compte
 * global non.
 */

test('démo : compléter une tâche décrémente les tâches non cochées', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

  const list = page.locator('[data-tutorial-id="tasks-list"]');
  await expect(list).toBeVisible({ timeout: 15_000 });

  // filter({ visible: true }) : desktop (table) et mobile (cards) coexistent
  // dans le DOM, masqués par CSS responsive — sans le filtre, `.first()` peut
  // résoudre une case cachée et le compte inclut les doublons invisibles.
  // TASK_TOGGLE_UNCHECKED plutôt que [role="checkbox"][aria-checked="false"] :
  // la TaskCard mobile est un <button aria-pressed>, pas une checkbox ARIA
  // (cf. fixtures.ts) — l'ancien sélecteur ne matchait que le desktop.
  const unchecked = list.locator(TASK_TOGGLE_UNCHECKED).filter({ visible: true });
  await expect(unchecked.first()).toBeVisible({ timeout: 10_000 });
  const before = await unchecked.count();
  expect(before).toBeGreaterThan(0);

  await unchecked.first().click();

  // Quelle que soit la réaction UI (case cochée OU ligne sortie du filtre),
  // le nombre de non-cochées doit diminuer d'exactement 1.
  await expect.poll(() => unchecked.count(), { timeout: 7_000 }).toBe(before - 1);

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});

test('démo : toggle d\'habitude PERSISTE à travers une navigation SPA', async ({ demoPage: page }) => {
  await navTo(page, /habitudes|habits/i, /\/habits/);
  // Compile à froid Vite : attendre le rendu avant de chercher le marqueur.
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

  // La vue par défaut est « Tableau » (le marqueur habits-list n'existe que
  // dans la vue « Liste ») — on scope sur <main> + rôles ARIA des DayButtons.
  const main = page.getByRole('main');
  const checkboxes = main.locator('[role="checkbox"]');
  await expect(checkboxes.first()).toBeVisible({ timeout: 15_000 });

  // 🔴 On suit UNE case, par son nom accessible, et plus un TOTAL de cases.
  // Mesuré dans la trace CI du 2026-10-09 : le total valait 0 à la première
  // lecture alors que la grille en porte ~60, donc « avant » était faux et le
  // test passait ou cassait selon le moment de la relecture. Une case nommée
  // est sans ambiguïté, et ce test reste capable de voir une coche perdue.
  // 1. Attendre la grille remplie (les seeds de démo cochent la plupart des jours).
  await expect
    .poll(() => main.locator('[role="checkbox"][aria-checked="true"]').count(), { timeout: 15_000 })
    .toBeGreaterThan(0);

  // 2. La case visée : la première du tableau, identifiée par habitude + date.
  //    Le libellé change avec l'état (« (complétée) ») : on garde la racine.
  const cible = checkboxes.first();
  const libelle = (await cible.getAttribute('aria-label')) ?? '';
  const racine = libelle.replace(/\s*\(.*\)\s*$/, '');
  expect(racine, 'la case visée doit avoir un nom (habitude, date)').toMatch(/, \d{4}-\d{2}-\d{2}$/);
  // Nom en texte = sous-chaîne : couvre « …, 2026-10-03 » et « …, 2026-10-03 (complétée) ».
  const caseVisee = (p: typeof page) => p.getByRole('main').getByRole('checkbox', { name: racine });
  const etatAvant = await caseVisee(page).getAttribute('aria-checked');
  const etatApres = etatAvant === 'true' ? 'false' : 'true';

  // 3. Cocher (ou décocher) et attendre que CETTE case ait basculé.
  await caseVisee(page).click();
  await expect(caseVisee(page)).toHaveAttribute('aria-checked', etatApres, { timeout: 7_000 });

  // Aller-retour SPA : l'état doit survivre (repo localStorage démo).
  await navTo(page, /accueil|dashboard|tableau/i, /\/$|\/dashboard/);
  await navTo(page, /habitudes|habits/i, /\/habits/);

  // 4. La MÊME case porte toujours le nouvel état.
  await expect(caseVisee(page)).toHaveAttribute('aria-checked', etatApres, { timeout: 15_000 });

  // 5. Et après un RECHARGEMENT. 🔴 Sans cette étape le test ne mesurait pas
  //    la persistance : l'aller-retour SPA relit le cache React Query (2 min),
  //    jamais le stockage. Prouvé le 2026-10-09 en supprimant l'écriture de
  //    `toggleCompletion` : le test restait vert. Un rechargement vide le cache.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(caseVisee(page)).toHaveAttribute('aria-checked', etatApres, { timeout: 20_000 });

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});

test('démo : la page OKR rend la première carte avec sa progression', async ({ demoPage: page }) => {
  // Viewport-aware : sur mobile, OKR est dans le sheet « Plus » de la tab bar
  await navTo(page, /okr/i, /\/okr/);

  // Marqueur stable du tutoriel — première carte OKR rendue.
  const firstCard = page.locator('[data-tutorial-id="okr-first-card"]');
  await expect(firstCard).toBeVisible({ timeout: 15_000 });

  // La carte affiche une progression (seeds démo : 3 OKRs actifs avec %).
  // ⚠️ Le premier « % » du DOM (« 67% du temps écoulé ») est masqué sous
  // `md:` : sur téléphone le cas expirait sur un élément que personne ne voit.
  // On cherche un pourcentage VISIBLE, dans la carte.
  await expect(firstCard.locator('text=/%/').filter({ visible: true }).first()).toBeVisible({ timeout: 5_000 });

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});
