/**
 * capture-entreprise-shots.mjs — capture ponctuelle des vues Kanban et
 * Planning (deadlines) de l'onglet Projets, pour la landing entreprise.
 *
 * Usage : npm start (port 3000) puis `node scripts/capture-entreprise-shots.mjs`
 * Jetable : script d'appoint, pas branché à un `npm run`.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'screenshots', 'entreprise');
const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 1280, height: 800 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PRESET = `
  try {
    localStorage.setItem('cosmo_cookie_consent', 'refused');
    localStorage.setItem('cosmo_onboarding_modules_done', '1');
    localStorage.setItem('cosmo_demo_banner_dismissed', '1');
    localStorage.removeItem('cosmo_onboarding_pending');
    localStorage.setItem('theme', 'noir');
  } catch {}
`;

const HIDE_TRANSIENTS = `
  const s = document.createElement('style');
  s.textContent = '[data-sonner-toaster]{opacity:0 !important;pointer-events:none !important}';
  document.head.appendChild(s);
`;

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

  await page.evaluate(PRESET);
  const hideBanner = page.getByRole('button', { name: /masquer la bannière démo/i }).first();
  if (await hideBanner.isVisible().catch(() => false)) await hideBanner.click();
  await wait(1000);

  await page.goto(`${BASE}/entreprise?tab=projects`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 20000 });
  await wait(2500);
  await page.evaluate(HIDE_TRANSIENTS);

  // Cadrage aligné sur les captures existantes : sans la nav latérale, sans
  // l'en-tête d'organisation — la scène commence à la barre d'onglets.
  const tabsAnchor = page.getByRole('button', { name: /^Aperçu$/ }).first();
  const tabsBox = await tabsAnchor.boundingBox();
  const clip = { x: tabsBox.x - 8, y: tabsBox.y - 12, width: VIEWPORT.width - (tabsBox.x - 8) - 8, height: VIEWPORT.height - (tabsBox.y - 12) - 8 };

  // Vue Tableau (Kanban)
  const kanbanTab = page.getByRole('button', { name: /tableau/i }).first();
  await kanbanTab.click();
  await wait(1200);
  await page.screenshot({ path: join(OUT, 'projets-kanban.png'), fullPage: false, clip });
  console.log('  ✓ projets-kanban.png');

  // Vue Planning (deadlines)
  const timelineTab = page.getByRole('button', { name: /planning/i }).first();
  await timelineTab.click();
  await wait(1200);
  await page.screenshot({ path: join(OUT, 'projets-planning.png'), fullPage: false, clip });
  console.log('  ✓ projets-planning.png');

  await browser.close();

  // Ré-encodage .png → .webp (canvas Chromium — pas d'encodeur webp côté
  // Node dans ce dépôt) : convention `shot()` de data.ts, cf. les captures
  // existantes.
  const toWebp = async (name) => {
    const pngPath = join(OUT, `${name}.png`);
    const b64 = readFileSync(pngPath).toString('base64');
    const converter = await chromium.launch();
    const p = await converter.newPage();
    const dataUrl = await p.evaluate(async (base64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return canvas.toDataURL('image/webp', 0.85);
    }, b64);
    await converter.close();
    writeFileSync(join(OUT, `${name}.webp`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    rmSync(pngPath);
    console.log(`  ✓ ${name}.webp`);
  };
  await toWebp('projets-kanban');
  await toWebp('projets-planning');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
