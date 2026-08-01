// E2E — Flux collaboration : ouvrir TaskModal → ouvrir la section Collaborateurs.
//
// ⚠️ Historique : cette spec cherchait un `heading` /collaborat|partager|amis/i
// dans le modal. Il n'y en a jamais eu — « Collaborateurs » est un <label>
// (desktop, DesktopCollaboratorsStep) ou un <p> (feuille mobile). L'assertion
// échouait donc systématiquement sur chromium. Elle avait aussi deux défauts
// qui la rendaient quasi-vacante :
//   1. un `if/else` qui passait sans rien vérifier si le bouton n'était pas
//      trouvé (masquait une vraie régression) ;
//   2. `window.__consoleErrors` n'est alimenté par PERSONNE dans l'app → le
//      `expect(errors).toHaveLength(0)` final passait toujours.
// On assert désormais un élément FONCTIONNEL de la section (le champ de
// recherche de collaborateur) et on écoute réellement la console.
import { test, expect, navTo, TASK_TOGGLE } from './fixtures';

/**
 * Erreurs console réelles (hors bruit connu non actionnable).
 *
 * Les `Warning:` sont écartés : React les émet via console.error en mode DEV
 * uniquement (le build prod ne les contient pas) et ils proviennent ici de
 * framer-motion, pas du code COSMO — `PopChild`/`AnimatePresence` déclenchent
 * « `ref` is not a prop » une fois par enfant animé (38 occurrences sur la
 * liste de tâches). Les filtrer garde l'assertion utile sans la rendre
 * ininterprétable ; les `pageerror` (exceptions non capturées) ne sont, eux,
 * JAMAIS filtrés — c'est le signal fort qu'on veut voir échouer.
 */
function watchConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.startsWith('Warning:')) return;
    if (text.includes('ResizeObserver') || text.includes('Non-Error')) return;
    errors.push(text);
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('collaboration (demo)', () => {
  // Pas d'override ici : 60 s était PLUS COURT que le timeout global (120 s,
  // cf. playwright.config.ts) et le réduisait silencieusement pour ce fichier
  // — le cold-start Vite y expirait dans la fixture (« Test timeout of 60000ms
  // exceeded while setting up "demoPage" »).

  test("ouvre TaskModal et affiche la section Collaborateurs", async ({ demoPage }) => {
    // Écoute AVANT toute action, sinon les erreurs du rendu sont manquées.
    const errors = watchConsoleErrors(demoPage);

    await navTo(demoPage, /to ?do|tâches|tasks/i, /\/tasks/);

    // Ouvrir la première tâche. Desktop = <table> (`hidden md:block`), mobile =
    // TaskCard (`md:hidden`) : les DEUX cohabitent dans le DOM, d'où
    // filter({ visible: true }) — sans lui, `table tbody tr` résolvait une
    // ligne invisible sur mobile et le clic partait en timeout.
    const list = demoPage.locator('[data-tutorial-id="tasks-list"]');
    await expect(list).toBeVisible({ timeout: 15_000 });
    const firstTask = list
      .locator('[data-testid="task-card"], table tbody tr')
      .filter({ visible: true })
      .first();
    await firstTask.waitFor({ state: 'visible', timeout: 15_000 });
    // scrollIntoViewIfNeeded : la liste a un `layout` Framer Motion (positions
    // qui se réajustent après le rendu initial). Sans lui, le clic auto-scroll
    // de Playwright vise la position D'AVANT le réajustement et atterrit sous
    // la tab bar mobile fixe (« <nav aria-label="Navigation mobile"> subtree
    // intercepts pointer events »).
    await firstTask.scrollIntoViewIfNeeded();
    await firstTask.click();

    const modal = demoPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Ouvrir la section collaborateurs :
    //  - desktop : bouton disclosure « Partager la tâche » (step 2 inline) ;
    //  - mobile  : Cell « Collaborateurs » (primitives.tsx rend un <button>)
    //              qui ouvre une action sheet.
    await modal
      .getByRole('button', { name: /partager la tâche|collaborateurs/i })
      .filter({ visible: true })
      .first()
      .click();

    // Assertion FONCTIONNELLE : le champ de recherche de collaborateur.
    // Desktop « Email, nom ou identifiant... » / mobile « Email ou nom… ».
    await expect(
      modal.getByPlaceholder(/email.*nom/i).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Fermer le modal.
    await demoPage.keyboard.press('Escape');
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await expect(demoPage.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('la liste des tâches se charge sans erreur console', async ({ demoPage }) => {
    const errors = watchConsoleErrors(demoPage);

    await navTo(demoPage, /to ?do|tâches|tasks/i, /\/tasks/);
    await expect(demoPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    // La liste doit être réellement peuplée (seed démo = 100 tâches) : sans
    // cette assertion, le test passerait sur une page vide.
    const list = demoPage.locator('[data-tutorial-id="tasks-list"]');
    await expect(list).toBeVisible({ timeout: 15_000 });
    await expect(
      list.locator(TASK_TOGGLE).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(demoPage.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
