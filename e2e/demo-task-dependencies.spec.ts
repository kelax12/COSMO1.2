import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-27 — dépendances entre tâches PERSONNELLES (mig. 132)
 * ═══════════════════════════════════════════════════════════════════
 *
 * `demo-entreprise-dependencies.spec.ts` couvre le graphe d'ÉQUIPE. Le graphe
 * personnel, livré le 2026-08-30, n'avait aucun parcours : ses jumelles
 * `TaskDependencyPicker` / `TaskDependenciesSection` sont volontairement NON
 * factorisées avec les versions d'équipe (ni le même type de tâche, ni la même
 * règle de périmètre), donc rien de ce qui est vérifié côté entreprise ne dit
 * quoi que ce soit de celui-ci.
 *
 * Les trois propriétés couvertes ici sont exactement celles que la migration
 * fait respecter en base, vues depuis l'écran :
 *  • une arête posée depuis la modale existe et se relit ;
 *  • une tâche n'est jamais candidate à sa propre dépendance ;
 *  • le sens inverse d'une arête existante est REFUSÉ (cycle), et refusé
 *    visiblement, pas par un échec silencieux.
 *
 * ⚠️ Un seul test porte l'enchaînement, et c'est délibéré : la fixture démo
 * repart d'un `localStorage` vide à chaque test, donc découper ce parcours
 * obligerait chaque morceau à re-poser l'arête — et l'assertion « le cycle est
 * refusé » ne vaut que si l'arête d'origine vient d'être posée PAR L'ÉCRAN.
 */

/** Tâches du seed démo (`modules/tasks/local.repository.ts`). */
const TASK_A = 'Audit sécurité Q1 2026';
const TASK_B = 'Chercher nouvel appartement';
const TASK_C = 'Préparer dossier crédit immo';

