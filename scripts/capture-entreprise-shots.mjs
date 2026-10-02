/**
 * capture-entreprise-shots.mjs — capture les vues de la landing entreprise
 * (public/screenshots/entreprise/*.webp) sur l'application en mode démo.
 *
 * Usage : un serveur de dev en mode démo, puis
 *   SHOTS_BASE=http://localhost:5521 node scripts/capture-entreprise-shots.mjs
 * (`dev-landing-shots` dans .claude/launch.json vide les variables Supabase,
 * donc la démo est forcée). Défaut : http://localhost:3000.
 * Jetable : script d'appoint, pas branché à un `npm run`.
 *
 * Refait le 2026-10-02 : la navigation est passée en une route par section
 * avec un panneau à droite (2026-09-23), le cadrage « depuis la barre
 * d'onglets » n'a plus d'ancre. On cadre désormais la colonne principale ET le
 * panneau de navigation, barre latérale de l'app repliée, en 16/10.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'screenshots', 'entreprise');
const BASE = process.env.SHOTS_BASE ?? 'http://localhost:3000';
const VIEWPORT = { width: 1280, height: 800 };
/** Largeur finale des WebP (cf. `docs/SEO.md` § captures de la landing). */
const OUT_WIDTH = 1600;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Thème noir AVANT la démo (la landing entreprise est graphite), et tout ce qui
// s'affiche une seule fois neutralisé : glossaire au premier affichage d'un
// rôle, carte « Gardez votre organisation », bandeau démo, consentement.
const PRESET = `
  try {
    localStorage.setItem('cosmo_cookie_consent', 'refused');
    localStorage.setItem('cosmo_onboarding_modules_done', '1');
    localStorage.setItem('cosmo_demo_banner_dismissed', '1');
    localStorage.removeItem('cosmo_onboarding_pending');
    localStorage.setItem('theme', 'noir');
    localStorage.setItem('cosmo_org_terms_seen_v1', JSON.stringify(['owner','admin','manager','teamLead','member','team','project','category']));
    localStorage.setItem('cosmo_demo_bridge_snooze', String(Date.now() + 30 * 24 * 3600 * 1000));
  } catch {}
`;

const HIDE_TRANSIENTS = `
  if (!document.getElementById('shots-hide')) {
    const s = document.createElement('style');
    s.id = 'shots-hide';
    s.textContent = '[data-sonner-toaster]{opacity:0 !important;pointer-events:none !important}';
    document.head.appendChild(s);
  }
  for (const l of ['Masquer la bannière démo', 'Masquer cette information', 'Masquer cette proposition']) {
    document.querySelector('button[aria-label="' + l + '"]')?.click();
  }
`;

/** Colonne principale + panneau de droite, du haut de la page, en 16/10. */
const clip = async (page) => {
  const main = await page.locator('main').first().boundingBox();
  // +16 : la poignée de repli de la barre latérale déborde sur le bord de <main>.
  const x = Math.round(main.x) + 16;
  const width = VIEWPORT.width - x;
  return { x, y: 0, width, height: Math.round((width * 10) / 16) };
};

const capture = async (page, name) => {
  await page.evaluate(HIDE_TRANSIENTS);
  await page.mouse.move(2, VIEWPORT.height - 2); // aucun survol parasite
  await wait(400);
  await page.screenshot({ path: join(OUT, `${name}.png`), clip: await clip(page) });
  console.log(`  ✓ ${name}.png`);
};

