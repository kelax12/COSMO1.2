#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Ce qu'une page coute AU REPOS — harnais de l'audit A-8.
//
// POURQUOI CET OUTIL, alors que `profile:landing` existe deja. Ce dernier
// mesure une page pendant qu'elle CHARGE, et attribue le temps par fichier.
// Or l'attribution par echantillonnage met le style et le paint declenches
// par une animation sous le fichier de la BIBLIOTHEQUE d'animation : son
// propre en-tete le dit. C'est ce qui a fait designer GSAP puis
// `vendor-animation` comme coupables de la lenteur de la landing, alors que
// couper la totalite des ScrollTrigger et des tweens infinis ne change RIEN.
//
// Ici on ne demande pas « qui execute », on demande « que coute cette page
// quand il ne se passe rien » : apres le chargement, sans scroll et sans clic,
// on somme les taches longues qui COMMENCENT dans une fenetre au repos. Une
// page tranquille rend 0. Mesure le 2026-09-03 sur le build de prod :
// `/guide` rend 0 ms, `/` en rend 2 893 sur 4 000.
//
// Puis on neutralise une famille d'effets par une FEUILLE DE STYLE globale et
// on remesure. Deux pieges, tous deux rencontres le 2026-09-03 :
//   - muter `el.style` ne tient pas : React reecrit la prop `style` a chaque
//     rendu, et cette page en declenche un toutes les 2,5 s ;
//   - marquer les noeuds par un attribut ne tient pas non plus : la rotation
//     de la fenetre produit REMONTE des sous-arbres entiers, et les noeuds
//     neufs n'ont pas la marque. Seule une regle `*` survit aux deux.
//
// DEUX TEMOINS, sans lesquels aucune conclusion n'est publiable :
//   - une regle CSS SANS EFFET doit laisser la mesure inchangee (sinon c'est
//     l'injection elle-meme qu'on mesure) ;
//   - l'inventaire structurel doit CHANGER entre `no-preference` et `reduce`
//     (sinon le detecteur ne regarde pas les animations).
//
// USAGE
//   node scripts/landing-motion-probe.mjs --url http://localhost:4399/
//   node scripts/landing-motion-probe.mjs --url http://localhost:5287/ --inventaire
//     (--inventaire exige un serveur de DEV : window.__ST/__gsap n'existent
//      que la, cf. src/lib/gsap.ts)
//
// ATTENTION : ce Chromium rasterise en LOGICIEL (SwiftShader), comme le
// runner de CI. C'est la bonne condition pour expliquer un score Lighthouse,
// pas pour predire ce que ressent un poste de bureau equipe d'un GPU.
// ═══════════════════════════════════════════════════════════════════
import { chromium } from 'playwright';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const flag = (n) => process.argv.includes(`--${n}`);

const URL_CIBLE = arg('url', 'http://localhost:4399/');
const FENETRE = Number(arg('fenetre', 4000));
const PASSES = Number(arg('passes', 3));
const [W, H] = (arg('viewport', '1350x940')).split('x').map(Number);

const mediane = (xs) => { const t = [...xs].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };

const feuille = (regle) => `() => { const s = document.createElement('style');
  s.textContent = ${JSON.stringify(regle)}; document.head.appendChild(s); }`;

const SCENARIOS = {
  'baseline': '() => {}',
  'sans aucun filter: blur': feuille('*{filter:none !important}'),
  'sans aucun backdrop-filter': feuille('*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'),
  'TEMOIN : regle CSS sans effet': feuille('*{outline-color:transparent}'),
};

/** Somme des taches longues qui commencent dans la fenetre au repos. */
async function auRepos(browser, source) {
  const ms = [];
  for (let p = 0; p < PASSES; p += 1) {
    const page = await browser.newPage({ reducedMotion: 'no-preference', viewport: { width: W, height: H } });
    await page.addInitScript(() => {
      window.__lt = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ s: e.startTime, d: e.duration }); })
        .observe({ type: 'longtask' });
    });
    await page.goto(URL_CIBLE, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    await page.evaluate(`(${source})()`);
    const debut = await page.evaluate(() => performance.now());
    await page.waitForTimeout(FENETRE);
    ms.push(await page.evaluate((d) => Math.round(
      window.__lt.filter((t) => t.s >= d).reduce((s, t) => s + t.d, 0)), debut));
    await page.close();
  }
  return { ms: mediane(ms), passes: ms };
}

