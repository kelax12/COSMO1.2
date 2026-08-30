#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Profil du fil principal d'une page du site, CPU bridé.
//
// POURQUOI CET OUTIL. Le job `lighthouse` de la CI rend un SCORE. Un score
// dit qu'une page est lente, jamais ce qui la ralentit, et il arrive après
// le push. T-51 demandait la réponse à « qu'est-ce qui bloque », et la seule
// façon honnête de l'obtenir est d'échantillonner le fil principal.
//
// CE QU'IL MESURE, et pourquoi ce sont ces trois-là :
//   • TBT  — la somme de ce qui dépasse 50 ms dans chaque tâche longue.
//            C'est la métrique que Lighthouse pénalise le plus lourdement.
//   • la plus longue tâche — un TBT identique se répartit très différemment
//            entre « cent tâches de 60 ms » et « une tâche de 3 s ».
//   • le temps CPU par FICHIER — INDICATIF, et il faut savoir pourquoi :
//     l'échantillonnage attribue à la frame du dessus, donc le style et le
//     layout déclenchés par une animation rAF tombent sous le fichier de la
//     bibliothèque d'animation. Le 2026-08-30 cette sortie a désigné GSAP à
//     4 078 ms là où Lighthouse ne lui attribue que 226 ms de bootup. À lire
//     comme « où le fil passe son temps », jamais comme « qui est coupable ».
//
// 🟢 POUR UNE ATTRIBUTION QUI FAIT FOI : installer Lighthouse
// (`npm i -D lighthouse`) et relancer. Le script le détecte, le pilote sur le
// même Chromium, et ajoute son propre découpage (bootup par script, travail du
// fil principal par catégorie). C'est cette sortie-là qui doit décider d'un
// correctif — elle mesure ce que la CI mesure.
//
// 🔴 UNE MESURE UNIQUE NE PROUVE RIEN. Sur cette machine, deux exécutions
// consécutives de la même page ont rendu 5 372 ms et 3 087 ms de TBT. L'outil
// impose donc plusieurs passes et rend la MÉDIANE ; et une comparaison
// avant/après doit garder le même nombre de passes, la même machine, et rien
// d'autre qui tourne à côté.
//
// USAGE
//   npm run build && npm run preview -- --port 4399 --strictPort
//   node scripts/profile-landing.mjs --url http://localhost:4399/ --runs 3
//   node scripts/profile-landing.mjs --reduce      # temoin : animations coupees
//
// Options : --url, --runs (3), --throttle (4), --idle (4000 ms), --reduce,
//           --json (sortie machine).
// ═══════════════════════════════════════════════════════════════════
import { chromium } from 'playwright';

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i === -1 ? defaut : process.argv[i + 1];
};
const flag = (nom) => process.argv.includes(`--${nom}`);

const URL_CIBLE = arg('url', 'http://localhost:4399/');
const RUNS = Number(arg('runs', 3));
const THROTTLE = Number(arg('throttle', 4));
const IDLE = Number(arg('idle', 4000));
const REDUCE = flag('reduce');

const mediane = (xs) => {
  const t = [...xs].sort((a, b) => a - b);
  return t.length % 2 ? t[(t.length - 1) / 2] : Math.round((t[t.length / 2 - 1] + t[t.length / 2]) / 2);
};

/** Une passe : charge la page, échantillonne le fil principal, rend les métriques. */
async function passe(browser) {
  const page = await browser.newPage(REDUCE ? { reducedMotion: 'reduce' } : {});
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });

  // Observateur posé AVANT la navigation : une tâche longue qui précède
  // l'installation de l'observateur n'est jamais comptée.
  await page.addInitScript(() => {
    window.__lt = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  });

  await cdp.send('Profiler.start');
  await page.goto(URL_CIBLE, { waitUntil: 'load' });
  await page.waitForTimeout(IDLE);
  const { profile } = await cdp.send('Profiler.stop');

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const lt = window.__lt ?? [];
    return {
      load: Math.round(nav.loadEventEnd),
      tbt: Math.round(lt.reduce((s, t) => s + Math.max(0, t.dur - 50), 0)),
      taches: lt.length,
      plusLongue: Math.round(lt.reduce((max, t) => Math.max(max, t.dur), 0)),
    };
  });

  // Temps CPU par fichier : un échantillon = `interval` microsecondes passées
  // dans cette frame. On agrège par fichier, le hash du build retiré pour que
  // deux builds se comparent.
  const noeuds = new Map(profile.nodes.map((n) => [n.id, n]));
  const cout = new Map();
  const dureeMs = (profile.endTime - profile.startTime) / 1000;
  for (const id of profile.samples) {
    const n = noeuds.get(id);
    if (!n) continue;
    const url = n.callFrame.url || '(moteur)';
    const f = url.split('/').pop().replace(/-[A-Za-z0-9_-]{8}\./, '.') || url;
    cout.set(f, (cout.get(f) ?? 0) + 1);
  }
  const parFichier = new Map();
  for (const [f, n] of cout) parFichier.set(f, Math.round((n / profile.samples.length) * dureeMs));

  await page.close();
  return { ...m, parFichier };
}