const goTo = async (page, path, waitMs = 3500) => {
  await page.goto(`${BASE}/entreprise${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 20000 });
  await wait(waitMs);
  await page.evaluate(HIDE_TRANSIENTS);
};

const clickView = async (page, name, waitMs = 3500) => {
  await page.getByRole('button', { name: new RegExp(`^${name}$`) }).first().click();
  await wait(waitMs);
};

const NAMES = [
  'apercu', 'pyramide', 'membres', 'taches',
  'projets', 'projets-planning', 'projets-portefeuille',
  'okr', 'rapports', 'taches-tableau', 'taches-dependances',
];

/** `SHOTS_ONLY=taches-tableau,taches-dependances` : ne refait que ces captures. */
const ONLY = process.env.SHOTS_ONLY ? new Set(process.env.SHOTS_ONLY.split(',')) : null;
const want = (...names) => !ONLY || names.some((n) => ONLY.has(n));

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await page.addInitScript(PRESET);

  await page.goto(`${BASE}/entreprise-presentation`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const btn = page.getByRole('button', { name: /^Ouvrir la démo entreprise$/ }).first();
  await btn.waitFor({ state: 'visible', timeout: 60000 });
  await btn.click();
  await page.waitForURL(/\/entreprise/, { timeout: 30000 });
  await wait(2500);

  // Barre latérale de l'app repliée : on ne montre que l'espace entreprise.
  const collapse = page.getByRole('button', { name: 'Réduire la barre latérale' }).first();
  if (await collapse.isVisible().catch(() => false)) await collapse.click();

  if (want('apercu')) {
    await goTo(page, '');
    await capture(page, 'apercu');
  }

  if (want('pyramide')) {
    await goTo(page, '/pyramid', 4000); // laisse jouer l'entrée de l'organigramme
    await capture(page, 'pyramide');
  }

  if (want('membres')) {
    await goTo(page, '/members');
    await capture(page, 'membres');
  }

  if (want('taches')) {
    await goTo(page, '/tasks', 4500);
    await capture(page, 'taches');
  }

  if (want('projets', 'projets-planning', 'projets-portefeuille')) {
    await goTo(page, '/projects');
    await clickView(page, 'Liste');
    await capture(page, 'projets');
    await clickView(page, 'Planning', 5000);
    await capture(page, 'projets-planning');
    await clickView(page, 'Portefeuille');
    await capture(page, 'projets-portefeuille');
    await clickView(page, 'Liste', 500); // ne pas laisser la préférence sur Portefeuille
  }

  if (want('okr')) {
    await goTo(page, '/okr', 4000);
    await capture(page, 'okr');
  }

  if (want('rapports')) {
    await goTo(page, '/reports', 4500);
    await capture(page, 'rapports');
  }

  // ── Étape 3 « Exécution » : le Tableau par statut, et la fiche d'une tâche
  // bloquée sur son onglet Dépendances. Viewport élargi : à 1280 px, les cinq
  // colonnes de statut ne tiennent pas côte à côte.
  if (want('taches-tableau', 'taches-dependances')) {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await goTo(page, '/tasks', 4500);
    await clickView(page, 'Tableau', 2500);
    if (want('taches-tableau')) {
      await page.evaluate(HIDE_TRANSIENTS);
      await page.mouse.move(2, 1198);
      await wait(400);
      // Cadré sur la rangée des filtres rapides et le tableau, sans l'en-tête
      // d'organisation ni le panneau de droite, en 16/10.
      const row = await page.getByRole('button', { name: /^Tableau$/ }).first().boundingBox();
      const main = await page.locator('main').first().boundingBox();
      const x = Math.round(main.x) + 16;
      await page.screenshot({
        path: join(OUT, 'taches-tableau.png'),
        clip: { x, y: Math.round(row.y) - 14, width: 1280, height: 800 },
      });
      console.log('  ✓ taches-tableau.png');
    }
    if (want('taches-dependances')) {
      // « Audit accessibilité WCAG » est bloquée par « Intégration du header
      // responsive » dans le seed démo (DEMO_TASK_DEPENDENCIES).
      await page.getByRole('button', { name: /Modifier la tâche Audit accessibilité/ }).first().click();
      await wait(2000);
      await page.getByText('Dépendances', { exact: true }).first().click();
      await wait(1500);
      const dialog = page.getByRole('dialog').filter({ hasText: 'Modifier la tâche' }).first();
      await page.mouse.move(2, 1198);
      await wait(300);
      // Sans le pied de la fiche (Supprimer / Annuler / Sauvegarder) : seul
      // l'onglet Dépendances porte le message.
      const box = await dialog.boundingBox();
      const del = await dialog.getByRole('button', { name: /^Supprimer$/ }).first().boundingBox();
      await page.screenshot({
        path: join(OUT, 'taches-dependances.png'),
        clip: { x: box.x, y: box.y, width: box.width, height: Math.round(del.y - 18 - box.y) },
      });
      console.log('  ✓ taches-dependances.png');
      await page.keyboard.press('Escape');
    }
    await clickView(page, 'Liste', 500); // ne pas laisser la préférence sur Tableau
  }

  await browser.close();

  // Ré-encodage .png → .webp redimensionné (canvas Chromium : pas d'encodeur
  // webp côté Node dans ce dépôt).
  const converter = await chromium.launch();
  const cpage = await converter.newPage();
  for (const name of NAMES.filter((n) => want(n))) {
    const pngPath = join(OUT, `${name}.png`);
    const b64 = readFileSync(pngPath).toString('base64');
    const dataUrl = await cpage.evaluate(async ({ base64, outWidth }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      // Jamais d'agrandissement : la carte Dépendances est plus étroite que 1600.
      canvas.width = Math.min(outWidth, img.naturalWidth);
      canvas.height = Math.round((img.naturalHeight * canvas.width) / img.naturalWidth);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.82);
    }, { base64: b64, outWidth: OUT_WIDTH });
    writeFileSync(join(OUT, `${name}.webp`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    rmSync(pngPath);
    console.log(`  ✓ ${name}.webp`);
  }
  await converter.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
