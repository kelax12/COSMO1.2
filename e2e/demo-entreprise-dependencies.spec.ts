import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Dépendances entre tâches + chemin critique (mig. 108) et responsable
 * d'équipe (mig. 107), en mode démo sur l'org seedée « Nova Studio ».
 *
 * Ces tests visent ce que les tests unitaires ne peuvent pas voir : que le
 * graphe seedé arrive bien jusqu'au rendu, dans les deux sens de lecture, et
 * que le chemin critique se RECALCULE après une écriture. La régression qui a
 * motivé ce fichier — une tâche isolée masquant une vraie chaîne — était
 * invisible en test unitaire parce que toutes les tâches y étaient connectées.
 *
 * ⚠️ Même précaution que `demo-entreprise.spec.ts` : on ancre les onglets au
 * DÉBUT du libellé, jamais à la fin — le badge de nouveautés entre dans le nom
 * accessible du bouton (« Projets 3 nouveautés »).
 */
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('button', { name: label }).filter({ visible: true }).first();

/** Passe la vue Projets sur l'un des trois modes de la barre d'outils. */
const switchView = async (page: Page, name: 'Liste' | 'Tableau' | 'Planning') => {
  await page.getByRole('group', { name: /vue/i }).getByRole('button', { name }).click();
};

/**
 * DEUX dialogues coexistent dès que le sélecteur de dépendances est ouvert :
 * la modale de tâche et le sélecteur. Un `getByRole('dialog')` nu devient donc
 * ambigu (violation du mode strict), d'où ces deux accesseurs nommés.
 *
 * ⚠️ Ces tests cherchaient `getByRole('menuitem')`, hérité d'une époque où le
 * sélecteur était un menu déroulant. Il est devenu un dialogue avec une LISTE
 * À COCHER (`<ul><li><button aria-pressed>`), qui ne porte aucun `menuitem` :
 * la requête ne pouvait donc plus rien trouver, et les deux tests échouaient
 * en CI depuis le 2026-08-30 sans que le produit ait quoi que ce soit. Le
 * parcours réel est désormais : cocher, PUIS confirmer.
 */
const taskDialog = (page: Page) => page.getByRole('dialog', { name: /modifier la tâche/i });
const pickerDialog = (page: Page) =>
  page.getByRole('dialog', { name: /ajouter une dépendance/i });

test.describe('Entreprise — dépendances et chemin critique (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Planning : le chemin critique est signalé et chiffré', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);
    await switchView(page, 'Planning');

    // La légende n'existe QUE s'il y a un chemin — sa présence prouve déjà que
    // le graphe seedé a traversé repository → hook → calcul → rendu.
    const legend = page.getByTitle(/plus longue chaîne de tâches/i);
    await expect(legend).toBeVisible({ timeout: 15_000 });
    // Et qu'il est chiffré : un chemin sans durée signalerait un graphe relié
    // à des tâches sans estimation, donc un calcul qui ne sert à rien.
    await expect(legend).toContainText(/\d/);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Planning : le chemin retenu est la branche la plus LONGUE, pas la plus fournie', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);
    await switchView(page, 'Planning');
    await expect(page.getByTitle(/plus longue chaîne de tâches/i)).toBeVisible({ timeout: 15_000 });

    const ringed = await page.evaluate(() =>
      [...document.querySelectorAll('button.ring-amber-500')]
        .map((b) => (b.getAttribute('aria-label') ?? '').split(',')[0]));

    // Seed « Refonte du site » : Maquettes → Intégration → { Optimisation →
    // Analytics | Audit WCAG }. La branche Optimisation/Analytics est plus
    // lourde, l'Audit ne doit donc PAS être surligné.
    expect(ringed).toContain('Setup analytics');
    expect(ringed).not.toContain('Audit accessibilité WCAG');

    // Régression : le projet « Lancement produit » contient une tâche isolée
    // aussi longue que sa chaîne. Elle masquait tout le chemin de ce projet.
    expect(ringed).toContain('Kit presse');
  });

  test('Modale : les deux sens de dépendance, et l’alerte de blocage', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);
    await switchView(page, 'Liste');

    // « Kit presse » est bloquée par « Plan de communication » dans le seed.
    await page.getByRole('button', { name: /Modifier la tâche Kit presse/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // L'alerte doit être lisible SANS déplier : c'est elle qui change la
    // décision de démarrer la tâche.
    await expect(dialog.getByText(/en attente de \d+ tâche/i)).toBeVisible();

    await dialog.getByRole('button', { expanded: false }).filter({ hasText: /dépendances/i }).click();
    await expect(dialog.getByText(/bloquée par/i)).toBeVisible();
    await expect(dialog.getByText('Plan de communication')).toBeVisible();
  });

  test('Modale : une tâche sans blocage annonce qu’elle peut démarrer', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);
    await switchView(page, 'Liste');

    // « Plan de communication » ne dépend de rien mais bloque « Kit presse » :
    // le sens « Bloque » est celui qu'on oublie, il doit être visible.
    await page.getByRole('button', { name: /Modifier la tâche Plan de communication/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole('button', { expanded: false }).filter({ hasText: /dépendances/i }).click();
    await expect(dialog.getByText(/peut démarrer dès maintenant/i)).toBeVisible();
    await expect(dialog.getByText(/^Bloque$/)).toBeVisible();
  });

  test('Ajout : le sélecteur reste dans le projet, et désactive un lien déjà posé', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);
    await switchView(page, 'Liste');

    await page.getByRole('button', { name: /Modifier la tâche Plan de communication/i }).click();
    const dialog = taskDialog(page);
    await dialog.getByRole('button', { expanded: false }).filter({ hasText: /dépendances/i }).click();
    await dialog.getByRole('button', { name: /ajouter une dépendance/i }).click();

    const picker = pickerDialog(page);
    await expect(picker).toBeVisible();

    // Une tâche d'un AUTRE projet est absente : la base impose le même projet,
    // il n'y a donc rien à expliquer, seulement à ne pas proposer.
    const items = (await picker.getByRole('listitem').allInnerTexts()).join('\n');
    expect(items).not.toContain('Setup analytics');

    // « Kit presse » est déjà reliée dans l'autre sens : la choisir créerait un
    // cycle que la base refuserait. Elle reste AFFICHÉE, avec sa raison, mais
    // n'est pas sélectionnable — montrer pourquoi une option est indisponible
    // vaut mieux que la faire disparaître sans rien dire. C'est la propriété
    // qui compte ; l'ancienne version de ce test exigeait sa disparition pure
    // et simple, ce que le produit ne fait plus.
    const dejaLiee = picker.getByRole('listitem').filter({ hasText: 'Kit presse' });
    await expect(dejaLiee).toBeVisible();
    await expect(dejaLiee.getByRole('button')).toBeDisabled();

    // Et il reste bien des candidats réellement sélectionnables.
    const selectionnables = picker.getByRole('listitem').getByRole('button', { disabled: false });
    expect(await selectionnables.count()).toBeGreaterThan(0);
  });

  test('Écriture : ajouter une dépendance rallonge le chemin critique', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);

    const readCritical = async () => {
      await switchView(page, 'Planning');
      const legend = page.getByTitle(/plus longue chaîne de tâches/i);
      await expect(legend).toBeVisible({ timeout: 15_000 });
      return page.evaluate(() =>
        document.querySelectorAll('button.ring-amber-500').length);
    };

    const before = await readCritical();

    await switchView(page, 'Liste');
    await page.getByRole('button', { name: /Modifier la tâche Plan de communication/i }).click();
    const dialog = taskDialog(page);
    await dialog.getByRole('button', { expanded: false }).filter({ hasText: /dépendances/i }).click();
    await dialog.getByRole('button', { name: /ajouter une dépendance/i }).click();

    // Le picker est une liste à cocher, pas un menu : on sélectionne, PUIS on
    // confirme. Le bouton de confirmation porte le nombre choisi, ce qui le
    // distingue du déclencheur resté dans la modale de tâche.
    const picker = pickerDialog(page);
    await picker.getByRole('listitem').first().getByRole('button').click();
    await picker.getByRole('button', { name: /^ajouter 1 dépendance$/i }).click();
    await expect(picker).toBeHidden();

    await expect(dialog.getByText(/bloquée par/i)).toBeVisible();
    await dialog.getByRole('button', { name: /^annuler$/i }).click();

    // Un maillon de plus dans la chaîne : le surlignage doit suivre. C'est ce
    // qui prouve que le calcul est bien dérivé de la donnée, pas figé au 1er
    // rendu.
    const after = await readCritical();
    expect(after).toBeGreaterThan(before);
  });
});

