// Helpers partagés des specs d'audit clavier (AM-2). Extraits de
// `a11y-keyboard-audit.spec.ts` le 2026-10-23 sans changer une ligne de logique :
// les trois détecteurs (entrée du focus, piège, Échap) restent LES MÊMES pour
// toutes les surfaces, témoin Radix compris.
import { expect, navTo } from './fixtures';
import type { Page, Locator } from '@playwright/test';

/**
 * Passe en gabarit téléphone ET attend que la barre d'onglets mobile soit
 * montée.
 *
 * 🔴 Sans cette attente, `navTo` cherchait ses liens pendant que la mise en page
 * bureau se démontait encore : sous WebKit, le lien « Tâches » n'était pas
 * encore atteignable, la fixture retombait sur la feuille « Plus », qui ne le
 * porte pas, et le cas expirait sur un élément qui n'existe pas dans cette
 * feuille (échec constant le 2026-10-16, absent sous Chromium).
 */
export async function passerEnMobile(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: /plus d'options/i }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 20_000 });
}

export interface FocusReport {
  focusMovedIn: boolean;
  focusedOnOpen: string;
  trapped: boolean;
  firstEscapee: string | null;
  escClosed: boolean;
  role: string | null;
  ariaModal: string | null;
  focusReturned: boolean | null;
}

export async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'BODY';
    const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}[${name}]`;
  });
}

export async function focusInside(container: Locator): Promise<boolean> {
  return container.evaluate((node) => node.contains(document.activeElement));
}

/** Marque l'élément focalisé pour pouvoir vérifier le RETOUR du focus. */
export async function markTrigger(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('[data-a11y-trigger]').forEach((n) => n.removeAttribute('data-a11y-trigger'));
    (document.activeElement as HTMLElement | null)?.setAttribute('data-a11y-trigger', '1');
  });
}

export async function measureFocus(
  page: Page,
  container: Locator,
  checkReturn = false,
): Promise<FocusReport> {
  // ⚠️ Attendu jusqu'à 3 s, pas lu une fois : une surface pose son focus JUSTE
  // APRÈS son affichage, et la lecture immédiate tombait parfois avant
  // (MobileAddToList, instable en CI le 2026-10-10). Un focus qui n'entre
  // jamais rend toujours `false`, au bout des 3 s.
  const focusMovedIn = await expect
    .poll(() => focusInside(container), { timeout: 3_000 })
    .toBe(true)
    .then(() => true, () => false);
  const focusedOnOpen = await describeFocus(page);
  const role = await container.getAttribute('role');
  const ariaModal = await container.getAttribute('aria-modal');

  let firstEscapee: string | null = null;
  for (let i = 0; i < 15 && firstEscapee === null; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusInside(container))) firstEscapee = await describeFocus(page);
  }

  await page.keyboard.press('Escape');
  // 5 s et non 2 : sous WebKit, machine chargée ou runner CI, la sortie animée
  // d'une modale dépasse 2 s (mesuré le 2026-10-16 : le TÉMOIN Radix lui-même
  // rendait « Échap ne ferme pas » une fois sur trois alors qu'il se fermait).
  // Le détecteur reste le même : une modale qu'Échap ne ferme JAMAIS échoue
  // toujours, au bout des 5 s.
  const escClosed = await container
    .waitFor({ state: 'hidden', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  let focusReturned: boolean | null = null;
  if (escClosed && checkReturn) {
    // Radix restitue le focus APRÈS le démontage : mesurer trop tôt rendrait
    // « false » sur une modale conforme, donc un finding faux.
    await page.waitForTimeout(600);
    focusReturned = await page.evaluate(
      () => document.activeElement?.hasAttribute('data-a11y-trigger') ?? false,
    );
  }

  return { focusMovedIn, focusedOnOpen, trapped: firstEscapee === null, firstEscapee, escClosed, role, ariaModal, focusReturned };
}

/**
 * Les trois détecteurs de C-53, appliqués à une surface modale maison.
 *
 * ⚠️ Volontairement les MÊMES que ceux du témoin Radix : une modale maison qui
 * passerait un jeu de contrôles plus indulgent que la bibliothèque de
 * référence n'aurait rien prouvé.
 */
export function assertModalTrapsFocus(
  surface: string,
  report: FocusReport,
  // `alertdialog` pour une confirmation destructive (`useModalA11y`, option
  // `role`). Le rôle attendu est DÉCLARÉ par le cas, jamais deviné : une
  // surface qui changerait de rôle fait toujours rougir.
  expectedRole: 'dialog' | 'alertdialog' = 'dialog',
): void {
  expect(report.focusMovedIn, `${surface}: focus resté sur ${report.focusedOnOpen}`).toBe(true);
  expect(report.trapped, `${surface}: focus sorti sur ${report.firstEscapee}`).toBe(true);
  expect(report.escClosed, `${surface}: Échap ne ferme pas`).toBe(true);
  expect(report.role, `${surface}: pas de role="${expectedRole}"`).toBe(expectedRole);
  expect(report.ariaModal, `${surface}: pas d'aria-modal`).toBe('true');
  // 🔴 `focusReturned` est IMPRIMÉ, jamais assertionné, et ce n'est pas une
  // complaisance : mesuré le 2026-09-05, le TÉMOIN Radix lui-même le rend
  // `false`. Un détecteur que la bibliothèque de référence ne passe pas mesure
  // le détecteur, pas la modale — en faire une gate tiendrait les surfaces
  // maison à une barre que Radix ne franchit pas. Les trois détecteurs de
  // C-53 (`focusMovedIn`, `trapped`, `escClosed`) sont, eux, verts sur le
  // témoin, donc opposables.
}

