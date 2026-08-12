/**
 * capture-screenshots.mjs — captures produit pour le SEO (Google Images) et l'OG.
 *
 * Génère public/screenshots/*.png depuis le MODE DÉMO : les données sont des
 * seeds déterministes (aucune donnée réelle ne peut fuiter dans une image
 * publique) et le rendu est reproductible d'une exécution à l'autre.
 *
 * Usage : npm start (port 3000) puis `node scripts/capture-screenshots.mjs`
 *
 * ⚠ Les dimensions écrites ici doivent rester synchronisées avec les attributs
 * width/height du bloc HOME_STATIC de prerender.mjs : ce sont eux qui réservent
 * la place et évitent le décalage de mise en page (CLS).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'screenshots');
const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 1280, height: 800 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Overlays à neutraliser AVANT le premier rendu : bandeau cookies, onboarding.
// Posés via addInitScript, sinon le composant lit le localStorage avant nous et
// s'affiche quand même.
const PRESET = `
  try {
    localStorage.setItem('cosmo_cookie_consent', 'refused');
    localStorage.setItem('cosmo_onboarding_modules_done', '1');
    localStorage.setItem('cosmo_demo_banner_dismissed', '1');
    localStorage.removeItem('cosmo_onboarding_pending');
    // Tutoriels par page (useTutorial) : sans ça, /tasks et /habits s'ouvrent
    // sur une carte d'aide en 6 étapes avec voile assombrissant.
    ['tasks', 'habits', 'agenda', 'okr'].forEach((page) => {
      localStorage.setItem('cosmo_tutorial_seen_' + page + '_desktop', '1');
      localStorage.setItem('cosmo_tutorial_seen_' + page + '_mobile', '1');
    });
  } catch {}
`;

// Toasts : masqués en CSS, JAMAIS retirés du DOM.
//
// ⚠ Piège coûteux : `el.remove()` sur `[data-sonner-toaster]` arrache un nœud
// que React gère encore. Au re-render suivant, l'AppErrorBoundary attrape
// l'erreur et blanchit toute la page — la capture sortait vide et la
// navigation suivante échouait, la sidebar ayant disparu avec. Une règle CSS
// est invisible pour React.
const HIDE_TRANSIENTS = `
  const s = document.createElement('style');
  s.textContent = '[data-sonner-toaster]{opacity:0 !important;pointer-events:none !important}';
  document.head.appendChild(s);
`;

const SHOTS = [
  // `ready` : sélecteur qui prouve que les données sont peintes — sans lui on
  // capture le spinner de chargement, ce qui est arrivé au premier essai.
  { path: /\/dashboard/, nav: /accueil/i, file: 'dashboard.png', ready: 'main h1, main h2' },
  { path: /\/tasks/, nav: /t[âa]ches/i, file: 'taches.png', ready: 'main table, main [role="list"], main h1' },
  { path: /\/habits/, nav: /habitudes/i, file: 'habitudes.png', ready: 'main h1, main h2' },
];

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await page.addInitScript(PRESET);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await wait(1500);

  const btn = page.getByRole('button', { name: /essayer.*sans inscription/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  await btn.click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  // ⚠ Les flags doivent être reposés ICI, pas via addInitScript : loginDemo()
  // commence par clearDemoStorage(), qui balaie toutes les clés `cosmo_*`.
  // Tout ce qui est écrit avant le clic sur « Essayer la démo » est effacé.
  await page.evaluate(PRESET);

  // La bannière démo est déjà montée : le flag ne la fera pas disparaître,
  // il faut cliquer son bouton de fermeture.
  const hideBanner = page.getByRole('button', { name: /masquer la bannière démo/i }).first();
  if (await hideBanner.isVisible().catch(() => false)) await hideBanner.click();
  await wait(3000);

  for (const shot of SHOTS) {
    if (!shot.path.test(page.url())) {
      const link = page.getByRole('link', { name: shot.nav }).filter({ visible: true }).first();
      await link.click({ force: true });
      await page.waitForURL(shot.path, { timeout: 10000 });
    }
    await page.waitForSelector(shot.ready, { timeout: 20000 });
    // Laisse les animations d'entrée se terminer avant de figer l'image.
    await wait(3000);
    await page.evaluate(HIDE_TRANSIENTS);
    await wait(400);
    await page.screenshot({ path: join(OUT, shot.file), fullPage: false });
    console.log(`  ✓ ${shot.file}`);
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