test.describe('Entreprise — responsable d’équipe (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Le responsable est visible par tous, pas seulement par ceux qui peuvent le changer', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^membres/i).click();
    await page.waitForURL(/tab=members/);

    // Le seed nomme Marie (Design) et Jean (Dev) responsables.
    await expect(page.getByText('Responsable').first()).toBeVisible({ timeout: 15_000 });
    const badges = await page.getByText('Responsable').count();
    expect(badges).toBeGreaterThanOrEqual(2);
  });

  test('Nommer un responsable : plusieurs par équipe, et scopé à cette équipe', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^membres/i).click();
    await page.waitForURL(/tab=members/);
    await expect(page.getByText('Responsable').first()).toBeVisible({ timeout: 15_000 });

    const before = await page.getByText('Responsable').count();
    await page.getByRole('button', { name: /nommer responsable de l'équipe/i }).first().click();

    // Le rôle est multiple : nommer un second responsable ne révoque pas le
    // premier — c'est la différence avec `created_by`, qui était unique.
    await expect(async () => {
      expect(await page.getByText('Responsable').count()).toBe(before + 1);
    }).toPass({ timeout: 10_000 });

    // Et il reste porté par l'appartenance à UNE équipe : la promotion n'a pas
    // ajouté de responsable ailleurs.
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('cosmo_org_team_members');
      return raw ? (JSON.parse(raw) as { teamId: string; isLead: boolean }[]) : [];
    });
    const leadTeams = new Set(stored.filter((m) => m.isLead).map((m) => m.teamId));
    expect(leadTeams.size).toBeLessThanOrEqual(2);
  });
});

test.describe('Entreprise — aperçu des badges de nouveautés (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Le badge dit CE QUI a changé, pas seulement combien', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // Ouvrir /entreprise marque l'org comme vue : on rembobine pour que les
    // badges existent encore au moment de l'assertion.
    await page.evaluate(() => localStorage.setItem('cosmo_org_last_seen_org-demo-1', '0'));
    await page.reload();
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    const badge = page.locator('span[aria-label*="nouveaut"]').first();
    await expect(badge).toBeVisible({ timeout: 15_000 });

    // Le survol doit produire une liste nommée — un compteur seul obligeait à
    // ouvrir l'onglet juste pour savoir de quoi il parlait.
    await badge.hover();
    await expect(page.getByRole('tooltip').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tooltip').first()).toContainText(/·/);
  });
});