/** Le focus reste-t-il dans `container` après `n` tabulations ? Sinon, où. */
export async function firstTabEscapee(page: Page, container: Locator, n = 12): Promise<string | null> {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusInside(container))) return await describeFocus(page);
  }
  return null;
}

/** Ouvre `/tasks`, attend le vrai rendu, et écarte le check-in hebdomadaire. */
export async function openTasksPage(page: Page): Promise<void> {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  // 🔴 Attendre un élément DE LA PAGE, pas un délai : l'URL passe à `/tasks`
  // alors que le chunk lazy n'a pas encore remplacé le dashboard. Trois sondes
  // successives ont mesuré le tableau de bord en croyant lire la page Tâches.
  await expect(page.getByRole('button', { name: /^créer une (nouvelle )?tâche$/i }).first())
    .toBeVisible({ timeout: 30_000 });
  const skip = page.getByRole('button', { name: /ignorer le check-in/i });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(400);
}


/**
 * Arrive sur `/entreprise` RENDUE. L'URL change avant que la page (lazy) ne
 * remplace le tableau de bord : attendre le nom de l'organisation démo, comme
 * `demo-entreprise.spec.ts`, sinon la navigation des sections n'existe pas encore.
 */
export async function ouvrirEntreprise(page: Page): Promise<void> {
  await navTo(page, /entreprise/i, /\/entreprise/);
  await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 30_000 });
}


/** Ouvre une surface en pressant Entrée sur son déclencheur focalisé. */
export async function ouvrirAuClavier(page: Page, trigger: Locator): Promise<void> {
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.focus();
  await markTrigger(page);
  await page.keyboard.press('Enter');
}

/**
 * Ouvre une surface par un RACCOURCI GLOBAL (N, ?, Ctrl+K).
 *
 * ⚠️ Ces trois surfaces sont `lazy` : leur écouteur `keydown` n'existe qu'une
 * fois leur chunk arrivé. Une touche pressée avant tombe dans le vide, d'où la
 * reprise. ⚠️ Deux des trois raccourcis BASCULENT (`?`, Ctrl+K) : on ne
 * represse donc que si la surface n'est pas déjà affichée, sinon une reprise
 * tardive la refermerait.
 */
export async function ouvrirParRaccourci(page: Page, touche: string, dialog: Locator): Promise<void> {
  // Le raccourci est ignoré quand le focus est dans un champ : on part du corps.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.keyboard.press(touche);
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

export async function mesurerSurface(
  page: Page,
  surface: string,
  dialog: Locator,
  expectedRole: 'dialog' | 'alertdialog' = 'dialog',
): Promise<void> {
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const report = await measureFocus(page, dialog, true);
  console.log(`[a11y-kbd] ${surface}`, JSON.stringify(report));
  assertModalTrapsFocus(surface, report, expectedRole);
}