/** Inventaire structurel : combien d'animations cette page monte reellement. */
async function inventaire(browser, reduce) {
  const page = await browser.newPage({
    reducedMotion: reduce ? 'reduce' : 'no-preference',
    viewport: { width: W, height: H },
  });
  await page.goto(URL_CIBLE, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const inv = await page.evaluate(() => {
    const ST = window.__ST; const g = window.__gsap;
    if (!ST || !g) return { erreur: 'window.__ST / __gsap absents : serveur de DEV requis pour --inventaire' };
    const tweens = g.globalTimeline.getChildren(true, true, false);
    const flous = [...document.querySelectorAll('*')].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.filter.includes('blur') || cs.backdropFilter.includes('blur');
    });
    const aire = flous.reduce((s, el) => {
      const b = el.getBoundingClientRect();
      return b.bottom > 0 && b.top < innerHeight ? s + (b.width * b.height) / 1e6 : s;
    }, 0);
    return {
      scrollTriggers: ST.getAll().length,
      tweens: tweens.length,
      infinis: tweens.filter((t) => t.repeat && t.repeat() === -1).length,
      waapi: document.getAnimations().length,
      flous: flous.length,
      aireFlouePremierEcran: +aire.toFixed(2),
    };
  });
  await page.close();
  if (inv.erreur) throw new Error(inv.erreur);
  return inv;
}

const browser = await chromium.launch({ headless: true });

let inv = null;
if (flag('inventaire')) {
  const libre = await inventaire(browser, false);
  const temoin = await inventaire(browser, true);
  inv = { libre, temoin };
}

const resultats = [];
for (const [nom, src] of Object.entries(SCENARIOS)) resultats.push({ nom, ...(await auRepos(browser, src)) });
await browser.close();

console.log(`\n${URL_CIBLE}   viewport ${W}x${H}   fenetre AU REPOS ${FENETRE} ms x ${PASSES} passes`);
console.log('(rasterisation logicielle, comme le runner de CI - une page tranquille rend 0)\n');
for (const r of resultats) {
  console.log(`  ${String(r.ms).padStart(5)} ms bloques  (${String(Math.round((r.ms / FENETRE) * 100)).padStart(3)} %)   ${r.nom}   [passes : ${r.passes.join(', ')}]`);
}

const base = resultats[0].ms;
const temoinCss = resultats.find((r) => r.nom.startsWith('TEMOIN')).ms;
const ecartTemoin = base === 0 ? 0 : Math.abs(temoinCss - base) / Math.max(base, 1);
console.log('');
if (ecartTemoin > 0.35) {
  console.error(`TEMOIN ROUGE : la regle sans effet deplace la mesure de ${Math.round(ecartTemoin * 100)} %. `
    + 'C est l injection qu on mesure, pas les effets. Aucune conclusion.');
  process.exitCode = 1;
} else {
  console.log(`TEMOIN VERT : la regle sans effet laisse la mesure a ${Math.round(ecartTemoin * 100)} % pres.`);
}

if (inv) {
  console.log('\n  Inventaire structurel (le compte ne depend pas de la machine)');
  for (const [nom, r] of [['no-preference', inv.libre], ['reduce', inv.temoin]]) {
    console.log(`    ${nom.padEnd(15)} ScrollTrigger ${String(r.scrollTriggers).padStart(3)} - tweens ${String(r.tweens).padStart(3)} (infinis ${r.infinis})`
      + ` - WAAPI ${String(r.waapi).padStart(3)} - surfaces floutees ${String(r.flous).padStart(3)} - aire flouee visible ${r.aireFlouePremierEcran} Mpx`);
  }
  const identique = inv.libre.scrollTriggers === inv.temoin.scrollTriggers && inv.libre.infinis === inv.temoin.infinis;
  console.log(identique
    ? '\n    TEMOIN ROUGE : `reduce` rend le meme inventaire, le detecteur ne regarde pas les animations.'
    : '\n    TEMOIN VERT : `reduce` change l inventaire, le detecteur regarde bien les animations.');
  if (identique) process.exitCode = 1;
}
console.log('');
