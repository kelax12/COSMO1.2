// ═══════════════════════════════════════════════════════════════════
// captures-revue.mjs · l'artefact de revue des références visuelles (V15.4)
//
// Joué par `.github/workflows/captures-regenerer.yml` APRÈS la régénération.
// Compare deux dossiers de PNG (`--avant` : les références de `main`, copiées
// avant `--update-snapshots` ; `--apres` : celles que le runner vient
// d'écrire) et écrit dans `--sortie` :
//
//   avant/<chemin>.png   la référence de `main` (modifiées et supprimées)
//   apres/<chemin>.png   la nouvelle référence (modifiées et ajoutées)
//   diff/<chemin>.png    les pixels qui changent, en rouge sur l'ancienne image
//   index.html           une page lisible d'un coup d'oeil, sans réseau ni script
//   resume.json          le même verdict, pour une machine
//
// ⚠️ La lecture reste humaine : ce script ne juge PAS qu'un changement est
// voulu. Il met la différence sous les yeux. Deux images de tailles différentes
// n'ont pas de diff pixel à pixel : elles sont signalées telles quelles.
//
// PNG vient de `playwright-core/lib/utilsBundle` (déjà installé, c'est le
// décodeur de Playwright) : aucune dépendance ajoutée. Chemin interne : s'il
// disparaît, l'import échoue bruyamment et le workflow rougit.
// Témoin : `scripts/captures-revue.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

/** Tous les `.png` d'un dossier, chemins relatifs en `/`, triés. */
export function listerPng(dossier) {
  if (!existsSync(dossier)) return [];
  const sortie = [];
  const marcher = (rel) => {
    for (const nom of readdirSync(join(dossier, rel))) {
      const r = rel ? `${rel}/${nom}` : nom;
      if (statSync(join(dossier, r)).isDirectory()) marcher(r);
      else if (nom.toLowerCase().endsWith('.png')) sortie.push(r);
    }
  };
  marcher('');
  return sortie.sort();
}

/**
 * Compare deux PNG décodés. Seuil 0 : tout pixel qui diffère compte, la
 * tolérance de la garde (`maxDiffPixelRatio`) n'est pas celle d'une revue.
 * @returns {{ memeTaille: boolean, pixels: number, total: number, image: PNG | null }}
 */
export function comparer(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    return { memeTaille: false, pixels: -1, total: Math.max(a.width * a.height, b.width * b.height), image: null };
  }
  const image = new PNG({ width: a.width, height: a.height });
  let pixels = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const egal = a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1]
      && a.data[i + 2] === b.data[i + 2] && a.data[i + 3] === b.data[i + 3];
    if (egal) {
      // L'ancienne image, éteinte, pour situer ce qui change.
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(a.data[i] * 0.25 + 191);
      image.data[i + 3] = 255;
    } else {
      pixels += 1;
      image.data[i] = 255; image.data[i + 1] = 0; image.data[i + 2] = 0; image.data[i + 3] = 255;
    }
  }
  return { memeTaille: true, pixels, total: a.width * a.height, image };
}

