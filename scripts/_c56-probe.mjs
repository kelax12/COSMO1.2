// ═══════════════════════════════════════════════════════════════════
// Sonde C-56 — `items-center` + `overflow-y-auto` sur le MEME element
// ═══════════════════════════════════════════════════════════════════
//
// Mesure le HAUT d'une carte plus haute que son conteneur, dans les trois
// dispositions possibles, a 375 x 350 px — la hauteur que prend le viewport de
// mise en page d'un telephone Android quand le clavier est ouvert.
//
// 🔴 AUTONOME, et ca n'a pas toujours ete le cas. La premiere version lisait un
// fichier HTML pose dans un repertoire de travail temporaire, propre a la
// session qui l'avait ecrite : une fois committee, elle ne pouvait plus
// tourner nulle part. Une sonde versionnee qui ne s'execute pas est un
// artefact mort — elle a l'air d'etre une preuve rejouable et n'en est pas
// une. Le harnais est donc ECRIT ICI, en dur.
//
// Usage : `node scripts/_c56-probe.mjs`
//
// Resultat attendu (mesure du 2026-09-04) :
//   items-center + overflow-y-auto        course  72 px, haut a -55,8 px  ← CASSE
//   ... + `my-auto` sur l enfant          course 144 px, haut a +16 px
//   scroll dehors + `min-h-full` dedans   course 144 px, haut a +16 px
//
// Le defilement ELOIGNE encore le haut dans le premier cas (-127,8 px a course
// pleine) : ce n'est pas « il faut remonter », c'est inatteignable.
import { chromium } from 'playwright';

const HARNESS = `
<style>
  *{box-sizing:border-box;margin:0}
  .stage{position:relative;width:375px;height:350px;overflow:hidden;border:2px solid #333;margin:8px}
  /* Le piege : centrage vertical ET defilement portes par le MEME element. */
  .pane{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:1rem}
  /* La sortie n°1 : une marge automatique sur l enfant centre. */
  .myauto{margin-top:auto;margin-bottom:auto}
  /* La sortie n°2 : le scroll dehors, le centrage dans un enfant min-h-full. */
  .outer{position:absolute;inset:0;overflow-y:auto}
  .inner{display:flex;min-height:100%;align-items:center;justify-content:center;padding:1rem}
  .card{width:100%;max-width:32rem;height:457.6px;background:#fff;border:1px solid #999}
</style>
<div class="stage"><div class="pane" id="p1"><div class="card" id="c1"></div></div></div>
<div class="stage"><div class="pane" id="p2"><div class="card myauto" id="c2"></div></div></div>
<div class="stage"><div class="outer" id="p3"><div class="inner"><div class="card" id="c3"></div></div></div></div>
<script>
  function probe(scroller, card, label) {
    scroller.scrollTop = 0;
    const top0 = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop = 99999;
    const topMax = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop = 0;
    return {
      label,
      course: scroller.scrollHeight - scroller.clientHeight,
      hautAScrollZero: Math.round(top0 * 10) / 10,
      hautAScrollMax: Math.round(topMax * 10) / 10,
      hautAtteignable: top0 >= -0.5,
    };
  }
  window.__c56 = [
    probe(p1, c1, 'items-center + overflow-y-auto'),
    probe(p2, c2, '... + my-auto sur l enfant'),
    probe(p3, c3, 'scroll dehors + min-h-full dedans'),
  ];
</script>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 1200 } });
await page.setContent(HARNESS);
for (const r of await page.evaluate(() => window.__c56)) {
  console.log(
    `${r.label.padEnd(36)} course=${String(r.course).padStart(4)} px  ` +
      `haut=${String(r.hautAScrollZero).padStart(7)} px  ` +
      (r.hautAtteignable ? 'ATTEIGNABLE' : 'INATTEIGNABLE'),
  );
}
await browser.close();