/** Ouvre la modale d'édition d'une tâche retrouvée par la recherche. */
async function openTaskModal(page: Page, name: string): Promise<void> {
  const search = page.getByRole('textbox', { name: /rechercher une tâche par nom/i });
  await search.fill(name);
  // La recherche ne laisse qu'une ligne : le déclencheur générique suffit, et
  // il couvre les deux viewports (« Actions pour … » desktop, « Options »
  // mobile) sans dépendre de la façon dont le nom entre dans l'étiquette.
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  const trigger = page
    .getByRole('button', { name: /^(actions pour |options$)/i })
    .filter({ visible: true })
    .first();
  await trigger.click({ timeout: 15_000 });
  await page.getByRole('menuitem', { name: /^modifier$/i }).click();
  await expect(page.getByRole('dialog', { name: /modifier la tâche/i })).toBeVisible({
    timeout: 10_000,
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Déplie la section « Dépendances » et ouvre la popup d'ajout. */
async function openDependencyPicker(page: Page): Promise<void> {
  const taskDialog = page.getByRole('dialog', { name: /modifier la tâche/i });
  await taskDialog.getByRole('button', { name: /^dépendances/i }).first().click();
  await taskDialog.getByRole('button', { name: /ajouter une dépendance/i }).click();
  await expect(page.getByRole('dialog', { name: /ajouter une dépendance/i })).toBeVisible({
    timeout: 10_000,
  });
}

const picker = (page: Page) => page.getByRole('dialog', { name: /ajouter une dépendance/i });
const taskDialog = (page: Page) => page.getByRole('dialog', { name: /modifier la tâche/i });

test.describe('C-27 — dépendances entre tâches personnelles (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('poser une arête, la relire, refuser le cycle, puis la retirer', async ({
    demoPage: page,
  }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);

    // ── 1. Poser « A est bloquée par B » ──────────────────────────
    await openTaskModal(page, TASK_A);
    await openDependencyPicker(page);

    await picker(page).getByRole('textbox', { name: /rechercher une de mes tâches/i }).fill('appartement');
    const candidate = picker(page).getByRole('button', { name: new RegExp(escapeRe(TASK_B), 'i') });
    await expect(candidate).toBeVisible({ timeout: 10_000 });
    await candidate.click();
    await expect(candidate).toHaveAttribute('aria-pressed', 'true');

    await picker(page).getByRole('button', { name: /^ajouter 1 dépendance$/i }).click();
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /1 dépendance ajoutée/i }),
    ).toBeVisible({ timeout: 10_000 });

    // ── 2. Elle se relit sous « Bloquée par » ─────────────────────
    // Le parcours écrit ET relit : une arête posée qui ne réapparaît pas est
    // exactement le mode d'échec que ce test existe pour attraper.
    await expect(taskDialog(page).getByText(TASK_B)).toBeVisible({ timeout: 10_000 });
    await taskDialog(page)
      .getByRole('button', { name: /^annuler$/i })
      .filter({ visible: true })
      .first()
      .click();
    await expect(taskDialog(page)).toBeHidden({ timeout: 10_000 });

    // ── 3. Un second maillon : C bloque B ─────────────────────────
    // On construit volontairement une CHAÎNE (C → B → A) plutôt qu'un aller-
    // retour entre deux tâches. Le sens inverse direct est refusé par un
    // motif plus faible (« Déjà liée ») qui ne dit rien du graphe ; le cycle
    // INDIRECT à trois maillons, lui, ne peut être refusé que par un parcours
    // réel du graphe — c'est ce que la mig. 132 garde en base, et c'est donc
    // ce qu'il faut mesurer ici.
    await openTaskModal(page, TASK_B);
    await openDependencyPicker(page);
    await picker(page)
      .getByRole('textbox', { name: /rechercher une de mes tâches/i })
      .fill('crédit immo');
    const second = picker(page).getByRole('button', { name: new RegExp(escapeRe(TASK_C), 'i') });
    await expect(second).toBeVisible({ timeout: 10_000 });
    await second.click();
    await picker(page).getByRole('button', { name: /^ajouter 1 dépendance$/i }).click();
    await expect(taskDialog(page).getByText(TASK_C)).toBeVisible({ timeout: 10_000 });
    await taskDialog(page)
      .getByRole('button', { name: /^annuler$/i })
      .filter({ visible: true })
      .first()
      .click();
    await expect(taskDialog(page)).toBeHidden({ timeout: 10_000 });

    // ── 4. Le cycle indirect est refusé, et il le DIT ─────────────
    await openTaskModal(page, TASK_C);
    await openDependencyPicker(page);
    await picker(page)
      .getByRole('textbox', { name: /rechercher une de mes tâches/i })
      .fill('Audit sécurité');

    const wouldCycle = picker(page).getByRole('button', { name: new RegExp(escapeRe(TASK_A), 'i') });
    await expect(wouldCycle).toBeVisible({ timeout: 10_000 });
    // 🔴 Refus VISIBLE : désactivé ET motivé. A et C ne sont pas liées
    // directement — seul un parcours du graphe peut voir le cycle.
    await expect(wouldCycle).toBeDisabled();
    await expect(wouldCycle).toContainText(/créerait un cycle/i);

    // ── 5. Une tâche n'est jamais sa propre candidate ─────────────
    await picker(page)
      .getByRole('textbox', { name: /rechercher une de mes tâches/i })
      .fill('crédit immo');
    await expect(
      picker(page).getByRole('button', { name: new RegExp(escapeRe(TASK_C), 'i') }),
    ).toHaveCount(0);

    await picker(page).getByRole('button', { name: /fermer/i }).first().click();
    await taskDialog(page)
      .getByRole('button', { name: /^annuler$/i })
      .filter({ visible: true })
      .first()
      .click();

    // ── 6. Retirer l'arête la fait disparaître ────────────────────
    await openTaskModal(page, TASK_A);
    await taskDialog(page).getByRole('button', { name: /^dépendances/i }).first().click();
    await expect(taskDialog(page).getByText(TASK_B)).toBeVisible({ timeout: 10_000 });
    await taskDialog(page).getByRole('button', { name: /retirer cette dépendance/i }).first().click();

    await expect(taskDialog(page).getByText(TASK_B)).toHaveCount(0, { timeout: 10_000 });
    await expect(
      taskDialog(page).getByText(/aucune dépendance\. cette tâche peut démarrer/i),
    ).toBeVisible();
  });

  test('« Créer et lier » crée la tâche manquante et pose l’arête en un geste', async ({
    demoPage: page,
  }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
    await openTaskModal(page, TASK_A);
    await openDependencyPicker(page);

    const newName = `Prérequis E2E ${Date.now()}`;
    await picker(page).getByRole('button', { name: /^créer une tâche$/i }).click();
    await picker(page).getByRole('textbox', { name: /nom de la tâche/i }).first().fill(newName);
    await picker(page).getByRole('button', { name: /^créer et lier$/i }).click();

    // La tâche n'existait pas : elle est créée dans MES tâches, puis liée. Les
    // deux moitiés comptent — une création sans lien laisserait une tâche
    // orpheline que personne n'a demandée.
    await expect(taskDialog(page).getByText(newName)).toBeVisible({ timeout: 15_000 });
    await taskDialog(page)
      .getByRole('button', { name: /^annuler$/i })
      .filter({ visible: true })
      .first()
      .click();
    await expect(taskDialog(page)).toBeHidden({ timeout: 10_000 });

    await page.getByRole('textbox', { name: /rechercher une tâche par nom/i }).fill(newName);
    await expect(
      page.locator('[data-tutorial-id="tasks-list"]').getByText(newName).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