const echapper = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** La page d'index : un bloc par capture modifiée, ajoutée ou supprimée. */
export function pageIndex(resume, { titre = 'Revue des captures' } = {}) {
  const { entrees, compte } = resume;
  const badge = { modifiee: 'MODIFIÉE', ajoutee: 'AJOUTÉE', supprimee: 'SUPPRIMÉE', identique: 'identique' };
  const blocs = entrees.filter((e) => e.etat !== 'identique').map((e) => {
    const img = (dossier, legende) => `<figure><figcaption>${legende}</figcaption><a href="${dossier}/${encodeURI(e.chemin)}"><img src="${dossier}/${encodeURI(e.chemin)}" loading="lazy" alt="${echapper(legende + ' ' + e.chemin)}"></a></figure>`;
    const cases = [];
    if (e.etat === 'modifiee' || e.etat === 'supprimee') cases.push(img('avant', 'Avant (main)'));
    if (e.etat === 'modifiee' || e.etat === 'ajoutee') cases.push(img('apres', 'Après'));
    if (e.etat === 'modifiee' && e.diff) cases.push(img('diff', 'Différence'));
    const detail = e.etat !== 'modifiee' ? ''
      : e.memeTaille
        ? `${e.pixels} pixel(s) sur ${e.total} (${(e.ratio * 100).toFixed(3)} %)`
        : `dimensions différentes : ${e.dimAvant} puis ${e.dimApres} ; pas de différence pixel à pixel`;
    return `<section id="${echapper(e.chemin)}"><h2>${echapper(e.chemin)} <span class="b ${e.etat}">${badge[e.etat]}</span></h2><p>${echapper(detail)}</p><div class="trio">${cases.join('')}</div></section>`;
  });
  const vide = blocs.length === 0 ? '<p class="ok">Aucune référence ne change : rien à relire.</p>' : '';
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)}</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#111}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 4px;word-break:break-all}
.sum{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sum span{padding:2px 10px;border-radius:99px;background:#eee}
.b{font-size:12px;padding:1px 8px;border-radius:99px;color:#fff}.modifiee{background:#c2410c}.ajoutee{background:#15803d}.supprimee{background:#b91c1c}
.trio{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}img{max-width:100%;border:1px solid #ccc;display:block}
.ok{padding:12px;background:#dcfce7;border-radius:8px}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}.sum span{background:#333}img{border-color:#555}.ok{background:#14532d}}
</style></head><body>
<h1>${echapper(titre)}</h1>
<p>Relire chaque bloc avant de ramener la branche sur <code>main</code>. Un changement non voulu est une régression à corriger dans le produit, pas une référence à entériner.</p>
<div class="sum"><span>${compte.modifiee} modifiée(s)</span><span>${compte.ajoutee} ajoutée(s)</span><span>${compte.supprimee} supprimée(s)</span><span>${compte.identique} identique(s)</span></div>
${vide}${blocs.join('\n')}
</body></html>
`;
}

/** Compare, écrit les images et la page. @returns le résumé */
export function produire({ avant, apres, sortie }) {
  const A = new Set(listerPng(avant));
  const B = new Set(listerPng(apres));
  const tous = [...new Set([...A, ...B])].sort();
  const entrees = [];
  const ecrire = (dossier, chemin, octets) => {
    const cible = join(sortie, dossier, chemin);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, octets);
  };
  for (const chemin of tous) {
    if (A.has(chemin) && !B.has(chemin)) {
      ecrire('avant', chemin, readFileSync(join(avant, chemin)));
      entrees.push({ chemin, etat: 'supprimee' });
    } else if (!A.has(chemin) && B.has(chemin)) {
      ecrire('apres', chemin, readFileSync(join(apres, chemin)));
      entrees.push({ chemin, etat: 'ajoutee' });
    } else {
      const ob = readFileSync(join(avant, chemin));
      const oa = readFileSync(join(apres, chemin));
      if (ob.equals(oa)) { entrees.push({ chemin, etat: 'identique' }); continue; }
      const pa = PNG.sync.read(ob);
      const pb = PNG.sync.read(oa);
      const c = comparer(pa, pb);
      ecrire('avant', chemin, ob);
      ecrire('apres', chemin, oa);
      if (c.image) ecrire('diff', chemin, PNG.sync.write(c.image));
      // Octets différents mais aucun pixel : métadonnées seules, signalé tel quel.
      entrees.push({
        chemin, etat: 'modifiee', memeTaille: c.memeTaille, diff: Boolean(c.image),
        pixels: c.pixels, total: c.total, ratio: c.memeTaille ? c.pixels / c.total : null,
        dimAvant: `${pa.width}x${pa.height}`, dimApres: `${pb.width}x${pb.height}`,
      });
    }
  }
  const compte = { modifiee: 0, ajoutee: 0, supprimee: 0, identique: 0 };
  for (const e of entrees) compte[e.etat] += 1;
  const resume = { compte, entrees };
  mkdirSync(sortie, { recursive: true });
  writeFileSync(join(sortie, 'resume.json'), JSON.stringify(resume, null, 2));
  writeFileSync(join(sortie, 'index.html'), pageIndex(resume));
  return resume;
}

function arg(argv, nom) {
  const i = argv.indexOf(nom);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function run({ argv = process.argv.slice(2), log = console.log, erreur = console.error } = {}) {
  const avant = arg(argv, '--avant');
  const apres = arg(argv, '--apres');
  const sortie = arg(argv, '--sortie');
  if (!avant || !apres || !sortie) {
    erreur('usage : captures-revue.mjs --avant <dossier> --apres <dossier> --sortie <dossier>');
    return 1;
  }
  // Rien à comparer des DEUX côtés = la régénération n'a rien écrit : un
  // artefact « aucune différence » serait un vert muet.
  if (listerPng(apres).length === 0) {
    erreur(`aucun PNG dans ${apres} : la régénération n'a rien produit`);
    return 1;
  }
  const { compte } = produire({ avant, apres, sortie });
  log(`captures · ${compte.modifiee} modifiée(s), ${compte.ajoutee} ajoutée(s), ${compte.supprimee} supprimée(s), ${compte.identique} identique(s)`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(run());
}