// Lighthouse, si le module est installe. `chrome-launcher` ne peut pas
// spawner de binaire dans certains environnements : on lui donne un Chromium
// deja lance par Playwright et son port de debogage.
async function auditLighthouse() {
  let lighthouse;
  try {
    ({ default: lighthouse } = await import('lighthouse'));
  } catch {
    return null;
  }
  const nav = await chromium.launch({ headless: true, args: ['--remote-debugging-port=9222'] });
  try {
    const r = await lighthouse(URL_CIBLE, { port: 9222, output: 'json', logLevel: 'error', preset: 'desktop' });
    const a = r.lhr.audits;
    return {
      score: Math.round(r.lhr.categories.performance.score * 100),
      fcp: a['first-contentful-paint'].displayValue,
      lcp: a['largest-contentful-paint'].displayValue,
      tbt: a['total-blocking-time'].displayValue,
      cls: a['cumulative-layout-shift'].displayValue,
      tti: a.interactive?.displayValue,
      bootup: (a['bootup-time'].details.items ?? []).slice(0, 8).map((i) => ({
        fichier: String(i.url).split('/').pop().replace(/-[A-Za-z0-9_-]{8}\./, '.') || '(document)',
        total: Math.round(i.total),
        script: Math.round(i.scripting),
      })),
      filPrincipal: (a['mainthread-work-breakdown'].details.items ?? []).map((i) => ({
        categorie: i.groupLabel,
        ms: Math.round(i.duration),
      })),
    };
  } finally {
    await nav.close();
  }
}

const lh = await auditLighthouse();

const browser = await chromium.launch({ headless: true });
const passes = [];
for (let i = 0; i < RUNS; i += 1) passes.push(await passe(browser));
await browser.close();

const fichiers = new Map();
for (const p of passes) {
  for (const [f, ms] of p.parFichier) {
    if (!fichiers.has(f)) fichiers.set(f, []);
    fichiers.get(f).push(ms);
  }
}
const cpu = [...fichiers.entries()]
  .map(([fichier, ms]) => ({ fichier, ms: mediane(ms) }))
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 12);

const resultat = {
  url: URL_CIBLE,
  runs: RUNS,
  throttle: `${THROTTLE}x`,
  mouvement: REDUCE ? 'reduce (temoin)' : 'no-preference',
  tbt_ms: mediane(passes.map((p) => p.tbt)),
  tbt_runs: passes.map((p) => p.tbt),
  plus_longue_ms: mediane(passes.map((p) => p.plusLongue)),
  taches_longues: mediane(passes.map((p) => p.taches)),
  load_ms: mediane(passes.map((p) => p.load)),
  cpu,
  lighthouse: lh,
};

if (flag('json')) {
  console.log(JSON.stringify(resultat, null, 2));
} else {
  console.log(`\n${resultat.url}  ·  ${RUNS} passes  ·  CPU ${resultat.throttle}  ·  ${resultat.mouvement}\n`);
  console.log(`  TBT median          ${resultat.tbt_ms} ms   (passes : ${resultat.tbt_runs.join(', ')})`);
  console.log(`  Plus longue tache   ${resultat.plus_longue_ms} ms`);
  console.log(`  Taches longues      ${resultat.taches_longues}`);
  console.log(`  load                ${resultat.load_ms} ms\n`);
  console.log('  Temps CPU par fichier (mediane des passes) : INDICATIF, cf. en-tete');
  for (const r of cpu) console.log(`    ${String(r.ms).padStart(6)} ms   ${r.fichier}`);
  console.log('');
  if (lh) {
    console.log(`  -- Lighthouse (desktop) -- score ${lh.score}`);
    console.log(`     FCP ${lh.fcp} - LCP ${lh.lcp} - TBT ${lh.tbt} - CLS ${lh.cls} - TTI ${lh.tti}`);
    console.log('');
    console.log('     Bootup par script (total / dont script)');
    for (const b of lh.bootup) console.log(`       ${String(b.total).padStart(5)} ms / ${String(b.script).padStart(5)} ms   ${b.fichier}`);
    console.log('');
    console.log('     Fil principal par categorie');
    for (const c of lh.filPrincipal) console.log(`       ${String(c.ms).padStart(5)} ms   ${c.categorie}`);
  } else {
    console.log('  (lighthouse non installe : npm i -D lighthouse pour lattribution qui fait foi)');
  }
  console.log('');
}
