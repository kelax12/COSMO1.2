#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Pourquoi la meme URL rend deux mesures — sonde de discrimination (C-68).
//
// `landing-motion-probe.mjs` SOMME les taches longues au repos. Il a rendu,
// sur `/entreprise-presentation` et sur le meme build, soit ~0 ms soit
// ~3 000 ms. Une somme ne dit pas QUELLE branche le chargement a prise :
// cette sonde-la enregistre, pour chaque passe, une SIGNATURE de la page
// (contexte WebGL obtenu ou non, backend GL, images decodees, rAF servies)
// PUIS une trace CDP de la meme fenetre au repos, ventilee par categorie
// en temps PROPRE (dur moins les enfants), sur le fil principal du rendu.
//
// CE QU'ELLE A TROUVE, le 2026-09-05, et qui a nomme C-68 :
//   - le fil principal ne fait PAS tourner du JavaScript, il ATTEND. Le poste
//     de tete du temps propre est `CommandBufferProxyImpl::WaitForGetOffset`
//     (2 300 a 4 500 ms sur une fenetre de 4 000), c'est-a-dire le blocage
//     synchrone du renderer sur un tampon de commandes plein, pendant que le
//     processus GPU passe le meme temps dans `CommandBufferService:PutChanged`
//     a executer le shader. C'est pour ca que neutraliser les flous, les
//     ScrollTrigger ou les tweens ne deplacait pas la mesure : ce n'etait pas
//     nous qui tournions ;
//   - la BIMODALITE de l'audit A-8 n'etait PAS une propriete de la page. En
//     28 passes de reference, zero passe basse. Elle se reproduit exactement
//     quand on MASQUE le canvas (0, 0, 111 ms) : cacher le canvas demande a
//     l'IntersectionObserver, donc a un rendu React, donc a un effet de
//     nettoyage, de gagner une course contre l'embouteillage qu'il est cense
//     defaire. Quand il la gagne, 0 ms ; quand il la perd, la boucle continue
//     et on relit 3 000 ms. La conclusion « le shader est un suspect » venait
//     de la, et le suspect etait le bon pour la mauvaise raison ;
//   - une file qui sature n'a pas un cout progressif : elle draine ou elle ne
//     draine pas. A 0,46 Mpx par frame la mesure est elle-meme bistable
//     (0 puis 3 486 ms), a 0,90 Mpx elle est haute a tous les coups.
//
// Le champ `tampon` de la sortie dit la taille reelle du tampon de dessin :
// c'est lui qui prouve que l'echelle adaptative de `LightRays` s'est engagee,
// et c'est le seul champ qui separait, passe par passe, une mesure a 0 ms
// d'une mesure a 3 665 ms sur le meme build.
//
// USAGE
//   node scripts/landing-bimodal-probe.mjs --url http://localhost:4399/entreprise-presentation --passes 6
//   --brut    ne pas attendre `networkidle` (fenetre calee sur `load`, comme
//             `landing-motion-probe.mjs` ; sert a mesurer la queue de
//             chargement plutot que le regime etabli)
//   --repos N attente supplementaire avant la fenetre (defaut 2500 ms)
// ═══════════════════════════════════════════════════════════════════
import { chromium } from 'playwright';

const flag = (n) => process.argv.includes(`--${n}`);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const URL_CIBLE = arg('url', 'http://localhost:4399/entreprise-presentation');
const FENETRE = Number(arg('fenetre', 4000));
const PASSES = Number(arg('passes', 6));
const [W, H] = (arg('viewport', '1350x940')).split('x').map(Number);

const INIT = () => {
  window.__sig = { getContext: [], raf: 0, glRenderer: null, glVendor: null, erreurs: [] };
  window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ s: e.startTime, d: e.duration }); })
    .observe({ type: 'longtask' });
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    let ctx = null; let jete = null;
    try { ctx = gc.call(this, type, ...rest); } catch (e) { jete = String(e); }
    window.__sig.getContext.push({ type, obtenu: !!ctx, jete });
    if (ctx && /webgl/.test(type) && !window.__sig.glRenderer) {
      try {
        const d = ctx.getExtension('WEBGL_debug_renderer_info');
        window.__sig.glRenderer = d ? ctx.getParameter(d.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER);
        window.__sig.glVendor = d ? ctx.getParameter(d.UNMASKED_VENDOR_WEBGL) : ctx.getParameter(ctx.VENDOR);
      } catch (e) { window.__sig.erreurs.push(String(e)); }
    }
    return ctx;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__sig.raf += 1; return cb(t); });
  window.addEventListener('error', (e) => window.__sig.erreurs.push(String(e.message)));
};

