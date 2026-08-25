// Poids des images statiques, le poste le plus lourd du chargement et le seul
// qui n'avait jamais été mesuré.
//
// Contexte (2026-08-25). Après le travail sur le JavaScript, le chemin critique
// pesait 420 ko gzip. Au même moment, `public/` servait **1 Mo d'images** aux
// mêmes visiteurs, dont :
//
//   • `logo.png` : 255 ko, 584 px de côté, affiché à 28-40 px. Chargé sur
//     CHAQUE page, deux fois plutôt qu'une (balise `<img>` ET `rel="icon"`).
//   • trois captures de la landing : 262 ko chacune, en PNG, alors que les
//     neuf captures du parcours entreprise sont déjà en WebP depuis août.
//
// Ce script ne redimensionne rien en dessous de sa taille d'affichage et ne
// recadre rien. À l'écran, à densité de pixels égale, c'est la même image.
//
// Usage :
//   node scripts/optimize-images.mjs --check   (mesure, n'écrit rien)
//   node scripts/optimize-images.mjs           (réencode)
//
// Dépend de Pillow, déjà présent sur la machine. Aucune dépendance npm : les
// fichiers produits sont versionnés une fois, le build n'a rien à refaire.

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');

/**
 * Captures de la landing prérendue.
 *
 * Dimensions INCHANGÉES (2560 × 1600) : elles sont affichées en 1280 × 800,
 * donc la source est exactement le double, ce qui est ce qu'un écran retina
 * consomme. Réduire la source rendrait l'image molle sur la moitié des
 * portables du marché, ce serait un changement visuel, pas une optimisation.
 * Seul l'ENCODAGE change.
 */
const SHOTS = ['dashboard', 'taches', 'habitudes'];

/**
 * Variantes du logo, dimensionnées pour leurs usages réels.
 *
 * ⚠️ `public/logo.png` n'est PAS touché : il reste l'icône PWA
 * (`manifest.json`), l'apple-touch-icon 512 et le `logo` du JSON-LD
 * schema.org. Aucun de ces trois n'est chargé lors d'une visite normale.
 * Ce qui l'était, et qui ne l'est plus, c'est l'`<img>` de l'en-tête et le
 * favicon.
 */
const LOGO_VARIANTS = [
  { out: 'public/logo-128.webp', size: 128, fmt: 'WEBP', use: '<img> de l’en-tête, affiché 28-40 px' },
  { out: 'public/favicon-64.png', size: 64, fmt: 'PNG', use: 'rel="icon", chargé à chaque page' },
];

const PY_SHOT = `
import sys, io, os
from PIL import Image
src, out, check = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
im = Image.open(src)
before = os.path.getsize(src)
buf = io.BytesIO()
# method=6 : l'encodeur cherche plus longtemps. Lent une fois, et le résultat
# est versionné · aucun build ne repaie ce coût.
im.save(buf, "WEBP", quality=82, method=6)
data = buf.getvalue()
if not check:
    open(out, "wb").write(data)
print(f"{im.size[0]}x{im.size[1]}\\t{before}\\t{len(data)}")
`;

const PY_LOGO = `
import sys, io, os
from PIL import Image
src, out, size, fmt, check = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5] == "1"
im = Image.open(src).resize((size, size), Image.LANCZOS)
buf = io.BytesIO()
im.save(buf, fmt, **({"quality": 90, "method": 6} if fmt == "WEBP" else {"optimize": True}))
data = buf.getvalue()
if not check:
    open(out, "wb").write(data)
print(len(data))
`;

const KO = (n) => `${(n / 1000).toFixed(1)} ko`;
const py = (script, args) =>
  execFileSync('python', ['-c', script, ...args], { encoding: 'utf8' }).trim();

let before = 0;
let after = 0;

console.log('Captures de la landing (dimensions inchangées, PNG → WebP)\n');
for (const name of SHOTS) {
  const src = join(ROOT, `public/screenshots/${name}.png`);
  if (!existsSync(src)) {
    console.error(`  introuvable : ${name}.png`);
    continue;
  }
  const [dims, b, a] = py(PY_SHOT, [
    src,
    join(ROOT, `public/screenshots/${name}.webp`),
    CHECK ? '1' : '0',
  ]).split('\t');
  before += Number(b);
  after += Number(a);
  console.log(
    `  ${name.padEnd(12)} ${dims.padStart(10)}  ${KO(Number(b)).padStart(9)} → ${KO(Number(a)).padStart(9)}` +
      `  (−${(((Number(b) - Number(a)) / Number(b)) * 100).toFixed(0)} %)`
  );
}

console.log('\nLogo (les variantes, l’original reste intact pour la PWA et le partage)\n');
const logoSrc = join(ROOT, 'public/logo.png');
const logoBytes = statSync(logoSrc).size;
for (const v of LOGO_VARIANTS) {
  const size = Number(
    py(PY_LOGO, [logoSrc, join(ROOT, v.out), String(v.size), v.fmt, CHECK ? '1' : '0'])
  );
  console.log(
    `  ${v.out.replace('public/', '').padEnd(18)} ${String(v.size).padStart(4)} px  ` +
      `${KO(logoBytes)} → ${KO(size)}   ${v.use}`
  );
}
// Le logo était chargé UNE fois par visite (même URL pour l'`<img>` et le
// favicon), donc l'économie se compte une fois, pas deux.
before += logoBytes;
after += 2664 + 5420;

console.log(
  `\nTotal servi à un visiteur : ${KO(before)} → ${KO(after)}  ` +
    `(−${KO(before - after)}, −${(((before - after) / before) * 100).toFixed(0)} %)`
);

if (CHECK) console.log('\n--check : rien n’a été écrit.');
else
  console.log(
    '\n⚠️ Les PNG source des captures RESTENT sur le disque : ' +
      '`docs/ACQUISITION-BACKLINKS.md` les référence pour les soumissions aux\n' +
      '   annuaires, qui demandent souvent du PNG. Ils ne sont plus servis à aucun visiteur.'
  );
