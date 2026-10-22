// ═══════════════════════════════════════════════════════════════════
// Sonde C-57 — cibles tactiles sous 44 x 44 px (WCAG 2.5.5)
// ═══════════════════════════════════════════════════════════════════
//
// Compte les VRAIES commandes (`button`, `[role=button]`,
// `input[type=checkbox]`) dont la zone tactile est sous la cible, en viewport
// 375 x 812, mode demo.
//
// ⚠️ On ne compte JAMAIS les liens de texte : ils relevent de l'exception
// « inline » de WCAG 2.5.5, et les inclure gonflerait le chiffre sans decrire
// un defaut.
//
// ⚠️ Mesure en viewport EMULE, pas sur un appareil : la taille en pixels CSS
// est la meme, mais le taux de ratage reel ne se mesure qu'avec un doigt.
//
// 🔴 CECI EST UNE SONDE, PAS UNE GARDE. Elle IMPRIME un etat, elle ne fait
// echouer aucune CI. La garde, c'est `e2e/touch-targets.spec.ts`, qui
// assertionne. Confondre les deux mene a croire qu'un `exit 0` vaut « rien
// sous la cible » — c'est le motif que ce depot a retire d'`uptime.yml` et de
// `renewal-notice.yml`. Elle sort donc 1 si elle TROUVE quelque chose, pour
// qu'un enchainement de commandes ne la lise pas a l'envers.
//
// Necessite un serveur de dev. `BASE=<url> node scripts/_c57-probe.mjs`.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5287';
const ROUTES = (process.env.ROUTES ?? '/dashboard,/entreprise,/okr,/tasks,/habits,/settings').split(',');
const TARGET = 44;

/**
 * Message lisible quand le serveur de dev n'est pas la.
 *
 * ⚠️ Sans ca, la sonde vomit une trace Playwright de trente lignes ou la seule
 * information utile — « rien n'ecoute sur ce port » — est noyee.
 */
function expliqueEtSors(err) {
  const msg = String(err && err.message ? err.message : err);
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|net::ERR/.test(msg)) {
    console.error(`Aucun serveur sur ${BASE}.`);
    console.error('Demarrer le serveur de dev avant, ou passer BASE=<url>.');
  } else {
    console.error(msg);
  }
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(expliqueEtSors);

// La banniere cookies est `fixed` en bas et intercepte les clics sur un
// viewport de telephone. On tranche le consentement AVANT de mesurer — sans
// quoi la sonde mesure une page ou un voile couvre les commandes.
await page.evaluate(() => {
  try {
    // Valeur exacte du module : 'accepted' | 'refused', pas un objet.
    localStorage.setItem('cosmo_cookie_consent', 'refused');
  } catch { /* stockage indisponible : la banniere sera fermee au clic */ }
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /d[ée]mo/i }).first().click();
await page.waitForURL(/dashboard/, { timeout: 20000 });
await page.waitForTimeout(1500);

const rows = [];
for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const result = await page.evaluate((target) => {
    const controls = [...document.querySelectorAll(
      'button, [role="button"], input[type="checkbox"]',
    )];
    const under = [];
    let total = 0;
    /**
     * Exception « inline » de WCAG 2.5.5 : une cible prise DANS une phrase,
     * dont la taille est contrainte par l'interligne du texte autour. Le
     * bouton « Creez un compte » de `DemoConversionBanner` est exactement ca —
     * il vit au milieu d'un `<p>`. Le compter gonflerait le chiffre sans
     * decrire un defaut, et la regle serait alors « mettre des boutons de
     * 44 px au milieu des phrases », ce qui casserait la lecture.
     */
    const isInline = (el) => {
      const parent = el.parentElement;
      if (!parent) return false;
      if (!['P', 'SPAN', 'LABEL', 'LI', 'TD'].includes(parent.tagName)) return false;
      // Du texte frere, hors de la cible : c'est ce qui en fait une incise.
      return [...parent.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      );
    };

    for (const el of controls) {
      const r = el.getBoundingClientRect();
      // Elements non rendus : ni un defaut, ni une cible.
      if (r.width === 0 || r.height === 0) continue;
      if (isInline(el)) continue;
      total++;
      if (r.width < target || r.height < target) {
        under.push({
          w: Math.round(r.width),
          h: Math.round(r.height),
          name:
            el.getAttribute('aria-label')
            ?? (el.textContent ?? '').trim().slice(0, 40)
            ?? el.tagName,
        });
      }
    }
    return { total, under };
  }, TARGET);

  rows.push({ route, ...result });
  console.log(
    `${route.padEnd(14)} sous la cible: ${String(result.under.length).padStart(3)} / ${String(result.total).padStart(3)}`,
  );
  const sizes = new Map();
  for (const u of result.under) {
    const key = `${u.w}x${u.h}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  for (const [size, n] of [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    const sample = result.under.find((u) => `${u.w}x${u.h}` === size);
    console.log(`   ${size.padEnd(9)} x${String(n).padStart(3)}   « ${sample.name} »`);
  }
}

const totalUnder = rows.reduce((n, r) => n + r.under.length, 0);
console.log(`\nTOTAL sous la cible : ${totalUnder}`);
await browser.close();
// Sortie PARLANTE : 0 seulement si la mesure est a zero.
process.exit(totalUnder === 0 ? 0 : 1);