/** Temps PROPRE par nom d'evenement sur le fil principal du rendu. */
function ventile(evts) {
  const parNom = new Map();
  const fils = new Map();
  for (const e of evts) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    const k = `${e.pid}/${e.tid}`;
    if (!fils.has(k)) fils.set(k, []);
    fils.get(k).push(e);
  }
  for (const [, liste] of fils) {
    liste.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const pile = [];
    for (const e of liste) {
      while (pile.length && pile[pile.length - 1].ts + pile[pile.length - 1].dur <= e.ts) pile.pop();
      if (pile.length) pile[pile.length - 1].enfants += e.dur;
      pile.push({ ...e, enfants: 0, ref: e });
      e.__n = pile[pile.length - 1];
    }
    for (const e of liste) {
      const propre = Math.max(0, e.dur - (e.__n ? e.__n.enfants : 0));
      parNom.set(e.name, (parNom.get(e.name) || 0) + propre);
    }
  }
  return parNom;
}

const browser = await chromium.launch({ headless: true });
const lignes = [];

for (let p = 0; p < PASSES; p += 1) {
  const page = await browser.newPage({ reducedMotion: 'no-preference', viewport: { width: W, height: H } });
  await page.addInitScript(INIT);
  const cdp = await page.context().newCDPSession(page);
  await page.goto(URL_CIBLE, { waitUntil: 'load' });
  // « Au repos » veut dire APRES le chargement, pas 1,8 s apres `load` : la
  // queue de chargement de cette page (decodage des captures, raster) deborde
  // sinon dans la fenetre et se fait compter comme du travail au repos.
  if (!flag('brut')) await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(Number(arg('repos', 2500)));

  const evts = [];
  cdp.on('Tracing.dataCollected', (d) => { evts.push(...d.value); });
  const fini = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', {
    traceConfig: {
      includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline',
        'blink.user_timing', 'v8.execute', 'gpu', 'toplevel'],
    },
    transferMode: 'ReportEvents',
  });
  const rafAvant = await page.evaluate(() => window.__sig.raf);
  const debut = await page.evaluate(() => performance.now());
  await page.waitForTimeout(FENETRE);
  const bloc = await page.evaluate((d) => Math.round(
    window.__lt.filter((t) => t.s >= d).reduce((s, t) => s + t.d, 0)), debut);
  const sig = await page.evaluate(() => ({
    ...window.__sig,
    canvas: document.querySelectorAll('canvas').length,
    tampon: (() => { const c = document.querySelector('canvas');
      return c ? `${c.width}x${c.height} pour ${c.clientWidth}x${c.clientHeight} CSS` : '-'; })(),
    anims: document.getAnimations().length,
  }));
  await cdp.send('Tracing.end');
  await fini;

  const parNom = ventile(evts);
  const top = [...parNom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([n, us]) => `${n} ${Math.round(us / 1000)}`);
  lignes.push({ p: p + 1, bloc, sig, rafs: sig.raf - rafAvant, top });
  await page.close();
}
await browser.close();

console.log(`\n${URL_CIBLE}  fenetre AU REPOS ${FENETRE} ms x ${PASSES} passes\n`);
for (const l of lignes) {
  const gl = l.sig.getContext.filter((c) => /webgl/.test(c.type));
  console.log(`passe ${l.p} : ${String(l.bloc).padStart(5)} ms bloques | canvas ${l.sig.canvas} | getContext webgl ${gl.length} obtenus ${gl.filter((c) => c.obtenu).length}`
    + ` | tampon ${l.sig.tampon} | rAF servies ${l.rafs} | anims ${l.sig.anims}`);
  console.log(`          temps propre (ms) : ${l.top.join(' · ')}`);
  if (l.sig.erreurs.length) console.log(`          erreurs : ${l.sig.erreurs.slice(0, 3).join(' | ')}`);
}
console.log('');
